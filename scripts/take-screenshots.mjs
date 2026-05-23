import { firefox } from '@playwright/test';
import { writeFileSync } from 'fs';

const BASE = 'http://localhost:5174';
const OUT = './doc/screenshots';

// サンプルデッキデータ（50枚）
function makeDeck() {
  const cards = [];
  const makeCard = (no, name, type, color, level, cost, count, isKeyCard = false) => ({
    card: {
      id: crypto.randomUUID(),
      cardNo: no,
      name,
      cardType: type,
      color,
      level,
      cost,
      isKeyCard,
      terrain: type === 'ユニット' ? '宇宙 地球' : undefined,
      feature: type === 'ユニット' ? '〔地球連邦〕' : undefined,
    },
    count,
  });

  return [
    makeCard('GD01-001', 'ガンダム',         'ユニット',   '青', 4, 3, 4, true),
    makeCard('GD01-002', 'ガンダムMk-II',    'ユニット',   '青', 3, 2, 4, true),
    makeCard('GD01-003', 'Zガンダム',        'ユニット',   '青', 4, 3, 4),
    makeCard('GD01-004', 'ZZガンダム',       'ユニット',   '青', 5, 4, 4),
    makeCard('GD01-005', 'νガンダム',        'ユニット',   '青', 5, 4, 4),
    makeCard('GD01-006', 'アムロ・レイ',      'パイロット', '青', 1, 1, 4),
    makeCard('GD01-007', 'カミーユ・ビダン',  'パイロット', '青', 2, 2, 4),
    makeCard('GD01-008', 'ジュドー・アーシタ','パイロット', '青', 2, 2, 4),
    makeCard('GD01-009', 'ロンド・ベル',      'コマンド',  '青', 0, 1, 4),
    makeCard('GD01-010', 'フィン・ファンネル', 'コマンド',  '青', 0, 2, 4),
    makeCard('GD01-011', 'ホワイトベース',    'ベース',    '青', 0, 0, 4),
    makeCard('GD01-012', 'ア・バオア・クー',  'ベース',    '青', 0, 1, 4),
    makeCard('GD01-013', 'ガンダムハンマー',  'コマンド',  '青', 0, 3, 2),
  ];
}

function buildStorageData() {
  const entries = makeDeck();
  const total = entries.reduce((s, e) => s + e.count, 0);
  console.log('デッキ枚数:', total);

  const deck = {
    id: 'demo-deck-1',
    name: 'サンプルデッキ（宇宙連邦）',
    entries,
    combos: [
      {
        id: 'combo-1',
        name: 'T1ムーブ',
        condition: {
          logic: 'AND',
          items: [
            { type: 'attr', filterCardType: 'パイロット', filterCost: 1, minCount: 1 },
            { type: 'attr', filterCardType: 'ユニット',   filterCost: 2, minCount: 1 },
          ],
        },
      },
      {
        id: 'combo-2',
        name: 'キーカード引き',
        condition: {
          logic: 'OR',
          items: [
            { type: 'keycard', minCount: 1 },
          ],
        },
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return JSON.stringify([deck]);
}

async function shot(page, name) {
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  console.log(`撮影: ${name}.png`);
}

(async () => {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // localStorageにサンプルデータを注入
  await page.goto(BASE);
  await page.evaluate((data) => {
    localStorage.setItem('gcg-decks', data);
  }, buildStorageData());
  await page.reload();
  await page.waitForTimeout(500);

  // ── デッキ編集タブ ──────────────────────────────────
  await page.click('button:has-text("デッキ編集")');
  // デッキ選択
  await page.selectOption('select', 'demo-deck-1');
  await page.waitForTimeout(300);
  await shot(page, '01_deck-editor_overview');

  // カード追加フォーム（右ペイン）にスクロール
  await page.screenshot({ path: `${OUT}/01_deck-editor_overview.png`, fullPage: true });
  console.log('撮影: 01_deck-editor_overview.png (fullpage)');

  // インポートモーダル
  await page.click('button:has-text("インポート")');
  await page.waitForTimeout(300);
  await shot(page, '02_deck-editor_import-modal');
  await page.click('button:has-text("キャンセル")');
  await page.waitForTimeout(300);

  // エクスポートモーダル
  await page.click('button:has-text("エクスポート")');
  await page.waitForTimeout(300);
  await shot(page, '03_deck-editor_export-modal');
  await page.click('button:has-text("閉じる")');
  await page.waitForTimeout(300);

  // ── 期待値タブ ──────────────────────────────────────
  await page.click('button:has-text("期待値")');
  await page.waitForTimeout(1500); // 初動安定率の計算待ち
  await page.screenshot({ path: `${OUT}/04_dashboard_top.png`, fullPage: false });
  console.log('撮影: 04_dashboard_top.png');
  await page.screenshot({ path: `${OUT}/05_dashboard_full.png`, fullPage: true });
  console.log('撮影: 05_dashboard_full.png');

  // コスト合算チェックON
  await page.locator('label:has-text("コスト合算モード") input[type="checkbox"]').check();
  await page.waitForTimeout(300);
  await shot(page, '06_dashboard_multi-mode');

  // ── テストドロータブ ─────────────────────────────────
  await page.click('button:has-text("テストドロー")');
  await page.waitForTimeout(300);
  await shot(page, '07_testdraw_initial');

  // ランダムドロー
  await page.click('button:has-text("新たにドロー")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/08_testdraw_after-draw.png`, fullPage: true });
  console.log('撮影: 08_testdraw_after-draw.png');

  // マリガン
  await page.click('button:has-text("マリガン")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${OUT}/09_testdraw_after-mulligan.png`, fullPage: true });
  console.log('撮影: 09_testdraw_after-mulligan.png');

  // 手動設定モード
  await page.click('button:has-text("手動設定")');
  await page.waitForTimeout(300);
  await shot(page, '10_testdraw_manual-mode');

  // ── 統計タブ ─────────────────────────────────────────
  await page.click('button:has-text("統計")');
  await page.waitForTimeout(300);
  await shot(page, '11_statistics_initial');

  await page.click('button:has-text("1,000 回実行")');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/12_statistics_result.png`, fullPage: true });
  console.log('撮影: 12_statistics_result.png');

  await browser.close();
  console.log('\n✓ 全スクリーンショット完了');
})();
