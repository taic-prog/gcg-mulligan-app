import type { Card } from '../../types';
import styles from './CardDetailPanel.module.css';

interface Props { card: Pick<Card, 'terrain' | 'feature' | 'link'> }

export default function CardDetailPanel({ card }: Props) {
  return (
    <div className={styles.cardDetail}>
      {card.terrain && (
        <span className={styles.detailItem}>
          <span className={styles.detailLabel}>地形</span>{card.terrain}
        </span>
      )}
      {card.feature && (
        <span className={styles.detailItem}>
          <span className={styles.detailLabel}>特徴</span>{card.feature}
        </span>
      )}
      {card.link && (
        <span className={styles.detailItem}>
          <span className={styles.detailLabel}>リンク</span>{card.link}
        </span>
      )}
    </div>
  );
}
