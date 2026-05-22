# 実装計画書
## ガンダムカードゲーム マリガン期待値計算アプリ

**文書バージョン:** 1.0.0
**作成日:** 2026年05月22日
**ベース要件:** requirements_gcg_mulligan.md v1.0.0

---

## 実装フェーズ概要

| フェーズ | 内容 | 優先度 |
|----------|------|--------|
| 1 | プロジェクト初期設定 | 最高 |
| 2 | 型定義 | 最高 |
| 3 | コアロジック実装 | 最高 |
| 4 | コアロジック ユニットテスト | 高 |
| 5 | 状態管理・永続化 | 高 |
| 6 | UIコンポーネント実装 | 高 |
| 7 | グラフ・可視化 | 中 |
| 8 | 統合・品質保証 | 中 |

---

## フェーズ 1: プロジェクト初期設定

### 1-1. プロジェクト作成

```bash
npm create vite@latest gcg-mulligan-app -- --template react-ts
cd gcg-mulligan-app
npm install
```

### 1-2. 依存パッケージインストール

```bash
# グラフ描画
npm install recharts

# テスト
npm install -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom

# 品質管理
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser prettier eslint-config-prettier
```

### 1-3. 設定ファイル

**vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/main.tsx'],
    },
  },
});
```

**tsconfig.json（strict mode 必須設定）**

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

**package.json scripts 追加**

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "coverage": "vitest run --coverage",
    "lint": "eslint src --ext ts,tsx",
    "format": "prettier --write src"
  }
}
```

### 1-4. ディレクトリ構造作成

```
src/
  components/
    DeckEditor/
    Dashboard/
    TestDraw/
    Statistics/
    common/
  logic/
  store/
  types/
  main.tsx
  App.tsx
tests/
  logic/
  store/
  setup.ts
```

---

## フェーズ 2: 型定義

**ファイル:** `src/types/index.ts`

要件定義書 §5 のデータモデルをそのまま実装する。

```typescript
export type CardType = 'ユニット' | 'パイロット' | 'コマンド' | 'ベース';
export type CardColor = '青' | '緑' | '赤' | '紫' | '白';

export interface Card {
  id: string;
  cardNo: string;
  name: string;
  cardType: CardType;
  color: CardColor;
  level: number;
  cost: number;
  isKeyCard: boolean;
}

export interface DeckEntry {
  card: Card;
  count: number;
}

export interface Deck {
  id: string;
  name: string;
  entries: DeckEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ExpectedValueResult {
  averageCostPerCard: number;
  totalHandCost: number;
  variance: number;
  standardDeviation: number;
  costDistribution: Record<number, number>;
}

export interface KeyCardProbability {
  cardIds: string[];
  totalKeyCardCount: number;
  probInitialHand: number;
  probAfterMulligan: number;
}

export interface SimulationResult {
  hand: DeckEntry[];
  totalCost: number;
  containsKeyCard: boolean;
  mulliganCount: number;
}

export interface MultiSimulationStats {
  trialCount: number;
  averageCost: number;
  standardDeviation: number;
  keyCardHitRate: number;
  costDistribution: Record<number, number>;
}

// バリデーションエラー
export interface ValidationError {
  field: string;
  message: string;
}
```

---

## フェーズ 3: コアロジック実装

### 3-1. バリデーション (`src/logic/validator.ts`)

実装する関数:

| 関数 | 説明 |
|------|------|
| `validateCard(card: Partial<Card>): ValidationError[]` | カード単体のバリデーション |
| `validateDeck(entries: DeckEntry[]): ValidationError[]` | デッキ全体のバリデーション |
| `canAddCard(entries: DeckEntry[], cardNo: string, addCount: number): boolean` | カード追加可否チェック |

**validateCard チェック項目:**
- `name` が空文字でないこと
- `cost` が 0 以上の整数であること
- `level` が 0 以上の整数であること
- `count` が 1〜4 の整数であること

**validateDeck チェック項目:**
- `entries` の全 `count` 合計 = 50
- 同一 `cardNo` の `count` 合計 ≤ 4
- 使用色の種類 ≤ 2

### 3-2. 計算ロジック (`src/logic/calculator.ts`)

実装する関数:

