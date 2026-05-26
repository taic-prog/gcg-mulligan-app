import { describe, expect, it } from 'vitest';
import { combination } from '../../src/logic/calculator';
import {
  drawHand,
  expandDeck,
  fisherYatesShuffle,
  runMultipleSimulations,
  simulateBothPlayabilityModes,
  simulateCustomPlayability,
  simulateMulligan,
  simulatePlayability,
} from '../../src/logic/simulator';
import type { Card, DeckEntry } from '../../src/types';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    id: crypto.randomUUID(),
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

// 50枚デッキ（キーカードなし）
function makeStandardDeck(): DeckEntry[] {
  return [{ card: makeCard({ cost: 2 }), count: 50 }];
}

// 50枚デッキ（キーカード K 枚）
function makeDeckWithKeyCards(keyCount: number): DeckEntry[] {
  const entries: DeckEntry[] = [];
  if (keyCount > 0) {
    entries.push({ card: makeCard({ cardNo: 'KEY', isKeyCard: true, cost: 3 }), count: keyCount });
  }
  entries.push({ card: makeCard({ cardNo: 'NORMAL', cost: 1 }), count: 50 - keyCount });
  return entries;
}

// -----------------------------------------------------------------------
// fisherYatesShuffle
// -----------------------------------------------------------------------

describe('fisherYatesShuffle', () => {
  it('T-SIM-01: シャッフル後も要素数が変わらない', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle(arr);
    expect(result).toHaveLength(arr.length);
  });

  it('T-SIM-02: シャッフル後も全要素が含まれる', () => {
    const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = fisherYatesShuffle(arr);
    expect(result.sort((a, b) => a - b)).toEqual([...arr].sort((a, b) => a - b));
  });

  it('元の配列を変更しない', () => {
    const arr = [1, 2, 3, 4, 5];
    const original = [...arr];
    fisherYatesShuffle(arr);
    expect(arr).toEqual(original);
  });
});

// -----------------------------------------------------------------------
// expandDeck
// -----------------------------------------------------------------------

describe('expandDeck', () => {
  it('各エントリを count 枚分展開する', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'A' }), count: 3 },
      { card: makeCard({ cardNo: 'B' }), count: 2 },
    ];
    const result = expandDeck(entries);
    expect(result).toHaveLength(5);
  });
});

// -----------------------------------------------------------------------
// drawHand
// -----------------------------------------------------------------------

describe('drawHand', () => {
  it('T-SIM-03: 5枚引ける', () => {
    const hand = drawHand(makeStandardDeck());
    expect(hand).toHaveLength(5);
  });

  it('T-SIM-04: デッキが5枚未満のとき例外をスロー', () => {
    const entries: DeckEntry[] = [{ card: makeCard(), count: 4 }];
    expect(() => drawHand(entries)).toThrow();
  });

  it('引いたカードはデッキ内のカードである', () => {
    const entries: DeckEntry[] = [
      { card: makeCard({ cardNo: 'A', cost: 2 }), count: 30 },
      { card: makeCard({ cardNo: 'B', cost: 4 }), count: 20 },
    ];
    const hand = drawHand(entries);
    hand.forEach((card) => {
      expect(['A', 'B']).toContain(card.cardNo);
    });
  });
});

// -----------------------------------------------------------------------
// simulateMulligan
// -----------------------------------------------------------------------

describe('simulateMulligan', () => {
  it('T-SIM-05: マリガン後も5枚引ける', () => {
    const result = simulateMulligan(makeStandardDeck());
    expect(result.hand).toHaveLength(5);
  });

  it('mulliganCount が 1 である', () => {
    const result = simulateMulligan(makeStandardDeck());
    expect(result.mulliganCount).toBe(1);
  });

  it('手札の総コストが正しく計算されている', () => {
    // 全カードがコスト2のデッキ → 総コストは必ず10
    const result = simulateMulligan(makeStandardDeck());
    expect(result.totalCost).toBe(10);
  });

  it('キーカードなしデッキでは containsKeyCard = false', () => {
    const result = simulateMulligan(makeStandardDeck());
    expect(result.containsKeyCard).toBe(false);
  });

  it('全カードがキーカードなら containsKeyCard = true', () => {
    const entries: DeckEntry[] = [{ card: makeCard({ isKeyCard: true }), count: 50 }];
    const result = simulateMulligan(entries);
    expect(result.containsKeyCard).toBe(true);
  });
});

