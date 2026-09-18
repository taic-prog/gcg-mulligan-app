import { useMemo } from 'react';
import { calculateComboProbability, checkComboCondition } from '../../logic/calculator';
import type { Card, DeckEntry, SavedCombo } from '../../types';
import styles from './ComboProbabilityList.module.css';

interface Props {
  combos: SavedCombo[];
  entries: DeckEntry[];
  currentHand?: Card[];    // コンボ成立判定に使う手札
  mulliganOnly?: boolean;  // マリガン後確率のみ表示（初期手札確率を非表示）
}

interface RowProps {
  combo: SavedCombo;
  entries: DeckEntry[];
  currentHand?: Card[];
  mulliganOnly?: boolean;
}

function ComboRow({ combo, entries, currentHand, mulliganOnly }: RowProps) {
  const result = useMemo(
    () => calculateComboProbability(entries, combo.condition),
    [entries, combo]
  );

  const handMatch = useMemo(
    () => (currentHand ? checkComboCondition(currentHand, combo.condition) : null),
    [currentHand, combo]
  );

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.comboName}>{combo.name}</span>
        <span className={styles.combMeta}>
          {combo.condition.items.length}条件
        </span>
        {handMatch !== null && (
          <span className={handMatch ? styles.hitBadge : styles.missBadge}>
            {handMatch ? '成立 ✓' : '不成立 ✗'}
          </span>
        )}
      </div>
      <div className={styles.probRow}>
        {!mulliganOnly && (
          <div className={styles.probItem}>
            <span className={styles.probLabel}>初期手札</span>
            <span className={styles.probValue}>
              {result ? `${(result.probInitialHand * 100).toFixed(2)}%` : '—'}
            </span>
          </div>
        )}
        <div className={styles.probItem}>
          <span className={styles.probLabel}>マリガン後</span>
          <span className={styles.probValue}>
            {result ? `${(result.probAfterMulligan * 100).toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ComboProbabilityList({ combos, entries, currentHand, mulliganOnly }: Props) {
  if (combos.length === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>コンボ確率</p>
        <p className={styles.hint}>デッキ編集画面でコンボを登録してください</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>コンボ確率</p>
      <div className={styles.list}>
        {combos.map((combo) => (
          <ComboRow
            key={combo.id}
            combo={combo}
            entries={entries}
            currentHand={currentHand}
            mulliganOnly={mulliganOnly}
          />
        ))}
      </div>
    </div>
  );
}