| 関数 | 説明 |
|------|------|
| `combination(n: number, k: number): number` | 二項係数 C(n,k) の計算 |
| `calculateExpectedCost(entries: DeckEntry[]): ExpectedValueResult` | 手札コスト期待値・分散・標準偏差・コスト分布の計算 |
| `calculateKeyCardProbability(entries: DeckEntry[]): KeyCardProbability` | キーカード含有確率の計算 |

**combination 実装方針:**
- `k > n` のとき `0` を返す
- `k === 0` または `k === n` のとき `1` を返す
- 桁あふれ防止のため対数和ではなく乗算/除算による逐次計算を使用する

```typescript
// C(n, k) = C(n, n-k) を利用して k を小さい方に揃える
function combination(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  k = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < k; i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}
```

**calculateExpectedCost 実装方針:**

1. デッキが 50 枚でない場合は例外をスロー
2. 期待値: `E = (5/50) × Σ(cost_i × n_i)`
3. 分散（正確な共分散を含む）:
   - `Var[i] = 5 × (n_i/50) × ((50-n_i)/50) × (45/49)`
   - `Cov[i,j] = -5 × (n_i/50) × (n_j/50) × (45/49)`
   - `Var[合計] = Σ(cost_i² × Var[i]) + 2 × Σ_{i<j}(cost_i × cost_j × Cov[i,j])`
4. コスト分布: 超幾何分布の畳み込みで各総コスト値の確率を計算

**calculateExpectedCost のコスト分布計算（畳み込み）実装方針:**

各ユニーク (cardNo, cost) グループを順に処理し、確率分布を畳み込む。
初期状態: `{ 0: 1.0 }`（総コスト0の確率が1）

```
各グループ g について:
  P(手札内でgがk枚引かれる) = C(n_g, k) × C(50-n_g, 5-k) / C(50, 5)  [超幾何分布]
  新しい分布 = 現在の分布と g の分布を畳み込み
```

ただし正確な超幾何分布の畳み込みはデッキの全カードを独立に扱えないため、実用的精度として **カードを独立とみなした近似畳み込み**を採用し、UIで近似である旨を注記する。

### 3-3. シミュレーション (`src/logic/simulator.ts`)

実装する関数:

| 関数 | 説明 |
|------|------|
| `fisherYatesShuffle<T>(array: T[]): T[]` | Fisher–Yates シャッフル（元配列を変更しない） |
| `expandDeck(entries: DeckEntry[]): Card[]` | DeckEntry[] を Card[] の配列に展開（count分重複） |
| `drawHand(entries: DeckEntry[]): Card[]` | デッキをシャッフルして5枚引く |
| `simulateMulligan(entries: DeckEntry[]): SimulationResult` | ドロー→マリガン1回実施 |
| `runMultipleSimulations(entries: DeckEntry[], count: number): MultiSimulationStats` | 複数回シミュレーション実行と集計 |

**runMultipleSimulations の count は 100 / 1000 / 10000 の3種類を想定。**
10000回シミュレーションは NFR-02 の3秒以内を必達とする。

---

## フェーズ 4: コアロジック ユニットテスト

要件定義書 §8-2 のテストケースをすべて実装する。

### ファイル構成

```
tests/
  logic/
    calculator.test.ts   # T-CALC-01 〜 T-CALC-12
    validator.test.ts    # T-VAL-01 〜 T-VAL-10
    simulator.test.ts    # T-SIM-01 〜 T-SIM-07
  store/
    deckStore.test.ts    # T-STORE-01 〜 T-STORE-05
  setup.ts
```

**tests/setup.ts**

```typescript
import '@testing-library/jest-dom';
```

### 主要テストケース（抜粋）

**T-CALC-09: combination の境界値**
```typescript
expect(combination(50, 5)).toBe(2118760);
expect(combination(5, 0)).toBe(1);
expect(combination(5, 5)).toBe(1);
expect(combination(3, 5)).toBe(0);
```

**T-CALC-01: 均一コストデッキの期待値**
```typescript
// 50枚すべてコスト3のデッキ → 期待値 = 15.00
const entries = [{ card: { cost: 3, ... }, count: 50 }];
const result = calculateExpectedCost(entries);
expect(result.totalHandCost).toBeCloseTo(15.0, 2);
```

