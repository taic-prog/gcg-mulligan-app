import type {
  Card,
  ComboCondition,
  ComboConditionItem,
  ComboProbabilityResult,
  DeckEntry,
  ExpectedValueResult,
  KeyCardProbability,
} from '../types';

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

export function checkComboCondition(hand: Card[], condition: ComboCondition): boolean {
  const check = (item: ComboConditionItem): boolean => {
    if (item.type === 'card') {
      return hand.filter((c) => c.id === item.cardId).length >= item.minCount;
    } else if (item.type === 'attr') {
      return hand.filter(
        (c) =>
          (item.filterCardType === undefined || c.cardType === item.filterCardType) &&
          (item.filterColor === undefined || c.color === item.filterColor) &&
          (item.filterLevel === undefined || c.level === item.filterLevel) &&
          (item.filterCost === undefined || c.cost === item.filterCost)
      ).length >= item.minCount;
    } else {
      // keycard
      return hand.filter((c) => c.isKeyCard).length >= item.minCount;
    }
  };
  return condition.logic === 'AND'
    ? condition.items.every(check)
    : condition.items.some(check);
}

// 初期手札を除いた残りのデッキエントリを返す
export function computeRemainingEntries(entries: DeckEntry[], hand: Card[]): DeckEntry[] {
  const countMap = new Map(entries.map((e) => [e.card.id, e.count]));
  for (const card of hand) {
    const n = countMap.get(card.id);
    if (n !== undefined) {
      if (n <= 1) countMap.delete(card.id);
      else countMap.set(card.id, n - 1);
    }
  }
  return entries
    .map((e) => ({ ...e, count: countMap.get(e.card.id) ?? 0 }))
    .filter((e) => e.count > 0);
}

// 超幾何分布の多変量列挙: 各グループの引き枚数を指定範囲で列挙して合計する
// totalDeck に実際のデッキ枚数を渡すことで 45枚デッキにも対応
function enumerateHandProb(
  conditions: { deckCount: number; minRange: number; maxRange: number }[],
  otherDeckCount: number,
  totalDeck: number
): number {
  const denom = combination(totalDeck, HAND_SIZE);
  function rec(idx: number, remaining: number, numerator: number): number {
    if (idx === conditions.length) {
      return numerator * combination(otherDeckCount, remaining);
    }
    const { deckCount, minRange, maxRange } = conditions[idx];
    let total = 0;
    for (let x = minRange; x <= Math.min(maxRange, remaining); x++) {
      const c = combination(deckCount, x);
      if (c === 0) continue;
      total += rec(idx + 1, remaining - x, numerator * c);
    }
    return total;
  }
  return rec(0, HAND_SIZE, 1) / denom;
}

export function calculateComboProbability(
  entries: DeckEntry[],
  condition: ComboCondition
): ComboProbabilityResult | null {
  if (condition.items.length === 0) return null;

  const totalDeck = entries.reduce((s, e) => s + e.count, 0);
  if (totalDeck < HAND_SIZE) return null;

  // カード指定条件のカードIDを収集（コスト/レベル条件から除外するため）
  const specifiedCardIds = new Set(
    condition.items
      .filter((i) => i.type === 'card' && i.cardId)
      .map((i) => i.cardId!)
  );

  const resolved = condition.items.map(
    (item): { deckCount: number; minCount: number } | null => {
      if (item.type === 'card') {
        const entry = entries.find((e) => e.card.id === item.cardId);
        if (!entry) return null;
        return { deckCount: entry.count, minCount: item.minCount };
      } else if (item.type === 'attr') {
        // 少なくとも1つのフィルタが指定されていなければ無効
        if (
          item.filterCardType === undefined &&
          item.filterColor === undefined &&
          item.filterLevel === undefined &&
          item.filterCost === undefined
        ) return null;
        const deckCount = entries
          .filter(
            (e) =>
              (item.filterCardType === undefined || e.card.cardType === item.filterCardType) &&
              (item.filterColor === undefined || e.card.color === item.filterColor) &&
              (item.filterLevel === undefined || e.card.level === item.filterLevel) &&
              (item.filterCost === undefined || e.card.cost === item.filterCost) &&
              !specifiedCardIds.has(e.card.id)
          )
          .reduce((s, e) => s + e.count, 0);
        return { deckCount, minCount: item.minCount };
      } else {
        // keycard
        const deckCount = entries
          .filter((e) => e.card.isKeyCard && !specifiedCardIds.has(e.card.id))
          .reduce((s, e) => s + e.count, 0);
        return { deckCount, minCount: item.minCount };
      }
    }
  );

  if (resolved.some((r) => r === null)) return null;
  const valid = resolved as { deckCount: number; minCount: number }[];

  const totalSpecified = valid.reduce((s, r) => s + r.deckCount, 0);
  const otherDeckCount = totalDeck - totalSpecified;
  if (otherDeckCount < 0) return null;

  let probInitialHand: number;

  if (condition.logic === 'AND') {
    const conds = valid.map(({ deckCount, minCount }) => ({
      deckCount,
      minRange: minCount,
      maxRange: deckCount,
    }));
    probInitialHand = enumerateHandProb(conds, otherDeckCount, totalDeck);
  } else {
    // P(1つ以上成立) = 1 - P(全条件不成立)
    const conds = valid.map(({ deckCount, minCount }) => ({
      deckCount,
      minRange: 0,
      maxRange: minCount - 1,
    }));
    probInitialHand = 1 - enumerateHandProb(conds, otherDeckCount, totalDeck);
  }

  const probAfterMulligan = 1 - (1 - probInitialHand) ** 2;
  return { probInitialHand, probAfterMulligan };
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
