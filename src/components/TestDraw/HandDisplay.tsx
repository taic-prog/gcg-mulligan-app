import type { Card } from '../../types';
import styles from './TestDraw.module.css';

interface Props { hand: Card[] }

export default function HandDisplay({ hand }: Props) {
  return (
    <div className={styles.hand}>
      {hand.map((card, i) => (
        <div key={`${card.id}-${i}`} className={styles.handCard}>
          <span className={styles.num}>{i + 1}.</span>
          <span className={styles.badge}>{card.cardType}</span>
          {card.isKeyCard && <span className={styles.keyIcon}>🔑</span>}
          <span className={styles.name}>{card.name}</span>
          <span className={styles.cost}>C:{card.cost}</span>
        </div>
      ))}
    </div>
  );
}
