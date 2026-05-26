import type { FetchedCardInfo } from './cardFetch';
import { isCardLike } from './validator';

function isValidFetchedCard(v: unknown): v is FetchedCardInfo & { cardNo: string } {
  if (!v || typeof v !== 'object') return false;
  const c = v as Record<string, unknown>;
  return (
    isCardLike(c) &&
    typeof c.terrain === 'string' &&
    typeof c.feature === 'string' &&
    typeof c.link === 'string'
  );
}

const DB_NAME = 'gcg-card-cache';
const DB_VERSION = 2;
const STORE = 'cards';
const META_STORE = 'meta';

type CachedCard = FetchedCardInfo & { cardNo: string; cachedAt: number };

interface CardDbFile {
  version: number;
  label?: string;
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
      const row: unknown = req.result;
      if (!isValidFetchedCard(row)) { resolve(null); return; }
      const { cardNo: _, cachedAt: __, ...info } = row as CachedCard;
      resolve(info);
    };
    req.onerror = () => reject(req.error);
  });
}


export async function getAllCards(): Promise<(FetchedCardInfo & { cardNo: string })[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
    req.onsuccess = () => {
      const rows: unknown[] = req.result ?? [];
      resolve(
        (rows.filter(isValidFetchedCard) as CachedCard[])
          .map(({ cachedAt: _, ...card }) => card)
      );
    };
    req.onerror = () => reject(req.error);
  });
}

export async function seedDB(): Promise<string> {
  const res = await fetch(`${import.meta.env.BASE_URL}card-db.json`);
  if (!res.ok) return '';

  const data: CardDbFile = await res.json();
  if (!data.version || !Array.isArray(data.cards)) return '';

  const db = await openDB();

  const storedVersion = await new Promise<number>((resolve) => {
    const req = db
      .transaction(META_STORE, 'readonly')
      .objectStore(META_STORE)
      .get('seedVersion');
    req.onsuccess = () => resolve((req.result as { key: string; value: number } | undefined)?.value ?? 0);
    req.onerror = () => resolve(0);
  });

  if (storedVersion < data.version) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, META_STORE], 'readwrite');
      const store = tx.objectStore(STORE);
      for (const card of data.cards) {
        if (isValidFetchedCard(card)) store.put({ ...card, cachedAt: Date.now() });
      }
      tx.objectStore(META_STORE).put({ key: 'seedVersion', value: data.version });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return data.label ?? '';
}
