import type { ExpectedValueResult } from '../../types';
import styles from './Dashboard.module.css';

interface Props { result: ExpectedValueResult }

export default function ExpectedValueCard({ result }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>初期手札（5枚）コスト期待値</p>
      <div className={styles.statRow}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>総コスト期待値</span>
          <span className={styles.statValue}>{result.totalHandCost.toFixed(2)}</span>
          <span className={styles.statUnit}>手札5枚の合計</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>1枚あたり平均コスト</span>
          <span className={styles.statValue}>{result.averageCostPerCard.toFixed(2)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>分散</span>
          <span className={styles.statValue}>{result.variance.toFixed(2)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>標準偏差</span>
          <span className={styles.statValue}>{result.standardDeviation.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
