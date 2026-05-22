import type { DeckEntry, KeyCardProbability } from '../../types';
import styles from './Dashboard.module.css';

interface Props {
  probability: KeyCardProbability;
  entries: DeckEntry[];
}

export default function KeyCardProbabilityCard({ probability, entries }: Props) {
  const keyCards = entries.filter((e) => e.card.isKeyCard);

  if (probability.totalKeyCardCount === 0) {
    return (
      <div className={styles.card}>
        <p className={styles.cardTitle}>キーカード含有確率</p>
        <p className={styles.keyInfo}>キーカードが設定されていません（デッキ編集画面で 🔑 を設定）</p>
      </div>
    );
  }

  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>キーカード含有確率</p>
      <p className={styles.keyInfo}>
        {keyCards.map((e) => `${e.card.name}(x${e.count})`).join(' / ')} - 計 {probability.totalKeyCardCount} 枚
      </p>
      <div className={styles.probRow}>
        <div className={styles.probItem}>
          <span className={styles.probLabel}>初期手札に1枚以上</span>
          <span className={styles.probValue}>{(probability.probInitialHand * 100).toFixed(2)}%</span>
        </div>
        <div className={styles.probItem}>
          <span className={styles.probLabel}>マリガン後に1枚以上</span>
          <span className={styles.probValue}>{(probability.probAfterMulligan * 100).toFixed(2)}%</span>
        </div>
      </div>
    </div>
  );
}
