import { useEffect, useState } from 'react';
import { simulateBothPlayabilityModes, simulateCustomPlayability } from '../../logic/simulator';
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

const TURN_LABELS = ['1ターン目', '2ターン目', '3ターン目'] as const;
const EMPTY_SEL = (): Set<string>[] => [new Set(), new Set(), new Set()];

export default function PlayabilityCard({ entries }: Props) {
  const [singleStats, setSingleStats] = useState<PlayabilityStats | null>(null);
  const [multiStats, setMultiStats] = useState<PlayabilityStats | null>(null);
  const [running, setRunning] = useState(true);
  const [multiCardMode, setMultiCardMode] = useState(false);

  const [selPerTurn, setSelPerTurn] = useState<Set<string>[]>(EMPTY_SEL);
  const [customStats, setCustomStats] = useState<PlayabilityStats | null>(null);
  const [customRunning, setCustomRunning] = useState(false);

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

  useEffect(() => {
    setSelPerTurn(EMPTY_SEL());
    setCustomStats(null);
  }, [entries]);

  const stats = multiCardMode ? multiStats : singleStats;

  function updateSel(turnIdx: number, id: string, add: boolean) {
    setSelPerTurn((prev) =>
      prev.map((s, i) => {
        if (i !== turnIdx) return s;
        const next = new Set(s);
        if (add) next.add(id);
        else next.delete(id);
        return next;
      }),
    );
    setCustomStats(null);
  }

  function runCustomSim() {
    setCustomRunning(true);
    setCustomStats(null);
    setTimeout(() => {
      const result = simulateCustomPlayability(entries, selPerTurn);
      setCustomStats(result);
      setCustomRunning(false);
    }, 0);
  }

  const anySelected = selPerTurn.some((s) => s.size > 0);

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

      <div className={styles.customSection}>
        <p className={styles.customTitle}>ターン別カード指定</p>
        <p className={styles.customNote}>各ターンに使いたいカードを選択して確率を計算します（10,000試行）</p>

        {TURN_LABELS.map((label, i) => {
          const sel = selPerTurn[i];
          const available: DeckEntry[] = [];
          const selected: DeckEntry[] = [];
          for (const e of entries) {
            if (sel.has(e.card.id)) selected.push(e);
            else available.push(e);
          }
          return (
            <div key={label} className={styles.turnRow}>
              <span className={styles.turnLabel}>{label}</span>
              <div className={styles.turnControl}>
                <select
                  className={styles.cardSelect}
                  value=""
                  onChange={(e) => {
                    if (e.target.value) updateSel(i, e.target.value, true);
                  }}
                  disabled={available.length === 0}
                >
                  <option value="">カードを追加…</option>
                  {available.map((entry) => (
                    <option key={entry.card.id} value={entry.card.id}>
                      {entry.card.name}（×{entry.count}）
                    </option>
                  ))}
                </select>
                {selected.length > 0 && (
                  <div className={styles.selectedPills}>
                    {selected.map((entry) => (
                      <span key={entry.card.id} className={styles.selectedPill}>
                        {entry.card.name}
                        <button
                          type="button"
                          className={styles.pillRemove}
                          onClick={() => updateSel(i, entry.card.id, false)}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        <div className={styles.customActions}>
          <button
            type="button"
            className={styles.btnCalc}
            onClick={runCustomSim}
            disabled={!anySelected || customRunning}
          >
            {customRunning ? '計算中…' : '計算する'}
          </button>
          {!anySelected && <span className={styles.customHint}>カードを選択してください</span>}
        </div>

        {customStats && !customRunning && (
          <div className={styles.rateGrid}>
            <RateItem
              label={`1ターン目${selPerTurn[0].size === 0 ? '（指定なし）' : ''}`}
              rate={customStats.turn1Rate}
            />
            <RateItem
              label={`2ターン目${selPerTurn[1].size === 0 ? '（指定なし）' : ''}`}
              rate={customStats.turn2Rate}
            />
            <RateItem
              label={`3ターン目${selPerTurn[2].size === 0 ? '（指定なし）' : ''}`}
              rate={customStats.turn3Rate}
            />
            <RateItem label="3ターン完走" rate={customStats.allTurnsRate} highlight />
          </div>
        )}
      </div>
    </div>
  );
}
