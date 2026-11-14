
export const requestNotificationPermissions = async () => {
  console.log("Demande de permissions Notifications...");
  if (!("Notification" in window)) {
    console.log("Ce navigateur ne supporte pas les notifications bureau");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    console.log("Permission notification:", permission);
    return permission === "granted";
  } catch (err) {
    console.warn("Erreur demande permission notification:", err);
    return false;
  }
};

// Simulation d'un canal Android pour le web (via console log pour le debug)
export const setupNotificationChannels = () => {
  console.log("Création du canal de notification 'Repas' (Importance: HIGH)");
};

/**
 * Joue une sonnerie / carillon agréable via l'API Web Audio (100% autonome, fonctionne hors ligne)
 */
export const playBreakEndAlarm = () => {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    // Carillon 3 tons ascendants (Do5, Mi5, Sol5)
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.18);
      gain.gain.setValueAtTime(0, now + idx * 0.18);
      gain.gain.linearRampToValueAtTime(0.35, now + idx * 0.18 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.18 + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.18);
      osc.stop(now + idx * 0.18 + 0.36);
    });
  } catch (e) {
    console.debug("Impossible d'émettre le carillon audio:", e);
  }
};

/**
 * Déclenche une vibration sur le téléphone
 */
export const triggerBreakVibration = () => {
  try {
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate([400, 200, 400, 200, 600]);
    }
  } catch (e) {
    console.debug("Vibration non supportée:", e);
  }
};

/**
 * Envoie la planification de fin de pause au Service Worker pour notification en arrière-plan
 */
export const scheduleServiceWorkerBreakNotification = (title: string, body: string, endTimeMs: number) => {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          reg.active?.postMessage({
            type: 'SCHEDULE_BREAK_NOTIFICATION',
            title,
            body,
            endTime: endTimeMs,
            delay: Math.max(0, endTimeMs - Date.now())
          });
        });
      }).catch((e) => console.debug("Erreur planification SW:", e));
    }
  } catch (e) {
    console.debug("Erreur scheduleServiceWorkerBreakNotification:", e);
  }
};

/**
 * Annule la notification de pause en attente dans le Service Worker
 */
export const cancelServiceWorkerBreakNotification = () => {
  try {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((reg) => {
          reg.active?.postMessage({
            type: 'CANCEL_BREAK_NOTIFICATION'
          });
        });
      }).catch(() => {});
    }
  } catch (e) {
    console.debug("Erreur cancelServiceWorkerBreakNotification:", e);
  }
};
