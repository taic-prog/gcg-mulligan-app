import { useEffect, useMemo, useState } from 'react';
import {
  calculateComboProbability,
  checkComboCondition,
  computeRemainingEntries,
} from '../../logic/calculator';
import type {
  Card,
  CardColor,
  CardType,
  ComboCondition,
  ComboConditionItem,
  ComboConditionType,
  DeckEntry,
} from '../../types';
import styles from './ComboCalculator.module.css';


interface Props {
  entries: DeckEntry[];
  initialCondition?: ComboCondition;  // 編集開始時に状態を初期化する
  showProbability?: boolean;          // 確率表示の有無（デフォルト true）
  initialHand?: Card[];
  currentHand?: Card[];
  onConditionChange?: (condition: ComboCondition | null) => void;
}

function isItemComplete(item: ComboConditionItem): boolean {
  if (item.type === 'card') return !!item.cardId;
  if (item.type === 'keycard') return true;
  // 'attr': 少なくとも1つのフィルタが指定されていること
  return (
    item.filterCardType !== undefined ||
    item.filterColor !== undefined ||
    item.filterLevel !== undefined ||
    item.filterCost !== undefined
  );
}

export default function ComboCalculator({
  entries,
  initialCondition,
  showProbability = true,
  initialHand,
  currentHand,
  onConditionChange,
}: Props) {
  const [items, setItems] = useState<ComboConditionItem[]>(() => initialCondition?.items ?? []);

  const condition = useMemo<ComboCondition | null>(
    () => (items.length > 0 ? { items } : null),
    [items]
  );

  const costValues = useMemo(
    () => [...new Set(entries.map((e) => e.card.cost))].sort((a, b) => a - b),
    [entries]
  );
  const levelValues = useMemo(
    () => [...new Set(entries.map((e) => e.card.level))].sort((a, b) => a - b),
    [entries]
  );
  const typeValues = useMemo(
    () => [...new Set(entries.map((e) => e.card.cardType))] as CardType[],
    [entries]
  );
  const colorValues = useMemo(
    () => [...new Set(entries.map((e) => e.card.color))] as CardColor[],
    [entries]
  );

  // card条件で使用済みのカードID（重複登録防止）
  const usedCardIds = useMemo(
    () => new Set(items.filter((i) => i.type === 'card' && i.cardId).map((i) => i.cardId!)),
    [items]
  );

  // 理論確率（50枚デッキから）
  const result = useMemo(() => {
    if (!condition || !condition.items.every(isItemComplete)) return null;
    return calculateComboProbability(entries, condition);
  }, [condition, entries]);

  // マリガン後確率：初期手札を除いた残り枚数デッキから計算
  const remainingEntries = useMemo(
    () => (initialHand ? computeRemainingEntries(entries, initialHand) : null),
    [entries, initialHand]
  );

  const mulliganResult = useMemo(() => {
    if (!remainingEntries || !condition || !condition.items.every(isItemComplete)) return null;
    return calculateComboProbability(remainingEntries, condition);
  }, [remainingEntries, condition]);

  // 現在の手札でのコンボ成立判定
  const handMatch = useMemo(() => {
    if (!currentHand || !condition || !condition.items.every(isItemComplete)) return null;
    return checkComboCondition(currentHand, condition);
  }, [currentHand, condition]);

  useEffect(() => {
    const complete = condition && condition.items.every(isItemComplete) ? condition : null;
    onConditionChange?.(complete);
  }, [condition, onConditionChange]);

  function addItem() {
    setItems((prev) => [...prev, { type: 'card', minCount: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateItem(idx: number, patch: Partial<ComboConditionItem>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;
        // 種別変更時は選択値をリセット
        if (patch.type && patch.type !== item.type) {
          return { type: patch.type, minCount: 1 };
        }
        return { ...item, ...patch };
      })
    );
  }

  // attr タイプで属性フィルタにマッチするデッキ内枚数
  function attrMatchCount(item: ComboConditionItem): number {
    return entries
      .filter(
        (e) =>
          (item.filterCardType === undefined || e.card.cardType === item.filterCardType) &&
          (item.filterColor === undefined || e.card.color === item.filterColor) &&
          (item.filterLevel === undefined || e.card.level === item.filterLevel) &&
          (item.filterCost === undefined || e.card.cost === item.filterCost) &&
          !usedCardIds.has(e.card.id)
      )
      .reduce((s, e) => s + e.count, 0);
  }

  function maxMinCount(item: ComboConditionItem): number {
    if (item.type === 'card') {
      const entry = entries.find((e) => e.card.id === item.cardId);
      return Math.min(entry?.count ?? 4, 5);
    } else if (item.type === 'attr') {
      return Math.min(attrMatchCount(item) || 5, 5);
    } else {
      // keycard
      const total = entries
        .filter((e) => e.card.isKeyCard && !usedCardIds.has(e.card.id))
        .reduce((s, e) => s + e.count, 0);
      return Math.min(total || 5, 5);
    }
  }

  const remainingCount = remainingEntries?.reduce((s, e) => s + e.count, 0) ?? 45;

  const mulliganLabel = initialHand
    ? `マリガン後（残り${remainingCount}枚）`
    : 'マリガン後（理論値）';

  const mulliganProb = initialHand
    ? mulliganResult?.probInitialHand
    : result?.probAfterMulligan;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.cardTitle}>コンボ確率</p>
      </div>

      <div className={styles.itemList}>
        {items.map((item, idx) => (
          <div key={idx} className={styles.conditionRow}>
            {/* 種別選択 */}
            <select
              className={styles.typeSelect}
              value={item.type}
              onChange={(e) => updateItem(idx, { type: e.target.value as ComboConditionType })}
            >
              <option value="card">カード指定</option>
              <option value="attr">属性指定</option>
              <option value="keycard">キーカード</option>
            </select>

            {/* カード選択 */}
            {item.type === 'card' && (
              <select
                className={styles.valueSelect}
                value={item.cardId ?? ''}
                onChange={(e) => updateItem(idx, { cardId: e.target.value })}
              >
                <option value="" disabled>カードを選択...</option>
                {entries
                  .filter((e) => !usedCardIds.has(e.card.id) || e.card.id === item.cardId)
                  .map((e) => (
                    <option key={e.card.id} value={e.card.id}>
                      {e.card.name}（x{e.count}）
                    </option>
                  ))}
              </select>
            )}

            {/* 属性指定（タイプ・色・Lv・コストをラベル付きで任意組み合わせ） */}
            {item.type === 'attr' && (
              <div className={styles.attrBlock}>
                <div className={styles.attrField}>
                  <span className={styles.attrFieldLabel}>タイプ</span>
                  <select
                    className={styles.attrSelect}
                    value={item.filterCardType ?? ''}
                    onChange={(e) =>
                      updateItem(idx, {
                        filterCardType: e.target.value ? (e.target.value as CardType) : undefined,
                      })
                    }
                  >
                    <option value="">指定なし</option>
                    {typeValues.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.attrField}>
                  <span className={styles.attrFieldLabel}>色</span>
                  <select
                    className={styles.attrSelect}
                    value={item.filterColor ?? ''}
                    onChange={(e) =>
                      updateItem(idx, {
                        filterColor: e.target.value ? (e.target.value as CardColor) : undefined,
                      })
                    }
                  >
                    <option value="">指定なし</option>
                    {colorValues.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.attrField}>
                  <span className={styles.attrFieldLabel}>レベル</span>
                  <select
                    className={styles.attrSelect}
                    value={item.filterLevel ?? ''}
                    onChange={(e) =>
                      updateItem(idx, {
                        filterLevel: e.target.value !== '' ? Number(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">指定なし</option>
                    {levelValues.map((v) => (
                      <option key={v} value={v}>Lv{v}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.attrField}>
                  <span className={styles.attrFieldLabel}>コスト</span>
                  <select
                    className={styles.attrSelect}
                    value={item.filterCost ?? ''}
                    onChange={(e) =>
                      updateItem(idx, {
                        filterCost: e.target.value !== '' ? Number(e.target.value) : undefined,
                      })
                    }
                  >
                    <option value="">指定なし</option>
                    {costValues.map((v) => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
                {isItemComplete(item) && (
                  <div className={styles.attrMatch}>
                    <span className={styles.attrMatchLabel}>対象</span>
                    <span className={styles.attrMatchValue}>{attrMatchCount(item)} 枚</span>
                  </div>
                )}
              </div>
            )}

            {/* キーカード（値選択なし・デッキ内枚数を表示） */}
            {item.type === 'keycard' && (
              <span className={styles.keycardInfo}>
                デッキ内 {entries.filter((e) => e.card.isKeyCard).reduce((s, e) => s + e.count, 0)} 枚
              </span>
            )}

            {/* 最小枚数選択 */}
            <select
              className={styles.countSelect}
              value={item.minCount}
              onChange={(e) => updateItem(idx, { minCount: Number(e.target.value) })}
              disabled={!isItemComplete(item)}
            >
              {Array.from({ length: maxMinCount(item) }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}枚以上</option>
              ))}
            </select>

            <button className={styles.btnRemove} onClick={() => removeItem(idx)}>✕</button>
          </div>
        ))}
      </div>

      <button
        className={styles.btnAdd}
        onClick={addItem}
        disabled={entries.length === 0}
      >
        ＋ 条件を追加
      </button>

      {showProbability && result && (
        <div className={styles.result}>
          <div className={styles.probRow}>
            <div className={styles.probItem}>
              <span className={styles.probLabel}>初期手札</span>
              <span className={styles.probValue}>{(result.probInitialHand * 100).toFixed(2)}%</span>
            </div>
            <div className={styles.probItem}>
              <span className={styles.probLabel}>{mulliganLabel}</span>
              <span className={styles.probValue}>
                {mulliganProb !== undefined ? `${(mulliganProb * 100).toFixed(2)}%` : '—'}
              </span>
            </div>
          </div>
          {handMatch !== null && (
            <div className={handMatch ? styles.hitBadge : styles.missBadge}>
              現在の手札: {handMatch ? 'コンボ成立 ✓' : '不成立 ✗'}
            </div>
          )}
        </div>
      )}

      {items.length === 0 && (
        <p className={styles.hint}>「＋ 条件を追加」でカード・属性・キーカードを指定してください</p>
      )}
    </div>
  );
}