// -----------------------------------------------------------------------
// runMultipleSimulations
// -----------------------------------------------------------------------

describe('runMultipleSimulations', () => {
  it('T-SIM-06: trialCount が指定回数と一致する', () => {
    const stats = runMultipleSimulations(makeStandardDeck(), 100);
    expect(stats.trialCount).toBe(100);
  });

  it('T-SIM-06: 1000回・10000回でも trialCount が正しい', () => {
    expect(runMultipleSimulations(makeStandardDeck(), 1000).trialCount).toBe(1000);
    expect(runMultipleSimulations(makeStandardDeck(), 10000).trialCount).toBe(10000);
  });

  it('T-SIM-07: 実測キーカード含有率が理論値±5%以内（1000回、K=10）', () => {
    const K = 10;
    const entries = makeDeckWithKeyCards(K);
    const stats = runMultipleSimulations(entries, 1000);

    // 理論値: P(1枚以上) = 1 - C(40,5)/C(50,5)
    const theoretical = 1 - combination(50 - K, 5) / combination(50, 5);
    expect(Math.abs(stats.keyCardHitRate - theoretical)).toBeLessThan(0.05);
  });

  it('コスト分布の確率の合計が 1 になる', () => {
    const stats = runMultipleSimulations(makeStandardDeck(), 100);
    const total = Object.values(stats.costDistribution).reduce((sum, p) => sum + p, 0);
    expect(total).toBeCloseTo(1.0, 5);
  });

  it('均一コストデッキの平均コストが理論値に近い（1000回）', () => {
    // 全カードコスト2 → 手札5枚の平均コストは必ず10
    const stats = runMultipleSimulations(makeStandardDeck(), 1000);
    expect(stats.averageCost).toBeCloseTo(10, 0);
  });

  it('標準偏差が0以上', () => {
    const stats = runMultipleSimulations(makeStandardDeck(), 100);
    expect(stats.standardDeviation).toBeGreaterThanOrEqual(0);
  });

  it('comboCheck を渡すと comboHitRate が返る', () => {
    const stats = runMultipleSimulations(makeStandardDeck(), 100, () => true);
    expect(stats.comboHitRate).toBe(1);
  });

  it('comboCheck なしは comboHitRate が undefined', () => {
    const stats = runMultipleSimulations(makeStandardDeck(), 100);
    expect(stats.comboHitRate).toBeUndefined();
  });
});

// -----------------------------------------------------------------------
// simulatePlayability
// -----------------------------------------------------------------------

function makePlayabilityDeck(): DeckEntry[] {
  return [
    { card: makeCard({ cardNo: 'C1', cost: 1, level: 1 }), count: 12 },
    { card: makeCard({ cardNo: 'C2', cost: 2, level: 2 }), count: 12 },
    { card: makeCard({ cardNo: 'C3', cost: 3, level: 3 }), count: 12 },
    { card: makeCard({ cardNo: 'C4', cost: 4, level: 4 }), count: 14 },
  ];
}

describe('simulatePlayability', () => {
  it('返り値の各確率が 0〜1 の範囲内', () => {
    const stats = simulatePlayability(makePlayabilityDeck(), false, 500);
    expect(stats.turn1Rate).toBeGreaterThanOrEqual(0);
    expect(stats.turn1Rate).toBeLessThanOrEqual(1);
    expect(stats.turn2Rate).toBeGreaterThanOrEqual(0);
    expect(stats.turn3Rate).toBeGreaterThanOrEqual(0);
    expect(stats.allTurnsRate).toBeGreaterThanOrEqual(0);
    expect(stats.t2t3Rate).toBeGreaterThanOrEqual(0);
  });

  it('trialCount が指定値と一致', () => {
    const stats = simulatePlayability(makePlayabilityDeck(), false, 200);
    expect(stats.trialCount).toBe(200);
  });

  it('allTurnsRate は turn1Rate・turn2Rate・turn3Rate を超えない', () => {
    const stats = simulatePlayability(makePlayabilityDeck(), false, 500);
    expect(stats.allTurnsRate).toBeLessThanOrEqual(stats.turn1Rate + 0.01);
    expect(stats.allTurnsRate).toBeLessThanOrEqual(stats.turn2Rate + 0.01);
    expect(stats.allTurnsRate).toBeLessThanOrEqual(stats.turn3Rate + 0.01);
  });

  it('multiCardMode=true でも同形の結果が返る', () => {
    const stats = simulatePlayability(makePlayabilityDeck(), true, 200);
    expect(stats.turn1Rate).toBeGreaterThanOrEqual(0);
    expect(stats.trialCount).toBe(200);
  });
});

