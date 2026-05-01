
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Fonction d'enregistrement simplifiée et sécurisée pour le Service Worker
const registerServiceWorker = () => {
  // Les Service Workers nécessitent un contexte sécurisé (HTTPS ou localhost)
  // et ne peuvent pas être enregistrés si la page elle-même est chargée via un blob
  if ('serviceWorker' in navigator && window.isSecureContext) {
    
    // Si nous sommes dans un environnement de sandbox qui utilise des blobs, 
    // l'enregistrement du SW échouera systématiquement.
    if (window.location.protocol === 'blob:') {
      console.debug('Service Worker : Enregistrement ignoré (protocole blob détecté).');
      return;
    }

    // Enregistrement du Service Worker principal pour le cache/PWA
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('AmbuFlow SW Cache Ready:', reg.scope))
      .catch(err => console.debug('SW Cache error:', err.message));

    // Enregistrement du Service Worker FCM
    navigator.serviceWorker.register('firebase-messaging-sw.js')
      .then(reg => console.log('AmbuFlow FCM SW Ready:', reg.scope))
      .catch(err => console.debug('FCM SW error:', err.message));
  }
};

// On s'assure que le document est prêt avant de tenter l'enregistrement
if (document.readyState === 'complete') {
  registerServiceWorker();
} else {
  window.addEventListener('load', registerServiceWorker);
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
