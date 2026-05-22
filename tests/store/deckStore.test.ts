import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  deleteDeck,
  loadDecks,
  saveDeck,
  updateCardInDeck,
  updateDeck,
  useDeckStore,
} from '../../src/store/deckStore';
import type { Card, DeckEntry } from '../../src/types';

beforeEach(() => localStorage.clear());
afterEach(() => localStorage.clear());

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: crypto.randomUUID(),
    cardNo: 'TEST-001',
    name: 'テストカード',
    cardType: 'ユニット',
    color: '青',
    level: 1,
    cost: 2,
    isKeyCard: false,
    ...overrides,
  };
}

function makeEntry(overrides: Partial<Card> = {}): DeckEntry {
  return { card: makeCard(overrides), count: 4 };
}

// -----------------------------------------------------------------------
// 純粋関数
// -----------------------------------------------------------------------

describe('saveDeck', () => {
  it('T-STORE-01: デッキが正常に保存される', () => {
    const deck = saveDeck({ name: 'テストデッキ', entries: [] });
    const decks = loadDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].id).toBe(deck.id);
    expect(decks[0].name).toBe('テストデッキ');
  });

  it('保存済みデッキに id / createdAt / updatedAt が付与される', () => {
    const deck = saveDeck({ name: 'デッキA', entries: [] });
    expect(deck.id).toBeTruthy();
    expect(deck.createdAt).toBeTruthy();
    expect(deck.updatedAt).toBeTruthy();
  });

  it('T-STORE-03: 6デッキ目の保存でエラーをスロー', () => {
    for (let i = 0; i < 5; i++) {
      saveDeck({ name: `デッキ${i + 1}`, entries: [] });
    }
    expect(() => saveDeck({ name: '6枚目', entries: [] })).toThrow();
  });

  it('複数デッキを順に保存できる', () => {
    saveDeck({ name: 'A', entries: [] });
    saveDeck({ name: 'B', entries: [] });
    expect(loadDecks()).toHaveLength(2);
  });
});

describe('loadDecks', () => {
  it('T-STORE-02: 保存したデッキが正確に復元される', () => {
    const saved = saveDeck({ name: '青赤デッキ', entries: [makeEntry()] });
    const loaded = loadDecks().find((d) => d.id === saved.id);
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe(saved.name);
    expect(loaded?.id).toBe(saved.id);
    expect(loaded?.createdAt).toBe(saved.createdAt);
    expect(loaded?.entries).toHaveLength(1);
  });

  it('localStorage が空のとき空配列を返す', () => {
    expect(loadDecks()).toEqual([]);
  });

  it('localStorage が不正な JSON のとき空配列を返す', () => {
    localStorage.setItem('gcg-decks', 'INVALID_JSON');
    expect(loadDecks()).toEqual([]);
  });
});

describe('deleteDeck', () => {
  it('T-STORE-04: 存在するデッキが削除される', () => {
    const deck = saveDeck({ name: '削除テスト', entries: [] });
    deleteDeck(deck.id);
    expect(loadDecks().find((d) => d.id === deck.id)).toBeUndefined();
  });

  it('T-STORE-05: 存在しない ID で削除してもエラーにならない', () => {
    expect(() => deleteDeck('non-existent-id')).not.toThrow();
  });

  it('削除後に他のデッキは残る', () => {
    const a = saveDeck({ name: 'A', entries: [] });
    const b = saveDeck({ name: 'B', entries: [] });
    deleteDeck(a.id);
    const remaining = loadDecks();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].id).toBe(b.id);
  });
});

describe('updateCardInDeck', () => {
  it('指定カードのプロパティを更新しエントリ順序を保持する', () => {
    const cardA = makeCard({ id: 'a', name: 'カードA' });
    const cardB = makeCard({ id: 'b', name: 'カードB', isKeyCard: false });
    const deck = saveDeck({ name: 'テスト', entries: [{ card: cardA, count: 2 }, { card: cardB, count: 3 }] });
    const updated = updateCardInDeck(deck.id, 'b', { isKeyCard: true });
    expect(updated?.entries[0].card.id).toBe('a');
    expect(updated?.entries[1].card.isKeyCard).toBe(true);
  });

  it('存在しないデッキ ID は null を返す', () => {
    expect(updateCardInDeck('ghost', 'card-1', { isKeyCard: true })).toBeNull();
  });
});

