import type { FetchedCardInfo } from './cardFetch';

const DB_NAME = 'gcg-card-cache';
const DB_VERSION = 1;
const STORE = 'cards';

type CachedCard = FetchedCardInfo & { cardNo: string; cachedAt: number };

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: 'cardNo' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getCached(cardNo: string): Promise<FetchedCardInfo | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE, 'readonly')
      .objectStore(STORE)
      .get(cardNo);
    req.onsuccess = () => {
      const row: CachedCard | undefined = req.result;
      resolve(row ? (({ cardNo: _, cachedAt: __, ...info }) => info)(row) : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function putCache(cardNo: string, info: FetchedCardInfo): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db
      .transaction(STORE, 'readwrite')
      .objectStore(STORE)
      .put({ cardNo, cachedAt: Date.now(), ...info });
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
