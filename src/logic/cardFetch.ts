import type { CardColor, CardType } from '../types';
import { getCached, putCache } from './cardCache';

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

const COLOR_MAP: Record<string, CardColor> = {
  Blue: '青',
  Green: '緑',
  Red: '赤',
  Purple: '紫',
  White: '白',
};

const TYPE_MAP: Record<string, CardType> = {
  UNIT: 'ユニット',
  PILOT: 'パイロット',
  COMMAND: 'コマンド',
  BASE: 'ベース',
};

function buildFieldMap(doc: Document): Record<string, string> {
  const map: Record<string, string> = {};
  doc.querySelectorAll('dt.dataTit').forEach((dt) => {
    const key = dt.textContent?.trim() ?? '';
    const dd = dt.nextElementSibling;
    if (key && dd) {
      map[key] = dd.textContent?.trim() ?? '';
    }
  });
  return map;
}

const TARGET_BASE = 'https://www.gundam-gcg.com/jp/cards/detail.php';
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

async function fetchFromNetwork(cardNo: string): Promise<FetchedCardInfo> {
  const targetUrl = `${TARGET_BASE}?detailSearch=${encodeURIComponent(cardNo)}`;
  const res = await fetch(`${CORS_PROXY}${encodeURIComponent(targetUrl)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const fields = buildFieldMap(doc);

  const name = doc.querySelector('h1')?.textContent?.trim() ?? '';
  if (!name || Object.keys(fields).length === 0) {
    throw new Error('カードが見つかりませんでした');
  }

  const level = parseInt(fields['Lv.'] ?? '', 10);
  const cost = parseInt(fields['COST'] ?? '', 10);
  const color = COLOR_MAP[fields['色'] ?? ''] ?? '青';
  const cardType = TYPE_MAP[fields['タイプ'] ?? ''] ?? 'ユニット';
  const terrain = fields['地形'] ?? '';
  const feature = fields['特徴'] ?? '';
  const link = fields['リンク'] ?? '';

  return {
    name,
    cardType,
    color,
    level: isNaN(level) ? 0 : level,
    cost: isNaN(cost) ? 0 : cost,
    terrain,
    feature,
    link,
  };
}

export async function fetchCardInfo(cardNo: string): Promise<FetchedCardInfo> {
  const cached = await getCached(cardNo);
  if (cached) return cached;

  const info = await fetchFromNetwork(cardNo);
  await putCache(cardNo, info);
  return info;
}
