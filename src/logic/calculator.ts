import {
  DECK_SIZE,
  HAND_SIZE,
} from '../types';
import type {
  Card,
  ComboCondition,
  ComboConditionItem,
  ComboProbabilityResult,
  DeckEntry,
  ExpectedValueResult,
  KeyCardProbability,
} from '../types';

// attr条件のフィルタにカードが一致するか判定する（未指定のフィルタは無条件で一致扱い）。
// calculateComboProbability・checkComboCondition・ComboCalculator.tsx で共有する
export function matchesAttrFilter(
  card: Card,
  item: Pick<ComboConditionItem, 'filterCardType' | 'filterColor' | 'filterLevel' | 'filterCost'>
): boolean {
  return (
    (item.filterCardType === undefined || card.cardType === item.filterCardType) &&
    (item.filterColor === undefined || card.color === item.filterColor) &&
    (item.filterLevel === undefined || card.level === item.filterLevel) &&
    (item.filterCost === undefined || card.cost === item.filterCost)
  );
}

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

// 1枚のカードが複数条件に二重計上されないよう、マッチしたカードは以降の条件から
// 除外して判定する。calculateComboProbability と同じく、'card'型条件はリスト内の
// 記載順に関係なく常に最優先で確保し、attr/keycard型はリスト順に評価する
export function checkComboCondition(hand: Card[], condition: ComboCondition): boolean {
  const matches = (card: Card, item: ComboConditionItem): boolean => {
    if (item.type === 'card') return card.id === item.cardId;
    if (item.type === 'attr') return matchesAttrFilter(card, item);
    // keycard
    return card.isKeyCard;
  };

  const used = new Array<boolean>(hand.length).fill(false);
  const evaluate = (item: ComboConditionItem): boolean => {
    let count = 0;
    for (let i = 0; i < hand.length && count < item.minCount; i++) {
      if (!used[i] && matches(hand[i], item)) {
        used[i] = true;
        count++;
      }
    }
    return count >= item.minCount;
  };

  const cardItems = condition.items.filter((i) => i.type === 'card');
  const otherItems = condition.items.filter((i) => i.type !== 'card');
  return [...cardItems, ...otherItems].every(evaluate);
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

// 各条件が対象とするカードを他条件と重複させないよう、リスト順に排他的に確保していく。
// 'card'型は特定の1銘柄を指すため、記載順に関わらず先に確保する。
// 戻り値は各条件（items[idx]）を評価する時点で「既に他条件に確保済みのカードID」の配列。
// calculateComboProbability・ComboCalculator.tsx（UI側の対象枚数表示）で共有する
export function resolveComboClaims(
  entries: DeckEntry[],
  items: ComboConditionItem[]
): Set<string>[] {
  const claimed = new Set(
    items.filter((i) => i.type === 'card' && i.cardId).map((i) => i.cardId!)
  );
  return items.map((item) => {
    const snapshot = new Set(claimed);
    if (item.type === 'attr') {
      const matched = entries.filter((e) => matchesAttrFilter(e.card, item) && !claimed.has(e.card.id));
      matched.forEach((e) => claimed.add(e.card.id));
    } else if (item.type === 'keycard') {
      const matched = entries.filter((e) => e.card.isKeyCard && !claimed.has(e.card.id));
      matched.forEach((e) => claimed.add(e.card.id));
    }
    return snapshot;
  });
}

export function calculateComboProbability(
  entries: DeckEntry[],
  condition: ComboCondition
): ComboProbabilityResult | null {
  if (condition.items.length === 0) return null;

  const totalDeck = entries.reduce((s, e) => s + e.count, 0);
  if (totalDeck < HAND_SIZE) return null;

  const claims = resolveComboClaims(entries, condition.items);

  const resolved = condition.items.map(
    (item, idx): { deckCount: number; minCount: number } | null => {
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
        const claimed = claims[idx];
        const deckCount = entries
          .filter((e) => matchesAttrFilter(e.card, item) && !claimed.has(e.card.id))
          .reduce((s, e) => s + e.count, 0);
        return { deckCount, minCount: item.minCount };
      } else {
        // keycard
        const claimed = claims[idx];
        const deckCount = entries
          .filter((e) => e.card.isKeyCard && !claimed.has(e.card.id))
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

  const conds = valid.map(({ deckCount, minCount }) => ({
    deckCount,
    minRange: minCount,
    maxRange: deckCount,
  }));
  const probInitialHand = enumerateHandProb(conds, otherDeckCount, totalDeck);

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
