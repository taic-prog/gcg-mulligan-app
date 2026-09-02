import { useState } from 'react';
import { useDeckReady } from '../../hooks/useDeckReady';
import { useMultiSimWorker } from '../../hooks/useMultiSimWorker';
import type { MultiSimulationStats } from '../../types';
import DeckNotReady from '../common/DeckNotReady';
import SimHistogram from './SimHistogram';
import StatsCard from './StatsCard';
import styles from './Statistics.module.css';

const COUNTS = [100, 1000, 10000] as const;

export default function Statistics() {
  const { activeDeck, total, ready } = useDeckReady();
  const [stats, setStats] = useState<MultiSimulationStats | null>(null);
  const [running, setRunning] = useState(false);
  const runSim = useMultiSimWorker();

  async function handleRun(count: number) {
    if (!activeDeck) return;
    setRunning(true);
    const result = await runSim(activeDeck.entries, count);
    setStats(result);
    setRunning(false);
  }

  if (!activeDeck || !ready) {
    return <DeckNotReady total={total} />;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.card}>
        <p className={styles.cardTitle}>シミュレーション実行</p>
        <div className={styles.btnRow}>
          {COUNTS.map((n) => (
            <button key={n} className={styles.btnRun} onClick={() => handleRun(n)} disabled={running}>
              {n.toLocaleString()} 回実行
            </button>
          ))}
        </div>
        {running && <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>計算中…</p>}
      </div>

      {stats && (
        <>
          <StatsCard stats={stats} />
          <SimHistogram distribution={stats.costDistribution} />
        </>
      )}

      {!stats && !running && (
        <div className={styles.noData} style={{ padding: '30px 0' }}>
          <p>上のボタンでシミュレーションを実行してください</p>
        </div>
      )}
    </div>
  );
}
