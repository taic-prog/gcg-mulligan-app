import styles from './TabNav.module.css';

export type Screen = 'deck-editor' | 'dashboard' | 'test-draw' | 'statistics';

const TABS: { id: Screen; label: string }[] = [
  { id: 'deck-editor', label: 'デッキ編集' },
  { id: 'dashboard', label: '期待値' },
  { id: 'test-draw', label: 'テストドロー' },
  { id: 'statistics', label: '統計' },
];

interface Props {
  screen: Screen;
  onChangeScreen: (s: Screen) => void;
}

export default function TabNav({ screen, onChangeScreen }: Props) {
  return (
    <nav className={styles.nav}>
      {TABS.map((t) => (
        <button
          key={t.id}
          className={`${styles.tab} ${screen === t.id ? styles.active : ''}`}
          onClick={() => onChangeScreen(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
