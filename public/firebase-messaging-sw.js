
// Scripts Firebase nécessaires pour le Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

// Initialisation de Firebase dans le Service Worker
// Utilisez les mêmes valeurs que dans votre firebaseConfig.ts
firebase.initializeApp({
  apiKey: "AIzaSyAdLD-MxaEObu8L8MDYwPLSg10nIMA4fVI",
  authDomain: "ambuflow-e5ffc.firebaseapp.com",
  projectId: "ambuflow-e5ffc",
  storageBucket: "ambuflow-e5ffc.firebasestorage.app",
  messagingSenderId: "296039792412",
  appId: "1:296039792412:web:4b9bddd562b72d62bac4d9"
});

const messaging = firebase.messaging();

// Gestionnaire de messages pour la planification locale (existant)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SCHEDULE_NOTIFICATION') {
    const { title, body, delay, urgency, icon } = event.data;
    
    setTimeout(() => {
      const options = {
        body: body,
        icon: icon || 'https://cdn-icons-png.flaticon.com/512/1022/1022213.png',
        vibrate: urgency === 'high' ? [300, 100, 300, 100, 400] : [100, 50, 100],
        badge: 'https://cdn-icons-png.flaticon.com/512/1022/1022213.png',
        tag: 'ambuflow-alert',
        renotify: true,
        data: { timestamp: Date.now() },
        actions: [{ action: 'open', title: 'Ouvrir AmbuFlow' }]
      };
      self.registration.showNotification(title, options);
    }, delay);
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});

// Gestionnaire de messages en arrière-plan FCM
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Message reçu en arrière-plan:', payload);
  
  const notificationTitle = payload.notification?.title || "AmbuFlow - Pause méritée ! 🚑";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.message || "Un petit creux ? Découvrez les restaurants à proximité.",
    icon: payload.notification?.icon || 'https://cdn-icons-png.flaticon.com/512/1022/1022213.png',
    data: payload.data,
    vibrate: [300, 100, 300],
    tag: 'ambuflow-meal-notif',
    renotify: true,
    actions: [
      { action: 'open', title: 'Voir le Resto' },
      { action: 'close', title: 'Plus tard' }
    ]
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
