import { useEffect, useRef, useState } from 'react';
import type { DeckEntry, PlayabilityStats } from '../../types';
import styles from './PlayabilityCard.module.css';

interface Props {
  entries: DeckEntry[];
}

type SimRequest =
  | { id: number; type: 'playability'; entries: DeckEntry[]; multiCardMode: boolean; trials: number }
  | { id: number; type: 'custom'; entries: DeckEntry[]; turnCardIds: string[][]; trials: number };

type SimResponse = { id: number; type: 'playability' | 'custom'; result: PlayabilityStats };

function RateItem({
  label,
  rate,
  highlight,
  impossible,
}: {
  label: string;
  rate: number;
  highlight?: boolean;
  impossible?: boolean;
}) {
  return (
    <div className={styles.rateItem}>
      <span className={styles.rateLabel}>{label}</span>
      <span className={`${styles.rateValue} ${highlight ? styles.rateValueHighlight : ''} ${impossible ? styles.rateValueImpossible : ''}`}>
        {impossible ? '−' : `${(rate * 100).toFixed(1)}%`}
      </span>
    </div>
  );
}

const TURN_LABELS = ['1ターン目', '2ターン目', '3ターン目'] as const;
const EMPTY_SEL = (): Set<string>[] => [new Set(), new Set(), new Set()];

export default function PlayabilityCard({ entries }: Props) {
  const [stats, setStats] = useState<PlayabilityStats | null>(null);
  const [running, setRunning] = useState(true);

  const [selPerTurn, setSelPerTurn] = useState<Set<string>[]>(EMPTY_SEL);
  const [customStats, setCustomStats] = useState<PlayabilityStats | null>(null);
  const [customRunning, setCustomRunning] = useState(false);

  const workerRef = useRef<Worker | null>(null);
  const nextIdRef = useRef(0);
  const pendingPlayabilityId = useRef(-1);
  const pendingCustomId = useRef(-1);

  // Worker を mount 時に1回だけ生成し、unmount 時に破棄
  useEffect(() => {
    const worker = new Worker(
      new URL('../../workers/simulator.worker.ts', import.meta.url),
      { type: 'module' },
    );
    worker.onmessage = (e: MessageEvent<SimResponse>) => {
      const { id, type, result } = e.data;
      if (type === 'playability' && id === pendingPlayabilityId.current) {
        setStats(result);
        setRunning(false);
      } else if (type === 'custom' && id === pendingCustomId.current) {
        setCustomStats(result);
        setCustomRunning(false);
      }
      // id が一致しない場合は古いリクエストの応答なので無視
    };
    workerRef.current = worker;
    return () => worker.terminate();
  }, []);

  // entries 変更時にシミュレーションを Worker で実行
  useEffect(() => {
    setRunning(true);
    setStats(null);
    const id = nextIdRef.current++;
    pendingPlayabilityId.current = id;
    workerRef.current?.postMessage({
      id,
      type: 'playability',
      entries,
      multiCardMode: true,
      trials: 10000,
    } satisfies SimRequest);
  }, [entries]);

  useEffect(() => {
    setSelPerTurn(EMPTY_SEL());
    setCustomStats(null);
  }, [entries]);

  const canPlayT1 = entries.some((e) => e.card.cost === 1 && e.card.level <= 1);

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
    const id = nextIdRef.current++;
    pendingCustomId.current = id;
    workerRef.current?.postMessage({
      id,
      type: 'custom',
      entries,
      turnCardIds: selPerTurn.map((s) => [...s]),
      trials: 10000,
    } satisfies SimRequest);
  }

  const anySelected = selPerTurn.some((s) => s.size > 0);

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.cardTitle}>初動安定率</p>
        <span className={styles.note}>各ターン開始時にドロー、コスト合算でプレイできる確率（10,000試行）</span>
      </div>

      {running ? (
        <p className={styles.loading}>計算中…</p>
      ) : stats ? (
        <div className={styles.rateGrid}>
          <RateItem label="1ターン目（コスト1）" rate={stats.turn1Rate} impossible={!canPlayT1} />
          <RateItem label="2ターン目（コスト2）" rate={stats.turn2Rate} />
          <RateItem label="3ターン目（コスト3）" rate={stats.turn3Rate} />
          <RateItem
            label={canPlayT1 ? '3ターン完走' : '2〜3ターン完走'}
            rate={canPlayT1 ? stats.allTurnsRate : stats.t2t3Rate}
            highlight
          />
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
