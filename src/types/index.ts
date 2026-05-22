export type CardType = 'ユニット' | 'パイロット' | 'コマンド' | 'ベース';
export type CardColor = '青' | '緑' | '赤' | '紫' | '白';

export interface Card {
  id: string;
  cardNo: string;
  name: string;
  cardType: CardType;
  color: CardColor;
  level: number;
  cost: number;
  isKeyCard: boolean;
}

export interface DeckEntry {
  card: Card;
  count: number;
}

export interface Deck {
  id: string;
  name: string;
  entries: DeckEntry[];
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

export interface MultiSimulationStats {
  trialCount: number;
  averageCost: number;
  standardDeviation: number;
  keyCardHitRate: number;
  costDistribution: Record<number, number>;
  comboHitRate?: number;
}

export type ComboConditionType = 'card' | 'cost' | 'level';

export interface ComboConditionItem {
  type: ComboConditionType;
  cardId?: string;     // type === 'card' のとき使用
  attrValue?: number;  // type === 'cost' | 'level' のとき使用
  minCount: number;
}

export type ComboLogic = 'AND' | 'OR';

export interface ComboCondition {
  items: ComboConditionItem[];
  logic: ComboLogic;
}

export interface ComboProbabilityResult {
  probInitialHand: number;
  probAfterMulligan: number;
}

export interface ValidationError {
  field: string;
  message: string;
}
