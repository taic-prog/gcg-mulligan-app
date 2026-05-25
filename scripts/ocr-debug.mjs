/**
 * OCRデバッグスクリプト
 * sampleImg 内の画像に対してOCRを実行し、認識されたカードNoのbboxを
 * 赤枠で描画した確認用画像を同ディレクトリに出力する。
 *
 * 使い方: node scripts/ocr-debug.mjs
 */

import { createRequire } from 'module';
import { readdir } from 'fs/promises';
import { join, basename, extname } from 'path';

const require = createRequire(import.meta.url);
const Tesseract = require('tesseract.js');
const { Jimp } = require('jimp');

const SAMPLE_DIR = new URL('../sampleImg', import.meta.url).pathname;
const CARD_NO_RE = /^[A-Z]{2}\d{2}-\d{3}$/;

const ALPHA_FIX = { '0': 'O', '6': 'G', '8': 'B', '5': 'S', '1': 'I' };
const DIGIT_FIX = { 'O': '0', 'D': '0', 'I': '1', 'L': '1', 'S': '5', 'B': '8', 'G': '0', 'Z': '2', 'E': '5' };

/** TSV行からword一覧を取得 */
function parseTsv(tsv) {
  const words = [];
  for (const line of tsv.trim().split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols[0] !== '5' || !cols[11]?.trim()) continue;
    words.push({
      text: cols[11].trim(),
      x0: +cols[6],
      y0: +cols[7],
      x1: +cols[6] + +cols[8],
      y1: +cols[7] + +cols[9],
    });
  }
  return words;
}

function estimateGridRows(confirmed, imgHeight, tolerance = 80) {
  if (confirmed.length === 0) return [];

  const yCenters = confirmed.map((c) => (c.y0 + c.y1) / 2).sort((a, b) => a - b);

  const rowYs = [];
  for (const y of yCenters) {
    if (!rowYs.some((r) => Math.abs(r - y) < tolerance)) rowYs.push(y);
  }

  if (rowYs.length >= 2) {
    const gaps = rowYs.slice(1).map((y, i) => y - rowYs[i]);
    const avgGap = gaps.reduce((a, b) => a + b) / gaps.length;

    let y = rowYs[rowYs.length - 1] + avgGap;
    while (y < imgHeight) { rowYs.push(y); y += avgGap; }
  }

  return rowYs.map((y) => ({ y0: y - tolerance, y1: y + tolerance }));
}

function tryFuzzyCardNo(text) {
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
  return CARD_NO_RE.test(candidate) ? candidate : null;
}

function drawRect(img, x0, y0, x1, y1, color, thickness = 2) {
  const w = img.width;
  const h = img.height;
  for (let t = 0; t < thickness; t++) {
    for (let x = Math.max(0, x0 - t); x <= Math.min(w - 1, x1 + t); x++) {
      if (y0 - t >= 0) img.setPixelColor(color, x, y0 - t);
      if (y1 + t < h)  img.setPixelColor(color, x, y1 + t);
    }
    for (let y = Math.max(0, y0 - t); y <= Math.min(h - 1, y1 + t); y++) {
      if (x0 - t >= 0) img.setPixelColor(color, x0 - t, y);
      if (x1 + t < w)  img.setPixelColor(color, x1 + t, y);
    }
  }
}

async function processImage(filePath) {
  const fileName = basename(filePath, extname(filePath));
  const outPath = join(SAMPLE_DIR, `${fileName}_ocr_debug.png`);

  console.log(`\n処理中: ${basename(filePath)}`);

  const worker = await Tesseract.createWorker('eng');
  await worker.setParameters({ tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT });
  const { data } = await worker.recognize(filePath, {}, { tsv: true });
  await worker.terminate();

  console.log('  OCR完了');

  const words = parseTsv(data.tsv);
  console.log(`  全認識ワード数: ${words.length}`);

  const imgHeight = Math.max(...words.map((w) => w.y1), 100);

  // Step 1: 厳密マッチ
  const seen = new Set();
  const strictMatches = [];
  for (const w of words) {
    const norm = w.text.toUpperCase().replace(/[^A-Z0-9\-]/g, '');
    if (CARD_NO_RE.test(norm) && !seen.has(norm)) {
      seen.add(norm);
      strictMatches.push({ ...w, text: norm });
    }
  }

  // Step 2: グリッド行推定
  const gridRows = estimateGridRows(strictMatches, imgHeight);

  // Step 3: グリッド行内のfuzzyマッチ
  const fuzzyMatches = [];
  for (const w of words) {
    const cy = (w.y0 + w.y1) / 2;
    const inGrid = gridRows.some((row) => cy >= row.y0 && cy <= row.y1);
    if (!inGrid) continue;

    if (w.x1 - w.x0 < 100) continue;

    const candidate = tryFuzzyCardNo(w.text);
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      fuzzyMatches.push({ ...w, text: candidate });
    }
  }

  console.log(`  厳密マッチ: ${strictMatches.length} 件`);
  strictMatches.forEach((c) =>
    console.log(`    [STRICT] ${c.text}  bbox=(${c.x0},${c.y0})-(${c.x1},${c.y1})`)
  );

  console.log(`  fuzzyマッチ: ${fuzzyMatches.length} 件`);
  fuzzyMatches.forEach((c) =>
    console.log(`    [FUZZY]  ${c.text}  bbox=(${c.x0},${c.y0})-(${c.x1},${c.y1})`)
  );

  console.log(`  合計: ${strictMatches.length + fuzzyMatches.length} 件`);

  // Jimpで画像読み込み・bbox描画
  const image = await Jimp.read(filePath);
  const GREEN  = 0x00BB00AA;
  const RED    = 0xFF0000FF;
  const YELLOW = 0xFFCC00FF;
  const BLUE   = 0x0066FFAA;

  // グリッド行帯を青で表示
  for (const row of gridRows) {
    for (let x = 0; x < image.width; x++) {
      if (row.y0 >= 0 && row.y0 < image.height) image.setPixelColor(BLUE, x, Math.floor(row.y0));
      if (row.y1 >= 0 && row.y1 < image.height) image.setPixelColor(BLUE, x, Math.floor(row.y1));
    }
  }

  // 全ワードを薄い緑で表示
  for (const w of words) {
    drawRect(image, w.x0, w.y0, w.x1, w.y1, GREEN, 1);
  }
  // fuzzyマッチを黄色枠で強調
  for (const { x0, y0, x1, y1 } of fuzzyMatches) {
    drawRect(image, x0, y0, x1, y1, YELLOW, 3);
  }
  // 厳密マッチを赤枠で強調
  for (const { x0, y0, x1, y1 } of strictMatches) {
    drawRect(image, x0, y0, x1, y1, RED, 3);
  }

  await image.write(outPath);
  console.log(`  出力: ${basename(outPath)}`);
}

const files = (await readdir(SAMPLE_DIR))
  .filter((f) => /\.(png|jpg|jpeg)$/i.test(f) && !f.includes('_ocr_debug'));

if (files.length === 0) {
  console.log('sampleImg に画像ファイルが見つかりません');
  process.exit(1);
}

for (const file of files) {
  await processImage(join(SAMPLE_DIR, file));
}
console.log('\n完了');
