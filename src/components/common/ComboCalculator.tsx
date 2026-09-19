import { useEffect, useMemo, useState } from 'react';
import { calculateComboProbability, checkComboCondition, matchesAttrFilter } from '../../logic/calculator';
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

  // card条件で使用済みのカードID（重複登録防止用。カード選択の候補絞り込みにのみ使う）
  const usedCardIds = useMemo(
    () => new Set(items.filter((i) => i.type === 'card' && i.cardId).map((i) => i.cardId!)),
    [items]
  );

  // calculateComboProbability と同じ順序・ロジックで「各条件を評価する時点で
  // 既に他条件に確保済みのカードID」を算出する（対象枚数表示・選択上限をバックエンドと一致させる）
  const claimedIdsBeforeIndex = useMemo(() => {
    const claimed = new Set(usedCardIds);
    return items.map((item) => {
      const snapshot = new Set(claimed);
      if (item.type === 'attr') {
        const matched = entries.filter((e) => matchesAttrFilter(e.card, item) && !claimed.has(e.card.id));
        matched.forEach((e) => claimed.add(e.card.id));
      } else if (item.type === 'keycard') {
        const matched = entries.filter((e) => e.card.isKeyCard && !claimed.has(e.card.id));
        matched.forEach((e) => claimed.add(e.card.id));
      }
      return snapshot;
    });
  }, [items, entries, usedCardIds]);

  // 理論確率（50枚デッキから）
  const result = useMemo(() => {
    if (!condition || !condition.items.every(isItemComplete)) return null;
    return calculateComboProbability(entries, condition);
  }, [condition, entries]);

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

  // attr タイプで属性フィルタにマッチするデッキ内枚数。その条件より前の条件が
  // 確保済みのカードは除いて数える（calculateComboProbability の排他ロジックと表示を一致させるため）
  function attrMatchCount(item: ComboConditionItem, idx: number): number {
    const claimed = claimedIdsBeforeIndex[idx];
    return entries
      .filter((e) => matchesAttrFilter(e.card, item) && !claimed.has(e.card.id))
      .reduce((s, e) => s + e.count, 0);
  }

  function maxMinCount(item: ComboConditionItem, idx: number): number {
    if (item.type === 'card') {
      const entry = entries.find((e) => e.card.id === item.cardId);
      return Math.min(entry?.count ?? 4, 5);
    } else if (item.type === 'attr') {
      // 対象0枚でも「1枚以上」は選択肢として残す（|| だと 0 が falsy で 5 に化けるため Math.max を使う）
      return Math.min(Math.max(attrMatchCount(item, idx), 1), 5);
    } else {
      // keycard
      const claimed = claimedIdsBeforeIndex[idx];
      const total = entries
        .filter((e) => e.card.isKeyCard && !claimed.has(e.card.id))
        .reduce((s, e) => s + e.count, 0);
      return Math.min(Math.max(total, 1), 5);
    }
  }

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
                    <span className={styles.attrMatchValue}>{attrMatchCount(item, idx)} 枚</span>
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
              {Array.from({ length: maxMinCount(item, idx) }, (_, i) => i + 1).map((n) => (
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
        <p className={styles.hint}>「＋ 条件を追加」でカード・属性・キーカードを指定してください</p>
      )}
    </div>
  );
}
