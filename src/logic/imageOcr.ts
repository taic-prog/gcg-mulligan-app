// カードNo.パターン（例: GD01-024, ST02-001）
const CARD_NO_RE = /^[A-Z]{2}\d{2}-\d{3}$/;

interface WordBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * カードNo.のbboxを基準に、上方にある1桁数字（枚数バッジ）を探す。
 * GCGデッキ画像では枚数は各カード右上のバッジに表示される。
 */
function findCountForCard(cardNoBox: WordBox, words: WordBox[]): number {
  const cardW = cardNoBox.x1 - cardNoBox.x0;
  // カードの横幅をもとに探索範囲を推定
  const searchW = Math.max(cardW * 3, 120);

  let best: { dist: number; count: number } | null = null;

  for (const w of words) {
    const n = parseInt(w.text, 10);
    if (isNaN(n) || n < 1 || n > 4 || w.text.trim().length !== 1) continue;

    // カードNo.より上にあること
    if (w.y1 > cardNoBox.y0) continue;

    // x方向がカードNo.のbboxから一定範囲内
    const cardCx = (cardNoBox.x0 + cardNoBox.x1) / 2;
    const numCx = (w.x0 + w.x1) / 2;
    if (Math.abs(numCx - cardCx) > searchW) continue;

    const dy = cardNoBox.y0 - w.y1;
    if (best === null || dy < best.dist) {
      best = { dist: dy, count: n };
    }
  }

  return best?.count ?? 1;
}

export interface OcrProgress {
  status: string;
  progress: number; // 0〜1
}

export async function recognizeDeckImage(
  file: File,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  // 動的インポートでバンドルを分割
  const Tesseract = await import('tesseract.js');

  const { data } = await Tesseract.default.recognize(file, 'eng', {
    logger: (m: { status: string; progress: number }) => {
      if (onProgress) {
        onProgress({ status: m.status, progress: m.progress ?? 0 });
      }
    },
  });

  // Block → Paragraph → Line → Word の階層でword一覧を収集
  const rawWords: WordBox[] = [];
  for (const block of data.blocks ?? []) {
    for (const para of block.paragraphs) {
      for (const line of para.lines) {
        for (const w of line.words) {
          rawWords.push({
            text: w.text.trim(),
            x0: w.bbox.x0,
            y0: w.bbox.y0,
            x1: w.bbox.x1,
            y1: w.bbox.y1,
          });
        }
      }
    }
  }

  // カードNo.候補を抽出（重複除去）
  const seen = new Set<string>();
  const cardNoWords: WordBox[] = [];
  for (const w of rawWords) {
    const normalized = w.text.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    if (CARD_NO_RE.test(normalized) && !seen.has(normalized)) {
      seen.add(normalized);
      cardNoWords.push({ ...w, text: normalized });
    }
  }

  if (cardNoWords.length === 0) return '';

  const lines = cardNoWords.map((cw) => {
    const count = findCountForCard(cw, rawWords);
    return `${cw.text} ${count}`;
  });

  return lines.join('\n');
}
