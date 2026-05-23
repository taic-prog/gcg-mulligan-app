import { useState } from 'react';
import { fetchCardInfo } from '../../logic/cardFetch';
import { canAddCard, validateCard } from '../../logic/validator';
import type { Card, CardColor, CardType, DeckEntry } from '../../types';
import styles from './DeckEditor.module.css';

const CARD_TYPES: CardType[] = ['ユニット', 'パイロット', 'コマンド', 'ベース'];
const CARD_COLORS: CardColor[] = ['青', '緑', '赤', '紫', '白'];

interface FormState {
  cardNo: string;
  name: string;
  cardType: CardType;
  color: CardColor;
  level: string;
  cost: string;
  count: string;
  isKeyCard: boolean;
}

const INIT: FormState = {
  cardNo: '', name: '', cardType: 'ユニット', color: '青',
  level: '1', cost: '1', count: '1', isKeyCard: false,
};

interface Props {
  entries: DeckEntry[];
  onAdd: (entry: DeckEntry) => void;
}

export default function CardForm({ entries, onAdd }: Props) {
  const [form, setForm] = useState<FormState>(INIT);
  const [errors, setErrors] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleFetch() {
    if (!form.cardNo.trim()) return;
    setFetching(true);
    setFetchError(null);
    try {
      const info = await fetchCardInfo(form.cardNo.trim());
      setForm((prev) => ({
        ...prev,
        name: info.name,
        cardType: info.cardType,
        color: info.color,
        level: String(info.level),
        cost: String(info.cost),
      }));
    } catch {
      setFetchError('カード情報の取得に失敗しました');
    } finally {
      setFetching(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const level = parseInt(form.level, 10);
    const cost = parseInt(form.cost, 10);
    const count = parseInt(form.count, 10);

    const cardPartial: Partial<Card> = {
      name: form.name, cardNo: form.cardNo || form.name,
      cardType: form.cardType, color: form.color,
      level, cost, isKeyCard: form.isKeyCard,
    };

    const cardErrors = validateCard(cardPartial);
    const errMsgs: string[] = cardErrors.map((e) => e.message);

    if (isNaN(count) || count < 1 || count > 4) {
      errMsgs.push('枚数は1〜4で入力してください');
    }

    if (errMsgs.length > 0) { setErrors(errMsgs); return; }

    if (!canAddCard(entries, cardPartial.cardNo!, count)) {
      const total = entries.reduce((s, e) => s + e.count, 0);
      if (total + count > 50) errMsgs.push('デッキが50枚を超えます');
      else errMsgs.push(`カードNo.「${cardPartial.cardNo}」はこれ以上追加できません（4枚上限）`);
      setErrors(errMsgs);
      return;
    }

    setErrors([]);
    const card: Card = {
      id: crypto.randomUUID(),
      cardNo: cardPartial.cardNo!,
      name: form.name,
      cardType: form.cardType,
      color: form.color,
      level,
      cost,
      isKeyCard: form.isKeyCard,
    };
    onAdd({ card, count });
    setForm(INIT);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className={styles.formGrid}>
        <div>
          <label>カードNo.</label>
          <div className={styles.cardNoRow}>
            <input
              value={form.cardNo}
              onChange={(e) => { set('cardNo', e.target.value); setFetchError(null); }}
              placeholder="例: GD01-001"
            />
            <button
              type="button"
              className={styles.btnFetch}
              onClick={handleFetch}
              disabled={!form.cardNo.trim() || fetching}
            >
              {fetching ? '取得中…' : '取得'}
            </button>
          </div>
          {fetchError && <p className={styles.fetchError}>{fetchError}</p>}
        </div>
        <div>
          <label>枚数</label>
          <input type="number" min={1} max={4} value={form.count} onChange={(e) => set('count', e.target.value)} />
        </div>
        <div className={styles.formFull}>
          <label>カード名 *</label>
          <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="ガンダム" required />
        </div>
        <div>
          <label>タイプ</label>
          <select value={form.cardType} onChange={(e) => set('cardType', e.target.value as CardType)}>
            {CARD_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label>色</label>
          <select value={form.color} onChange={(e) => set('color', e.target.value as CardColor)}>
            {CARD_COLORS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label>Lv.</label>
          <input type="number" min={0} value={form.level} onChange={(e) => set('level', e.target.value)} />
        </div>
        <div>
          <label>コスト</label>
          <input type="number" min={0} value={form.cost} onChange={(e) => set('cost', e.target.value)} />
        </div>
        <div className={styles.checkRow}>
          <input type="checkbox" id="isKeyCard" checked={form.isKeyCard} onChange={(e) => set('isKeyCard', e.target.checked)} />
          <label htmlFor="isKeyCard">キーカード</label>
        </div>
      </div>
      {errors.length > 0 && (
        <ul className={styles.errorList}>
          {errors.map((msg, i) => <li key={i} className={styles.errorItem}>⚠ {msg}</li>)}
        </ul>
      )}
      <div className={styles.formActions}>
        <button type="submit" className={styles.btnAdd}>カードを追加する</button>
      </div>
    </form>
  );
}
