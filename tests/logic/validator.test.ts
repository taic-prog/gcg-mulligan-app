import { describe, expect, it } from 'vitest';
import { buildCard, canAddCard, validateCard, validateDeck } from '../../src/logic/validator';
import type { Card, CardColor, DeckEntry } from '../../src/types';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'test-id',
    cardNo: 'TEST-001',
    name: 'テストカード',
    cardType: 'ユニット',
    color: '青',
    level: 1,
    cost: 1,
    isKeyCard: false,
    ...overrides,
  };
}

// 50枚構成の基本デッキ: 12種×4枚 + 1種×2枚
function makeValidDeckEntries(): DeckEntry[] {
  return [
    ...Array.from({ length: 12 }, (_, i) => ({
      card: makeCard({ cardNo: `CARD-${String(i + 1).padStart(3, '0')}`, color: '青' as CardColor }),
      count: 4,
    })),
    { card: makeCard({ cardNo: 'CARD-013', color: '青' }), count: 2 },
  ];
}

// -----------------------------------------------------------------------
// validateDeck
// -----------------------------------------------------------------------

describe('validateDeck', () => {
  it('T-VAL-01: 合計50枚で合格', () => {
    const errors = validateDeck(makeValidDeckEntries());
    expect(errors).toHaveLength(0);
  });

  it('T-VAL-02: 合計49枚でエラー', () => {
    const entries = [
      ...Array.from({ length: 12 }, (_, i) => ({
        card: makeCard({ cardNo: `CARD-${i + 1}`, color: '青' as CardColor }),
        count: 4,
      })),
      { card: makeCard({ cardNo: 'CARD-13', color: '青' as CardColor }), count: 1 }, // 2→1 で合計49
    ];
    const errors = validateDeck(entries);
    expect(errors.some((e) => e.field === 'deck')).toBe(true);
  });

  it('T-VAL-03: 合計51枚でエラー', () => {
    const entries = [
      ...Array.from({ length: 12 }, (_, i) => ({
        card: makeCard({ cardNo: `CARD-${i + 1}`, color: '青' as CardColor }),
        count: 4,
      })),
      { card: makeCard({ cardNo: 'CARD-13', color: '青' as CardColor }), count: 3 }, // 2→3 で合計51
    ];
    const errors = validateDeck(entries);
    expect(errors.some((e) => e.field === 'deck')).toBe(true);
  });

  it('T-VAL-04: 同一カードNo. 5枚でエラー', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'DUP' }), count: 3 },
      { card: makeCard({ cardNo: 'DUP', id: 'dup-2' }), count: 2 }, // 合計5枚
      ...Array.from({ length: 10 }, (_, i) => ({
        card: makeCard({ cardNo: `CARD-${i + 1}` }),
        count: 4,
      })),
      { card: makeCard({ cardNo: 'CARD-11' }), count: 1 }, // 3+2+40+1=46 → 足りないが cardNo エラーのみテスト
    ];
    const errors = validateDeck(entries);
    expect(errors.some((e) => e.field === 'cardNo')).toBe(true);
  });

  it('T-VAL-05: 同一カードNo. 4枚で合格（cardNo エラーなし）', () => {
    const errors = validateDeck(makeValidDeckEntries());
    expect(errors.some((e) => e.field === 'cardNo')).toBe(false);
  });

  it('T-VAL-06: 3色使用でエラー', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'A1', color: '青' }), count: 4 },
      { card: makeCard({ cardNo: 'A2', color: '赤' }), count: 4 },
      { card: makeCard({ cardNo: 'A3', color: '緑' }), count: 4 }, // 3色目
      ...Array.from({ length: 9 }, (_, i) => ({
        card: makeCard({ cardNo: `B${i + 1}`, color: '青' as CardColor }),
        count: 4,
      })),
      { card: makeCard({ cardNo: 'C1', color: '青' }), count: 2 }, // 合計: 12+38+2=52 → deck エラーも出るが color エラーをテスト
    ];
    const errors = validateDeck(entries);
    expect(errors.some((e) => e.field === 'color')).toBe(true);
  });

  it('T-VAL-07: 2色使用で合格（color エラーなし）', () => {
    const entries: DeckEntry[] = [
      ...Array.from({ length: 6 }, (_, i) => ({
        card: makeCard({ cardNo: `A${i + 1}`, color: '青' as CardColor }),
        count: 4,
      })),
      ...Array.from({ length: 6 }, (_, i) => ({
        card: makeCard({ cardNo: `B${i + 1}`, color: '赤' as CardColor }),
        count: 4,
      })),
      { card: makeCard({ cardNo: 'C1', color: '青' }), count: 2 },
    ];
    const errors = validateDeck(entries);
    expect(errors.some((e) => e.field === 'color')).toBe(false);
  });
});

// -----------------------------------------------------------------------
// validateCard
// -----------------------------------------------------------------------

