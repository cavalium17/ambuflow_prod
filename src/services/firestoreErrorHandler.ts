
import { auth, db } from '../firebaseConfig';
import { disableNetwork } from 'firebase/firestore';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL || null
      })) || []
    },
    operationType,
    path
  }
  
  const errorMsg = errInfo.error.toLowerCase();
  const isQuotaOrLimitError = 
    errorMsg.includes('quota') || 
    errorMsg.includes('resource-exhausted') || 
    errorMsg.includes('resource_exhausted') ||
    errorMsg.includes('exhausted') ||
    errorMsg.includes('billing') ||
    errorMsg.includes('rate limit') ||
    errorMsg.includes('limit exceeded');

  console.error('Firestore Error: ', JSON.stringify(errInfo));

  if (isQuotaOrLimitError) {
    (window as any).firestoreQuotaExceeded = true;
    try {
      localStorage.setItem('firestore_quota_exceeded', 'true');
    } catch (e) {}
    disableNetwork(db).catch(err => console.error("Could not disable network:", err));
    window.dispatchEvent(new CustomEvent('firestore-quota-exceeded', { detail: errInfo }));
    console.warn("Firestore Quota Exceeded. Suppressing crash to allow offline/local operations.");
    return; // Suppress crash
  }

  // Shield the user from any background database write failures (since localStorage persists state locally)
  if (operationType === OperationType.WRITE) {
    console.warn(`Firestore background write failed on ${path}. Suppressed crash as data is saved locally.`);
    return; // Suppress crash for writes
  }

  throw new Error(JSON.stringify(errInfo));
}
