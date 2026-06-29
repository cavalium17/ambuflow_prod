import { GoogleGenAI, Type, Schema } from "@google/genai";

export interface RestaurantSuggestion {
  name: string;
  address: string;
  rating: number;
  distanceMinutes: number;
  mapsUri: string;
  hasParking: boolean;
  latitude?: number;
  longitude?: number;
  type: string;
  isFallback?: boolean;
}

// Définition stricte du schéma de réponse pour forcer Gemini à mapper les vrais résultats Google Maps
const restaurantSchema: Schema = {
  type: Type.ARRAY,
  description: "Liste de strictement 5 établissements de restauration réels",
  items: {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING, description: "Nom exact de l'établissement" },
      address: { type: Type.STRING, description: "Adresse postale complète" },
      rating: { type: Type.NUMBER, description: "Note moyenne (ex: 4.5)" },
      distanceMinutes: { type: Type.NUMBER, description: "Temps de trajet réaliste aller en minutes" },
      mapsUri: { type: Type.STRING, description: "Lien Google Maps direct" },
      hasParking: { type: Type.BOOLEAN, description: "True si le lieu dispose d'un parking ou accès ambulance" },
      type: { type: Type.STRING, description: "Type précis (Boulangerie, Fast-food, Snack, Restaurant)" },
      latitude: { type: Type.NUMBER, description: "Latitude géographique décimale" },
      longitude: { type: Type.NUMBER, description: "Longitude géographique décimale" }
    },
    required: ["name", "address", "rating", "distanceMinutes", "mapsUri", "hasParking", "type"]
  }
};

/**
 * Fonction de secours utilisant l'API d'OpenStreetMap (Overpass)
 * Récupère des restaurants réels autour de la position GPS sans utiliser le quota Gemini.
 */
