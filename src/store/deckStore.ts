import { useCallback, useState } from 'react';
import type { Deck, DeckEntry } from '../types';

const STORAGE_KEY = 'gcg-decks';
const MAX_DECKS = 5;

// -----------------------------------------------------------------------
// localStorage 操作の純粋関数（テスト・直接利用可）
// -----------------------------------------------------------------------

export function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Deck[];
  } catch {
    return [];
  }
}

function persistDecks(decks: Deck[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
}

export function saveDeck(data: { name: string; entries: DeckEntry[] }): Deck {
  const decks = loadDecks();
  if (decks.length >= MAX_DECKS) {
    throw new Error(`保存できるデッキは最大${MAX_DECKS}件です`);
  }
  const now = new Date().toISOString();
  const newDeck: Deck = {
    id: crypto.randomUUID(),
    name: data.name,
    entries: data.entries,
    createdAt: now,
    updatedAt: now,
  };
  persistDecks([...decks, newDeck]);
  return newDeck;
}

export function deleteDeck(id: string): void {
  persistDecks(loadDecks().filter((d) => d.id !== id));
}

export function updateDeck(
  id: string,
  data: { name?: string; entries?: DeckEntry[] }
): Deck | null {
  const decks = loadDecks();
  const index = decks.findIndex((d) => d.id === id);
  if (index === -1) return null;
  const updated: Deck = {
    ...decks[index],
    ...data,
    updatedAt: new Date().toISOString(),
  };
  const newDecks = [...decks];
  newDecks[index] = updated;
  persistDecks(newDecks);
  return updated;
}

// -----------------------------------------------------------------------
// useDeckStore フック
// -----------------------------------------------------------------------

export interface DeckStore {
  decks: Deck[];
  activeDeck: Deck | null;
  setActiveDeck: (id: string) => void;
  saveNewDeck: (data: { name: string; entries: DeckEntry[] }) => Deck;
  deleteDeck: (id: string) => void;
  renameDeck: (id: string, name: string) => void;
  addEntry: (entry: DeckEntry) => void;
  updateEntry: (cardId: string, count: number) => void;
  removeEntry: (cardId: string) => void;
}

export function useDeckStore(): DeckStore {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  const handleSetActiveDeck = useCallback((id: string) => {
    setActiveDeckId(id);
  }, []);

  const handleSaveNewDeck = useCallback((data: { name: string; entries: DeckEntry[] }): Deck => {
    const newDeck = saveDeck(data);
    setDecks((prev) => [...prev, newDeck]);
    return newDeck;
  }, []);

  const handleDeleteDeck = useCallback(
    (id: string) => {
      deleteDeck(id);
      setDecks((prev) => prev.filter((d) => d.id !== id));
      if (activeDeckId === id) setActiveDeckId(null);
    },
    [activeDeckId]
  );

  const handleRenameDeck = useCallback((id: string, name: string) => {
    const updated = updateDeck(id, { name });
    if (updated) setDecks((prev) => prev.map((d) => (d.id === id ? updated : d)));
  }, []);

  const handleAddEntry = useCallback(
    (entry: DeckEntry) => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      const updated = updateDeck(activeDeckId, { entries: [...deck.entries, entry] });
      if (updated) setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? updated : d)));
    },
    [activeDeckId, decks]
  );

  const handleUpdateEntry = useCallback(
    (cardId: string, count: number) => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      const updated = updateDeck(activeDeckId, {
        entries: deck.entries.map((e) => (e.card.id === cardId ? { ...e, count } : e)),
      });
      if (updated) setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? updated : d)));
    },
    [activeDeckId, decks]
  );

  const handleRemoveEntry = useCallback(
    (cardId: string) => {
      if (!activeDeckId) return;
      const deck = decks.find((d) => d.id === activeDeckId);
      if (!deck) return;
      const updated = updateDeck(activeDeckId, {
        entries: deck.entries.filter((e) => e.card.id !== cardId),
      });
      if (updated) setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? updated : d)));
    },
    [activeDeckId, decks]
  );

  return {
    decks,
    activeDeck,
    setActiveDeck: handleSetActiveDeck,
    saveNewDeck: handleSaveNewDeck,
    deleteDeck: handleDeleteDeck,
    renameDeck: handleRenameDeck,
    addEntry: handleAddEntry,
    updateEntry: handleUpdateEntry,
    removeEntry: handleRemoveEntry,
  };
}
