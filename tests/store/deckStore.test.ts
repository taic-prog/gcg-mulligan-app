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

  it('null JSON のとき空配列を返す', () => {
    localStorage.setItem('gcg-decks', 'null');
    expect(loadDecks()).toEqual([]);
  });

  it('配列でない JSON のとき空配列を返す', () => {
    localStorage.setItem('gcg-decks', '{"key":"value"}');
    expect(loadDecks()).toEqual([]);
  });

  it('必須フィールドが欠けているデッキはフィルタされる', () => {
    // name が欠けているデッキ
    localStorage.setItem('gcg-decks', JSON.stringify([{ id: '1', entries: [], combos: [], createdAt: 'x', updatedAt: 'x' }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('entries が配列でないデッキはフィルタされる', () => {
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: 'bad', combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('entry.count が範囲外のデッキはフィルタされる', () => {
    const badEntry = { count: 5, card: { id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false } };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [badEntry], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('entry.count が整数でないデッキはフィルタされる', () => {
    const badEntry = { count: 1.5, card: { id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false } };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [badEntry], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('card.isKeyCard が真偽値でないデッキはフィルタされる', () => {
    const badCard = { id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: 'true' };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 1, card: badCard }], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('card.id が文字列でないデッキはフィルタされる', () => {
    const badCard = { id: 123, cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 1, card: badCard }], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('card.terrain が文字列でない場合はフィルタされる', () => {
    const badCard = { id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false, terrain: 123 };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 1, card: badCard }], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('combos フィールドがない既存デッキは combos=[] で補完される', () => {
    const validCard = { id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 1, card: validCard }], createdAt: 'x', updatedAt: 'x',
    }]));
    const decks = loadDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].combos).toEqual([]);
  });

  it('combos の id が文字列でないデッキはフィルタされる', () => {
    const badCombo = { id: 999, name: 'c', condition: { items: [{ type: 'keycard', minCount: 1 }] } };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [], combos: [badCombo], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('combos の condition が配列でないデッキはフィルタされる', () => {
    const badCombo = { id: 'c1', name: 'c', condition: { items: 'bad' } };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [], combos: [badCombo], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('combo の item.type が不正なデッキはフィルタされる', () => {
    const badCombo = { id: 'c1', name: 'c', condition: { items: [{ type: 'invalid', minCount: 1 }] } };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [], combos: [badCombo], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('combo の item がオブジェクトでない場合はフィルタされる', () => {
    const badCombo = { id: 'c1', name: 'c', condition: { items: ['not-object'] } };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [], combos: [badCombo], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('entry がオブジェクトでない場合はフィルタされる', () => {
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: ['not-object'], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('card が null のデッキはフィルタされる（isValidCard null チェック）', () => {
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 1, card: null }], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('terrain・feature・link が文字列のカードは正常に復元される', () => {
    const validCard = {
      id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青',
      level: 1, cost: 1, isKeyCard: false,
      terrain: '宇宙', feature: '〔地球連邦〕', link: '「アムロ」',
    };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 1, card: validCard }], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    const decks = loadDecks();
    expect(decks).toHaveLength(1);
    expect(decks[0].entries[0].card.terrain).toBe('宇宙');
    expect(decks[0].entries[0].card.feature).toBe('〔地球連邦〕');
    expect(decks[0].entries[0].card.link).toBe('「アムロ」');
  });

  it('entry.count が 0 のデッキはフィルタされる', () => {
    const validCard = { id: 'x', cardNo: 'A', name: 'A', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [{ count: 0, card: validCard }], combos: [], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('combos 配列に null が含まれる場合はデッキごとフィルタされる（isValidCombo null チェック）', () => {
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [], combos: [null], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('combo の condition が null のデッキはフィルタされる（isValidCombo condition チェック）', () => {
    const badCombo = { id: 'c1', name: 'c', condition: null };
    localStorage.setItem('gcg-decks', JSON.stringify([{
      id: '1', name: 'A', entries: [], combos: [badCombo], createdAt: 'x', updatedAt: 'x',
    }]));
    expect(loadDecks()).toHaveLength(0);
  });

  it('デッキ配列に null が含まれる場合は無視される（isValidDeck null チェック）', () => {
    const validDeck = { id: '1', name: 'A', entries: [], combos: [], createdAt: 'x', updatedAt: 'x' };
    localStorage.setItem('gcg-decks', JSON.stringify([null, validDeck]));
    expect(loadDecks()).toHaveLength(1);
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

  it('addCombo でコンボがデッキに追加される', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.addCombo({
        name: 'テストコンボ',
        condition: { items: [{ type: 'keycard', minCount: 1 }] },
      });
    });
    const combos = result.current.activeDeck?.combos ?? [];
    expect(combos).toHaveLength(1);
    expect(combos[0].name).toBe('テストコンボ');
    expect(combos[0].id).toBeTruthy();
  });

  it('updateCombo でコンボ名が更新される', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.addCombo({
        name: '旧コンボ',
        condition: { items: [{ type: 'keycard', minCount: 1 }] },
      });
    });
    const comboId = result.current.activeDeck!.combos[0].id;
    act(() => {
      result.current.updateCombo(comboId, { name: '新コンボ' });
    });
    expect(result.current.activeDeck?.combos[0].name).toBe('新コンボ');
  });

  it('deleteCombo でコンボが削除される', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.addCombo({
        name: 'コンボ1',
        condition: { items: [{ type: 'keycard', minCount: 1 }] },
      });
    });
    act(() => {
      result.current.addCombo({
        name: 'コンボ2',
        condition: { items: [{ type: 'keycard', minCount: 2 }] },
      });
    });
    const comboId = result.current.activeDeck!.combos[0].id;
    act(() => {
      result.current.deleteCombo(comboId);
    });
    expect(result.current.activeDeck?.combos).toHaveLength(1);
    expect(result.current.activeDeck?.combos[0].name).toBe('コンボ2');
  });

  it('importEntries でデッキエントリが置き換えられる', () => {
    const { result } = renderHook(() => useDeckStore());
    const card1 = makeCard({ id: 'a', cardNo: 'A' });
    const card2 = makeCard({ id: 'b', cardNo: 'B' });
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [{ card: card1, count: 2 }] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.importEntries([{ card: card2, count: 3 }]);
    });
    expect(result.current.activeDeck?.entries).toHaveLength(1);
    expect(result.current.activeDeck?.entries[0].card.id).toBe('b');
  });

  it('activeDeck が null のとき importEntries は何もしない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.saveNewDeck({ name: 'A', entries: [] });
      // activeDeck を設定しない
    });
    act(() => {
      result.current.importEntries([makeEntry()]);
    });
    expect(result.current.decks[0].entries).toHaveLength(0);
  });

  it('activeDeck が null のとき addCombo は何もしない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.saveNewDeck({ name: 'A', entries: [] });
      // activeDeck を設定しない
    });
    act(() => {
      result.current.addCombo({ name: 'X', condition: { items: [] } });
    });
    expect(result.current.decks[0].combos).toHaveLength(0);
  });

  it('activeDeck が null のとき updateCombo は何もしない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.updateCombo('any-id', { name: 'X' });
    });
    expect(result.current.decks).toHaveLength(0);
  });

  it('activeDeck が null のとき deleteCombo は何もしない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      result.current.deleteCombo('any-id');
    });
    expect(result.current.decks).toHaveLength(0);
  });

  it('renameDeck に空文字を渡しても名前が変わらない', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: '元の名前', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.renameDeck(result.current.decks[0].id, '   ');
    });
    expect(result.current.decks[0].name).toBe('元の名前');
  });

  it('2デッキある状態で renameDeck すると対象デッキのみ名前が変わる', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckAId: string;
    act(() => {
      const a = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckAId = a.id;
    });
    act(() => {
      result.current.saveNewDeck({ name: 'B', entries: [] });
    });
    act(() => {
      result.current.renameDeck(deckAId!, '新A');
    });
    expect(result.current.decks.find((d) => d.id === deckAId!)?.name).toBe('新A');
    expect(result.current.decks.find((d) => d.name === 'B')).toBeDefined();
  });

  it('2エントリある状態で updateEntry すると対象エントリのみ枚数が変わる', () => {
    const { result } = renderHook(() => useDeckStore());
    const card1 = makeCard({ id: 'c1' });
    const card2 = makeCard({ id: 'c2' });
    act(() => {
      const deck = result.current.saveNewDeck({
        name: 'A',
        entries: [{ card: card1, count: 2 }, { card: card2, count: 1 }],
      });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.updateEntry('c1', 4);
    });
    const entries = result.current.activeDeck?.entries ?? [];
    expect(entries.find((e) => e.card.id === 'c1')?.count).toBe(4);
    expect(entries.find((e) => e.card.id === 'c2')?.count).toBe(1);
  });

  it('2デッキある状態で非アクティブデッキを deleteDeck しても activeDeck は変わらない', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckAId: string, deckBId: string;
    act(() => {
      const a = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckAId = a.id;
    });
    act(() => {
      const b = result.current.saveNewDeck({ name: 'B', entries: [] });
      deckBId = b.id;
      result.current.setActiveDeck(deckAId!);
    });
    act(() => {
      result.current.deleteDeck(deckBId!);
    });
    expect(result.current.decks).toHaveLength(1);
    expect(result.current.activeDeck?.id).toBe(deckAId!);
  });

  it('2デッキある状態で addEntry するとアクティブデッキのみエントリが増える', () => {
    const { result } = renderHook(() => useDeckStore());
    let deckAId: string, deckBId: string;
    act(() => {
      const a = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckAId = a.id;
    });
    act(() => {
      const b = result.current.saveNewDeck({ name: 'B', entries: [] });
      deckBId = b.id;
      result.current.setActiveDeck(deckAId!);
    });
    act(() => {
      result.current.addEntry(makeEntry());
    });
    expect(result.current.decks.find((d) => d.id === deckAId!)?.entries).toHaveLength(1);
    expect(result.current.decks.find((d) => d.id === deckBId!)?.entries).toHaveLength(0);
  });

  it('2デッキある状態で updateCard するとアクティブデッキのみ更新される', () => {
    const { result } = renderHook(() => useDeckStore());
    const card = makeCard({ id: 'c1', isKeyCard: false });
    let deckAId: string, deckBId: string;
    act(() => {
      const a = result.current.saveNewDeck({ name: 'A', entries: [{ card, count: 2 }] });
      deckAId = a.id;
      result.current.setActiveDeck(deckAId);
    });
    act(() => {
      const b = result.current.saveNewDeck({ name: 'B', entries: [] });
      deckBId = b.id;
    });
    act(() => {
      result.current.updateCard('c1', { isKeyCard: true });
    });
    expect(result.current.decks.find((d) => d.id === deckAId!)?.entries[0].card.isKeyCard).toBe(true);
    expect(result.current.decks.find((d) => d.id === deckBId!)?.entries).toHaveLength(0);
  });

  it('2デッキある状態で importEntries するとアクティブデッキのみエントリが置換される', () => {
    const { result } = renderHook(() => useDeckStore());
    const card = makeCard({ id: 'c1' });
    let deckAId: string, deckBId: string;
    act(() => {
      const a = result.current.saveNewDeck({ name: 'A', entries: [] });
      deckAId = a.id;
    });
    act(() => {
      const b = result.current.saveNewDeck({ name: 'B', entries: [] });
      deckBId = b.id;
      result.current.setActiveDeck(deckAId!);
    });
    act(() => {
      result.current.importEntries([{ card, count: 2 }]);
    });
    expect(result.current.decks.find((d) => d.id === deckAId!)?.entries).toHaveLength(1);
    expect(result.current.decks.find((d) => d.id === deckBId!)?.entries).toHaveLength(0);
  });

  it('2コンボある状態で updateCombo すると対象コンボのみ更新される', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      result.current.addCombo({ name: 'コンボ1', condition: { items: [{ type: 'keycard', minCount: 1 }] } });
    });
    act(() => {
      result.current.addCombo({ name: 'コンボ2', condition: { items: [{ type: 'keycard', minCount: 1 }] } });
    });
    const comboId = result.current.activeDeck!.combos[0].id;
    act(() => {
      result.current.updateCombo(comboId, { name: '更新コンボ' });
    });
    expect(result.current.activeDeck?.combos[0].name).toBe('更新コンボ');
    expect(result.current.activeDeck?.combos[1].name).toBe('コンボ2');
  });

  it('localStorage クリア後の addEntry は entries を変更しない（updateDeck null guard）', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      localStorage.clear();
      result.current.addEntry(makeEntry());
    });
    expect(result.current.decks[0].entries).toHaveLength(0);
  });

  it('localStorage クリア後の updateCard は状態を変更しない（null guard）', () => {
    const { result } = renderHook(() => useDeckStore());
    const card = makeCard({ id: 'c1', isKeyCard: false });
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [{ card, count: 1 }] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      localStorage.clear();
      result.current.updateCard('c1', { isKeyCard: true });
    });
    expect(result.current.decks[0].entries[0].card.isKeyCard).toBe(false);
  });

  it('localStorage クリア後の importEntries は状態を変更しない（null guard）', () => {
    const { result } = renderHook(() => useDeckStore());
    act(() => {
      const deck = result.current.saveNewDeck({ name: 'A', entries: [] });
      result.current.setActiveDeck(deck.id);
    });
    act(() => {
      localStorage.clear();
      result.current.importEntries([makeEntry()]);
    });
    expect(result.current.decks[0].entries).toHaveLength(0);
  });
});
