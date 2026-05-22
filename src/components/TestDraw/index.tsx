import { useState } from 'react';
import { drawHand, runMultipleSimulations } from '../../logic/simulator';
import { useDeckStoreCtx } from '../../store/DeckStoreContext';
import type { Card, MultiSimulationStats } from '../../types';
import HandDisplay from './HandDisplay';
import HandSummary from './HandSummary';
import MulliganButton from './MulliganButton';
import SimulationButtons from './SimulationButtons';
import styles from './TestDraw.module.css';

export default function TestDraw() {
  const { activeDeck } = useDeckStoreCtx();
  const [initialHand, setInitialHand] = useState<Card[] | null>(null);
  const [mulliganHand, setMulliganHand] = useState<Card[] | null>(null);
  const [mulliganUsed, setMulliganUsed] = useState(false);
  const [simStats, setSimStats] = useState<MultiSimulationStats | null>(null);
  const [simRunning, setSimRunning] = useState(false);

  const total = activeDeck?.entries.reduce((s, e) => s + e.count, 0) ?? 0;
  const ready = activeDeck !== null && total === 50;

  function handleDraw() {
    if (!activeDeck) return;
    setInitialHand(drawHand(activeDeck.entries));
    setMulliganHand(null);
    setMulliganUsed(false);
    setSimStats(null);
  }

  function handleMulligan() {
    if (!activeDeck || mulliganUsed) return;
    setMulliganHand(drawHand(activeDeck.entries));
    setMulliganUsed(true);
  }

  function handleRunSim(count: number) {
    if (!activeDeck) return;
    setSimRunning(true);
    // setTimeout で UI をブロックしない（NFR-02 対応）
    setTimeout(() => {
      setSimStats(runMultipleSimulations(activeDeck.entries, count));
      setSimRunning(false);
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
        <p className={styles.cardTitle}>テストドロー</p>
        <div className={styles.drawActions}>
          <button className={styles.btnDraw} onClick={handleDraw}>新たにドロー</button>
          {initialHand && <MulliganButton used={mulliganUsed} onClick={handleMulligan} />}
        </div>

        {initialHand && (
          <>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              {mulliganHand ? '初期手札' : '初期手札（5枚）'}
            </p>
            <HandDisplay hand={initialHand} />
            {!mulliganHand && <HandSummary hand={initialHand} />}
          </>
        )}

        {mulliganHand && (
          <>
            <div className={styles.mulliganCompare}>
              <div className={styles.compareItem}>
                <span className={styles.compareLabel}>初期手札 総コスト</span>
                <span className={styles.compareValue}>
                  {initialHand!.reduce((s, c) => s + c.cost, 0)}
                </span>
              </div>
              <div style={{ fontSize: 20, alignSelf: 'center' }}>→</div>
              <div className={styles.compareItem}>
                <span className={styles.compareLabel}>マリガン後 総コスト</span>
                <span className={styles.compareValue}>
                  {mulliganHand.reduce((s, c) => s + c.cost, 0)}
                </span>
              </div>
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '10px 0 6px' }}>マリガン後手札</p>
            <HandDisplay hand={mulliganHand} />
            <HandSummary hand={mulliganHand} label="マリガン後 総コスト" />
          </>
        )}

        <SimulationButtons onRun={handleRunSim} disabled={simRunning} />
        {simRunning && <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>計算中…</p>}
      </div>

      {simStats && (
        <div className={styles.card}>
          <p className={styles.cardTitle}>シミュレーション結果（{simStats.trialCount.toLocaleString()} 回）</p>
          <div className={styles.mulliganCompare}>
            <div className={styles.compareItem}>
              <span className={styles.compareLabel}>平均コスト</span>
              <span className={styles.compareValue}>{simStats.averageCost.toFixed(2)}</span>
            </div>
            <div className={styles.compareItem}>
              <span className={styles.compareLabel}>標準偏差</span>
              <span className={styles.compareValue}>{simStats.standardDeviation.toFixed(2)}</span>
            </div>
            <div className={styles.compareItem}>
              <span className={styles.compareLabel}>キーカード含有率（実測）</span>
              <span className={styles.compareValue}>{(simStats.keyCardHitRate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
