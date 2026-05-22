import { useEffect, useMemo, useState } from 'react';
import { calculateComboProbability, checkComboCondition } from '../../logic/calculator';
import type { Card, ComboCondition, ComboConditionItem, ComboLogic, DeckEntry } from '../../types';
import styles from './ComboCalculator.module.css';

interface Props {
  entries: DeckEntry[];
  currentHand?: Card[];
  onConditionChange?: (condition: ComboCondition | null) => void;
}

export default function ComboCalculator({ entries, currentHand, onConditionChange }: Props) {
  const [items, setItems] = useState<ComboConditionItem[]>([]);
  const [logic, setLogic] = useState<ComboLogic>('AND');

  const condition = useMemo<ComboCondition | null>(
    () => (items.length > 0 ? { items, logic } : null),
    [items, logic]
  );

  const result = useMemo(() => {
    if (!condition || items.some((i) => !i.cardId)) return null;
    return calculateComboProbability(entries, condition);
  }, [condition, entries, items]);

  const handMatch = useMemo(() => {
    if (!currentHand || !condition || items.some((i) => !i.cardId)) return null;
    return checkComboCondition(currentHand, condition);
  }, [currentHand, condition, items]);

  useEffect(() => {
    onConditionChange?.(items.length > 0 && items.every((i) => i.cardId) ? condition : null);
  }, [condition, items, onConditionChange]);

  const usedCardIds = new Set(items.map((i) => i.cardId).filter(Boolean));
  const availableEntries = entries.filter((e) => !usedCardIds.has(e.card.id));

  function addItem() {
    if (availableEntries.length === 0) return;
    setItems((prev) => [...prev, { cardId: '', minCount: 1 }]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateCardId(idx: number, cardId: string) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, cardId } : item)));
  }

  function updateMinCount(idx: number, minCount: number) {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, minCount } : item)));
  }

  const maxMinCount = (item: ComboConditionItem): number => {
    const entry = entries.find((e) => e.card.id === item.cardId);
    return entry ? Math.min(entry.count, 5) : 4;
  };

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
        {items.map((item, idx) => {
          const entryForItem = entries.find((e) => e.card.id === item.cardId);
          const selectableEntries = entries.filter(
            (e) => !usedCardIds.has(e.card.id) || e.card.id === item.cardId
          );
          return (
            <div key={idx} className={styles.conditionRow}>
              <select
                className={styles.cardSelect}
                value={item.cardId}
                onChange={(e) => updateCardId(idx, e.target.value)}
              >
                <option value="" disabled>カードを選択...</option>
                {selectableEntries.map((e) => (
                  <option key={e.card.id} value={e.card.id}>
                    {e.card.name}（x{e.count}）
                  </option>
                ))}
              </select>
              <select
                className={styles.countSelect}
                value={item.minCount}
                onChange={(e) => updateMinCount(idx, Number(e.target.value))}
                disabled={!item.cardId}
              >
                {Array.from({ length: maxMinCount(item) }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}枚以上</option>
                ))}
              </select>
              {entryForItem && (
                <span className={styles.deckCount}>デッキ{entryForItem.count}枚</span>
              )}
              <button className={styles.btnRemove} onClick={() => removeItem(idx)}>✕</button>
            </div>
          );
        })}
      </div>

      <button
        className={styles.btnAdd}
        onClick={addItem}
        disabled={availableEntries.length === 0 || entries.length === 0}
      >
        ＋ 条件を追加
      </button>

      {result && (
        <div className={styles.result}>
          <div className={styles.probRow}>
            <div className={styles.probItem}>
              <span className={styles.probLabel}>初期手札</span>
              <span className={styles.probValue}>{(result.probInitialHand * 100).toFixed(2)}%</span>
            </div>
            <div className={styles.probItem}>
              <span className={styles.probLabel}>マリガン後</span>
              <span className={styles.probValue}>{(result.probAfterMulligan * 100).toFixed(2)}%</span>
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
        <p className={styles.hint}>「＋ 条件を追加」でカードと必要枚数を指定してください</p>
      )}
    </div>
  );
}