describe('validateCard', () => {
  it('T-VAL-08: コストに負数でエラー', () => {
    const errors = validateCard(makeCard({ cost: -1 }));
    expect(errors.some((e) => e.field === 'cost')).toBe(true);
  });

  it('T-VAL-09: カード名が空文字でエラー', () => {
    const errors = validateCard(makeCard({ name: '' }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('T-VAL-09: カード名がスペースのみでエラー', () => {
    const errors = validateCard(makeCard({ name: '   ' }));
    expect(errors.some((e) => e.field === 'name')).toBe(true);
  });

  it('T-VAL-10: Lv. に小数でエラー', () => {
    const errors = validateCard(makeCard({ level: 1.5 }));
    expect(errors.some((e) => e.field === 'level')).toBe(true);
  });

  it('正常なカードはエラーなし', () => {
    const errors = validateCard(makeCard({ name: 'ガンダム', cost: 3, level: 2 }));
    expect(errors).toHaveLength(0);
  });

  it('コスト0は有効', () => {
    const errors = validateCard(makeCard({ cost: 0 }));
    expect(errors.some((e) => e.field === 'cost')).toBe(false);
  });

  it('cost が undefined のときエラー', () => {
    const errors = validateCard({ name: 'テスト', level: 1 });
    expect(errors.some((e) => e.field === 'cost')).toBe(true);
  });

  it('level が undefined のときエラー', () => {
    const errors = validateCard({ name: 'テスト', cost: 1 });
    expect(errors.some((e) => e.field === 'level')).toBe(true);
  });
});

// -----------------------------------------------------------------------
// canAddCard
// -----------------------------------------------------------------------

describe('canAddCard', () => {
  it('デッキ50枚フル時は追加不可', () => {
    const entries: DeckEntry[] = [{ card: makeCard({ cardNo: 'A' }), count: 50 }];
    expect(canAddCard(entries, 'B', 1)).toBe(false);
  });

  it('同一cardNo 4枚到達後は追加不可', () => {
    const entries: DeckEntry[] = [{ card: makeCard({ cardNo: 'A' }), count: 4 }];
    expect(canAddCard(entries, 'A', 1)).toBe(false);
  });

  it('同一cardNo が3枚なら1枚追加可', () => {
    const entries: DeckEntry[] = [{ card: makeCard({ cardNo: 'A' }), count: 3 }];
    expect(canAddCard(entries, 'A', 1)).toBe(true);
  });

  it('空デッキへの追加は可', () => {
    expect(canAddCard([], 'A', 1)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// validateCard — 上限チェック
// -----------------------------------------------------------------------

describe('validateCard 上限', () => {
  it('cost > 20 でエラー', () => {
    const errors = validateCard(makeCard({ cost: 21 }));
    expect(errors.some((e) => e.field === 'cost')).toBe(true);
  });

  it('cost = 20 はエラーなし', () => {
    const errors = validateCard(makeCard({ cost: 20 }));
    expect(errors.some((e) => e.field === 'cost')).toBe(false);
  });

  it('level > 20 でエラー', () => {
    const errors = validateCard(makeCard({ level: 21 }));
    expect(errors.some((e) => e.field === 'level')).toBe(true);
  });

  it('level = 20 はエラーなし', () => {
    const errors = validateCard(makeCard({ level: 20 }));
    expect(errors.some((e) => e.field === 'level')).toBe(false);
  });
});

// -----------------------------------------------------------------------
// buildCard
// -----------------------------------------------------------------------

describe('buildCard', () => {
  it('必須フィールドからCardを生成する', () => {
    const card = buildCard({
      cardNo: 'GD01-001', name: 'ガンダム', cardType: 'ユニット',
      color: '青', level: 1, cost: 2, isKeyCard: false,
    });
    expect(card.cardNo).toBe('GD01-001');
    expect(card.name).toBe('ガンダム');
    expect(card.isKeyCard).toBe(false);
  });

  it('id が UUID 形式で生成される', () => {
    const card = buildCard({
      cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット',
      color: '青', level: 1, cost: 1, isKeyCard: false,
    });
    expect(card.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/i);
  });

  it('呼ぶたびに異なる id が生成される', () => {
    const base = { cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット' as const, color: '青' as const, level: 1, cost: 1, isKeyCard: false };
    const a = buildCard(base);
    const b = buildCard(base);
    expect(a.id).not.toBe(b.id);
  });

  it('terrain が truthy なら含まれる', () => {
    const card = buildCard(
      { cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false },
      { terrain: '宇宙' }
    );
    expect(card.terrain).toBe('宇宙');
  });

  it('terrain が空文字なら含まれない', () => {
    const card = buildCard(
      { cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false },
      { terrain: '' }
    );
    expect(card.terrain).toBeUndefined();
  });

  it('feature・link も同様に truthy なら含まれ、falsy なら含まれない', () => {
    const withOpt = buildCard(
      { cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false },
      { feature: '〔地球連邦〕', link: '「アムロ・レイ」' }
    );
    expect(withOpt.feature).toBe('〔地球連邦〕');
    expect(withOpt.link).toBe('「アムロ・レイ」');

    const withoutOpt = buildCard(
      { cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット', color: '青', level: 1, cost: 1, isKeyCard: false }
    );
    expect(withoutOpt.feature).toBeUndefined();
    expect(withoutOpt.link).toBeUndefined();
  });
});
