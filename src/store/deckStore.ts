import { useCallback, useState } from 'react';
import type { Card, Deck, DeckEntry, SavedCombo } from '../types';

const STORAGE_KEY = 'gcg-decks';
const MAX_DECKS = 5;

// -----------------------------------------------------------------------
// localStorage 操作の純粋関数（テスト・直接利用可）
// -----------------------------------------------------------------------

export function loadDecks(): Deck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const decks = JSON.parse(raw) as Deck[];
    // 後方互換: combos フィールドがない既存デッキに空配列を補完
    return decks.map((d) => ({ ...d, combos: d.combos ?? [] }));
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
    combos: [],
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
  data: { name?: string; entries?: DeckEntry[]; combos?: SavedCombo[] }
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

// カードのプロパティを更新する（エントリの順序を保持）
export function updateCardInDeck(
  deckId: string,
  cardId: string,
  cardData: Partial<Card>
): Deck | null {
  const decks = loadDecks();
  const index = decks.findIndex((d) => d.id === deckId);
  if (index === -1) return null;
  const updated: Deck = {
    ...decks[index],
    entries: decks[index].entries.map((e) =>
      e.card.id === cardId ? { ...e, card: { ...e.card, ...cardData } } : e
    ),
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
  updateCard: (cardId: string, cardData: Partial<Card>) => void;
  removeEntry: (cardId: string) => void;
  importEntries: (entries: DeckEntry[]) => void;
  addCombo: (combo: Omit<SavedCombo, 'id'>) => void;
  updateCombo: (comboId: string, data: Partial<Pick<SavedCombo, 'name' | 'condition'>>) => void;
  deleteCombo: (comboId: string) => void;
}

export function useDeckStore(): DeckStore {
  const [decks, setDecks] = useState<Deck[]>(() => loadDecks());
  const [activeDeckId, setActiveDeckId] = useState<string | null>(null);

  const activeDeck = decks.find((d) => d.id === activeDeckId) ?? null;

  function applyToActive(updater: (deck: Deck) => Partial<Pick<Deck, 'entries' | 'combos'>>) {
    if (!activeDeckId) return;
    const deck = decks.find((d) => d.id === activeDeckId);
    if (!deck) return;
    const updated = updateDeck(activeDeckId, updater(deck));
    if (updated) setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? updated : d)));
  }

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
      applyToActive((deck) => ({ entries: [...deck.entries, entry] }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeckId, decks]
  );

  const handleUpdateEntry = useCallback(
    (cardId: string, count: number) => {
      applyToActive((deck) => ({
        entries: deck.entries.map((e) => (e.card.id === cardId ? { ...e, count } : e)),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeckId, decks]
  );

  const handleRemoveEntry = useCallback(
    (cardId: string) => {
      applyToActive((deck) => ({
        entries: deck.entries.filter((e) => e.card.id !== cardId),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeckId, decks]
  );

  const handleUpdateCard = useCallback(
    (cardId: string, cardData: Partial<Card>) => {
      if (!activeDeckId) return;
      const updated = updateCardInDeck(activeDeckId, cardId, cardData);
      if (updated) setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? updated : d)));
    },
    [activeDeckId]
  );

  const handleImportEntries = useCallback(
    (entries: DeckEntry[]) => {
      if (!activeDeckId) return;
      const updated = updateDeck(activeDeckId, { entries });
      if (updated) setDecks((prev) => prev.map((d) => (d.id === activeDeckId ? updated : d)));
    },
    [activeDeckId]
  );

  const handleAddCombo = useCallback(
    (combo: Omit<SavedCombo, 'id'>) => {
      const newCombo: SavedCombo = { ...combo, id: crypto.randomUUID() };
      applyToActive((deck) => ({ combos: [...deck.combos, newCombo] }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeckId, decks]
  );

  const handleUpdateCombo = useCallback(
    (comboId: string, data: Partial<Pick<SavedCombo, 'name' | 'condition'>>) => {
      applyToActive((deck) => ({
        combos: deck.combos.map((c) => (c.id === comboId ? { ...c, ...data } : c)),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeDeckId, decks]
  );

  const handleDeleteCombo = useCallback(
    (comboId: string) => {
      applyToActive((deck) => ({
        combos: deck.combos.filter((c) => c.id !== comboId),
      }));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    updateCard: handleUpdateCard,
    removeEntry: handleRemoveEntry,
    importEntries: handleImportEntries,
    addCombo: handleAddCombo,
    updateCombo: handleUpdateCombo,
    deleteCombo: handleDeleteCombo,
  };
}
