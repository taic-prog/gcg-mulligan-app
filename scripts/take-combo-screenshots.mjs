import { firefox } from '@playwright/test';

const BASE = 'http://localhost:5174';
const OUT = './doc/screenshots';

function buildStorageData() {
  const makeCard = (no, name, type, color, level, cost, count, isKeyCard = false) => ({
    card: { id: crypto.randomUUID(), cardNo: no, name, cardType: type, color, level, cost, isKeyCard },
    count,
  });
  const entries = [
    makeCard('GD01-001', 'ガンダム',          'ユニット',   '青', 4, 3, 4, true),
    makeCard('GD01-002', 'ガンダムMk-II',     'ユニット',   '青', 3, 2, 4, true),
    makeCard('GD01-003', 'Zガンダム',         'ユニット',   '青', 4, 3, 4),
    makeCard('GD01-004', 'ZZガンダム',        'ユニット',   '青', 5, 4, 4),
    makeCard('GD01-005', 'νガンダム',         'ユニット',   '青', 5, 4, 4),
    makeCard('GD01-006', 'アムロ・レイ',       'パイロット', '青', 1, 1, 4),
    makeCard('GD01-007', 'カミーユ・ビダン',   'パイロット', '青', 2, 2, 4),
    makeCard('GD01-008', 'ジュドー・アーシタ', 'パイロット', '青', 2, 2, 4),
    makeCard('GD01-009', 'ロンド・ベル',       'コマンド',  '青', 0, 1, 4),
    makeCard('GD01-010', 'フィン・ファンネル',  'コマンド',  '青', 0, 2, 4),
    makeCard('GD01-011', 'ホワイトベース',     'ベース',    '青', 0, 0, 4),
    makeCard('GD01-012', 'ア・バオア・クー',   'ベース',    '青', 0, 1, 4),
    makeCard('GD01-013', 'ガンダムハンマー',   'コマンド',  '青', 0, 3, 2),
  ];
  const deck = {
    id: 'demo-deck-1',
    name: 'サンプルデッキ（宇宙連邦）',
    entries,
    combos: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  return JSON.stringify([deck]);
}

async function shot(page, name, fullPage = false) {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage });
  console.log(`撮影: ${name}.png`);
}

(async () => {
  const browser = await firefox.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();

  await page.goto(BASE);
  await page.evaluate((data) => localStorage.setItem('gcg-decks', data), buildStorageData());
  await page.reload();
  await page.waitForTimeout(500);

  // デッキ選択
  await page.selectOption('select', 'demo-deck-1');
  await page.waitForTimeout(300);

  // ── コンボ追加ボタンを押してエディタを開く ──────────────────────
  await page.click('button:has-text("＋ コンボを追加")');
  await page.waitForTimeout(400);
  await shot(page, '13_combo-editor_open', true);

  // ── 条件を1つ追加（カード指定） ──────────────────────────────────
  await page.click('button:has-text("＋ 条件を追加")');
  await page.waitForTimeout(300);
  await shot(page, '14_combo-condition_card', true);

  // ── カード指定: カードを選択した状態 ────────────────────────────
  // 最初のカード選択セレクトでガンダムを選択
  const cardSelect = page.locator('select.valueSelect, [class*="valueSelect"]').first();
  await cardSelect.selectOption({ index: 1 });
  await page.waitForTimeout(300);
  await shot(page, '15_combo-condition_card-selected', true);

  // ── 属性指定に切り替え ────────────────────────────────────────
  const typeSelect = page.locator('select[class*="typeSelect"]').first();
  await typeSelect.selectOption('attr');
  await page.waitForTimeout(300);
  await shot(page, '16_combo-condition_attr-empty', true);

  // ── 属性指定: タイプ「ユニット」・色「青」を選択した状態 ─────────
  const attrSelects = page.locator('select[class*="attrSelect"]');
  await attrSelects.nth(0).selectOption('ユニット');  // タイプ
  await attrSelects.nth(1).selectOption('青');        // 色
  await page.waitForTimeout(300);
  await shot(page, '17_combo-condition_attr-filled', true);

  // ── キーカードに切り替え ──────────────────────────────────────
  await typeSelect.selectOption('keycard');
  await page.waitForTimeout(300);
  await shot(page, '18_combo-condition_keycard', true);

  // ── 条件をもう1つ追加して複合条件を表示 ─────────────────────────
  await page.click('button:has-text("＋ 条件を追加")');
  await page.waitForTimeout(300);
  const typeSelects = page.locator('select[class*="typeSelect"]');
  await typeSelects.nth(1).selectOption('attr');
  await page.waitForTimeout(200);
  const attrSelects2 = page.locator('select[class*="attrSelect"]');
  await attrSelects2.nth(0).selectOption('パイロット'); // 2つ目のattrブロック最初のセレクト
  await page.waitForTimeout(300);
  await shot(page, '19_combo-condition_multi', true);

  // ── OR に切り替えた状態 ───────────────────────────────────────
  await page.click('button:has-text("OR（いずれか成立）")');
  await page.waitForTimeout(300);
  await shot(page, '20_combo-condition_or-logic', true);

  await browser.close();
  console.log('\n✓ コンボスクリーンショット完了');
})();