**T-SIM-07: 統計的妥当性（確率論的テスト）**
```typescript
// キーカード4枚のデッキで1000回試行 → 実測含有率が理論値±5%以内
const theoretical = 1 - combination(46, 5) / combination(50, 5);
expect(Math.abs(stats.keyCardHitRate - theoretical)).toBeLessThan(0.05);
```

---

## フェーズ 5: 状態管理・永続化

**ファイル:** `src/store/deckStore.ts`

React の `useState` + `useEffect` によるカスタムフックとして実装。外部状態管理ライブラリは使用しない。

### フック設計

```typescript
interface DeckStore {
  decks: Deck[];
  activeDeck: Deck | null;
  setActiveDeck: (id: string) => void;
  saveDeck: (deck: Omit<Deck, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteDeck: (id: string) => void;
  addEntry: (entry: Omit<DeckEntry, never>) => void;
  updateEntry: (cardId: string, count: number) => void;
  removeEntry: (cardId: string) => void;
}

export function useDeckStore(): DeckStore { ... }
```

### localStorage スキーマ

```
key: 'gcg-decks'
value: JSON.stringify(Deck[])  // 最大5件
```

**saveDeck で6件目を保存しようとした場合は Error をスロー。**

---

## フェーズ 6: UIコンポーネント実装

### 共通方針

- スタイリングは CSS Modules (`*.module.css`) を使用する
- コンポーネントはロジックを持たず、`logic/` の関数と `useDeckStore` フックを呼び出す
- レスポンシブ: PC 1280px 以上 / スマートフォン 375px 以上

### 6-1. App.tsx（ルーティング）

画面切り替えは URL ルーティングではなくタブ式UIで実装する（外部ルーターライブラリ不使用）。

```typescript
type Screen = 'deck-editor' | 'dashboard' | 'test-draw' | 'statistics';
```

### 6-2. SC-01: DeckEditor

**ファイル:** `src/components/DeckEditor/`

| コンポーネント | 責務 |
|----------------|------|
| `DeckEditor` | 画面全体のレイアウト。デッキ選択・デッキ保存ボタン |
| `CardForm` | カード追加フォーム。`validateCard` でリアルタイムバリデーション |
| `DeckList` | デッキ内カード一覧表示 |
| `DeckListItem` | カード1行。編集・削除・キーカードフラグのトグル |
| `DeckSummary` | 合計枚数・使用色のサマリ表示 |

**実装上の注意:**
- `validateDeck` のエラーをUI上部にまとめて表示する
- カード追加時に50枚超過・同一カードNo.4枚超過を即時バリデーション

### 6-3. SC-02: Dashboard

**ファイル:** `src/components/Dashboard/`

| コンポーネント | 責務 |
|----------------|------|
| `Dashboard` | 画面全体。デッキ50枚未構築時は計算不可のメッセージを表示 |
| `ExpectedValueCard` | 期待値・分散・標準偏差の数値表示 |
| `MulliganNote` | マリガン前後の期待値が同値であることの説明パネル |
| `CostDistributionChart` | 手札総コスト分布の棒グラフ（Recharts使用） |
| `KeyCardProbabilityCard` | キーカード含有確率の表示 |

**計算トリガー:** `useDeckStore` の `activeDeck.entries` が変化したときに `calculateExpectedCost` と `calculateKeyCardProbability` を再計算する。

### 6-4. SC-03: TestDraw

**ファイル:** `src/components/TestDraw/`

| コンポーネント | 責務 |
|----------------|------|
| `TestDraw` | 画面全体。ドロー結果の state 管理 |
| `HandDisplay` | 手札5枚の一覧表示（カード名・タイプ・コスト・キーカードマーク） |
| `HandSummary` | 総コスト・キーカード有無の表示 |
| `MulliganButton` | マリガン実施ボタン（1回限り。実施後はグレーアウト） |
| `SimulationButtons` | 100回/1000回/10000回 実行ボタン |

**状態:**
```typescript
interface TestDrawState {
  initialHand: Card[] | null;
  mulliganHand: Card[] | null;
  mulliganUsed: boolean;
}
```

### 6-5. SC-04: Statistics

