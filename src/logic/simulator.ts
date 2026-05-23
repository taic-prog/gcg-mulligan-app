import type { Card, DeckEntry, MultiSimulationStats, PlayabilityStats, SimulationResult } from '../types';

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

// 手札から合計コストが target になるサブセットを取り出し残りの手札を返す
// 存在しない場合は null を返す（コスト 0 のカードは計算に含めない）
function removeSubsetSummingTo(hand: Card[], target: number): Card[] | null {
  const n = hand.length;

  function rec(idx: number, remaining: number): number[] | null {
    if (remaining === 0) return [];
    if (idx >= n || remaining < 0) return null;
    const cost = hand[idx].cost;
    if (cost > 0 && cost <= remaining) {
      const found = rec(idx + 1, remaining - cost);
      if (found !== null) return [idx, ...found];
    }
    return rec(idx + 1, remaining);
  }

  const used = rec(0, target);
  if (used === null) return null;
  const usedSet = new Set(used);
  return hand.filter((_, i) => !usedSet.has(i));
}

// 1〜3ターンの初動安定率をシミュレーションで算出する
// 各ターン開始時に1枚ドロー。cost=ターン番号 のカードをプレイできるか判定する
// multiCardMode=true のとき、複数枚の合計コストでもターンコストを満たせる
export function simulatePlayability(
  entries: DeckEntry[],
  multiCardMode = false,
  trials = 10000,
): PlayabilityStats {
  const baseDeck = expandDeck(entries);
  let t1Hits = 0, t2Hits = 0, t3Hits = 0, allHits = 0;

  for (let i = 0; i < trials; i++) {
    const deck = fisherYatesShuffle(baseDeck);
    let hand: Card[] = deck.slice(0, 5);
    let ptr = 5;

    hand.push(deck[ptr++]);
    let t1: boolean;
    if (multiCardMode) {
      const next = removeSubsetSummingTo(hand, 1);
      t1 = next !== null;
      if (t1) hand = next!;
    } else {
      const idx = hand.findIndex((c) => c.cost === 1);
      t1 = idx !== -1;
      if (t1) hand.splice(idx, 1);
    }

    hand.push(deck[ptr++]);
    let t2: boolean;
    if (multiCardMode) {
      const next = removeSubsetSummingTo(hand, 2);
      t2 = next !== null;
      if (t2) hand = next!;
    } else {
      const idx = hand.findIndex((c) => c.cost === 2);
      t2 = idx !== -1;
      if (t2) hand.splice(idx, 1);
    }

    hand.push(deck[ptr++]);
    const t3 = multiCardMode
      ? removeSubsetSummingTo(hand, 3) !== null
      : hand.some((c) => c.cost === 3);

    if (t1) t1Hits++;
    if (t2) t2Hits++;
    if (t3) t3Hits++;
    if (t1 && t2 && t3) allHits++;
  }

  return {
    turn1Rate: t1Hits / trials,
    turn2Rate: t2Hits / trials,
    turn3Rate: t3Hits / trials,
    allTurnsRate: allHits / trials,
    trialCount: trials,
  };
}

// 単体モードとコスト合算モードを同一シャッフル結果で同時に計算する。
// 同じ試行データを共有するため T1〜T3 の値がモード間で一致する。
export function simulateBothPlayabilityModes(
  entries: DeckEntry[],
  trials = 10000,
): { single: PlayabilityStats; multi: PlayabilityStats } {
  const baseDeck = expandDeck(entries);
  let s1 = 0, s2 = 0, s3 = 0, sAll = 0;
  let m1 = 0, m2 = 0, m3 = 0, mAll = 0;

  for (let i = 0; i < trials; i++) {
    const deck = fisherYatesShuffle(baseDeck);

    // 単体モード
    {
      let hand: Card[] = deck.slice(0, 5);
      let ptr = 5;

      hand.push(deck[ptr++]);
      const idx1 = hand.findIndex((c) => c.cost === 1);
      const t1 = idx1 !== -1;
      if (t1) hand.splice(idx1, 1);

      hand.push(deck[ptr++]);
      const idx2 = hand.findIndex((c) => c.cost === 2);
      const t2 = idx2 !== -1;
      if (t2) hand.splice(idx2, 1);

      hand.push(deck[ptr++]);
      const t3 = hand.some((c) => c.cost === 3);

      if (t1) s1++;
      if (t2) s2++;
      if (t3) s3++;
      if (t1 && t2 && t3) sAll++;
    }

    // コスト合算モード（同じ deck 順を使用）
    {
      let hand: Card[] = deck.slice(0, 5);
      let ptr = 5;

      hand.push(deck[ptr++]);
      const next1 = removeSubsetSummingTo(hand, 1);
      const t1 = next1 !== null;
      if (t1) hand = next1!;

      hand.push(deck[ptr++]);
      const next2 = removeSubsetSummingTo(hand, 2);
      const t2 = next2 !== null;
      if (t2) hand = next2!;

      hand.push(deck[ptr++]);
      const t3 = removeSubsetSummingTo(hand, 3) !== null;

      if (t1) m1++;
      if (t2) m2++;
      if (t3) m3++;
      if (t1 && t2 && t3) mAll++;
    }
  }

  const make = (t1: number, t2: number, t3: number, all: number): PlayabilityStats => ({
    turn1Rate: t1 / trials,
    turn2Rate: t2 / trials,
    turn3Rate: t3 / trials,
    allTurnsRate: all / trials,
    trialCount: trials,
  });

  return {
    single: make(s1, s2, s3, sAll),
    multi: make(m1, m2, m3, mAll),
  };
}

// 複数回シミュレーションを実行して統計を集計する
// comboCheck を渡した場合はコンボ成立率も計測する
export function runMultipleSimulations(
  entries: DeckEntry[],
  count: number,
  comboCheck?: (hand: Card[]) => boolean
): MultiSimulationStats {
  let totalCost = 0;
  let totalCostSq = 0;
  let keyCardHitCount = 0;
  let comboHitCount = 0;
  const costFrequency: Record<number, number> = {};

  for (let i = 0; i < count; i++) {
    const hand = drawHand(entries);
    const cost = hand.reduce((sum, card) => sum + card.cost, 0);
    totalCost += cost;
    totalCostSq += cost * cost;
    if (hand.some((card) => card.isKeyCard)) keyCardHitCount++;
    if (comboCheck?.(hand)) comboHitCount++;
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
    ...(comboCheck !== undefined ? { comboHitRate: comboHitCount / count } : {}),
  };
}
