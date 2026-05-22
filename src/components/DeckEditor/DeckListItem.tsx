import type { DeckEntry } from '../../types';
import styles from './DeckEditor.module.css';

interface Props {
  entry: DeckEntry;
  onUpdateCount: (cardId: string, count: number) => void;
  onToggleKeyCard: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}

export default function DeckListItem({ entry, onUpdateCount, onToggleKeyCard, onRemove }: Props) {
  const { card, count } = entry;

  return (
    <div className={styles.item}>
      <span className={styles.badge}>{card.cardType}</span>
      {card.isKeyCard && <span className={styles.keyIcon}>🔑</span>}
      <span className={styles.cardName} title={card.name}>{card.name}</span>
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
  );
}
