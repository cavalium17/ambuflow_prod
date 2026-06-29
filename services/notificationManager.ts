
export const requestNotificationPermissions = async () => {
  console.log("Demande de permissions Notifications...");
  if (!("Notification" in window)) {
    console.log("Ce navigateur ne supporte pas les notifications bureau");
    return false;
  }

  const permission = await Notification.requestPermission();
  console.log("Permission notification:", permission);
  return permission === "granted";
};

export const requestLocationPermissions = async (): Promise<{latitude: number, longitude: number} | null> => {
  console.log("Demande de permissions GPS (Toujours/Background)...");
  if (!navigator.geolocation) {
    console.log("Géolocalisation non supportée");
    return null;
  }

  return new Promise((resolve) => {
    console.log("Tentative GPS 1: Haute Précision activée (Timeout 5s)...");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Position récupérée (Haute Précision) :", [pos.coords.latitude, pos.coords.longitude]);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      (err) => {
        console.warn("Échec Tentative GPS 1 (Haute Précision):", err.message, "Code:", err.code);
        console.log("Lancement de la Tentative GPS 2 de repli (Basse Précision/Réseau/Wi-Fi)...");
        
        navigator.geolocation.getCurrentPosition(
          (fallbackPos) => {
            console.log("Position récupérée après repli (Basse Précision) :", [fallbackPos.coords.latitude, fallbackPos.coords.longitude]);
            resolve({
              latitude: fallbackPos.coords.latitude,
              longitude: fallbackPos.coords.longitude
            });
          },
          (fallbackErr) => {
            if (fallbackErr.code === 1 || fallbackErr.message.includes('permission') || fallbackErr.message.includes('policy')) {
              console.warn("L'accès au GPS est désactivé par l'utilisateur ou la politique de sécurité de l'iframe.");
            } else {
              console.warn("Impossible de récupérer la position GPS (les deux précisions ont échoué) :", fallbackErr.message);
            }
            // On signale gentiment et on alerte via un log visible
            console.warn(`[GPS] Signal GPS non disponible. Détails - Tentative 1: ${err.message} | Repli: ${fallbackErr.message}`);
            resolve(null);
          },
          { enableHighAccuracy: false, timeout: 10000 }
        );
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  });
};

// Simulation d'un canal Android pour le web (via console log pour le debug)
export const setupNotificationChannels = () => {
  console.log("Création du canal de notification 'Repas' (Importance: HIGH)");
  // Sur Android natif, on utiliserait PushNotification.createChannel
};
