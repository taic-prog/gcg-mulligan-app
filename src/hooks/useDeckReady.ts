import { useDeckStoreCtx } from '../store/DeckStoreContext';
import { validateDeck } from '../logic/validator';

export function useDeckReady() {
  const { activeDeck } = useDeckStoreCtx();
  const total = activeDeck?.entries.reduce((s, e) => s + e.count, 0) ?? 0;
  const ready = activeDeck !== null && validateDeck(activeDeck.entries).length === 0;
  return { activeDeck, total, ready };
}
