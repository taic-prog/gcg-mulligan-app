import { useState } from 'react';
import type { Card, DeckEntry } from '../../types';
import styles from './ManualHandSelector.module.css';

interface Props {
  entries: DeckEntry[];
  onConfirm: (hand: Card[]) => void;
}

const HAND_SIZE = 5;

export default function ManualHandSelector({ entries, onConfirm }: Props) {
  const [counts, setCounts] = useState<Record<string, number>>({});

  const total = Object.values(counts).reduce((s, n) => s + n, 0);

  function add(cardId: string) {
    setCounts((prev) => ({ ...prev, [cardId]: (prev[cardId] ?? 0) + 1 }));
  }

  function remove(cardId: string) {
    setCounts((prev) => {
      const n = (prev[cardId] ?? 0) - 1;
      if (n <= 0) {
        const next = { ...prev };
        delete next[cardId];
        return next;
      }
      return { ...prev, [cardId]: n };
    });
  }

  function handleConfirm() {
    if (total !== HAND_SIZE) return;
    const hand: Card[] = [];
    for (const { card } of entries) {
      const n = counts[card.id] ?? 0;
      for (let i = 0; i < n; i++) hand.push(card);
    }
    onConfirm(hand);
  }

  const sortedEntries = [...entries].sort(
    (a, b) => a.card.cost - b.card.cost || a.card.level - b.card.level
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <span className={total === HAND_SIZE ? styles.countReady : styles.count}>
          {total} / {HAND_SIZE} 枚選択中
        </span>
        <button
          className={styles.btnConfirm}
          onClick={handleConfirm}
          disabled={total !== HAND_SIZE}
        >
          この手札で確定
        </button>
      </div>

      <div className={styles.list}>
        {sortedEntries.map(({ card, count }) => {
          const selected = counts[card.id] ?? 0;
          return (
            <div key={card.id} className={styles.row}>
              <div className={styles.info}>
                <span className={styles.cardName}>
                  {card.isKeyCard && <span className={styles.keyIcon}>★</span>}
                  {card.name}
                </span>
                <span className={styles.meta}>
                  {card.color}・{card.cardType}・Lv{card.level}・コスト{card.cost}
                </span>
              </div>
              <div className={styles.ctrl}>
                <span className={styles.deckCount}>×{count}</span>
                <button
                  className={styles.btnAdj}
                  onClick={() => remove(card.id)}
                  disabled={selected === 0}
                >−</button>
                <span className={styles.selected}>{selected}</span>
                <button
                  className={styles.btnAdj}
                  onClick={() => add(card.id)}
                  disabled={selected >= count || total >= HAND_SIZE}
                >＋</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
