import { validateDeck } from '../../logic/validator';
import type { DeckEntry } from '../../types';
import styles from './DeckEditor.module.css';

interface Props { entries: DeckEntry[] }

export default function DeckSummary({ entries }: Props) {
  const total = entries.reduce((s, e) => s + e.count, 0);
  const colors = [...new Set(entries.map((e) => e.card.color))];
  const errors = validateDeck(entries);

  return (
    <div>
      <div className={styles.summary}>
        <span className={styles.summaryItem}>
          <span className={styles.summaryLabel}>合計</span>
          <span className={total === 50 ? styles.count50 : styles.countWarn}>{total} / 50 枚</span>
        </span>
        <span className={styles.summaryItem}>
          <span className={styles.summaryLabel}>色</span>
          <span>{colors.length > 0 ? colors.join('・') : '—'}</span>
        </span>
      </div>
      {errors.length > 0 && (
        <ul className={styles.validationErrors}>
          {errors.map((e, i) => (
            <li key={i} className={styles.validErr}>⚠ {e.message}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
