import { useMemo } from 'react';
import { calculateExpectedCost, calculateKeyCardProbability } from '../../logic/calculator';
import { useDeckReady } from '../../hooks/useDeckReady';
import ComboProbabilityList from '../common/ComboProbabilityList';
import DeckNotReady from '../common/DeckNotReady';
import CostDistributionChart from './CostDistributionChart';
import ExpectedValueCard from './ExpectedValueCard';
import KeyCardProbabilityCard from './KeyCardProbabilityCard';
import MulliganNote from './MulliganNote';
import PlayabilityCard from './PlayabilityCard';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { activeDeck, total, ready } = useDeckReady();

  const result = useMemo(() => {
    if (!ready || !activeDeck) return null;
    try { return calculateExpectedCost(activeDeck.entries); } catch { return null; }
  }, [ready, activeDeck]);

  const keyProb = useMemo(() => {
    if (!activeDeck) return null;
    return calculateKeyCardProbability(activeDeck.entries);
  }, [activeDeck]);

  if (!activeDeck || !ready) {
    return <DeckNotReady total={total} hint="デッキ編集画面でデッキを作成・選択してください" />;
  }

  if (!result) return <div className={styles.noData}>計算に失敗しました</div>;

  return (
    <div className={styles.grid}>
      <ExpectedValueCard result={result} />
      <MulliganNote result={result} />
      <div className={styles.wide}>
        <PlayabilityCard entries={activeDeck.entries} />
      </div>
      {keyProb && (
        <div className={styles.wide}>
          <KeyCardProbabilityCard probability={keyProb} entries={activeDeck.entries} />
        </div>
      )}
      <div className={styles.wide}>
        <ComboProbabilityList combos={activeDeck.combos} entries={activeDeck.entries} />
      </div>
      <div className={styles.wide}>
        <CostDistributionChart distribution={result.costDistribution} />
      </div>
    </div>
  );
}
