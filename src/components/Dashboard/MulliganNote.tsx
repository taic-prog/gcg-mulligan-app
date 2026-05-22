import type { ExpectedValueResult } from '../../types';
import styles from './Dashboard.module.css';

interface Props { result: ExpectedValueResult }

export default function MulliganNote({ result }: Props) {
  return (
    <div className={styles.card}>
      <p className={styles.cardTitle}>マリガンについて</p>
      <div className={styles.noteBox}>
        <p>マリガン後の期待値は <strong>{result.totalHandCost.toFixed(2)}</strong> と同値です。</p>
        <p style={{ marginTop: 6 }}>
          GCG のマリガンは全手札をデッキ下に戻してシャッフル後に引き直すため、
          デッキ構成が変わらない限り期待値は変化しません。
          ただし標準偏差 <strong>{result.standardDeviation.toFixed(2)}</strong> のばらつきがあるため、
          低コスト手札を引いた場合はマリガンによる改善が期待できます。
        </p>
      </div>
    </div>
  );
}
