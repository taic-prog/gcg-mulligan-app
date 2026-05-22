import { createContext, useContext } from 'react';
import { useDeckStore } from './deckStore';
import type { DeckStore } from './deckStore';

const Ctx = createContext<DeckStore | null>(null);

export function DeckStoreProvider({ children }: { children: React.ReactNode }) {
  const store = useDeckStore();
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useDeckStoreCtx(): DeckStore {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('DeckStoreProvider が必要です');
  return ctx;
}
