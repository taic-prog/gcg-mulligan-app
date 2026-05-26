import { describe, expect, it } from 'vitest';
import {
  calculateComboProbability,
  calculateExpectedCost,
  calculateKeyCardProbability,
  checkComboCondition,
  combination,
  computeRemainingEntries,
} from '../../src/logic/calculator';
import type { Card, ComboCondition, DeckEntry } from '../../src/types';

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

function makeUniformDeck(cost: number): DeckEntry[] {
  return [{ card: makeCard({ cost }), count: 50 }];
}

// -----------------------------------------------------------------------
// combination
// -----------------------------------------------------------------------

describe('combination', () => {
  it('T-CALC-09: C(50,5) = 2118760', () => {
    expect(combination(50, 5)).toBe(2118760);
  });

  it('T-CALC-10: C(n,0) = 1', () => {
    expect(combination(50, 0)).toBe(1);
    expect(combination(1, 0)).toBe(1);
    expect(combination(0, 0)).toBe(1);
  });

  it('T-CALC-11: C(n,n) = 1', () => {
    expect(combination(5, 5)).toBe(1);
    expect(combination(50, 50)).toBe(1);
  });

  it('T-CALC-12: k > n のとき 0 を返す', () => {
    expect(combination(3, 5)).toBe(0);
    expect(combination(0, 5)).toBe(0);
  });
});

// -----------------------------------------------------------------------
// calculateExpectedCost
// -----------------------------------------------------------------------

describe('calculateExpectedCost', () => {
  it('T-CALC-01: 50枚均一コストデッキで期待値が正しい', () => {
    const result = calculateExpectedCost(makeUniformDeck(3));
    expect(result.totalHandCost).toBeCloseTo(15.0, 2);
    expect(result.averageCostPerCard).toBeCloseTo(3.0, 2);
  });

  it('T-CALC-02: コスト0のカードのみのデッキで期待値=0', () => {
    const result = calculateExpectedCost(makeUniformDeck(0));
    expect(result.totalHandCost).toBe(0);
    expect(result.averageCostPerCard).toBe(0);
  });

  it('T-CALC-03: デッキが50枚未満のとき例外をスロー', () => {
    const entries: DeckEntry[] = [{ card: makeCard(), count: 49 }];
    expect(() => calculateExpectedCost(entries)).toThrow();
  });

  it('T-CALC-04: 既知の分散値との比較（コスト2×25枚 + コスト4×25枚）', () => {
    // Var = 225/49 (超幾何分布の正確な式より)
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'A', cost: 2 }), count: 25 },
      { card: makeCard({ cardNo: 'B', cost: 4 }), count: 25 },
    ];
    const result = calculateExpectedCost(entries);
    expect(result.totalHandCost).toBeCloseTo(15.0, 4);
    expect(result.variance).toBeCloseTo(225 / 49, 4);
    expect(result.standardDeviation).toBeCloseTo(Math.sqrt(225 / 49), 4);
  });

  it('コスト分布の確率の合計が1になる', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'A', cost: 2 }), count: 25 },
      { card: makeCard({ cardNo: 'B', cost: 4 }), count: 25 },
    ];
    const { costDistribution } = calculateExpectedCost(entries);
    const total = Object.values(costDistribution).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1.0, 6);
  });

  it('均一コストデッキはその総コストのみ確率1.0を持つ', () => {
    const { costDistribution } = calculateExpectedCost(makeUniformDeck(2));
    expect(costDistribution[10]).toBeCloseTo(1.0, 6);
    const otherSum = Object.entries(costDistribution)
      .filter(([cost]) => Number(cost) !== 10)
      .reduce((sum, [, p]) => sum + p, 0);
    expect(otherSum).toBeCloseTo(0, 6);
  });
});

// -----------------------------------------------------------------------
// calculateKeyCardProbability
// -----------------------------------------------------------------------

describe('calculateKeyCardProbability', () => {
  it('T-CALC-05: K=4 のとき確率値が正しい', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'KEY', isKeyCard: true }), count: 4 },
      { card: makeCard({ cardNo: 'OTHER' }), count: 46 },
    ];
    const result = calculateKeyCardProbability(entries);
    // P(1枚以上) = 1 - C(46,5)/C(50,5)
    const expected = 1 - combination(46, 5) / combination(50, 5);
    expect(result.probInitialHand).toBeCloseTo(expected, 6);
    expect(result.totalKeyCardCount).toBe(4);
  });

  it('T-CALC-06: K=0 のとき確率=0', () => {
    const result = calculateKeyCardProbability(makeUniformDeck(2));
    expect(result.probInitialHand).toBe(0);
    expect(result.probAfterMulligan).toBe(0);
    expect(result.totalKeyCardCount).toBe(0);
  });

  it('T-CALC-07: K=50 のとき確率=1', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ isKeyCard: true }), count: 50 },
    ];
    const result = calculateKeyCardProbability(entries);
    expect(result.probInitialHand).toBe(1);
    expect(result.probAfterMulligan).toBe(1);
  });

  it('T-CALC-08: マリガンあり（2回試行）の確率が正しい', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'KEY', isKeyCard: true }), count: 4 },
      { card: makeCard({ cardNo: 'OTHER' }), count: 46 },
    ];
    const result = calculateKeyCardProbability(entries);
    const p0 = combination(46, 5) / combination(50, 5);
    const expectedMulligan = 1 - p0 ** 2;
    expect(result.probAfterMulligan).toBeCloseTo(expectedMulligan, 6);
    // マリガンありの確率はなしより高い
    expect(result.probAfterMulligan).toBeGreaterThan(result.probInitialHand);
  });
});

