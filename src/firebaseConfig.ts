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
import firebaseConfigData from '../firebase-applet-config.json';

// Use the configuration directly from the generated file. 
// Only override if the environment variables are explicitly provided AND valid.
const getEnv = (key: string) => {
  const val = (import.meta as any).env?.[key];
  if (typeof val !== 'string' || val.length === 0) return undefined;
  
  // Basic validation to prevent overriding with garbage or placeholders
  if (key.includes('API_KEY') && !val.startsWith('AIza')) return undefined;
  if (key.includes('PROJECT_ID') && val.includes(' ')) return undefined;
  
  return val;
};

const finalConfig = {
  ...firebaseConfigData,
  apiKey: getEnv('VITE_FIREBASE_API_KEY') || firebaseConfigData.apiKey,
  projectId: getEnv('VITE_FIREBASE_PROJECT_ID') || firebaseConfigData.projectId,
  appId: getEnv('VITE_FIREBASE_APP_ID') || firebaseConfigData.appId,
  authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN') || firebaseConfigData.authDomain,
  storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET') || firebaseConfigData.storageBucket,
  messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID') || firebaseConfigData.messagingSenderId,
};

// Guard: Ensure API key is present and looks like a Firebase key
if (!finalConfig.apiKey || !finalConfig.apiKey.startsWith('AIza')) {
  console.error("❌ CRITICAL: Invalid or missing Firebase API Key detected in finalConfig!", { 
    hasKey: !!finalConfig.apiKey, 
    keyPrefix: finalConfig.apiKey?.substring(0, 4) 
  });
} else {
  console.log("Firebase Config loaded successfully:", {
    projectId: finalConfig.projectId,
    apiKey: finalConfig.apiKey.substring(0, 6) + "...",
    authDomain: finalConfig.authDomain
  });
}

const app = initializeApp(finalConfig);

// Initialize Auth with explicit local persistence and popup resolver for better iframe compatibility
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export const googleProvider = new GoogleAuthProvider();

// Forced Long Polling to avoid WebSocket issues in sandboxed environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

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
