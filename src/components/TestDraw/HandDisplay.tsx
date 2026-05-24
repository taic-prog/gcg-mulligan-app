import { useState } from 'react';
import type { Card } from '../../types';
import styles from './TestDraw.module.css';

function HandCard({ card, index }: { card: Card; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(card.terrain || card.feature || card.link);

  return (
    <div className={styles.handCard}>
      <div className={styles.handCardMain} onClick={() => hasDetail && setExpanded((v) => !v)}>
        <span className={styles.num}>{index + 1}.</span>
        <span className={styles.badge} data-color={card.color}>{card.cardType}</span>
        {card.isKeyCard && <span className={styles.keyIcon}>🔑</span>}
        <span className={styles.name}>{card.name}</span>
        {hasDetail && <span className={styles.expandArrow}>{expanded ? '▴' : '▾'}</span>}
        <span className={styles.lv}>Lv:{card.level}</span>
        <span className={styles.cost}>C:{card.cost}</span>
      </div>
      {expanded && hasDetail && (
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
      )}
    </div>
  );
}

interface Props { hand: Card[] }

export default function HandDisplay({ hand }: Props) {
  return (
    <div className={styles.hand}>
      {hand.map((card, i) => (
        <HandCard key={`${card.id}-${i}`} card={card} index={i} />
      ))}
    </div>
  );
}