// -----------------------------------------------------------------------
// checkComboCondition
// -----------------------------------------------------------------------

function makeHandCard(overrides: Partial<Card> = {}): Card {
  return {
    id: 'h-1', cardNo: 'GD01-001', name: 'テスト', cardType: 'ユニット',
    color: '青', level: 1, cost: 1, isKeyCard: false, ...overrides,
  };
}

describe('checkComboCondition', () => {
  it('card タイプ: 指定IDが手札にあれば成立', () => {
    const hand = [makeHandCard({ id: 'card-a' }), makeHandCard({ id: 'card-b' })];
    const condition: ComboCondition = { items: [{ type: 'card', cardId: 'card-a', minCount: 1 }] };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });

  it('card タイプ: 指定IDが手札になければ不成立', () => {
    const hand = [makeHandCard({ id: 'card-b' })];
    const condition: ComboCondition = { items: [{ type: 'card', cardId: 'card-a', minCount: 1 }] };
    expect(checkComboCondition(hand, condition)).toBe(false);
  });

  it('attr タイプ: 色フィルタが一致するカードが minCount 以上で成立', () => {
    const hand = [
      makeHandCard({ id: '1', color: '赤' }),
      makeHandCard({ id: '2', color: '赤' }),
      makeHandCard({ id: '3', color: '青' }),
    ];
    const condition: ComboCondition = { items: [{ type: 'attr', filterColor: '赤', minCount: 2 }] };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });

  it('attr タイプ: minCount を満たさなければ不成立', () => {
    const hand = [makeHandCard({ color: '赤' })];
    const condition: ComboCondition = { items: [{ type: 'attr', filterColor: '赤', minCount: 2 }] };
    expect(checkComboCondition(hand, condition)).toBe(false);
  });

  it('keycard タイプ: キーカードが minCount 以上で成立', () => {
    const hand = [
      makeHandCard({ isKeyCard: true }),
      makeHandCard({ isKeyCard: true }),
      makeHandCard({ isKeyCard: false }),
    ];
    const condition: ComboCondition = { items: [{ type: 'keycard', minCount: 2 }] };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });

  it('keycard タイプ: キーカードが minCount 未満で不成立', () => {
    const hand = [makeHandCard({ isKeyCard: true }), makeHandCard({ isKeyCard: false })];
    const condition: ComboCondition = { items: [{ type: 'keycard', minCount: 2 }] };
    expect(checkComboCondition(hand, condition)).toBe(false);
  });

  it('複数条件はすべて成立する必要がある', () => {
    const hand = [
      makeHandCard({ id: 'a', isKeyCard: true }),
      makeHandCard({ id: 'b', color: '赤' }),
    ];
    const condition: ComboCondition = {
      items: [
        { type: 'keycard', minCount: 1 },
        { type: 'attr', filterColor: '赤', minCount: 1 },
      ],
    };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });

  it('条件が0件なら常に成立', () => {
    const hand = [makeHandCard()];
    expect(checkComboCondition(hand, { items: [] })).toBe(true);
  });

  it('attr タイプ: filterLevel でフィルタ（一致/不一致の両分岐）', () => {
    const hand = [makeHandCard({ id: '1', level: 2 }), makeHandCard({ id: '2', level: 3 })];
    const condition: ComboCondition = { items: [{ type: 'attr', filterLevel: 2, minCount: 1 }] };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });

  it('attr タイプ: filterCost でフィルタ（一致/不一致の両分岐）', () => {
    const hand = [makeHandCard({ id: '1', cost: 3 }), makeHandCard({ id: '2', cost: 1 })];
    const condition: ComboCondition = { items: [{ type: 'attr', filterCost: 3, minCount: 1 }] };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });

  it('attr タイプ: filterCost 不一致で不成立', () => {
    const hand = [makeHandCard({ cost: 1 })];
    const condition: ComboCondition = { items: [{ type: 'attr', filterCost: 5, minCount: 1 }] };
    expect(checkComboCondition(hand, condition)).toBe(false);
  });

  it('attr タイプ: filterCardType 不一致で不成立（Branch B2 for filterCardType）', () => {
    const hand = [makeHandCard({ cardType: 'パイロット' })];
    const condition: ComboCondition = { items: [{ type: 'attr', filterCardType: 'ユニット', minCount: 1 }] };
    expect(checkComboCondition(hand, condition)).toBe(false);
  });

  it('attr タイプ: 4フィルタすべて指定して一致', () => {
    const hand = [makeHandCard({ cardType: 'ユニット', color: '赤', level: 2, cost: 3 })];
    const condition: ComboCondition = {
      items: [{ type: 'attr', filterCardType: 'ユニット', filterColor: '赤', filterLevel: 2, filterCost: 3, minCount: 1 }],
    };
    expect(checkComboCondition(hand, condition)).toBe(true);
  });
});

