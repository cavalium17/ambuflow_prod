const CACHE_NAME = 'ambuflow-v5-clean';

// Installation : active immédiatement le nouveau service worker
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Activation : purge tous les anciens caches corrompus et prend le contrôle
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          console.log('[SW] Purging cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Stratégie de requête : ne jamais intercepter ni polluer les modules de dev Vite
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Laisser passer directement toutes les requêtes de dev, modules, API et Firebase
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/@') ||
    url.pathname.includes('/node_modules/') ||
    url.pathname.endsWith('.ts') ||
    url.pathname.endsWith('.tsx') ||
    url.pathname.endsWith('.jsx') ||
    url.pathname === '/index.html' ||
    url.pathname === '/' ||
    url.search.includes('v=') ||
    url.search.includes('t=') ||
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('firebaselogging.googleapis.com') ||
    request.url.includes('identitytoolkit.googleapis.com') ||
    request.url.includes('securetoken.googleapis.com')
  ) {
    return;
  }

  // Network First avec fallback
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

let breakNotificationTimer = null;

// Notifications
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SHOW_NOTIFICATION') {
    const { title, body, icon, url } = event.data;
    const options = {
      body: body || 'AmbuFlow Update',
      icon: icon || '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: url || '/' }
    };
    event.waitUntil(self.registration.showNotification(title, options));
  } else if (event.data.type === 'SCHEDULE_BREAK_NOTIFICATION') {
    if (breakNotificationTimer) {
      clearTimeout(breakNotificationTimer);
      breakNotificationTimer = null;
    }
    const { title, body, delay } = event.data;
    const safeDelay = Math.max(0, Number(delay) || 0);
    breakNotificationTimer = setTimeout(() => {
      breakNotificationTimer = null;
      self.registration.showNotification(title || 'Fin de pause', {
        body: body || 'Votre temps de pause est écoulé.',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        vibrate: [300, 100, 300, 100, 400],
        tag: 'ambuflow-break-end',
        renotify: true,
        data: { url: '/' }
      });
    }, safeDelay);
  } else if (event.data.type === 'CANCEL_BREAK_NOTIFICATION') {
    if (breakNotificationTimer) {
      clearTimeout(breakNotificationTimer);
      breakNotificationTimer = null;
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