describe('updateDeck', () => {
  it('名前を更新できる', () => {
    const deck = saveDeck({ name: '旧名', entries: [] });
    const updated = updateDeck(deck.id, { name: '新名' });
    expect(updated?.name).toBe('新名');
    expect(loadDecks()[0].name).toBe('新名');
  });

  it('存在しない ID の更新は null を返す', () => {
    expect(updateDeck('ghost-id', { name: 'X' })).toBeNull();
  });

  it('updatedAt が更新される', async () => {
    const deck = saveDeck({ name: 'A', entries: [] });
    await new Promise((r) => setTimeout(r, 2)); // タイムスタンプに差を作る
    const updated = updateDeck(deck.id, { name: 'B' });
    expect(updated?.updatedAt).not.toBe(deck.updatedAt);
  });
});

// -----------------------------------------------------------------------
// useDeckStore フック
// -----------------------------------------------------------------------

describe('useDeckStore', () => {
  it('初期状態でデッキ一覧は空', () => {
    const { result } = renderHook(() => useDeckStore());
    expect(result.current.decks).toEqual([]);
    expect(result.current.activeDeck).toBeNull();
  });

  it('saveNewDeck でデッキを追加し一覧に反映される', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.saveNewDeck({ name: '新デッキ', entries: [] });
    });
    expect(result.current.decks).toHaveLength(1);
    expect(result.current.decks[0].name).toBe('新デッキ');
  });

  it('setActiveDeck で activeDeck が切り替わる', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckId: string;
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckId = deck.id;
    });
    act(() => {
      result.current.setActiveDeck(deckId!);
    });
    expect(result.current.activeDeck?.id).toBe(deckId!);
  });

  it('deleteDeck でデッキが削除され activeDeck がリセットされる', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckId: string;
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckId = deck.id;
      result.current.setActiveDeck(deckId);
    });
    act(() => {
      result.current.deleteDeck(deckId!);
    });
    expect(result.current.decks).toHaveLength(0);
    expect(result.current.activeDeck).toBeNull();
  });

  it('addEntry で activeDeck にカードが追加される', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckId: string;
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckId = deck.id;
      result.current.setActiveDeck(deckId);
    });
    act(() => {
      result.current.addEntry(makeEntry());
    });
    expect(result.current.activeDeck?.entries).toHaveLength(1);
  });

  it('updateEntry でカードの枚数が変更される', () => {
    const { result } = renderHook(() => useDeckStore());
    const card = makeCard();
    act(() => {
      const deck = result.current.saveNewDeck({
        name: 'A',
        entries: [{ card, count: 2 }],
      });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.updateEntry(card.id, 4);
    });
    expect(result.current.activeDeck?.entries[0].count).toBe(4);
  });

  it('removeEntry でカードが除外される', () => {
    const { result } = renderHook(() => useDeckStore());
    const card = makeCard();
    act(() => {
      const deck = result.current.saveNewDeck({
        name: 'A',
        entries: [{ card, count: 2 }],
      });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.removeEntry(card.id);
    });
    expect(result.current.activeDeck?.entries).toHaveLength(0);
  });

  it('renameDeck でデッキ名が変更される', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckId: string;
    act(() => {
      const deck = result.current.saveNewDeck({ name: '旧名', entries: [] });
      deckId = deck.id;
    });
    act(() => {
      result.current.renameDeck(deckId!, '新名');
    });
    expect(result.current.decks[0].name).toBe('新名');
  });

  it('activeDeck が null のとき addEntry / updateEntry / removeEntry は何もしない', () => {
    const { result } = renderHook(() => useDeckStore());
    // activeDeck を設定せずに操作してもエラーにならない
    act(() => {
      result.current.addEntry(makeEntry());
      result.current.updateEntry('some-id', 3);
      result.current.removeEntry('some-id');
    });
    expect(result.current.decks).toHaveLength(0);
  });

  it('updateCard でカードプロパティが更新されエントリ順序が保持される', () => {
    const { result } = renderHook(() => useDeckStore());
    const cardA = makeCard({ id: 'a' });
    const cardB = makeCard({ id: 'b', isKeyCard: false });
    act(() => {
      const deck = result.current.saveNewDeck({
        name: 'A',
        entries: [{ card: cardA, count: 2 }, { card: cardB, count: 1 }],
      });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.updateCard('b', { isKeyCard: true });
    });
    const entries = result.current.activeDeck?.entries ?? [];
    expect(entries[0].card.id).toBe('a');
    expect(entries[1].card.isKeyCard).toBe(true);
  });

  it('activeDeck が null のとき updateCard は何もしない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.updateCard('some-id', { isKeyCard: true });
    });
    expect(result.current.decks).toHaveLength(0);
  });

  it('renameDeck で存在しない id を渡しても状態が壊れない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.saveNewDeck({ name: 'A', entries: [] });
    });
    act(() => {
      result.current.renameDeck('ghost-id', 'X');
    });
    // 既存デッキは変わらない
    expect(result.current.decks[0].name).toBe('A');
  });
});
