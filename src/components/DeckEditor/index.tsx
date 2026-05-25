import { useState } from 'react';
import { exportDeckText } from '../../logic/deckExport';
import { useDeckStoreCtx } from '../../store/DeckStoreContext';
import CardForm from './CardForm';
import ComboManager from './ComboManager';
import DeckDistributionChart from './DeckDistributionChart';
import DeckExportModal from './DeckExportModal';
import DeckImportModal from './DeckImportModal';
import DeckList from './DeckList';
import DeckSummary from './DeckSummary';
import styles from './DeckEditor.module.css';

export default function DeckEditor() {
  const { decks, activeDeck, setActiveDeck, saveNewDeck, deleteDeck, renameDeck,
          addEntry, updateEntry, updateCard, removeEntry, importEntries } = useDeckStoreCtx();
  const [showImport, setShowImport] = useState(false);
  const [showExport, setShowExport] = useState(false);

  function handleNewDeck() {
    const deck = saveNewDeck({ name: '新デッキ', entries: [] });
    setActiveDeck(deck.id);
  }

  function handleUpdateCount(cardId: string, count: number) {
    updateEntry(cardId, count);
  }

  function handleToggleKeyCard(cardId: string) {
    if (!activeDeck) return;
    const entry = activeDeck.entries.find((e) => e.card.id === cardId);
    if (!entry) return;
    updateCard(cardId, { isKeyCard: !entry.card.isKeyCard });
  }

  return (
    <>
    {showImport && activeDeck && (
      <DeckImportModal
        onImport={importEntries}
        onClose={() => setShowImport(false)}
      />
    )}
    {showExport && activeDeck && (
      <DeckExportModal
        text={exportDeckText(activeDeck)}
        onClose={() => setShowExport(false)}
      />
    )}
    <div className={styles.layout}>
      {/* 左ペイン: デッキ一覧 + カードリスト */}
      <div className={styles.panel}>
        <div className={styles.deckBar}>
          <select
            className={styles.deckSelect}
            value={activeDeck?.id ?? ''}
            onChange={(e) => setActiveDeck(e.target.value)}
          >
            <option value="" disabled>デッキを選択…</option>
            {decks.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          {activeDeck && (
            <input
              className={styles.deckName}
              value={activeDeck.name}
              onChange={(e) => renameDeck(activeDeck.id, e.target.value)}
              placeholder="デッキ名"
            />
          )}
          <button className={styles.btnNew} onClick={handleNewDeck} disabled={decks.length >= 5}>
            ＋新規
          </button>
          {activeDeck && (
            <button className={styles.btnImport} onClick={() => setShowImport(true)}>
              インポート
            </button>
          )}
          {activeDeck && (
            <button className={styles.btnImport} onClick={() => setShowExport(true)}>
              エクスポート
            </button>
          )}
          {activeDeck && (
            <button className={styles.btnDel} onClick={() => deleteDeck(activeDeck.id)}>
              削除
            </button>
          )}
        </div>

        {activeDeck ? (
          <>
            <DeckList
              entries={activeDeck.entries}
              onUpdateCount={handleUpdateCount}
              onToggleKeyCard={handleToggleKeyCard}
              onRemove={removeEntry}
            />
            <DeckSummary entries={activeDeck.entries} />
            <DeckDistributionChart entries={activeDeck.entries} />
            <ComboManager />
          </>
        ) : (
          <p className={styles.noDeck}>「＋新規」ボタンでデッキを作成してください</p>
        )}
      </div>

      {/* 右ペイン: カード追加フォーム */}
      <div className={styles.panel}>
        <p className={styles.panelTitle}>カード追加</p>
        {activeDeck ? (
          <CardForm entries={activeDeck.entries} onAdd={addEntry} />
        ) : (
          <p className={styles.noDeck}>デッキを選択してください</p>
        )}
      </div>
    </div>
    </>
  );
}
