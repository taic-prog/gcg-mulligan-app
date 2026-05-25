// カードNo.パターン（例: GD01-024, ST02-001）
const CARD_NO_RE = /^[A-Z]{2}\d{2}-\d{3}$/;

interface WordBox {
  text: string;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface MatchBox extends WordBox {
  fuzzy: boolean;
}

/** TSV形式のOCR結果（level=5がword）からword一覧を取得 */
function parseTsv(tsv: string): WordBox[] {
  const words: WordBox[] = [];
  for (const line of tsv.trim().split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols[0] !== '5' || !cols[11]?.trim()) continue;
    const x = parseInt(cols[6], 10);
    const y = parseInt(cols[7], 10);
    const w = parseInt(cols[8], 10);
    const h = parseInt(cols[9], 10);
    words.push({ text: cols[11].trim(), x0: x, y0: y, x1: x + w, y1: y + h });
  }
  return words;
}

/**
 * 厳密マッチしたカードNo.のY座標から、グリッド行（カードNo.帯）のY範囲を推定する。
 * 確認済み行の間隔（平均）を使って、まだ検出できていない行も補完する。
 */
function estimateGridRows(
  confirmed: WordBox[],
  imgHeight: number,
  tolerance = 80
): Array<{ y0: number; y1: number; center: number }> {
  if (confirmed.length === 0) return [];

  const yCenters = confirmed.map((c) => (c.y0 + c.y1) / 2).sort((a, b) => a - b);

  // クラスタリング：近い値をまとめて行Y座標を確定
  const rowYs: number[] = [];
  for (const y of yCenters) {
    if (!rowYs.some((r) => Math.abs(r - y) < tolerance)) rowYs.push(y);
  }

  // 行間隔の平均から未検出の後続行を補完（後方のみ）
  if (rowYs.length >= 2) {
    const gaps = rowYs.slice(1).map((y, i) => y - rowYs[i]);
    const avgGap = gaps.reduce((a, b) => a + b) / gaps.length;

    let y = rowYs[rowYs.length - 1] + avgGap;
    while (y < imgHeight) { rowYs.push(y); y += avgGap; }
  }

  return rowYs.map((center) => ({ y0: center - tolerance, y1: center + tolerance, center }));
}

/** 検出済みカードのX中心から列X座標を推定する */
function estimateGridCols(matches: WordBox[], tolerance = 150): number[] {
  const xCenters = matches.map((m) => (m.x0 + m.x1) / 2).sort((a, b) => a - b);
  const colXs: number[] = [];
  for (const x of xCenters) {
    if (!colXs.some((c) => Math.abs(c - x) < tolerance)) colXs.push(x);
  }
  return colXs.sort((a, b) => a - b);
}

/**
 * OCR誤認識の補正マッピング。
 * アルファベット位置: 数字→アルファベット変換（0→O, 6→G など）
 * 数字位置: アルファベット→数字変換（O→0, I→1, E→5 など）
 */
const ALPHA_FIX: Record<string, string> = { '0': 'O', '6': 'G', '8': 'B', '5': 'S', '1': 'I' };
const DIGIT_FIX: Record<string, string> = {
  'O': '0', 'D': '0', 'I': '1', 'L': '1', 'S': '5',
  'B': '8', 'G': '0', 'Z': '2', 'E': '5',
};

/**
 * グリッド行内のword テキストに対してfuzzy normalizationを行い
 * カードNo.として解釈できる文字列を返す。返せない場合はnull。
 */
function tryFuzzyCardNo(text: string): string | null {
  const raw = text.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (raw.length < 6 || raw.length > 8) return null;

  const a0 = ALPHA_FIX[raw[0]] ?? raw[0];
  const a1 = ALPHA_FIX[raw[1]] ?? raw[1];
  const n0 = DIGIT_FIX[raw[2]] ?? raw[2];
  const n1 = DIGIT_FIX[raw[3]] ?? raw[3];
  const n2 = DIGIT_FIX[raw[raw.length - 3]] ?? raw[raw.length - 3];
  const n3 = DIGIT_FIX[raw[raw.length - 2]] ?? raw[raw.length - 2];
  const n4 = DIGIT_FIX[raw[raw.length - 1]] ?? raw[raw.length - 1];

  const candidate = `${a0}${a1}${n0}${n1}-${n2}${n3}${n4}`;
  const prefix = `${a0}${a1}`;
  if (prefix !== 'GD' && prefix !== 'ST') return null;
  return CARD_NO_RE.test(candidate) ? candidate : null;
}