**ファイル:** `src/components/Statistics/`

| コンポーネント | 責務 |
|----------------|------|
| `Statistics` | 画面全体。`MultiSimulationStats` の表示 |
| `StatsCard` | 平均コスト・標準偏差・キーカード含有率の数値表示 |
| `SimHistogram` | 実測コスト分布ヒストグラム（Recharts使用） |

**10000回シミュレーション中はローディング表示を出す（`setTimeout` で非同期実行し UIブロックを防ぐ）。**

---

## フェーズ 7: グラフ・可視化

Recharts を使用して以下の2種類のグラフを実装する。

### 7-1. コスト分布グラフ（SC-02: Dashboard）

```typescript
// Recharts の BarChart を使用
// データ形式
type ChartData = { cost: number; probability: number }[];

// ExpectedValueResult.costDistribution から変換
const chartData = Object.entries(result.costDistribution).map(
  ([cost, prob]) => ({ cost: Number(cost), probability: prob * 100 })
);
```

- 横軸: 手札総コスト値
- 縦軸: 確率（%表示）
- ツールチップで確率の小数点2位まで表示

### 7-2. シミュレーションヒストグラム（SC-04: Statistics）

```typescript
// SC-02 と同形式。実測確率をプロット。
// MultiSimulationStats.costDistribution から生成
```

---

## フェーズ 8: 統合・品質保証

### 8-1. カバレッジ確認

```bash
npm run coverage
```

90%未満の行があれば追加テストを実装する。

### 8-2. 非機能要件チェックリスト

| 要件ID | 確認方法 |
|--------|----------|
| NFR-01 | `calculateExpectedCost` の実行時間を `console.time` で計測（目標1秒以内） |
| NFR-02 | `runMultipleSimulations(entries, 10000)` の実行時間を計測（目標3秒以内） |
| NFR-03 | Chrome DevTools の Lighthouse で LCP を確認（目標3秒以内） |
| NFR-04 | Chrome・Firefox・Safari・Edge の各最新版で動作確認 |
| NFR-05 | Chrome DevTools でスマートフォン（375px）表示を確認 |
| NFR-06 | DevTools の Network を `Offline` にして動作確認 |
| NFR-07 | `npx tsc --noEmit` でエラーがないこと |
| NFR-08 | `npm run coverage` で全項目90%以上 |
| NFR-09 | `npm run lint` でエラーがないこと |

### 8-3. UIのコーナーケース確認

- デッキ未構築（0枚）状態でのDashboard表示
- デッキ50枚未満状態でのDashboard表示
- キーカードが設定されていない状態でのキーカード確率表示
- 全カードのコストが0のデッキでの期待値表示
- localStorageが5件フルの状態でのデッキ保存

---

## 実装順序まとめ

```
Phase 1  プロジェクト初期設定
    ↓
Phase 2  型定義（src/types/index.ts）
    ↓
Phase 3  コアロジック（logic/validator.ts → calculator.ts → simulator.ts）
    ↓
Phase 4  コアロジック ユニットテスト（カバレッジ90%達成を確認）
    ↓
Phase 5  状態管理（store/deckStore.ts + テスト）
    ↓
Phase 6  UIコンポーネント（DeckEditor → Dashboard → TestDraw → Statistics）
    ↓
Phase 7  グラフ実装（CostDistributionChart, SimHistogram）
    ↓
Phase 8  統合・非機能要件確認
```

---

## 確定済み技術選択

| # | 項目 | 決定内容 | 理由 |
|---|------|----------|------|
| 1 | コスト分布の計算精度 | **独立近似** | 計算コスト削減、NFR-01達成を優先。UIで近似である旨を注記する |
| 2 | グラフライブラリ | **Recharts** | React向け設計、TypeScript対応良好 |
| 3 | 画面遷移方式 | **タブ切替** | SPAとして完結、外部ルーターライブラリ不要 |
| 4 | シールド配置考慮 | **50枚モデル** | 要件定義のデフォルト。44枚精密モデルは将来拡張候補 |

---

*本実装計画は requirements_gcg_mulligan.md v1.0.0 に基づく。ゲームルールの変更があった場合は計算ロジック仕様（フェーズ3）から見直すこと。*
