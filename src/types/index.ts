export type CardType = 'ユニット' | 'パイロット' | 'コマンド' | 'ベース';
export type CardColor = '青' | '緑' | '赤' | '紫' | '白';

export const CARD_TYPES: readonly CardType[] = ['ユニット', 'パイロット', 'コマンド', 'ベース'];
export const CARD_COLORS: readonly CardColor[] = ['青', '緑', '赤', '紫', '白'];
export const CARD_TYPE_SET = new Set<string>(CARD_TYPES);
export const CARD_COLOR_SET = new Set<string>(CARD_COLORS);

// ゲームルール定数
export const DECK_SIZE = 50;
export const HAND_SIZE = 5;
export const MAX_SAME_CARD = 4;
export const MAX_LEVEL = 20;
export const MAX_COST = 20;
// アンカーなしのパターン文字列（行内抽出など非アンカー用途向け）
export const CARD_NO_PATTERN = '[A-Za-z]{1,4}\\d{0,2}-\\d{2,4}';
export const CARD_NO_RE = /^[A-Za-z]{1,4}\d{0,2}-\d{2,4}$/;

export interface Card {
  id: string;
  cardNo: string;
  name: string;
  cardType: CardType;
  color: CardColor;
  level: number;
  cost: number;
  isKeyCard: boolean;
  terrain?: string;  // 地形（例: "宇宙 地球"）
  feature?: string;  // 特徴（例: "〔地球連邦〕 〔WB隊〕"）
  link?: string;     // リンク（例: "「アムロ・レイ」"）
}

export interface DeckEntry {
  card: Card;
  count: number;
}

export interface SavedCombo {
  id: string;
  name: string;
  condition: ComboCondition;
}

export interface Deck {
  id: string;
  name: string;
  entries: DeckEntry[];
  combos: SavedCombo[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpectedValueResult {
  averageCostPerCard: number;
  totalHandCost: number;
  variance: number;
  standardDeviation: number;
  costDistribution: Record<number, number>;
}

export interface KeyCardProbability {
  cardIds: string[];
  totalKeyCardCount: number;
  probInitialHand: number;
  probAfterMulligan: number;
}

export interface SimulationResult {
  hand: Card[];
  totalCost: number;
  containsKeyCard: boolean;
  mulliganCount: number;
}

export interface PlayabilityStats {
  turn1Rate: number;    // T1: cost=1 を手札に引けた確率
  turn2Rate: number;    // T2: cost=2 を手札に引けた確率
  turn3Rate: number;    // T3: cost=3 を手札に引けた確率
  allTurnsRate: number; // T1〜T3 すべてコスト通りに動けた確率
  t2t3Rate: number;     // T2〜T3 のみ（T1不可デッキ向け完走指標）
  trialCount: number;
}

export interface MultiSimulationStats {
  trialCount: number;
  averageCost: number;
  standardDeviation: number;
  keyCardHitRate: number;
  costDistribution: Record<number, number>;
  comboHitRate?: number;
}

export type ComboConditionType = 'card' | 'attr' | 'keycard';
export const COMBO_CONDITION_TYPES = new Set<string>(
  ['card', 'attr', 'keycard'] satisfies ComboConditionType[]
);

export interface ComboConditionItem {
  type: ComboConditionType;
  // 'card' タイプ
  cardId?: string;
  // 'attr' タイプ（すべて省略可能、少なくとも1つ指定する）
  filterCardType?: CardType;
  filterColor?: CardColor;
  filterLevel?: number;
  filterCost?: number;
  // 共通
  minCount: number;
}

export interface ComboCondition {
  items: ComboConditionItem[];
}

export interface ComboProbabilityResult {
  probInitialHand: number;
  probAfterMulligan: number;
}

export interface ValidationError {
  field: string;
  message: string;
}
