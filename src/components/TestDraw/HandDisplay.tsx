import { useState } from 'react';
import type { Card } from '../../types';
import CardDetailPanel from '../common/CardDetailPanel';
import CardTypeBadge from '../common/CardTypeBadge';
import styles from './TestDraw.module.css';

function HandCard({ card, index }: { card: Card; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = !!(card.terrain || card.feature || card.link);

  return (
    <div className={styles.handCard}>
      <div className={styles.handCardMain} onClick={() => hasDetail && setExpanded((v) => !v)}>
        <span className={styles.num}>{index + 1}.</span>
        <CardTypeBadge card={card} />
        {card.isKeyCard && <span className={styles.keyIcon}>🔑</span>}
        <span className={styles.name}>{card.name}</span>
        {hasDetail && <span className={styles.expandArrow}>{expanded ? '▴' : '▾'}</span>}
        <span className={styles.lv}>Lv:{card.level}</span>
        <span className={styles.cost}>C:{card.cost}</span>
      </div>
      {expanded && hasDetail && <CardDetailPanel card={card} />}
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
