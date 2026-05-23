import { useState } from 'react';
import styles from './DeckImportModal.module.css';

interface Props {
  text: string;
  onClose: () => void;
}

export default function DeckExportModal({ text, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.overlay} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <p className={styles.title}>デッキリストをエクスポート</p>
          <button className={styles.btnClose} onClick={onClose}>✕</button>
        </div>

        <div className={styles.body}>
          <p className={styles.label}>デッキリスト（テキスト形式）</p>
          <textarea
            className={styles.textarea}
            value={text}
            readOnly
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
          <p className={styles.hint}>クリックで全選択、またはボタンでコピーできます</p>
        </div>

        <div className={styles.footer}>
          <button className={styles.btnCancel} onClick={onClose}>閉じる</button>
          <button className={styles.btnImport} onClick={handleCopy}>
            {copied ? 'コピーしました！' : 'クリップボードにコピー'}
          </button>
        </div>
      </div>
    </div>
  );
}
