import { initializeApp } from 'firebase/app';
import { 
  initializeAuth, 
  browserLocalPersistence, 
  browserPopupRedirectResolver,
  GoogleAuthProvider 
} from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

// REMPLACEMENT : On utilise les variables du .env à la place du fichier JSON
const firebaseConfigData = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfigData);

// Le reste de ton code (Auth, Firestore, Messaging) reste identique...
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const googleProvider = new GoogleAuthProvider();
// Force popup mode for better compatibility in AI Studio preview
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

// Forced Long Polling to avoid WebSocket issues in sandboxed/firewalled environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfigData.firestoreDatabaseId);

async function testConnection() {
  try {
    // Wait longer to allow initial network stabilization in iframe/sandboxed environments
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // If browser reports offline, don't treat it as a configuration error
    if (typeof window !== 'undefined' && !window.navigator.onLine) {
       console.log("Firestore: Waiting for network...");
       return;
    }
    
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore: Connection established.");
  } catch (error) {
    // Don't log "offline" message as a fatal error, Firestore handles this automatically
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.log("Firestore: Ready (offline mode enabled)");
    } else {
      console.info("Firestore connection probe:", error);
    }
  }
}
testConnection();

export const storage = getStorage(app);

// Use a safe initialization for messaging to prevent crashes in unsupported environments
const initMessaging = () => {
  if (typeof window === 'undefined') return null;
  try {
    return getMessaging(app);
  } catch (error) {
    console.warn("Firebase Messaging not supported in this environment:", error);
    return null;
  }
};

export const messaging = initMessaging();

export const requestForToken = async () => {
  if (!messaging) return null;
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: 'BD_v_Y_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z_Z' // Placeholder, usually not strictly needed for basic setup if not using web push specifically
    });
    if (currentToken) {
      console.log('Token FCM:', currentToken);
      return currentToken;
    }
  } catch (err) {
    console.error('Erreur token FCM:', err);
  }
  return null;
};

export const onMessageListener = (callback: (payload: any) => void) => {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

export default app;
