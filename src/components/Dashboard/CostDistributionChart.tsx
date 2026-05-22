import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import styles from './Dashboard.module.css';

interface Props { distribution: Record<number, number> }

export default function CostDistributionChart({ distribution }: Props) {
  const data = Object.entries(distribution)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([cost, prob]) => ({ cost: Number(cost), 確率: parseFloat((prob * 100).toFixed(2)) }));

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>手札総コスト分布（確率）</p>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="cost" tick={{ fontSize: 11 }} label={{ value: '総コスト', position: 'insideBottom', offset: -2, fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} unit="%" />
          <Tooltip formatter={(v: number) => [`${v}%`, '確率']} labelFormatter={(l) => `総コスト: ${l}`} />
          <Bar dataKey="確率" fill="var(--primary)" radius={[2, 2, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
