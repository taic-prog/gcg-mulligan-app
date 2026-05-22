import { useState } from 'react';
import './index.css';
import styles from './App.module.css';
import TabNav from './components/common/TabNav';
import type { Screen } from './components/common/TabNav';
import Dashboard from './components/Dashboard';
import DeckEditor from './components/DeckEditor';
import Statistics from './components/Statistics';
import TestDraw from './components/TestDraw';
import { DeckStoreProvider } from './store/DeckStoreContext';

export default function App() {
  const [screen, setScreen] = useState<Screen>('deck-editor');

  return (
    <DeckStoreProvider>
      <div className={styles.app}>
        <header className={styles.header}>
          <span className={styles.title}>GCG マリガン期待値計算</span>
          <TabNav screen={screen} onChangeScreen={setScreen} />
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
