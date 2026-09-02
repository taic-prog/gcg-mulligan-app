import { useState } from 'react';
import { drawHand } from '../../logic/simulator';
import { useDeckReady } from '../../hooks/useDeckReady';
import { useMultiSimWorker } from '../../hooks/useMultiSimWorker';
import type { Card, MultiSimulationStats } from '../../types';
import ComboProbabilityList from '../common/ComboProbabilityList';
import DeckNotReady from '../common/DeckNotReady';
import HandDisplay from './HandDisplay';
import HandSummary from './HandSummary';
import ManualHandSelector from './ManualHandSelector';
import MulliganButton from './MulliganButton';
import SimulationButtons from './SimulationButtons';
import styles from './TestDraw.module.css';

type DrawMode = 'random' | 'manual';

export default function TestDraw() {
  const { activeDeck, total, ready } = useDeckReady();
  const [drawMode, setDrawMode] = useState<DrawMode>('random');
  const [initialHand, setInitialHand] = useState<Card[] | null>(null);
  const [mulliganHand, setMulliganHand] = useState<Card[] | null>(null);
  const [mulliganUsed, setMulliganUsed] = useState(false);
  const [simStats, setSimStats] = useState<MultiSimulationStats | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const runSim = useMultiSimWorker();

  function clearHand() {
    setInitialHand(null);
    setMulliganHand(null);
    setMulliganUsed(false);
    setSimStats(null);
  }

  function switchMode(mode: DrawMode) {
    setDrawMode(mode);
    clearHand();
  }

  function handleDraw() {
    if (!activeDeck) return;
    setInitialHand(drawHand(activeDeck.entries));
    setMulliganHand(null);
    setMulliganUsed(false);
    setSimStats(null);
  }

  function handleManualConfirm(hand: Card[]) {
    setInitialHand(hand);
    setMulliganHand(null);
    setMulliganUsed(false);
    setSimStats(null);
  }

  function handleMulligan() {
    if (!activeDeck || mulliganUsed) return;
    setMulliganHand(drawHand(activeDeck.entries));
    setMulliganUsed(true);
  }

  async function handleRunSim(count: number) {
    if (!activeDeck) return;
    setSimRunning(true);
    const result = await runSim(activeDeck.entries, count);
    setSimStats(result);
    setSimRunning(false);
  }

  if (!activeDeck || !ready) {
    return <DeckNotReady total={total} />;
  }

  return (
    <div className={styles.layout}>
      <div className={styles.card}>
        <p className={styles.cardTitle}>テストドロー</p>

        {/* モード切り替え */}
        <div className={styles.modeToggle}>
          <button
            className={drawMode === 'random' ? styles.modeActive : styles.modeBtn}
            onClick={() => switchMode('random')}
          >
            ランダム
          </button>
          <button
            className={drawMode === 'manual' ? styles.modeActive : styles.modeBtn}
            onClick={() => switchMode('manual')}
          >
            手動設定
          </button>
        </div>

        {/* ランダムモード：ドローボタン */}
        {drawMode === 'random' && (
          <div className={styles.drawActions}>
            <button className={styles.btnDraw} onClick={handleDraw}>新たにドロー</button>
            {initialHand && <MulliganButton used={mulliganUsed} onClick={handleMulligan} />}
          </div>
        )}

        {/* 手動モード：カード選択 or 再選択ボタン */}
        {drawMode === 'manual' && !initialHand && (
          <ManualHandSelector entries={activeDeck.entries} onConfirm={handleManualConfirm} />
        )}
        {drawMode === 'manual' && initialHand && (
          <div className={styles.drawActions}>
            <button className={styles.btnDraw} onClick={clearHand}>再選択</button>
            <MulliganButton used={mulliganUsed} onClick={handleMulligan} />
          </div>
        )}

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

      <ComboProbabilityList
        combos={activeDeck.combos}
        entries={activeDeck.entries}
        initialHand={initialHand ?? undefined}
        currentHand={mulliganHand ?? initialHand ?? undefined}
        mulliganOnly
      />
    </div>
  );
}
