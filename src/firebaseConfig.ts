import { initializeApp } from 'firebase/app';
import { 
  getAuth,
  browserLocalPersistence, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { initializeFirestore, getFirestore, doc, getDocFromServer, disableNetwork } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfigData from '../firebase-applet-config.json';

// Helper to get configuration safely
const getFirebaseConfig = () => {
  const source = (firebaseConfigData as any).default || firebaseConfigData || {};
  
  const getEnv = (key: string, fallback: string | undefined): string | undefined => {
    const val = (import.meta as any).env?.[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      const trimmed = val.trim().replace(/[\n\r]/g, '');
      // Only return if it seems like a real value, not a placeholder
      if (key.includes('API_KEY') && !trimmed.startsWith('AIza')) return fallback;
      if (key.includes('PROJECT_ID') && (trimmed.includes(' ') || trimmed.includes('{'))) return fallback;
      return trimmed;
    }
    return fallback;
  };

  const config = {
    apiKey: getEnv('VITE_FIREBASE_API_KEY', source.apiKey),
    projectId: getEnv('VITE_FIREBASE_PROJECT_ID', source.projectId),
    appId: getEnv('VITE_FIREBASE_APP_ID', source.appId),
    authDomain: getEnv('VITE_FIREBASE_AUTH_DOMAIN', source.authDomain),
    storageBucket: getEnv('VITE_FIREBASE_STORAGE_BUCKET', source.storageBucket),
    messagingSenderId: getEnv('VITE_FIREBASE_MESSAGING_SENDER_ID', source.messagingSenderId),
    measurementId: getEnv('VITE_FIREBASE_MEASUREMENT_ID', source.measurementId),
  };

  const databaseId = getEnv('VITE_FIREBASE_DATABASE_ID', (source as any).firestoreDatabaseId);

  return { config, databaseId };
};

export const { config: finalConfig, databaseId } = getFirebaseConfig();

// Diagnostics logging (safe)
const maskKey = (key: string | undefined) => {
  if (!key) return "MISSING";
  if (key.length < 10) return "INVALID_FORMAT";
  return `${key.substring(0, 6)}...${key.substring(key.length - 4)}`;
};

console.log("Firebase Diagnostic:", {
  projectId: finalConfig.projectId,
  apiKey: maskKey(finalConfig.apiKey),
  hasAppId: !!finalConfig.appId,
  isSecure: typeof window !== 'undefined' && window.isSecureContext
});

// Guard: Ensure API key is present
if (!finalConfig.apiKey || !finalConfig.apiKey.startsWith('AIza')) {
  console.error("❌ CRITICAL: Invalid Firebase API Key detected!");
}

// Initialization
const app = initializeApp(finalConfig);

// Initialize Auth
export const auth = getAuth(app);
// Set persistence explicitly to ensure it works in all environments
auth.setPersistence(browserLocalPersistence);

export const googleProvider = new GoogleAuthProvider();

// Initialize Firestore with databaseId if provided
// Forced Long Polling to avoid WebSocket issues in sandboxed environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, databaseId || undefined);

// Pre-emptively disable network if quota is known to be exceeded
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem('firestore_quota_exceeded') === 'true') {
      (window as any).firestoreQuotaExceeded = true;
      console.warn("Firestore: Quota exceeded flag found in localStorage. Disabling network immediately on boot.");
      disableNetwork(db).catch(err => console.error("Could not pre-emptively disable network:", err));
    }
  } catch (localStorageErr) {
    console.error("Local storage error during pre-emptive quota check:", localStorageErr);
  }
}

// Diagnostics (safe)
const testConnection = async () => {
  console.log("Firebase initialized with project:", finalConfig.projectId);
  if ((window as any).firestoreQuotaExceeded) {
    console.log("Firestore test connection skipped as database is in offline quota status.");
    return;
  }
  try {
    // Wait briefly for network/iframe stabilization
    await new Promise(resolve => setTimeout(resolve, 3000));
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore: Initialized and connected.");
  } catch (error: any) {
    const errorMsg = error?.message?.toLowerCase() || '';
    const isQuota = errorMsg.includes('quota') || errorMsg.includes('resource-exhausted') || errorMsg.includes('resource_exhausted') || errorMsg.includes('exhausted');
    if (isQuota) {
      console.warn("Firestore initialization detected quota limit exceeded. Disabling network immediately to prevent error storm.");
      (window as any).firestoreQuotaExceeded = true;
      try {
        localStorage.setItem('firestore_quota_exceeded', 'true');
      } catch (e) {}
      disableNetwork(db).catch(err => console.error("Could not disable network:", err));
      window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', { detail: { error: error.message || String(error) } }));
    } else if (error?.message?.includes('offline')) {
      console.log("Firestore: Initialized (Local mode)");
    } else {
      console.info("Firestore status:", error?.message || error);
    }
  }
};

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
