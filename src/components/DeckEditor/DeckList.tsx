import type { DeckEntry } from '../../types';
import DeckListItem from './DeckListItem';
import styles from './DeckEditor.module.css';

interface Props {
  entries: DeckEntry[];
  onUpdateCount: (cardId: string, count: number) => void;
  onToggleKeyCard: (cardId: string) => void;
  onRemove: (cardId: string) => void;
}

export default function DeckList({ entries, onUpdateCount, onToggleKeyCard, onRemove }: Props) {
  const total = entries.reduce((s, e) => s + e.count, 0);

  return (
    <div>
      <div className={styles.listHeader}>
        <span>デッキ内カード ({entries.length} 種)</span>
        <span>{total} / 50 枚</span>
      </div>
      {entries.length === 0 ? (
        <p className={styles.emptyMsg}>カードを追加してください</p>
      ) : (
        entries.map((entry) => (
          <DeckListItem
            key={entry.card.id}
            entry={entry}
            onUpdateCount={onUpdateCount}
            onToggleKeyCard={onToggleKeyCard}
            onRemove={onRemove}
          />
        ))
      )}
    </div>
  );
}
