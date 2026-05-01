
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
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("Position récupérée :", [pos.coords.latitude, pos.coords.longitude]);
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      },
      (err) => {
        console.error("Erreur GPS:", err);
        resolve(null);
      },
      { enableHighAccuracy: true }
    );
  });
};

// Simulation d'un canal Android pour le web (via console log pour le debug)
export const setupNotificationChannels = () => {
  console.log("Création du canal de notification 'Repas' (Importance: HIGH)");
  // Sur Android natif, on utiliserait PushNotification.createChannel
};
