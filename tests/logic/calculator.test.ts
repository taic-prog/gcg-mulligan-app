import { describe, expect, it } from 'vitest';
import { calculateExpectedCost, calculateKeyCardProbability, combination } from '../../src/logic/calculator';
import type { Card, DeckEntry } from '../../src/types';

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