// -----------------------------------------------------------------------
// computeRemainingEntries
// -----------------------------------------------------------------------

describe('computeRemainingEntries', () => {
  it('手札のカードがエントリから減算される', () => {
    const card = makeHandCard({ id: 'c1', cardNo: 'GD01-001' });
    const entries: DeckEntry[] = [{ card, count: 3 }];
    const hand = [card];
    const remaining = computeRemainingEntries(entries, hand);
    expect(remaining[0].count).toBe(2);
  });

  it('count が 1 のカードを手札に持つとエントリから消える', () => {
    const card = makeHandCard({ id: 'c1' });
    const entries: DeckEntry[] = [{ card, count: 1 }];
    const remaining = computeRemainingEntries(entries, [card]);
    expect(remaining).toHaveLength(0);
  });

  it('手札に entries にないカードがあっても無視される', () => {
    const cardA = makeHandCard({ id: 'a', cardNo: 'A' });
    const entries: DeckEntry[] = [{ card: cardA, count: 2 }];
    const extraCard = makeHandCard({ id: 'not-in-deck', cardNo: 'X' });
    const remaining = computeRemainingEntries(entries, [cardA, extraCard]);
    expect(remaining[0].count).toBe(1);
  });

  it('手札にないカードは変化しない', () => {
    const cardA = makeHandCard({ id: 'a', cardNo: 'A' });
    const cardB = makeHandCard({ id: 'b', cardNo: 'B' });
    const entries: DeckEntry[] = [
      { card: cardA, count: 2 },
      { card: cardB, count: 4 },
    ];
    const remaining = computeRemainingEntries(entries, [cardA]);
    const bEntry = remaining.find((e) => e.card.id === 'b');
    expect(bEntry?.count).toBe(4);
  });
});

// -----------------------------------------------------------------------
// calculateComboProbability
// -----------------------------------------------------------------------

