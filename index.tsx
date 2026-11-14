
import './src/suppressQuotaError';
import './index.css';

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Nettoyage immédiat des caches navigateur pour éliminer tout importmap ou module React obsolète
if (typeof window !== 'undefined' && 'caches' in window) {
  caches.keys().then((names) => {
    names.forEach((name) => {
      caches.delete(name);
    });
  }).catch(() => {});
}

// Gestion Service Worker : en développement on désenregistre les anciens workers pour garantir le HMR et éviter le cache
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  if (import.meta.env.DEV) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((r) => {
        if (r.active?.scriptURL.includes('sw.js')) {
          r.unregister();
        }
      });
    }).catch(() => {});
  } else if (window.isSecureContext && window.location.protocol !== 'blob:') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((reg) => console.log('[AmbuFlow PWA] SW Ready:', reg.scope))
        .catch((err) => console.debug('[AmbuFlow PWA] SW registration notice:', err.message));
    });
  }

  // Enregistrement du Service Worker FCM pour les notifications
  if (window.isSecureContext && window.location.protocol !== 'blob:') {
    try {
      navigator.serviceWorker.register('/firebase-messaging-sw.js')
        .then(reg => console.log('AmbuFlow FCM SW Ready:', reg.scope))
        .catch(err => console.debug('FCM SW error:', err.message));
    } catch (err) {
      console.debug('FCM SW exception:', err);
    }
  }
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
