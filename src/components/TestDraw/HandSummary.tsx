import type { Card } from '../../types';
import styles from './TestDraw.module.css';

interface Props { hand: Card[]; label?: string }

export default function HandSummary({ hand, label = '総コスト' }: Props) {
  const total = hand.reduce((s, c) => s + c.cost, 0);
  const hasKey = hand.some((c) => c.isKeyCard);

  return (
    <div className={styles.summary}>
      <div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
        <div className={styles.totalCost}>{total}</div>
      </div>
      <span className={`${styles.keyResult} ${hasKey ? styles.keyHit : styles.keyMiss}`}>
        {hasKey ? '✅ キーカードあり' : '❌ キーカードなし'}
      </span>
    </div>
  );
}
