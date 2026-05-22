import type { DeckEntry, ExpectedValueResult, KeyCardProbability } from '../types';

const DECK_SIZE = 50;
const HAND_SIZE = 5;

// C(n,k) の計算。k>n のとき 0、桁あふれ防止のため逐次乗除を使用
export function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return Math.round(result);
}

export function calculateExpectedCost(entries: DeckEntry[]): ExpectedValueResult {
  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
  if (totalCount !== DECK_SIZE) {
    throw new Error(`デッキは${DECK_SIZE}枚ちょうどである必要があります（現在${totalCount}枚）`);
  }

  // 期待値: E = (5/50) × Σ(cost_i × n_i)
  const totalHandCost =
    (HAND_SIZE / DECK_SIZE) * entries.reduce((sum, e) => sum + e.card.cost * e.count, 0);
  const averageCostPerCard = totalHandCost / HAND_SIZE;

  // コスト分布: 多変量超幾何分布の DP による正確な計算
  const costDistribution = calculateCostDistribution(entries);

  // 分散: Var[X] = E[X²] - (E[X])²
  const eX2 = Object.entries(costDistribution).reduce(
    (sum, [cost, prob]) => sum + Number(cost) ** 2 * prob,
    0
  );
  const variance = Math.max(0, eX2 - totalHandCost ** 2);
  const standardDeviation = Math.sqrt(variance);

  return {
    averageCostPerCard,
    totalHandCost,
    variance,
    standardDeviation,
    costDistribution,
  };
}

// 多変量超幾何分布の DP
// P(K1=k1,...,Km=km) = [Π C(n_i, k_i)] / C(50,5)  (Σki=5)
// dp[k] = Map<totalCost, Π C(n_i,k_i) の累積和>
function calculateCostDistribution(entries: DeckEntry[]): Record<number, number> {
  const dp: Map<number, number>[] = Array.from({ length: HAND_SIZE + 1 }, () => new Map());
  dp[0].set(0, 1);

  for (const entry of entries) {
    const { card, count: ni } = entry;
    const newDp: Map<number, number>[] = Array.from({ length: HAND_SIZE + 1 }, () => new Map());

    for (let k = 0; k <= HAND_SIZE; k++) {
      if (dp[k].size === 0) continue;
      for (let j = 0; j <= Math.min(ni, HAND_SIZE - k); j++) {
        const comb = combination(ni, j);
        if (comb === 0) continue;
        const addedCost = card.cost * j;
        for (const [cost, numerator] of dp[k]) {
          const newCost = cost + addedCost;
          const newK = k + j;
          newDp[newK].set(newCost, (newDp[newK].get(newCost) ?? 0) + numerator * comb);
        }
      }
    }

    for (let k = 0; k <= HAND_SIZE; k++) {
      dp[k] = newDp[k];
    }
  }

  const denom = combination(DECK_SIZE, HAND_SIZE);
  const result: Record<number, number> = {};
  for (const [cost, numerator] of dp[HAND_SIZE]) {
    result[cost] = numerator / denom;
  }
  return result;
}

export function calculateKeyCardProbability(entries: DeckEntry[]): KeyCardProbability {
  const keyEntries = entries.filter((e) => e.card.isKeyCard);
  const cardIds = keyEntries.map((e) => e.card.id);
  const totalKeyCardCount = keyEntries.reduce((sum, e) => sum + e.count, 0);

  // P(0枚) = C(50-K, 5) / C(50, 5)
  const probZero =
    combination(DECK_SIZE - totalKeyCardCount, HAND_SIZE) / combination(DECK_SIZE, HAND_SIZE);
  const probInitialHand = 1 - probZero;
  // マリガンは独立2回試行: P_マリガン(1枚以上) = 1 - P(0枚)²
  const probAfterMulligan = 1 - probZero ** 2;

  return {
    cardIds,
    totalKeyCardCount,
    probInitialHand,
    probAfterMulligan,
  };
}
