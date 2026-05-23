import { useEffect, useState } from 'react';
import { simulateBothPlayabilityModes } from '../../logic/simulator';
import type { DeckEntry, PlayabilityStats } from '../../types';
import styles from './PlayabilityCard.module.css';

interface Props {
  entries: DeckEntry[];
}

function RateItem({ label, rate, highlight }: { label: string; rate: number; highlight?: boolean }) {
  return (
    <div className={styles.rateItem}>
      <span className={styles.rateLabel}>{label}</span>
      <span className={`${styles.rateValue} ${highlight ? styles.rateValueHighlight : ''}`}>
        {(rate * 100).toFixed(1)}%
      </span>
    </div>
  );
}

export default function PlayabilityCard({ entries }: Props) {
  const [singleStats, setSingleStats] = useState<PlayabilityStats | null>(null);
  const [multiStats, setMultiStats] = useState<PlayabilityStats | null>(null);
  const [running, setRunning] = useState(true);
  const [multiCardMode, setMultiCardMode] = useState(false);

  useEffect(() => {
    setRunning(true);
    setSingleStats(null);
    setMultiStats(null);
    const timer = setTimeout(() => {
      const { single, multi } = simulateBothPlayabilityModes(entries, 10000);
      setSingleStats(single);
      setMultiStats(multi);
      setRunning(false);
    }, 0);
    return () => clearTimeout(timer);
  }, [entries]);

  const stats = multiCardMode ? multiStats : singleStats;

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.cardTitle}>初動安定率</p>
        <span className={styles.note}>各ターン開始時にドロー、コストNのカードをプレイできる確率（10,000試行）</span>
        <label className={styles.toggle}>
          <input
            type="checkbox"
            checked={multiCardMode}
            onChange={(e) => setMultiCardMode(e.target.checked)}
          />
          コスト合算モード（複数枚の合計コストで動く）
        </label>
      </div>

      {running ? (
        <p className={styles.loading}>計算中…</p>
      ) : stats ? (
        <div className={styles.rateGrid}>
          <RateItem label="1ターン目（コスト1）" rate={stats.turn1Rate} />
          <RateItem label="2ターン目（コスト2）" rate={stats.turn2Rate} />
          <RateItem label="3ターン目（コスト3）" rate={stats.turn3Rate} />
          <RateItem label="3ターン完走" rate={stats.allTurnsRate} highlight />
        </div>
      ) : null}
    </div>
  );
}
