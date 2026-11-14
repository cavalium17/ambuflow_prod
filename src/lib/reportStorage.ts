const DB_NAME = 'ambuflow_reports_db';
const DB_VERSION = 1;
const STORE_NAME = 'pdf_files';

interface StoredPdfEntry {
  monthKey: string;
  base64: string;
  updatedAt: string;
}

const openReportsDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non disponible'));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'monthKey' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Erreur IndexedDB'));
  });
};

export const base64ToPdfBlob = (base64: string): Blob => {
  const clean = base64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: 'application/pdf' });
};

export const saveMonthlyPdfToStorage = async (monthKey: string, base64: string): Promise<void> => {
  try {
    const db = await openReportsDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: StoredPdfEntry = {
        monthKey,
        base64,
        updatedAt: new Date().toISOString()
      };
      store.put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.warn('Stockage IndexedDB indisponible pour le PDF :', err);
  }
};

export const getMonthlyPdfFromStorage = async (
  monthKey: string
): Promise<{ base64: string; blob: Blob } | null> => {
  try {
    const db = await openReportsDb();
    const entry = await new Promise<StoredPdfEntry | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(monthKey);
      req.onsuccess = () => resolve(req.result as StoredPdfEntry | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    if (!entry?.base64) return null;
    return {
      base64: entry.base64,
      blob: base64ToPdfBlob(entry.base64)
    };
  } catch (err) {
    console.warn('Lecture IndexedDB indisponible pour le PDF :', err);
    return null;
  }
};