/**
 * カードNo.のbboxを基準に、上方にある1桁数字（枚数バッジ）を探す。
 */
function findCountForCard(cardNoBox: WordBox, words: WordBox[]): number {
  const cardW = cardNoBox.x1 - cardNoBox.x0;
  const searchW = Math.max(cardW * 3, 120);
  let best: { dist: number; count: number } | null = null;

  for (const w of words) {
    const n = parseInt(w.text, 10);
    if (isNaN(n) || n < 1 || n > 4 || w.text.trim().length !== 1) continue;
    if (w.y1 > cardNoBox.y0) continue;

    const cardCx = (cardNoBox.x0 + cardNoBox.x1) / 2;
    const numCx = (w.x0 + w.x1) / 2;
    if (Math.abs(numCx - cardCx) > searchW) continue;

    const dy = cardNoBox.y0 - w.y1;
    if (best === null || dy < best.dist) best = { dist: dy, count: n };
  }

  return best?.count ?? 1;
}

export interface OcrProgress {
  status: string;
  progress: number;
}

export async function recognizeDeckImage(
  file: File,
  onProgress?: (p: OcrProgress) => void
): Promise<string> {
  const Tesseract = await import('tesseract.js');

  const worker = await Tesseract.createWorker('eng', undefined, {
    logger: (m: { status: string; progress: number }) => {
      onProgress?.({ status: m.status, progress: m.progress ?? 0 });
    },
  });
  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
  const { data } = await worker.recognize(file, {}, { tsv: true } as never);
  await worker.terminate();

  if (!data.tsv) return '';

  const words = parseTsv(data.tsv);
  const imgHeight = Math.max(...words.map((w) => w.y1), 100);

  // Step 1: 厳密マッチ
  const seen = new Set<string>();
  const strictMatches: WordBox[] = [];
  for (const w of words) {
    const norm = w.text.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    if (CARD_NO_RE.test(norm) && !seen.has(norm)) {
      seen.add(norm);
      strictMatches.push({ ...w, text: norm });
    }
  }

  // Step 2: 厳密マッチのY座標からグリッド行を推定
  const gridRows = estimateGridRows(strictMatches, imgHeight);

  // Step 3: グリッド行Y範囲内のwordのみ fuzzy match を適用
  const allMatches: MatchBox[] = strictMatches.map((m) => ({ ...m, fuzzy: false }));
  for (const w of words) {
    const cy = (w.y0 + w.y1) / 2;
    const inGrid = gridRows.some((row) => cy >= row.y0 && cy <= row.y1);
    if (!inGrid) continue;

    // 幅が極端に小さいwordはカード番号ではなく別テキストの誤検出
    if (w.x1 - w.x0 < 100) continue;

    const candidate = tryFuzzyCardNo(w.text);
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      allMatches.push({ ...w, text: candidate, fuzzy: true });
    }
  }

  if (allMatches.length === 0) return '';

  // Step 4: グリッド列を推定し、グリッドマップを構築
  const colXs = estimateGridCols(allMatches);
  const colTolerance = 150;
  const rowTolerance = 80;

  // grid[rowIdx][colIdx] = MatchBox | null
  const grid: Array<Array<MatchBox | null>> = gridRows.map(() => colXs.map(() => null));

  for (const m of allMatches) {
    const cx = (m.x0 + m.x1) / 2;
    const cy = (m.y0 + m.y1) / 2;
    const colIdx = colXs.findIndex((x) => Math.abs(x - cx) < colTolerance);
    const rowIdx = gridRows.findIndex((row) => cy >= row.y0 - rowTolerance && cy <= row.y1 + rowTolerance);
    if (rowIdx >= 0 && colIdx >= 0 && grid[rowIdx][colIdx] === null) {
      grid[rowIdx][colIdx] = m;
    }
  }

  // Step 5: グリッドを行×列の順で出力。検出済みのある行のみ出力し、
  //         空セルは「# 未検出」、fuzzyは末尾に「# fuzzy（要確認）」を付与する。
  const lines: string[] = [];
  for (const row of grid) {
    if (row.every((cell) => cell === null)) continue; // 検出ゼロの行はスキップ
    for (const cell of row) {
      if (cell === null) {
        lines.push('# 未検出');
      } else {
        const count = findCountForCard(cell, words);
        const suffix = cell.fuzzy ? '  # fuzzy（要確認）' : '';
        lines.push(`${cell.text} ${count}${suffix}`);
      }
    }
  }

  return lines.join('\n');
}
