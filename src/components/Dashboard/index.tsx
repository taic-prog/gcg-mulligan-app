import { useMemo } from 'react';
import { calculateExpectedCost, calculateKeyCardProbability } from '../../logic/calculator';
import { useDeckStoreCtx } from '../../store/DeckStoreContext';
import ComboProbabilityList from '../common/ComboProbabilityList';
import CostDistributionChart from './CostDistributionChart';
import ExpectedValueCard from './ExpectedValueCard';
import KeyCardProbabilityCard from './KeyCardProbabilityCard';
import MulliganNote from './MulliganNote';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { activeDeck } = useDeckStoreCtx();

  const total = activeDeck?.entries.reduce((s, e) => s + e.count, 0) ?? 0;
  const ready = activeDeck !== null && total === 50;

  const result = useMemo(() => {
    if (!ready || !activeDeck) return null;
    try { return calculateExpectedCost(activeDeck.entries); } catch { return null; }
  }, [ready, activeDeck]);

  const keyProb = useMemo(() => {
    if (!activeDeck) return null;
    return calculateKeyCardProbability(activeDeck.entries);
  }, [activeDeck]);

  if (!activeDeck) {
    return (
      <div className={styles.noData}>
        <p>デッキが選択されていません</p>
        <p className={styles.noDataHint}>デッキ編集画面でデッキを作成・選択してください</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={styles.noData}>
        <p>デッキが 50 枚ではありません（現在 {total} 枚）</p>
        <p className={styles.noDataHint}>デッキ編集画面でちょうど 50 枚に調整してください</p>
      </div>
    );
  }

  if (!result) return <div className={styles.noData}>計算に失敗しました</div>;

  return (
    <div className={styles.grid}>
      <ExpectedValueCard result={result} />
      <MulliganNote result={result} />
      <div className={styles.wide}>
        <CostDistributionChart distribution={result.costDistribution} />
      </div>
      {keyProb && (
        <div className={styles.wide}>
          <KeyCardProbabilityCard probability={keyProb} entries={activeDeck.entries} />
        </div>
      )}
      <div className={styles.wide}>
        <ComboProbabilityList combos={activeDeck.combos} entries={activeDeck.entries} />
      </div>
    </div>
  );
}
