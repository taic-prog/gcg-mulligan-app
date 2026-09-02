# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

ガンダムカードゲーム（GCG）のマリガン期待値計算Webアプリ。デッキを仮想構築し、初期手札とマリガン後の手札における「コスト期待値」を数学的に計算・シミュレーションする。React + Vite製のクライアントサイド完結アプリで、GitHub Pagesにデプロイされる（`main`へのpushで`.github/workflows/deploy.yml`が自動デプロイ）。

## コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド（tsc型チェック → vite build）
npm run build

# 型チェックのみ
npx tsc --noEmit

# Lint（警告0件必須）
npm run lint

# フォーマット
npm run format

# テスト（全件）
npm run test

# テスト（単一ファイル）
npx vitest run tests/logic/calculator.test.ts

# テスト（watchモード）
npm run test:watch

# テスト（カバレッジ付き）
npm run coverage
```

## アーキテクチャ

### ディレクトリ構成

```
src/
├── components/       # Reactコンポーネント（UIのみ、ロジックを含まない）
│   ├── DeckEditor/   # SC-01: カード追加・編集・削除・キーカード設定・コンボ管理・インポート/エクスポート
│   ├── Dashboard/    # SC-02: 期待値・分布・キーカード確率・初動安定率(Playability)の表示
│   ├── TestDraw/     # SC-03: ランダムドロー・手動ハンド選択・マリガンシミュレーション
│   ├── Statistics/   # SC-04: 複数回シミュレーション集計結果（Web Worker経由）
│   └── common/       # 画面横断の共有コンポーネント（TabNav, CardDetailPanel, ComboCalculator等）
├── logic/            # フレームワーク非依存の純粋関数群（テストカバレッジ対象の中核）
│   ├── calculator.ts # 期待値・分散・キーカード確率・コンボ成立確率の計算
│   ├── simulator.ts  # Fisher–Yatesシャッフル・ドロー・初動安定率シミュレーション
│   ├── validator.ts  # カード・デッキのバリデーション
│   ├── cardFetch.ts  # カード情報取得（cardCache経由、DB未登録時はエラー）
│   ├── cardCache.ts  # IndexedDBによるカードDBキャッシュ（public/card-db.jsonからシード）
│   ├── deckImport.ts # テキスト形式デッキリストのパース
│   ├── deckExport.ts # デッキのテキスト形式エクスポート
│   └── imageOcr.ts   # tesseract.jsによるデッキ画像OCR → カードNo.グリッド抽出
├── workers/
│   └── simulator.worker.ts  # simulator.tsの重い処理をメインスレッド外で実行
├── hooks/
│   └── useDeckReady.ts       # アクティブデッキが50枚ちょうどかを判定するフック
├── store/
│   ├── deckStore.ts          # 状態管理ロジックとlocalStorage永続化（最大5デッキ、純粋関数+useDeckStoreフック）
│   └── DeckStoreContext.tsx  # useDeckStoreをReact Contextとして配布するProvider
└── types/
    └── index.ts      # Card, Deck, ComboCondition, 各種計算結果の型定義とゲームルール定数
