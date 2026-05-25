import { useEffect, useState } from 'react';
import './index.css';
import styles from './App.module.css';
import TabNav from './components/common/TabNav';
import type { Screen } from './components/common/TabNav';
import Dashboard from './components/Dashboard';
import DeckEditor from './components/DeckEditor';
import Statistics from './components/Statistics';
import TestDraw from './components/TestDraw';
import { DeckStoreProvider } from './store/DeckStoreContext';
import { seedDB } from './logic/cardCache';

function initDark(): boolean {
  const saved = localStorage.getItem('theme');
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  return dark;
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('deck-editor');
  const [dark, setDark] = useState(initDark);

  useEffect(() => { seedDB(); }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return (
    <DeckStoreProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <span className={styles.title}>GCG マリガン期待値計算</span>
          <TabNav screen={screen} onChangeScreen={setScreen} />
          <button
            className={styles.btnTheme}
            onClick={() => setDark((d) => !d)}
            title={dark ? 'ライトモードに切替' : 'ダークモードに切替'}
          >
            {dark ? '☀️' : '🌙'}
          </button>
        </header>
        <main className={styles.main}>
          {screen === 'deck-editor' && <DeckEditor />}
          {screen === 'dashboard' && <Dashboard />}
          {screen === 'test-draw' && <TestDraw />}
          {screen === 'statistics' && <Statistics />}
        </main>
      </div>
    </DeckStoreProvider>
  );
}
