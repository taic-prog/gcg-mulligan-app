import type { MultiSimulationStats } from '../../types';
import styles from './Statistics.module.css';

interface Props { stats: MultiSimulationStats }

export default function StatsCard({ stats }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>集計結果（{stats.trialCount.toLocaleString()} 回試行）</p>
      <div className={styles.statsGrid}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>平均コスト</span>
          <span className={styles.statValue}>{stats.averageCost.toFixed(2)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>標準偏差</span>
          <span className={styles.statValue}>{stats.standardDeviation.toFixed(2)}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>キーカード含有率</span>
          <span className={styles.statValue}>{(stats.keyCardHitRate * 100).toFixed(1)}%</span>
        </div>
      </div>
    </div>
  );
}
