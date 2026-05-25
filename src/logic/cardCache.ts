import type { FetchedCardInfo } from './cardFetch';

const DB_NAME = 'gcg-card-cache';
const DB_VERSION = 2;
const STORE = 'cards';
const META_STORE = 'meta';

type CachedCard = FetchedCardInfo & { cardNo: string; cachedAt: number };

interface CardDbFile {
  version: number;
  cards: (FetchedCardInfo & { cardNo: string })[];
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'cardNo' });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
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

export async function getAllCards(): Promise<(FetchedCardInfo & { cardNo: string })[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows: CachedCard[] = req.result ?? [];
      resolve(rows.map(({ cachedAt: _, ...card }) => card));
    };
    req.onerror = () => reject(req.error);
  });
}

export async function seedDB(): Promise<void> {
  const res = await fetch(`${import.meta.env.BASE_URL}card-db.json`);
  if (!res.ok) return;

  const data: CardDbFile = await res.json();
  if (!data.version || !Array.isArray(data.cards)) return;

  const db = await openDB();

  const storedVersion = await new Promise<number>((resolve) => {
    const req = db
      .transaction(META_STORE, 'readonly')
      .objectStore(META_STORE)
      .get('seedVersion');
    req.onsuccess = () => resolve((req.result as { key: string; value: number } | undefined)?.value ?? 0);
    req.onerror = () => resolve(0);
  });

  if (storedVersion >= data.version) return;

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([STORE, META_STORE], 'readwrite');
    const store = tx.objectStore(STORE);
    for (const card of data.cards) {
      store.put({ ...card, cachedAt: Date.now() });
    }
    tx.objectStore(META_STORE).put({ key: 'seedVersion', value: data.version });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