```

### 設計方針

- `src/logic/` の関数はReact・状態管理に依存しない純粋関数として実装する
- コンポーネントはロジックを直接持たず、`logic/` の関数を呼び出す
- TypeScript strict mode を使用する
- 重いシミュレーション（Statistics画面の複数回試行など）は `src/workers/simulator.worker.ts` に委譲し、UIスレッドをブロックしない

### カードDB・OCRインポートの仕組み

- `public/card-db.json`（`{version, label, cards[]}`形式）がアプリ起動時（`App.tsx`の`seedDB()`）にIndexedDB（`cardCache.ts`）へシードされる。`version`が既存より大きい場合のみ再シードする。
- `cardFetch.fetchCardInfo(cardNo)` はキャッシュ（IndexedDB）のみを参照し、未登録カードNo.は例外を投げる（外部への都度フェッチは行わない）。
- デッキ画像（スクショ）からのインポートは `imageOcr.recognizeDeckImage()` がtesseract.jsでOCRし、カードNo.のグリッド位置を推定（厳密マッチ→行/列グリッド推定→fuzzy補正）してテキスト形式に変換する。その後 `deckImport.parseDeckText()` で通常のテキストインポートと同じ経路を通る。

## 計算ロジック仕様

### 手札コスト期待値（FR-05）

超幾何分布の期待値の線形性を利用する。

```
E[手札総コスト] = (5/50) × Σ_i ( cost_i × n_i )
```

- `n_i`: カードiのデッキ内枚数
- `cost_i`: カードiのコスト

コスト分布（`costDistribution`）は多変量超幾何分布をDPで正確に計算し（`calculator.ts`の`calculateCostDistribution`）、分散はそこから `Var[X] = E[X²] - (E[X])²` として導出する。

### キーカード含有確率（FR-08）

```
P(1枚以上) = 1 - C(50-K, 5) / C(50, 5)
P_マリガン(1枚以上) = 1 - P(0枚)²
```

- `K`: デッキ内のキーカード合計枚数

### コンボ成立確率

`ComboCondition`（複数の`ComboConditionItem`のAND条件。各itemは`card`/`attr`(カード種別・色・Lv・コストによる属性フィルタ)/`keycard`のいずれかで最低枚数を指定）に対して、多変量超幾何分布の列挙により初期手札・マリガン後の成立確率を計算する（`calculateComboProbability`）。デッキに保存して繰り返し評価できる（`Deck.combos`）。

### 初動安定率（Playability）

`simulator.simulatePlayability` / `simulateCustomPlayability` は解析的に解くのではなくシミュレーションでT1〜T3（コスト1/2/3のカードをLv制限内でプレイできるか）の成立率を算出する。`multiCardMode`では単体コストではなく複数枚の合計コストでの充足も許容する。

### GCGマリガンの特性

マリガンは「全5枚をデッキ下に戻してシャッフル後に引き直す」ため、**マリガン後の期待値はマリガン前と同値**になる。UIでこの事実を明示し、代わりにコスト分散・標準偏差でマリガンの有用性を表現する。

## データモデル

```typescript
type CardType = 'ユニット' | 'パイロット' | 'コマンド' | 'ベース';
type CardColor = '青' | '緑' | '赤' | '紫' | '白';

interface Card {
  id: string;         // UUID
  cardNo: string;     // 同一No.は4枚上限の判定に使用
  name: string;
  cardType: CardType;
  color: CardColor;
  level: number;      // 0以上の整数
  cost: number;       // 0以上の整数
  isKeyCard: boolean;
  terrain?: string;   // 地形（例: "宇宙 地球"）
  feature?: string;   // 特徴（例: "〔地球連邦〕 〔WB隊〕"）
  link?: string;      // リンク（例: "「アムロ・レイ」"）
}

interface DeckEntry { card: Card; count: number; }  // count: 1〜4

interface SavedCombo { id: string; name: string; condition: ComboCondition; }

interface Deck {
  id: string;
  name: string;
  entries: DeckEntry[];
  combos: SavedCombo[];
  createdAt: string;  // ISO8601
  updatedAt: string;
}
```

**デッキバリデーション制約:**
- `entries` の全 `count` 合計 = 50
- 同一 `cardNo` の `count` 合計 ≤ 4
- 使用色の種類 ≤ 2

## テスト要件

- テストフレームワーク: Vitest + @testing-library/react（jsdom環境、`tests/setup.ts`）
- カバレッジ対象: `src/logic/**/*.ts` と `src/store/deckStore.ts` のみ。ステートメント・ブランチ・関数・行すべて **90%以上**（`vitest.config.ts`）
  - `cardCache.ts`・`imageOcr.ts` はIndexedDB/tesseract.jsという外部ブラウザAPIに直接依存するためカバレッジ対象から除外されている
- `src/logic/` の純粋関数は必ずユニットテストを書く（`tests/logic/*.test.ts`）
- `src/store/deckStore.ts` は `tests/store/deckStore.test.ts` でテストする
- パフォーマンス関連の検証は `tests/performance/performance.test.ts`

## 技術スタック

- Node.js 20.x LTS / TypeScript 5.x (strict mode)
- React 18.x + Vite（`base: '/gcg-mulligan-app/'`でGitHub Pages配信を想定）
- Recharts（コスト分布・ヒストグラムのグラフ描画）
- tesseract.js（デッキ画像OCR）、IndexedDB（カードDBキャッシュ）
- Vitest + @vitest/coverage-v8 + @testing-library/react
- ESLint 8.x（`eslint:recommended` + `@typescript-eslint/recommended` + `react-hooks/recommended`）+ Prettier 3.x

## ゲームルール上の制約

- デッキは50枚ちょうど、同一カードNo.は最大4枚
- 初期手札は5枚、マリガンは1回のみ（全5枚引き直し）
- **シールド配置（6枚）はデッキから行われるが、本アプリでは計算簡略化のため50枚デッキから直接5枚引くモデルを使用する**（将来拡張として44枚モデルを検討）
- リソースデッキ（10枚）は計算対象外
