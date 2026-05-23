import type { CardColor, CardType } from '../types';

export interface FetchedCardInfo {
  name: string;
  cardType: CardType;
  color: CardColor;
  level: number;
  cost: number;
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

export async function fetchCardInfo(cardNo: string): Promise<FetchedCardInfo> {
  const res = await fetch(`/gcg-api/jp/cards/detail.php?detailSearch=${encodeURIComponent(cardNo)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  const name = doc.querySelector('h1')?.textContent?.trim() ?? '';
  if (!name) throw new Error('カード情報が見つかりませんでした');

  function extractSpan(label: string): string {
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      if (node.textContent?.includes(label)) {
        const next = node.parentElement?.nextElementSibling ?? node.parentElement?.parentElement?.querySelector('span');
        if (next?.tagName === 'SPAN') return next.textContent?.trim() ?? '';
      }
    }
    // フォールバック: 正規表現でHTML文字列から取得
    const re = new RegExp(`${label}[^<]*<[^>]*>([^<]+)<`);
    return html.match(re)?.[1]?.trim() ?? '';
  }

  const lvRaw = extractSpan('Lv.');
  const costRaw = extractSpan('COST');
  const colorRaw = extractSpan('色');
  const typeRaw = extractSpan('タイプ');

  const level = parseInt(lvRaw, 10);
  const cost = parseInt(costRaw, 10);
  const color = COLOR_MAP[colorRaw] ?? '青';
  const cardType = TYPE_MAP[typeRaw] ?? 'ユニット';

  return { name, cardType, color, level: isNaN(level) ? 0 : level, cost: isNaN(cost) ? 0 : cost };
}
