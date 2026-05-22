import styles from './TestDraw.module.css';

interface Props {
  onRun: (count: number) => void;
  disabled?: boolean;
}

const COUNTS = [100, 1000, 10000] as const;

export default function SimulationButtons({ onRun, disabled }: Props) {
  return (
    <div className={styles.simSection}>
      <p className={styles.simTitle}>統計シミュレーション</p>
      <div className={styles.simBtns}>
        {COUNTS.map((n) => (
          <button key={n} className={styles.btnSim} onClick={() => onRun(n)} disabled={disabled}>
            {n.toLocaleString()} 回実行
          </button>
        ))}
      </div>
    </div>
  );
}