// -----------------------------------------------------------------------
// simulateBothPlayabilityModes
// -----------------------------------------------------------------------

describe('simulateBothPlayabilityModes', () => {
  it('single と multi の両方が返る', () => {
    const result = simulateBothPlayabilityModes(makePlayabilityDeck(), 200);
    expect(result.single).toBeDefined();
    expect(result.multi).toBeDefined();
  });

  it('両モードとも trialCount が一致', () => {
    const result = simulateBothPlayabilityModes(makePlayabilityDeck(), 300);
    expect(result.single.trialCount).toBe(300);
    expect(result.multi.trialCount).toBe(300);
  });

  it('各確率が 0〜1 の範囲内', () => {
    const { single, multi } = simulateBothPlayabilityModes(makePlayabilityDeck(), 200);
    for (const stats of [single, multi]) {
      expect(stats.turn1Rate).toBeGreaterThanOrEqual(0);
      expect(stats.turn1Rate).toBeLessThanOrEqual(1);
      expect(stats.allTurnsRate).toBeLessThanOrEqual(1);
    }
  });
});

// -----------------------------------------------------------------------
// simulateCustomPlayability
// -----------------------------------------------------------------------

describe('simulateCustomPlayability', () => {
  it('turnCardIds が全て空セットなら全確率=1', () => {
    const stats = simulateCustomPlayability(
      makePlayabilityDeck(),
      [new Set(), new Set(), new Set()],
      200
    );
    expect(stats.turn1Rate).toBe(1);
    expect(stats.turn2Rate).toBe(1);
    expect(stats.turn3Rate).toBe(1);
    expect(stats.allTurnsRate).toBe(1);
  });

  it('trialCount が一致', () => {
    const stats = simulateCustomPlayability(makePlayabilityDeck(), [new Set(), new Set(), new Set()], 150);
    expect(stats.trialCount).toBe(150);
  });

  it('存在しないカードIDのみ指定すると確率=0', () => {
    const stats = simulateCustomPlayability(
      makePlayabilityDeck(),
      [new Set(['nonexistent-id']), new Set(), new Set()],
      200
    );
    expect(stats.turn1Rate).toBe(0);
    expect(stats.allTurnsRate).toBe(0);
  });

  it('T2 のみ失敗する場合 turn2Rate=0 かつ t2t3Rate=0', () => {
    const stats = simulateCustomPlayability(
      makePlayabilityDeck(),
      [new Set(), new Set(['nonexistent']), new Set()],
      200
    );
    expect(stats.turn2Rate).toBe(0);
    expect(stats.t2t3Rate).toBe(0);
  });

  it('T3 のみ失敗する場合 turn3Rate=0 かつ t2t3Rate=0', () => {
    const stats = simulateCustomPlayability(
      makePlayabilityDeck(),
      [new Set(), new Set(), new Set(['nonexistent'])],
      200
    );
    expect(stats.turn3Rate).toBe(0);
    expect(stats.t2t3Rate).toBe(0);
  });

  it('全ターンで同一カードIDを指定し全カードがそのIDなら全確率=1（hit&&t<2のsplice分岐）', () => {
    const fixedId = 'fixed-id';
    const entries: DeckEntry[] = [
      { card: makeCard({ id: fixedId, cardNo: 'GD01-001', level: 1 }), count: 50 },
    ];
    const stats = simulateCustomPlayability(
      entries,
      [new Set([fixedId]), new Set([fixedId]), new Set([fixedId])],
      50
    );
    expect(stats.turn1Rate).toBe(1);
    expect(stats.allTurnsRate).toBe(1);
    expect(stats.t2t3Rate).toBe(1);
  });

  it('各確率が 0〜1 の範囲内', () => {
    const card1Id = 'real-card-id';
    const entries: DeckEntry[] = [
      { card: makeCard({ id: card1Id, cardNo: 'GD01-001', cost: 1, level: 1 }), count: 4 },
      { card: makeCard({ id: 'other', cardNo: 'GD01-002', cost: 2, level: 2 }), count: 46 },
    ];
    const stats = simulateCustomPlayability(entries, [new Set([card1Id]), new Set(), new Set()], 200);
    expect(stats.turn1Rate).toBeGreaterThanOrEqual(0);
    expect(stats.turn1Rate).toBeLessThanOrEqual(1);
  });
});
