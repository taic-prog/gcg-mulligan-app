import { describe, expect, it } from 'vitest';
import { exportDeckText } from '../../src/logic/deckExport';
import type { Card, Deck } from '../../src/types';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-id',
    cardNo: 'GD01-001',
    name: 'テストカード',
    cardType: 'ユニット',
    color: '青',
    level: 1,
    cost: 1,
    isKeyCard: false,
    ...overrides,
  };
}

function makeDeck(overrides: Partial<Deck> = {}): Deck {
  return {
    id: 'deck-id',
    name: 'テストデッキ',
    entries: [],
    combos: [],
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('exportDeckText', () => {
  it('先頭行にデッキ名が # コメントとして出力される', () => {
    const deck = makeDeck({ name: 'マイデッキ', entries: [] });
    const result = exportDeckText(deck);
    expect(result.startsWith('# マイデッキ')).toBe(true);
  });

  it('各エントリが「cardNo 枚数」形式で出力される', () => {
    const deck = makeDeck({
      entries: [{ card: makeCard({ cardNo: 'GD01-001' }), count: 3 }],
    });
    const result = exportDeckText(deck);
    expect(result).toContain('GD01-001 3');
  });

  it('複数エントリが全て出力される', () => {
    const deck = makeDeck({
      entries: [
        { card: makeCard({ cardNo: 'GD01-001' }), count: 4 },
        { card: makeCard({ cardNo: 'GD01-002' }), count: 2 },
        { card: makeCard({ cardNo: 'ST01-001' }), count: 1 },
      ],
    });
    const result = exportDeckText(deck);
    const lines = result.split('\n');
    expect(lines).toHaveLength(4); // ヘッダ + 3エントリ
    expect(lines[1]).toBe('GD01-001 4');
    expect(lines[2]).toBe('GD01-002 2');
    expect(lines[3]).toBe('ST01-001 1');
  });

  it('エントリなしデッキはヘッダ行のみ', () => {
    const deck = makeDeck({ name: '空デッキ', entries: [] });
    const result = exportDeckText(deck);
    expect(result).toBe('# 空デッキ');
  });

  it('parseDeckText でインポートし直せる内容が出力される', async () => {
    const { parseDeckText } = await import('../../src/logic/deckImport');
    const deck = makeDeck({
      entries: [
        { card: makeCard({ cardNo: 'GD01-001' }), count: 4 },
        { card: makeCard({ cardNo: 'GD01-002' }), count: 2 },
      ],
    });
    const text = exportDeckText(deck);
    const parsed = parseDeckText(text);
    expect(parsed).toHaveLength(2);
    expect(parsed[0]).toEqual({ cardNo: 'GD01-001', count: 4 });
    expect(parsed[1]).toEqual({ cardNo: 'GD01-002', count: 2 });
  });
});
