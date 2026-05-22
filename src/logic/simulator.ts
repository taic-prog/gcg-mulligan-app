import type { Card, DeckEntry, MultiSimulationStats, SimulationResult } from '../types';

const HAND_SIZE = 5;

// Fisher–Yates シャッフル（元配列を変更しない）
export function fisherYatesShuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// DeckEntry[] を Card[] に展開（count 分だけ同じカードを並べる）
export function expandDeck(entries: DeckEntry[]): Card[] {
  return entries.flatMap((entry) => Array<Card>(entry.count).fill(entry.card));
}

// デッキをシャッフルして HAND_SIZE 枚引く
export function drawHand(entries: DeckEntry[]): Card[] {
  const deck = expandDeck(entries);
  if (deck.length < HAND_SIZE) {
    throw new Error(`デッキは${HAND_SIZE}枚以上必要です（現在${deck.length}枚）`);
  }
  return fisherYatesShuffle(deck).slice(0, HAND_SIZE);
}

// マリガン実施: 全手札をデッキに戻してシャッフル後に引き直す
// GCG ではシャッフル後の引き直しのためデッキ構成は変化しない
export function simulateMulligan(entries: DeckEntry[]): SimulationResult {
  const hand = drawHand(entries);
  const totalCost = hand.reduce((sum, card) => sum + card.cost, 0);
  const containsKeyCard = hand.some((card) => card.isKeyCard);

  return {
    hand,
    totalCost,
    containsKeyCard,
    mulliganCount: 1,
  };
}

// 複数回シミュレーションを実行して統計を集計する
export function runMultipleSimulations(
  entries: DeckEntry[],
  count: number
): MultiSimulationStats {
  let totalCost = 0;
  let totalCostSq = 0;
  let keyCardHitCount = 0;
  const costFrequency: Record<number, number> = {};

  for (let i = 0; i < count; i++) {
    const hand = drawHand(entries);
    const cost = hand.reduce((sum, card) => sum + card.cost, 0);
    totalCost += cost;
    totalCostSq += cost * cost;
    if (hand.some((card) => card.isKeyCard)) keyCardHitCount++;
    costFrequency[cost] = (costFrequency[cost] ?? 0) + 1;
  }

  const averageCost = totalCost / count;
  const variance = totalCostSq / count - averageCost ** 2;
  const standardDeviation = Math.sqrt(Math.max(0, variance));
  const keyCardHitRate = keyCardHitCount / count;

  const costDistribution: Record<number, number> = {};
  for (const [cost, freq] of Object.entries(costFrequency)) {
    costDistribution[Number(cost)] = freq / count;
  }

  return {
    trialCount: count,
    averageCost,
    standardDeviation,
    keyCardHitRate,
    costDistribution,
  };
}
