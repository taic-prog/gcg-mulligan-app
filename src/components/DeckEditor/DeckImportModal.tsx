import { useRef, useState } from 'react';
import { fetchCardInfo } from '../../logic/cardFetch';
import { parseDeckText } from '../../logic/deckImport';
import type { DeckEntry } from '../../types';
import styles from './DeckImportModal.module.css';

interface FetchResult {
  cardNo: string;
  count: number;
  status: 'pending' | 'loading' | 'ok' | 'error';
  name?: string;
  entry?: DeckEntry;
}

type Step = 'input' | 'fetching' | 'done';

interface Props {
  onImport: (entries: DeckEntry[]) => void;
  onClose: () => void;
}

const STATUS_LABEL: Record<FetchResult['status'], string> = {
  pending: '待機中',
  loading: '取得中…',
  ok: '取得完了',
  error: '取得失敗',
};

const STATUS_CLASS: Record<FetchResult['status'], string> = {
  pending: styles.statusPending,
  loading: styles.statusLoading,
  ok: styles.statusOk,
  error: styles.statusError,
};

export default function DeckImportModal({ onImport, onClose }: Props) {
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [results, setResults] = useState<FetchResult[]>([]);
  const [parseError, setParseError] = useState('');
  const abortRef = useRef(false);

  const doneCount = results.filter((r) => r.status === 'ok').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const loadedCount = doneCount + errorCount;

  async function handleFetch() {
    const parsed = parseDeckText(text);
    if (parsed.length === 0) {
      setParseError('カードNo.が見つかりませんでした。形式を確認してください。');
      return;
    }
    setParseError('');
    abortRef.current = false;

    const initial: FetchResult[] = parsed.map((p) => ({
      cardNo: p.cardNo,
      count: p.count,
      status: 'pending',
    }));
    setResults(initial);
    setStep('fetching');

    const working = [...initial];
    for (let i = 0; i < working.length; i++) {
      if (abortRef.current) break;

      working[i] = { ...working[i], status: 'loading' };
      setResults([...working]);

      try {
        const info = await fetchCardInfo(working[i].cardNo);
        const entry: DeckEntry = {
          card: {
            id: crypto.randomUUID(),
            cardNo: working[i].cardNo,
            name: info.name,
            cardType: info.cardType,
            color: info.color,
            level: info.level,
            cost: info.cost,
            isKeyCard: false,
            ...(info.terrain ? { terrain: info.terrain } : {}),
            ...(info.feature ? { feature: info.feature } : {}),
            ...(info.link ? { link: info.link } : {}),
          },
          count: working[i].count,
        };
        working[i] = { ...working[i], status: 'ok', name: info.name, entry };
      } catch {
        working[i] = { ...working[i], status: 'error' };
      }
      setResults([...working]);
    }

    setStep('done');
  }

  function handleImport() {
    const entries = results.filter((r) => r.status === 'ok').map((r) => r.entry!);
    onImport(entries);
    onClose();
  }

  function handleClose() {
    abortRef.current = true;
    onClose();
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <p className={styles.title}>デッキリストをインポート</p>
          <button className={styles.btnClose} onClick={handleClose}>✕</button>
        </div>

        <div className={styles.body}>
          {step === 'input' && (
            <>
              <p className={styles.label}>デッキリストを貼り付け（1行1カード）</p>
              <textarea
                className={styles.textarea}
                value={text}
                onChange={(e) => { setText(e.target.value); setParseError(''); }}
                placeholder={'GD01-001 3\nGD01-002 x4\nGD01-003 2'}
              />
              <p className={styles.hint}>
                形式: 「カードNo. 枚数」または「カードNo. x枚数」（枚数省略時は1枚）
              </p>
              {parseError && <p className={styles.parseError}>{parseError}</p>}
            </>
          )}

          {(step === 'fetching' || step === 'done') && (
            <>
              <div className={styles.resultList}>
                {results.map((r) => (
                  <div key={r.cardNo} className={styles.resultRow}>
                    <span className={styles.resultCardNo}>{r.cardNo}</span>
                    <span className={styles.resultName}>{r.name ?? '—'}</span>
                    <span className={styles.resultCount}>×{r.count}</span>
                    <span className={STATUS_CLASS[r.status]}>{STATUS_LABEL[r.status]}</span>
                  </div>
                ))}
              </div>
              {step === 'fetching' && (
                <p className={styles.progress}>
                  {loadedCount} / {results.length} 取得中…
                </p>
              )}
              {step === 'done' && (
                <p className={styles.progress}>
                  完了: {doneCount} 件成功 {errorCount > 0 ? `/ ${errorCount} 件失敗` : ''}
                </p>
              )}
            </>
          )}
        </div>

        <div className={styles.footer}>
          {step === 'done' && (
            <span className={styles.footerNote}>
              ※ 現在のデッキリストは上書きされます
            </span>
          )}
          <button className={styles.btnCancel} onClick={handleClose}>
            キャンセル
          </button>
          {step === 'input' && (
            <button
              className={styles.btnFetch}
              onClick={handleFetch}
              disabled={!text.trim()}
            >
              カード情報を取得
            </button>
          )}
          {step === 'done' && (
            <button
              className={styles.btnImport}
              onClick={handleImport}
              disabled={doneCount === 0}
            >
              デッキにインポート（{doneCount} 枚種）
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
