import { useState } from 'react';
import type { DeckEntry } from '../../types';
import CardDetailPanel from '../common/CardDetailPanel';
import CardTypeBadge from '../common/CardTypeBadge';
import styles from './DeckEditor.module.css';

interface Props {
  entry: DeckEntry;
  onUpdateCount: (cardId: string, count: number) => void;
  onToggleKeyCard: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}

export default function DeckListItem({ entry, onUpdateCount, onToggleKeyCard, onRemove }: Props) {
  const [expanded, setExpanded] = useState(false);
  const { card, count } = entry;
  const hasDetail = !!(card.terrain || card.feature || card.link);

  return (
    <div className={styles.item}>
      <div className={styles.itemMain}>
        <CardTypeBadge card={card} />
        {card.isKeyCard && <span className={styles.keyIcon}>🔑</span>}
        <div className={styles.nameGroup}>
          <span className={styles.cardName} title={card.name}>{card.name}</span>
          {hasDetail && (
            <button
              type="button"
              className={styles.btnExpand}
              onClick={() => setExpanded((v) => !v)}
              title="詳細表示"
            >
              {expanded ? '▴' : '▾'}
            </button>
          )}
        </div>
        <span className={styles.lvBadge}>Lv:{card.level}</span>
        <span className={styles.costBadge}>C:{card.cost}</span>
        <div className={styles.counter}>
          <button onClick={() => onUpdateCount(card.id, count - 1)} disabled={count <= 1}>－</button>
          <span className={styles.countNum}>{count}</span>
          <button onClick={() => onUpdateCount(card.id, count + 1)} disabled={count >= 4}>＋</button>
        </div>
        <button
          className={`${styles.btnKey} ${card.isKeyCard ? styles.active : ''}`}
          onClick={() => onToggleKeyCard(card.id)}
          title="キーカード切替"
        >🔑</button>
        <button className={styles.btnRemove} onClick={() => onRemove(card.id)} title="削除">✕</button>
      </div>
      {expanded && hasDetail && <CardDetailPanel card={card} />}
    </div>
  );
}
