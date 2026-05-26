import { useEffect, useRef, useState } from 'react';
import { fetchCardInfo } from '../../logic/cardFetch';
import { recognizeDeckImage } from '../../logic/imageOcr';
import { parseDeckText } from '../../logic/deckImport';
import { buildCard } from '../../logic/validator';
import type { OcrProgress } from '../../logic/imageOcr';
import type { DeckEntry } from '../../types';
import styles from './DeckImportModal.module.css';

const MAX_IMAGE_SIZE = 20 * 1024 * 1024; // 20 MB

interface FetchResult {
  cardNo: string;
  count: number;
  status: 'pending' | 'loading' | 'ok' | 'error';
  name?: string;
  entry?: DeckEntry;
}

type Step = 'input' | 'fetching' | 'done';
type Tab = 'text' | 'image';

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
  const [tab, setTab] = useState<Tab>('text');
  const [text, setText] = useState('');
  const [step, setStep] = useState<Step>('input');
  const [results, setResults] = useState<FetchResult[]>([]);
  const [parseError, setParseError] = useState('');
  const abortRef = useRef(false);

  // 画像タブ用state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'processing' | 'done' | 'error'>('idle');
  const [ocrProgress, setOcrProgress] = useState<OcrProgress>({ status: '', progress: 0 });
  const [ocrError, setOcrError] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => { if (imageUrl) URL.revokeObjectURL(imageUrl); };
  }, [imageUrl]);

  const doneCount = results.filter((r) => r.status === 'ok').length;
  const errorCount = results.filter((r) => r.status === 'error').length;
  const loadedCount = doneCount + errorCount;

  function handleImageSelect(file: File) {
    if (!file.type.startsWith('image/')) return;
    if (file.size > MAX_IMAGE_SIZE) {
      setOcrError(`ファイルサイズが大きすぎます（上限${MAX_IMAGE_SIZE / 1024 / 1024}MB）`);
      return;
    }
    setImageFile(file);
    setImageUrl(URL.createObjectURL(file));
    setOcrStatus('idle');
    setOcrError('');
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleImageSelect(file);
  }

  async function handleOcr() {
    if (!imageFile) return;
    setOcrStatus('processing');
    setOcrError('');
    try {
      const result = await recognizeDeckImage(imageFile, (p) => setOcrProgress(p));
      if (!result.trim()) {
        setOcrStatus('error');
        setOcrError('カードNo.を認識できませんでした。画像を確認してください。');
        return;
      }
      setText(result);
      setOcrStatus('done');
      // テキストタブに切り替えてユーザーが確認できるようにする
      setTab('text');
    } catch {
      setOcrStatus('error');
      setOcrError('画像の読み取りに失敗しました。');
    }
  }

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
          card: buildCard(
            { cardNo: working[i].cardNo, name: info.name, cardType: info.cardType,
              color: info.color, level: info.level, cost: info.cost, isKeyCard: false },
            { terrain: info.terrain, feature: info.feature, link: info.link }
          ),
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

        {/* タブ（入力ステップのみ表示） */}
        {step === 'input' && (
          <div className={styles.tabs}>
            <button
              className={tab === 'text' ? styles.tabActive : styles.tab}
              onClick={() => setTab('text')}
            >
              テキスト
            </button>
            <button
              className={tab === 'image' ? styles.tabActive : styles.tab}
              onClick={() => setTab('image')}
            >
              画像から読み取り
            </button>
          </div>
        )}

        <div className={styles.body}>
          {/* テキストタブ */}
          {step === 'input' && tab === 'text' && (
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

          {/* 画像タブ */}
          {step === 'input' && tab === 'image' && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => e.target.files?.[0] && handleImageSelect(e.target.files[0])}
              />
              {!imageFile ? (
                <div
                  className={isDragOver ? styles.dropZoneActive : styles.dropZone}
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDrop}
                >
                  <p className={styles.dropZoneText}>画像をドロップ、またはクリックして選択</p>
                  <p className={styles.dropZoneHint}>GCG公式のデッキシェア画像に対応</p>
                </div>
              ) : (
                <>
                  {imageUrl && (
                    <img src={imageUrl} alt="デッキ画像" className={styles.imagePreview} />
                  )}
                  {ocrStatus === 'processing' && (
                    <>
                      <div className={styles.progressBar}>
                        <div
                          className={styles.progressFill}
                          style={{ width: `${ocrProgress.progress * 100}%` }}
                        />
                      </div>
                      <p className={styles.progressLabel}>
                        {ocrProgress.status} … {Math.round(ocrProgress.progress * 100)}%
                      </p>
                    </>
                  )}
                  {ocrStatus === 'done' && (
                    <p className={styles.progress}>読み取り完了 — テキストタブで確認してください</p>
                  )}
                  {ocrError && <p className={styles.ocrError}>{ocrError}</p>}
                  <p className={styles.hint}>
                    <button
                      className={styles.btnCancel}
                      style={{ fontSize: 11, padding: '2px 10px', marginTop: 6 }}
                      onClick={() => { setImageFile(null); setImageUrl(null); setOcrStatus('idle'); }}
                    >
                      別の画像を選択
                    </button>
                  </p>
                </>
              )}
            </>
          )}

          {/* 取得結果一覧 */}
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
            <span className={styles.footerNote}>※ 現在のデッキリストは上書きされます</span>
          )}
          <button className={styles.btnCancel} onClick={handleClose}>キャンセル</button>
          {step === 'input' && tab === 'text' && (
            <button
              className={styles.btnFetch}
              onClick={handleFetch}
              disabled={!text.trim()}
            >
              カード情報を取得
            </button>
          )}
          {step === 'input' && tab === 'image' && imageFile && ocrStatus !== 'processing' && ocrStatus !== 'done' && (
            <button className={styles.btnFetch} onClick={handleOcr}>
              画像を読み取る
            </button>
          )}
          {step === 'input' && tab === 'image' && ocrStatus === 'done' && (
            <button className={styles.btnFetch} onClick={() => setTab('text')}>
              テキストを確認する
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
