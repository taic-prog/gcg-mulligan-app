export interface ParsedLine {
  cardNo: string;
  count: number;
}

/**
 * テキスト形式のデッキリストを解析してカードNo.と枚数の配列を返す。
 * 対応フォーマット（1行1カード）:
 *   GD01-001 3
 *   GD01-001 x3
 *   3 GD01-001
 *   GD01-001（枚数省略時は1）
 */
export function parseDeckText(text: string): ParsedLine[] {
  const result: ParsedLine[] = [];
  const cardNoRe = /[A-Za-z]+\d*-\d+[A-Za-z0-9]*/;

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim().replace(/[\s　]+/g, ' ');
    if (!line || line.startsWith('#') || line.startsWith('//')) continue;

    const cardNoMatch = line.match(cardNoRe);
    if (!cardNoMatch) continue;

    const cardNo = cardNoMatch[0].toUpperCase();
    const rest = line.replace(cardNoMatch[0], '').trim();
    const countMatch = rest.match(/x?(\d+)/i);
    const count = countMatch
      ? Math.min(Math.max(1, parseInt(countMatch[1], 10)), 4)
      : 1;

    const existing = result.find((r) => r.cardNo === cardNo);
    if (existing) {
      existing.count = Math.min(existing.count + count, 4);
    } else {
      result.push({ cardNo, count });
    }
  }

  return result;
}
