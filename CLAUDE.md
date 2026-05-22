# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト概要

ガンダムカードゲーム（GCG）のマリガン期待値計算Webアプリ。デッキを仮想構築し、初期手札とマリガン後の手札における「コスト期待値」を数学的に計算・シミュレーションする。

## コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# 型チェック
npx tsc --noEmit

# Lint
npm run lint

# フォーマット
npm run format

# テスト（全件）
npm run test

# テスト（単一ファイル）
npx vitest run tests/logic/calculator.test.ts

# テスト（カバレッジ付き）
npm run coverage
```

## アーキテクチャ

### ディレクトリ構成

```
src/
├── components/       # Reactコンポーネント（UIのみ、ロジックを含まない）
│   ├── DeckEditor/   # SC-01: カード追加・編集・削除・キーカード設定
│   ├── Dashboard/    # SC-02: 期待値・分布・キーカード確率の表示
│   ├── TestDraw/     # SC-03: ランダムドロー・マリガンシミュレーション
│   └── Statistics/   # SC-04: 複数回シミュレーション集計結果
├── logic/            # フレームワーク非依存の純粋関数群
│   ├── calculator.ts # 期待値・分散・キーカード確率の計算
│   ├── simulator.ts  # Fisher–Yatesシャッフル・ドロー・シミュレーション
│   └── validator.ts  # カード・デッキのバリデーション
├── store/
│   └── deckStore.ts  # 状態管理とlocalStorage永続化（最大5デッキ）
└── types/
    └── index.ts      # Card, DeckEntry, Deck, 計算結果の型定義
```

### 設計方針

- `src/logic/` の関数はReact・状態管理に依存しない純粋関数として実装する
- コンポーネントはロジックを直接持たず、`logic/` の関数を呼び出す
- TypeScript strict mode を使用する

## 計算ロジック仕様

### 手札コスト期待値（FR-05）

超幾何分布の期待値の線形性を利用する。

```
E[手札総コスト] = (5/50) × Σ_i ( cost_i × n_i )
```

- `n_i`: カードiのデッキ内枚数
- `cost_i`: カードiのコスト

### 分散（FR-06）

```
Var[カードiの手札内枚数] = 5 × (n_i/50) × ((50-n_i)/50) × (45/49)
Cov[i,j] = -5 × (n_i/50) × (n_j/50) × (45/49)   (i ≠ j)
Var[手札総コスト] = Σ_i(cost_i² × Var[i]) + 2 × Σ_{i<j}(cost_i × cost_j × Cov[i,j])
```

### キーカード含有確率（FR-08）

```
P(1枚以上) = 1 - C(50-K, 5) / C(50, 5)
P_マリガン(1枚以上) = 1 - P(0枚)²
```

- `K`: デッキ内のキーカード合計枚数

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
}

interface DeckEntry { card: Card; count: number; }  // count: 1〜4

interface Deck {
  id: string;
  name: string;
  entries: DeckEntry[];
  createdAt: string;  // ISO8601
  updatedAt: string;
}
```

**デッキバリデーション制約:**
- `entries` の全 `count` 合計 = 50
- 同一 `cardNo` の `count` 合計 ≤ 4
- 使用色の種類 ≤ 2

## テスト要件

- テストフレームワーク: Vitest + @testing-library/react
- カバレッジ目標: ステートメント・ブランチ・関数・行 すべて **90%以上**
- `src/logic/` の純粋関数は必ずユニットテストを書く
- 主要なテストケース: `tests/` ディレクトリ内の `calculator.test.ts`、`simulator.test.ts`、`validator.test.ts`、`deckStore.test.ts`

## 技術スタック

- Node.js 20.x LTS / TypeScript 5.x (strict mode)
- React 18.x + Vite 5.x
- Chart.js または Recharts（コスト分布グラフ）
- Vitest + @vitest/coverage-v8 + @testing-library/react
- ESLint 8.x + Prettier 3.x

## ゲームルール上の制約

- デッキは50枚ちょうど、同一カードNo.は最大4枚
- 初期手札は5枚、マリガンは1回のみ（全5枚引き直し）
- **シールド配置（6枚）はデッキから行われるが、本アプリでは計算簡略化のため50枚デッキから直接5枚引くモデルを使用する**（将来拡張として44枚モデルを検討）
- リソースデッキ（10枚）は計算対象外
