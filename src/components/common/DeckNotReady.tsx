import styles from './DeckNotReady.module.css';

interface Props {
  total: number;
  hint?: string;
}

export default function DeckNotReady({ total, hint }: Props) {
  if (total === 0) {
    return (
      <div className={styles.noData}>
        <p>デッキが選択されていません</p>
        <p className={styles.noDataHint}>{hint ?? 'デッキ編集画面でデッキを選択してください'}</p>
      </div>
    );
  }
  return (
    <div className={styles.noData}>
      <p>デッキが 50 枚ではありません（現在 {total} 枚）</p>
      <p className={styles.noDataHint}>デッキ編集画面でちょうど 50 枚に調整してください</p>
    </div>
  );
}
