import type { DeckEntry } from '../../types';
import styles from './DeckDistributionChart.module.css';

interface Props { entries: DeckEntry[] }

function buildDist(entries: DeckEntry[], key: 'level' | 'cost'): [number, number][] {
  const map: Record<number, number> = {};
  for (const { card, count } of entries) {
    const v = card[key];
    map[v] = (map[v] ?? 0) + count;
  }
  // level/cost は 0 も有効値のため、固定レンジではなく実データの最小〜最大を隙間なく表示する
  const keys = Object.keys(map).map(Number);
  if (keys.length === 0) return [];
  const min = Math.min(...keys);
  const max = Math.max(...keys);
  return Array.from({ length: max - min + 1 }, (_, i) => min + i).map((k) => [k, map[k] ?? 0]);
}

function MiniBarChart({ label, data }: { label: string; data: [number, number][] }) {
  const max = Math.max(...data.map(([, v]) => v), 1);
  return (
    <div>
      <p className={styles.chartLabel}>{label}</p>
      <div className={styles.bars}>
        {data.map(([k, v]) => (
          <div key={k} className={styles.barCol}>
            <span className={styles.barCount}>{v}</span>
            <div className={styles.barTrack}>
              <div className={styles.bar} style={{ height: `${(v / max) * 100}%` }} />
            </div>
            <span className={styles.barKey}>{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DeckDistributionChart({ entries }: Props) {
  if (entries.length === 0) return null;
  return (
    <div className={styles.container}>
      <MiniBarChart label="Lv 分布" data={buildDist(entries, 'level')} />
      <MiniBarChart label="コスト分布" data={buildDist(entries, 'cost')} />
    </div>
  );
}
