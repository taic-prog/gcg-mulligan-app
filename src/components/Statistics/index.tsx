import { useState } from 'react';
import { runMultipleSimulations } from '../../logic/simulator';
import { useDeckStoreCtx } from '../../store/DeckStoreContext';
import type { MultiSimulationStats } from '../../types';
import SimHistogram from './SimHistogram';
import StatsCard from './StatsCard';
import styles from './Statistics.module.css';

const COUNTS = [100, 1000, 10000] as const;

export default function Statistics() {
  const { activeDeck } = useDeckStoreCtx();
  const [stats, setStats] = useState<MultiSimulationStats | null>(null);
  const [running, setRunning] = useState(false);

  const total = activeDeck?.entries.reduce((s, e) => s + e.count, 0) ?? 0;
  const ready = activeDeck !== null && total === 50;

  function handleRun(count: number) {
    if (!activeDeck) return;
    setRunning(true);
    // setTimeout で UI をブロックしない（NFR-02 対応）
    setTimeout(() => {
      setStats(runMultipleSimulations(activeDeck.entries, count));
      setRunning(false);
    }, 0);
  }

  if (!activeDeck) {
    return (
      <div className={styles.noData}>
        <p>デッキが選択されていません</p>
        <p className={styles.noDataHint}>デッキ編集画面でデッキを選択してください</p>
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