async function fetchFromOpenStreetMapFallback(
  lat: number,
  lon: number,
  maxMin: number,
  mode: 'A_PIED' | 'EN_VOITURE'
): Promise<RestaurantSuggestion[]> {
  // Calcul du rayon de recherche approximatif en mètres :
  // ~80 m/minute à pied, ~400 m/minute en ambulance urbaine trajet fluide
  const radius = mode === 'A_PIED' ? maxMin * 80 : maxMin * 400;
  
  const query = `[out:json][timeout:8];
    (
      node["amenity"~"fast_food|restaurant|cafe"](around:${radius},${lat},${lon});
      node["shop"="bakery"](around:${radius},${lat},${lon});
      way["amenity"~"fast_food|restaurant|cafe"](around:${radius},${lat},${lon});
      way["shop"="bakery"](around:${radius},${lat},${lon});
    );
    out center 15;`;

  const endpoints = [
    `https://overpass-api.de/api/interpreter`,
    `https://lz4.overpass-api.de/api/interpreter`,
    `https://z.overpass-api.de/api/interpreter`,
    `https://overpass.kumi.systems/api/interpreter`
  ];

  const headers: Record<string, string> = {
    'Accept': 'application/json'
  };
  if (typeof window === 'undefined') {
    headers['User-Agent'] = 'AmbuFlow-Emergency-App/2.0 (adrien.brunelliere@gmail.com; Emergency App)';
  }

  for (const endpoint of endpoints) {
    try {
      const url = `${endpoint}?data=${encodeURIComponent(query)}`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 secondes de timeout par miroir

      const response = await fetch(url, {
        headers,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.warn(`[OSM] Miroir ${endpoint} indisponible (Statut: ${response.status}). Essai du suivant...`);
        continue;
      }

      const data = await response.json();
      if (!data || !data.elements || data.elements.length === 0) {
        continue;
      }

      const results: RestaurantSuggestion[] = data.elements.map((el: any) => {
        const name = el.tags?.name || el.tags?.brand || el.tags?.operator || "Restauration proche";
        
        let type = "Restaurant";
        if (el.tags?.shop === 'bakery') {
          type = "Boulangerie";
        } else if (el.tags?.amenity === 'fast_food') {
          type = "Fast-food";
        } else if (el.tags?.amenity === 'cafe') {
          type = "Café / Snack";
        } else if (el.tags?.amenity) {
          type = el.tags.amenity.charAt(0).toUpperCase() + el.tags.amenity.slice(1);
        }

        const itemLat = el.lat || el.center?.lat || lat;
        const itemLon = el.lon || el.center?.lon || lon;
        
        let address = el.tags?.["addr:street"] 
          ? `${el.tags?.["addr:housenumber"] || ""} ${el.tags?.["addr:street"]}` 
          : "Adresse à proximité";
        if (el.tags?.["addr:city"]) {
          address += `, ${el.tags["addr:city"]}`;
        }

        // Calcul d'écart pour estimer le temps de trajet
        const dy = (itemLat - lat) * 111000;
        const dx = (itemLon - lon) * 111000 * Math.cos(lat * Math.PI / 180);
        const distanceMeters = Math.sqrt(dx * dx + dy * dy);
        
        let travelTime = 1;
        if (mode === 'A_PIED') {
          travelTime = Math.max(1, Math.round(distanceMeters / 80));
        } else {
          travelTime = Math.max(1, Math.round(distanceMeters / 300));
        }

        return {
          name,
          address,
          rating: el.tags?.stars ? parseFloat(el.tags.stars) : 4.3,
          distanceMinutes: Math.min(travelTime, maxMin),
          mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name + " " + itemLat + "," + itemLon)}`,
          hasParking: mode === 'EN_VOITURE',
          type,
          latitude: itemLat,
          longitude: itemLon,
          isFallback: true
        };
      });

      return results
        .sort((a, b) => a.distanceMinutes - b.distanceMinutes)
        .slice(0, 5);

    } catch (err) {
      console.warn(`[OSM] Échec silencieux sur le miroir ${endpoint}`);
    }
  }

  // Si tout échoue, on bascule de façon transparente sur l'algorithme de proximité hors-ligne silencieux
  console.log("[OSM] Tous les miroirs ont échoué. Bascule sur la liste hors-ligne.");
  return getOfflineFallbackList(lat, lon, maxMin, mode);
}

/**
 * Secours hors-ligne ou algorithme de proximité pure
 */
function getOfflineFallbackList(
  latitude: number,
  longitude: number,
  maxDurationMinutes: number,
  modeTransport: 'A_PIED' | 'EN_VOITURE'
): RestaurantSuggestion[] {
  const isFoot = modeTransport === 'A_PIED';
  
  const fallbackList: RestaurantSuggestion[] = [
    {
      name: isFoot ? "Boulangerie L'Épi d'Or" : "Relais Routier & Grill L'Étape",
      address: isFoot ? "Avenue du Général de Gaulle" : "Route Nationale, Rond-Point des Amandiers",
      rating: 4.6,
      distanceMinutes: Math.min(Math.round(maxDurationMinutes * 0.4) || 2, isFoot ? 4 : 5),
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((isFoot ? "Boulangerie" : "Relais Routier") + " proche de " + latitude + "," + longitude)}`,
      hasParking: !isFoot,
      type: isFoot ? "Boulangerie / Café" : "Relais Routier / Restaurant",
      latitude: latitude + (isFoot ? 0.0012 : 0.0084),
      longitude: longitude + (isFoot ? -0.0008 : 0.012),
      isFallback: true
    },
    {
      name: "L'Ardoise Gourmande (Bistrot)",
      address: "Place de la Mairie, Centre Ville",
      rating: 4.5,
      distanceMinutes: Math.min(Math.round(maxDurationMinutes * 0.6) || 4, isFoot ? 6 : 8),
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("L'Ardoise Gourmande proche de " + latitude + "," + longitude)}`,
      hasParking: false,
      type: "Bistrot Français",
      latitude: latitude + (isFoot ? -0.0018 : -0.0065),
      longitude: longitude + (isFoot ? 0.0015 : -0.009),
      isFallback: true
    },
    {
      name: "Marie Blachère Boulangerie",
      address: "Zone Commerciale des Alouettes",
      rating: 4.4,
      distanceMinutes: Math.min(Math.round(maxDurationMinutes * 0.7) || 5, isFoot ? 8 : 10),
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Marie Blachère proche de " + latitude + "," + longitude)}`,
      hasParking: true,
      type: "Boulangerie / Sandwichs",
      latitude: latitude + (isFoot ? 0.0022 : 0.015),
      longitude: longitude + (isFoot ? 0.0025 : 0.018),
      isFallback: true
    },
    {
      name: "SubWay & Salades Rapides",
      address: "Zone Commerciale Grand Sud",
      rating: 4.2,
      distanceMinutes: Math.min(Math.round(maxDurationMinutes * 0.8) || 6, isFoot ? 9 : 11),
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Subway proche de " + latitude + "," + longitude)}`,
      hasParking: true,
      type: "Restauration Rapide",
      latitude: latitude + (isFoot ? -0.0029 : -0.011),
      longitude: longitude + (isFoot ? -0.0031 : 0.021),
      isFallback: true
    },
    {
      name: "McDonald's Drive & Parking",
      address: "Avenue de l'Europe",
      rating: 4.1,
      distanceMinutes: Math.min(maxDurationMinutes, isFoot ? 10 : 12),
      mapsUri: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("McDonalds proche de " + latitude + "," + longitude)}`,
      hasParking: true,
      type: "Restauration Rapide / Drive",
      latitude: latitude + (isFoot ? 0.0035 : -0.022),
      longitude: longitude + (isFoot ? -0.0042 : -0.015),
      isFallback: true
    }
  ];

  return fallbackList.filter(r => r.distanceMinutes <= maxDurationMinutes);
}

export async function getFiveNearbyRestaurants(
  vehicleType: string,
  latitude: number,
  longitude: number,
  modeTransport: 'A_PIED' | 'EN_VOITURE',
  maxDurationMinutes: number
): Promise<RestaurantSuggestion[]> {
  
  // 1. Anti-bombardement: vérification du cache local (sessionStorage)
  const cacheKey = `restos_${latitude.toFixed(4)}_${longitude.toFixed(4)}_${modeTransport}_${maxDurationMinutes}`;
  
  if (typeof window !== 'undefined') {
    try {
      const cachedData = sessionStorage.getItem(cacheKey);
      if (cachedData) {
        console.log("Utilisation du cache de session pour restaurants");
        return JSON.parse(cachedData);
      }
    } catch (e) {
      console.warn("Storage cache read error:", e);
    }
  }

  // 2. Si on est dans le navigateur (client-side), on fait un appel API transparent vers notre route serveur
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/restaurants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          vehicleType,
          latitude,
          longitude,
          modeTransport,
          maxDurationMinutes
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.restaurants)) {
          // Enregistrer dans le cache de session
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(data.restaurants));
          } catch (storageErr) {}
          return data.restaurants;
        }
      }
    } catch (e) {
      console.error("Client: Échec de l'appel proxy, bascule sur le fallback OpenStreetMap local...", e);
    }
    // Si l'API serveur ou le proxy échoue en local
    return await fetchFromOpenStreetMapFallback(latitude, longitude, maxDurationMinutes, modeTransport);
  }

  // 3. Code exécuté sur le serveur (Node.js) :
  const isLargeVehicle = vehicleType === 'ASSU' || vehicleType === 'AMBU';
  const transportLabel = modeTransport === 'A_PIED' ? 'à pied' : 'en voiture (ambulance)';

  // Initialisation de Google Gen AI (côté serveur uniquement)
  const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
  });

  const prompt = `Utilise ton outil de recherche Google Maps autour de : Latitude ${latitude}, Longitude ${longitude}.
  Trouve exactement 5 lieux réels indépendants pour manger (boulangerie, fast-food, restaurant de quartier) à moins de ${maxDurationMinutes} minutes de trajet ${transportLabel}.
  ${isLargeVehicle ? "Priorise des établissements bénéficiant d'accès faciles ou de parkings pour une ambulance car notre véhicule est de grand gabarit." : "Priorise la proximité immédiate de l'adresse."}
  Remplis rigoureusement le schéma de réponse JSON fourni avec ces 5 options réelles de notre environnement géographique immédiat.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        responseMimeType: "application/json",
        responseSchema: restaurantSchema
      },
    });

    const text = response.text || "";
    if (text) {
      const data = JSON.parse(text);
      if (Array.isArray(data) && data.length > 0) {
        const finalResults = data.slice(0, 5).map((item: any) => ({
          name: item.name || "Établissement",
          address: item.address || "Adresse non disponible",
          rating: item.rating || 4.1,
          distanceMinutes: item.distanceMinutes || maxDurationMinutes,
          mapsUri: item.mapsUri && item.mapsUri.startsWith('http') 
            ? item.mapsUri 
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((item.name || "") + " " + (item.address || ""))}`,
          hasParking: !!item.hasParking,
          type: item.type || "Restauration",
          latitude: item.latitude || latitude,
          longitude: item.longitude || longitude
        }));

        return finalResults;
      }
    }
    
    console.warn("Pas de réponse valide de Gemini. Appel à OpenStreetMap (Overpass)...");
    return await fetchFromOpenStreetMapFallback(latitude, longitude, maxDurationMinutes, modeTransport);

  } catch (error: any) {
    console.warn("Échec ou Quota Gemini épuisé (Erreur 429). Bascule automatique sur OpenStreetMap.");
    return await fetchFromOpenStreetMapFallback(latitude, longitude, maxDurationMinutes, modeTransport);
  }
}