describe('calculateComboProbability', () => {
  it('条件が0件のとき null を返す', () => {
    const entries: DeckEntry[] = [{ card: makeHandCard(), count: 50 }];
    expect(calculateComboProbability(entries, { items: [] })).toBeNull();
  });

  it('デッキ枚数が手札サイズ未満のとき null を返す', () => {
    const entries: DeckEntry[] = [{ card: makeHandCard({ id: 'a' }), count: 4 }];
    const condition: ComboCondition = { items: [{ type: 'keycard', minCount: 1 }] };
    expect(calculateComboProbability(entries, condition)).toBeNull();
  });

  it('card タイプで存在しないカードID のとき null を返す', () => {
    const entries: DeckEntry[] = [{ card: makeHandCard({ id: 'a' }), count: 50 }];
    const condition: ComboCondition = { items: [{ type: 'card', cardId: 'nonexistent', minCount: 1 }] };
    expect(calculateComboProbability(entries, condition)).toBeNull();
  });

  it('attr タイプでフィルタ未指定のとき null を返す', () => {
    const entries: DeckEntry[] = [{ card: makeHandCard(), count: 50 }];
    const condition: ComboCondition = { items: [{ type: 'attr', minCount: 1 }] };
    expect(calculateComboProbability(entries, condition)).toBeNull();
  });

  it('keycard タイプ: 全カードがキーカードなら初期手札確率=1', () => {
    const entries: DeckEntry[] = [{ card: makeHandCard({ isKeyCard: true }), count: 50 }];
    const condition: ComboCondition = { items: [{ type: 'keycard', minCount: 1 }] };
    const result = calculateComboProbability(entries, condition);
    expect(result?.probInitialHand).toBeCloseTo(1, 6);
  });

  it('card タイプ: 返り値が0〜1の範囲内', () => {
    const card = makeHandCard({ id: 'k' });
    const entries: DeckEntry[] = [
      { card, count: 4 },
      { card: makeHandCard({ id: 'other', cardNo: 'OTHER' }), count: 46 },
    ];
    const condition: ComboCondition = { items: [{ type: 'card', cardId: 'k', minCount: 1 }] };
    const result = calculateComboProbability(entries, condition);
    expect(result?.probInitialHand).toBeGreaterThanOrEqual(0);
    expect(result?.probInitialHand).toBeLessThanOrEqual(1);
    expect(result?.probAfterMulligan).toBeGreaterThan(result?.probInitialHand ?? 0);
  });

  it('attr タイプ: 色フィルタで確率が0〜1の範囲内', () => {
    const entries: DeckEntry[] = [
      { card: makeHandCard({ id: 'r1', cardNo: 'R1', color: '赤' }), count: 12 },
      { card: makeHandCard({ id: 'b1', cardNo: 'B1', color: '青' }), count: 38 },
    ];
    const condition: ComboCondition = { items: [{ type: 'attr', filterColor: '赤', minCount: 1 }] };
    const result = calculateComboProbability(entries, condition);
    expect(result).not.toBeNull();
    expect(result?.probInitialHand).toBeGreaterThan(0);
    expect(result?.probInitialHand).toBeLessThanOrEqual(1);
  });

  it('attr タイプ: 複数フィルタの組み合わせ', () => {
    const entries: DeckEntry[] = [
      { card: makeHandCard({ id: 'u1', cardNo: 'U1', color: '赤', cardType: 'ユニット', level: 2, cost: 2 }), count: 10 },
      { card: makeHandCard({ id: 'b1', cardNo: 'B1', color: '青' }), count: 40 },
    ];
    const condition: ComboCondition = {
      items: [{ type: 'attr', filterColor: '赤', filterCardType: 'ユニット', minCount: 1 }],
    };
    const result = calculateComboProbability(entries, condition);
    expect(result).not.toBeNull();
    expect(result?.probInitialHand).toBeGreaterThan(0);
  });

  it('attr タイプ: filterLevel で確率計算', () => {
    const entries: DeckEntry[] = [
      { card: makeHandCard({ id: 'lv2', cardNo: 'L2', level: 2 }), count: 10 },
      { card: makeHandCard({ id: 'lv3', cardNo: 'L3', level: 3 }), count: 40 },
    ];
    const condition: ComboCondition = { items: [{ type: 'attr', filterLevel: 2, minCount: 1 }] };
    const result = calculateComboProbability(entries, condition);
    expect(result).not.toBeNull();
    expect(result?.probInitialHand).toBeGreaterThan(0);
  });

  it('attr タイプ: filterCost で確率計算', () => {
    const entries: DeckEntry[] = [
      { card: makeHandCard({ id: 'c1', cardNo: 'C1', cost: 1 }), count: 10 },
      { card: makeHandCard({ id: 'c3', cardNo: 'C3', cost: 3 }), count: 40 },
    ];
    const condition: ComboCondition = { items: [{ type: 'attr', filterCost: 1, minCount: 1 }] };
    const result = calculateComboProbability(entries, condition);
    expect(result).not.toBeNull();
    expect(result?.probInitialHand).toBeGreaterThan(0);
  });

  it('条件の合計 deckCount がデッキ枚数を超えるとき null を返す', () => {
    // キーカードが赤でもある場合 keycard と attr(赤) で二重カウント → otherDeckCount<0
    const entries: DeckEntry[] = [
      { card: makeHandCard({ id: 'k1', cardNo: 'K1', color: '赤', isKeyCard: true }), count: 3 },
      { card: makeHandCard({ id: 'k2', cardNo: 'K2', color: '赤', isKeyCard: true }), count: 3 },
    ];
    const condition: ComboCondition = {
      items: [
        { type: 'keycard', minCount: 1 },
        { type: 'attr', filterColor: '赤', minCount: 1 },
      ],
    };
    expect(calculateComboProbability(entries, condition)).toBeNull();
  });

  it('card タイプと attr タイプの混合条件', () => {
    const keyCard = makeHandCard({ id: 'key', cardNo: 'KEY' });
    const entries: DeckEntry[] = [
      { card: keyCard, count: 4 },
      { card: makeHandCard({ id: 'r1', cardNo: 'R1', color: '赤' }), count: 10 },
      { card: makeHandCard({ id: 'b1', cardNo: 'B1', color: '青' }), count: 36 },
    ];
    const condition: ComboCondition = {
      items: [
        { type: 'card', cardId: 'key', minCount: 1 },
        { type: 'attr', filterColor: '赤', minCount: 1 },
      ],
    };
    const result = calculateComboProbability(entries, condition);
    expect(result).not.toBeNull();
    expect(result?.probInitialHand).toBeGreaterThanOrEqual(0);
  });
});
