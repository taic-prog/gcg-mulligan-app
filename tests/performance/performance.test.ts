import { describe, expect, it } from 'vitest';
import { calculateExpectedCost } from '../../src/logic/calculator';
import { runMultipleSimulations } from '../../src/logic/simulator';
import type { Card, DeckEntry } from '../../src/types';

// 現実的な50枚デッキ（コスト分布あり、キーカードあり）
function makeRealisticDeck(): DeckEntry[] {
  const specs: { cost: number; count: number; isKeyCard?: boolean }[] = [
    { cost: 0, count: 4 },
    { cost: 1, count: 8 },
    { cost: 2, count: 12 },
    { cost: 3, count: 12, isKeyCard: true },
    { cost: 4, count: 8 },
    { cost: 5, count: 4 },
    { cost: 6, count: 2 },
  ];
  // 合計 4+8+12+12+8+4+2 = 50 ✓
  return specs.map(({ cost, count, isKeyCard }, i) => ({
    card: {
      id: `card-${i}`,
      cardNo: `PERF-${String(i).padStart(3, '0')}`,
      name: `カード${i}`,
      cardType: 'ユニット',
      color: '青',
      level: 1,
      cost,
      isKeyCard: isKeyCard ?? false,
    } satisfies Card,
    count,
  }));
}

describe('NFR-01: calculateExpectedCost は 1 秒以内に完了する', () => {
  it('50枚デッキの期待値計算が 1000ms 未満', () => {
    const deck = makeRealisticDeck();
    const start = performance.now();
    const result = calculateExpectedCost(deck);
    const elapsed = performance.now() - start;

    expect(result.totalHandCost).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(1000);
  });

  it('最大カード種数（50種×1枚）でも 1000ms 未満', () => {
    // 50種類すべて異なる cardNo / cost のデッキ
    const deck: DeckEntry[] = Array.from({ length: 50 }, (_, i) => ({
      card: {
        id: `card-${i}`,
        cardNo: `CARD-${i}`,
        name: `カード${i}`,
        cardType: 'ユニット',
        color: '青',
        level: 1,
        cost: i % 7,
        isKeyCard: false,
      } satisfies Card,
      count: 1,
    }));

    const start = performance.now();
    calculateExpectedCost(deck);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(1000);
  });
});

describe('NFR-02: runMultipleSimulations(10000) は 3 秒以内に完了する', () => {
  it('10000回シミュレーションが 3000ms 未満', () => {
    const deck = makeRealisticDeck();
    const start = performance.now();
    const stats = runMultipleSimulations(deck, 10000);
    const elapsed = performance.now() - start;

    expect(stats.trialCount).toBe(10000);
    expect(elapsed).toBeLessThan(3000);
  });
});
