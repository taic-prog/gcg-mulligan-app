import { useEffect, useMemo, useState } from 'react';
import {
  calculateComboProbability,
  checkComboCondition,
  computeRemainingEntries,
} from '../../logic/calculator';
import type {
  Card,
  ComboCondition,
  ComboConditionItem,
  ComboConditionType,
  ComboLogic,
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
  return item.attrValue !== undefined;
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
  const [logic, setLogic] = useState<ComboLogic>(() => initialCondition?.logic ?? 'AND');

  const condition = useMemo<ComboCondition | null>(
    () => (items.length > 0 ? { items, logic } : null),
    [items, logic]
  );

  const costValues = useMemo(
    () => [...new Set(entries.map((e) => e.card.cost))].sort((a, b) => a - b),
    [entries]
  );
  const levelValues = useMemo(
    () => [...new Set(entries.map((e) => e.card.level))].sort((a, b) => a - b),
    [entries]
  );

  // card条件で使用済みのカードID（重複登録防止）
  const usedCardIds = useMemo(
    () => new Set(items.filter((i) => i.type === 'card' && i.cardId).map((i) => i.cardId!)),
    [items]
  );

  // 理論確率（50枚デッキから）
  const result = useMemo(() => {
    if (!condition || !items.every(isItemComplete)) return null;
    return calculateComboProbability(entries, condition);
  }, [condition, entries, items]);

  // マリガン後確率：初期手札を除いた残り枚数デッキから計算
  const remainingEntries = useMemo(
    () => (initialHand ? computeRemainingEntries(entries, initialHand) : null),
    [entries, initialHand]
  );

  const mulliganResult = useMemo(() => {
    if (!remainingEntries || !condition || !items.every(isItemComplete)) return null;
    return calculateComboProbability(remainingEntries, condition);
  }, [remainingEntries, condition, items]);

  // 現在の手札でのコンボ成立判定
  const handMatch = useMemo(() => {
    if (!currentHand || !condition || !items.every(isItemComplete)) return null;
    return checkComboCondition(currentHand, condition);
  }, [currentHand, condition, items]);

  useEffect(() => {
    const complete = items.length > 0 && items.every(isItemComplete) ? condition : null;
    onConditionChange?.(complete);
  }, [condition, items, onConditionChange]);

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

  function maxMinCount(item: ComboConditionItem): number {
    if (item.type === 'card') {
      const entry = entries.find((e) => e.card.id === item.cardId);
      return Math.min(entry?.count ?? 4, 5);
    } else if (item.type === 'cost') {
      const total = entries
        .filter((e) => e.card.cost === item.attrValue && !usedCardIds.has(e.card.id))
        .reduce((s, e) => s + e.count, 0);
      return Math.min(total || 5, 5);
    } else {
      const total = entries
        .filter((e) => e.card.level === item.attrValue && !usedCardIds.has(e.card.id))
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
        <div className={styles.logicToggle}>
          <button
            className={logic === 'AND' ? styles.logicActive : styles.logicBtn}
            onClick={() => setLogic('AND')}
          >
            AND（すべて成立）
          </button>
          <button
            className={logic === 'OR' ? styles.logicActive : styles.logicBtn}
            onClick={() => setLogic('OR')}
          >
            OR（いずれか成立）
          </button>
        </div>
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
              <option value="cost">コスト指定</option>
              <option value="level">レベル指定</option>
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

            {/* コスト値選択 */}
            {item.type === 'cost' && (
              <select
                className={styles.valueSelect}
                value={item.attrValue ?? ''}
                onChange={(e) => updateItem(idx, { attrValue: Number(e.target.value) })}
              >
                <option value="" disabled>コストを選択...</option>
                {costValues.map((v) => {
                  const total = entries
                    .filter((e) => e.card.cost === v)
                    .reduce((s, e) => s + e.count, 0);
                  return (
                    <option key={v} value={v}>
                      コスト{v}（デッキ{total}枚）
                    </option>
                  );
                })}
              </select>
            )}

            {/* レベル値選択 */}
            {item.type === 'level' && (
              <select
                className={styles.valueSelect}
                value={item.attrValue ?? ''}
                onChange={(e) => updateItem(idx, { attrValue: Number(e.target.value) })}
              >
                <option value="" disabled>レベルを選択...</option>
                {levelValues.map((v) => {
                  const total = entries
                    .filter((e) => e.card.level === v)
                    .reduce((s, e) => s + e.count, 0);
                  return (
                    <option key={v} value={v}>
                      レベル{v}（デッキ{total}枚）
                    </option>
                  );
                })}
              </select>
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
        <p className={styles.hint}>「＋ 条件を追加」でカード・コスト・レベルを指定してください</p>
      )}
    </div>
  );
}
