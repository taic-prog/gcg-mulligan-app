import styles from './TestDraw.module.css';

interface Props { used: boolean; onClick: () => void }

export default function MulliganButton({ used, onClick }: Props) {
  return (
    <button className={styles.btnMulligan} onClick={onClick} disabled={used}>
      {used ? 'マリガン済み' : 'マリガンを実施する'}
    </button>
  );
}
