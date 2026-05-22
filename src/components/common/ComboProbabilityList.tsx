import { useMemo } from 'react';
import {
  calculateComboProbability,
  checkComboCondition,
  computeRemainingEntries,
} from '../../logic/calculator';
import type { Card, DeckEntry, SavedCombo } from '../../types';
import styles from './ComboProbabilityList.module.css';

interface Props {
  combos: SavedCombo[];
  entries: DeckEntry[];
  initialHand?: Card[];  // 引いた初期手札（残り枚数でマリガン確率を計算）
  currentHand?: Card[];  // コンボ成立判定に使う手札
}

interface RowProps {
  combo: SavedCombo;
  entries: DeckEntry[];
  remainingEntries: DeckEntry[] | null;
  currentHand?: Card[];
}

function ComboRow({ combo, entries, remainingEntries, currentHand }: RowProps) {
  const result = useMemo(
    () => calculateComboProbability(entries, combo.condition),
    [entries, combo]
  );

  const mulliganResult = useMemo(
    () => (remainingEntries ? calculateComboProbability(remainingEntries, combo.condition) : null),
    [remainingEntries, combo]
  );

  const handMatch = useMemo(
    () => (currentHand ? checkComboCondition(currentHand, combo.condition) : null),
    [currentHand, combo]
  );

  const remainingCount = remainingEntries?.reduce((s, e) => s + e.count, 0);
  const mulliganLabel = remainingCount !== undefined
    ? `マリガン後（残り${remainingCount}枚）`
    : 'マリガン後（理論値）';
  const mulliganProb = remainingEntries
    ? mulliganResult?.probInitialHand
    : result?.probAfterMulligan;

  return (
    <div className={styles.row}>
      <div className={styles.rowHeader}>
        <span className={styles.comboName}>{combo.name}</span>
        <span className={styles.combMeta}>
          {combo.condition.logic === 'AND' ? 'AND' : 'OR'} / {combo.condition.items.length}条件
        </span>
        {handMatch !== null && (
          <span className={handMatch ? styles.hitBadge : styles.missBadge}>
            {handMatch ? '成立 ✓' : '不成立 ✗'}
          </span>
        )}
      </div>
      <div className={styles.probRow}>
        <div className={styles.probItem}>
          <span className={styles.probLabel}>初期手札</span>
          <span className={styles.probValue}>
            {result ? `${(result.probInitialHand * 100).toFixed(2)}%` : '—'}
          </span>
        </div>
        <div className={styles.probItem}>
          <span className={styles.probLabel}>{mulliganLabel}</span>
          <span className={styles.probValue}>
            {mulliganProb !== undefined ? `${(mulliganProb * 100).toFixed(2)}%` : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ComboProbabilityList({ combos, entries, initialHand, currentHand }: Props) {
  const remainingEntries = useMemo(
    () => (initialHand ? computeRemainingEntries(entries, initialHand) : null),
    [entries, initialHand]
  );

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
            remainingEntries={remainingEntries}
            currentHand={currentHand}
          />
        ))}
      </div>
    </div>
  );
}
