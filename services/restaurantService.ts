
import { GoogleGenAI } from "@google/genai";

export interface RestaurantSuggestion {
  name: string;
  address: string;
  rating: number;
  distanceMinutes: number;
  mapsUri: string;
  hasParking: boolean;
  latitude?: number;
  longitude?: number;
}

export const findNearbyRestos = getRestaurantSuggestion;

export async function getRestaurantSuggestion(
  vehicleType: string,
  latitude: number,
  longitude: number
): Promise<RestaurantSuggestion | null> {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const isLargeVehicle = vehicleType === 'ASSU' || vehicleType === 'AMBU';
  
  const prompt = `Je suis ambulancier en service avec un véhicule de type ${vehicleType}. 
  Je commence ma coupure repas et je cherche un endroit pour manger (Boulangerie ou Restaurant).
  ${isLargeVehicle ? "IMPORTANT : Mon véhicule est de GRAND GABARIT. Priorise les endroits avec un grand parking accessible ou situés sur des axes principaux dégagés." : "Priorise la proximité et la qualité (note > 4.2)."}
  Ma position actuelle est : lat ${latitude}, lng ${longitude}.
  Trouve la meilleure option à moins de 10 minutes.
  Réponds au format JSON avec les champs : name, address, rating, distanceMinutes, mapsUri, hasParking, latitude, longitude.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleMaps: {} }],
        toolConfig: {
          retrievalConfig: {
            latLng: {
              latitude,
              longitude
            }
          }
        }
      },
    });

    // Since googleMaps tool is used, we should also check grounding metadata for links
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const mapsLink = chunks?.find(c => c.maps?.uri)?.maps?.uri || "";

    // The text might contain the JSON
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    
    if (jsonMatch) {
      const data = JSON.parse(jsonMatch[0]);
      return {
        name: data.name || "Restaurant suggéré",
        address: data.address || "",
        rating: data.rating || 0,
        distanceMinutes: data.distanceMinutes || 5,
        mapsUri: mapsLink || data.mapsUri || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.name + " " + data.address)}`,
        hasParking: !!data.hasParking,
        latitude: data.latitude,
        longitude: data.longitude
      };
    }
    
    return null;
  } catch (error) {
    console.error("Error fetching restaurant suggestion:", error);
    return null;
  }
}
