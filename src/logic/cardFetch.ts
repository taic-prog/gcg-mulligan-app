import type { CardColor, CardType } from '../types';
import { getCached } from './cardCache';

export interface FetchedCardInfo {
  name: string;
  cardType: CardType;
  color: CardColor;
  level: number;
  cost: number;
  terrain: string;
  feature: string;
  link: string;
}

export async function fetchCardInfo(cardNo: string): Promise<FetchedCardInfo> {
  const cached = await getCached(cardNo);
  if (cached) return cached;
  throw new Error(`カードNo.「${cardNo}」はDBに登録されていません`);
}
