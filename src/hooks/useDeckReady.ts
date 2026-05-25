import { useDeckStoreCtx } from '../store/DeckStoreContext';

export function useDeckReady() {
  const { activeDeck } = useDeckStoreCtx();
  const total = activeDeck?.entries.reduce((s, e) => s + e.count, 0) ?? 0;
  const ready = activeDeck !== null && total === 50;
  return { activeDeck, total, ready };
}
