import { useRef, useState } from 'react';
import { getAllCards } from '../../logic/cardCache';
import { fetchCardInfo } from '../../logic/cardFetch';
import type { FetchedCardInfo } from '../../logic/cardFetch';
import { canAddCard, validateCard } from '../../logic/validator';
import { CARD_COLORS, CARD_TYPES } from '../../types';
import type { Card, CardColor, CardType, DeckEntry } from '../../types';
import styles from './DeckEditor.module.css';

interface FormState {
  cardNo: string;
  name: string;
  cardType: CardType;
  color: CardColor;
  level: string;
  cost: string;
  count: string;
  isKeyCard: boolean;
  terrain: string;
  feature: string;
  link: string;
}

const INIT: FormState = {
  cardNo: '', name: '', cardType: CARD_TYPES[0], color: CARD_COLORS[0],
  level: '1', cost: '1', count: '1', isKeyCard: false,
  terrain: '', feature: '', link: '',
};

type CardRecord = FetchedCardInfo & { cardNo: string };

// DBから全件を一度だけロードしてメモリキャッシュ
let cachedAllCards: CardRecord[] | null = null;
async function getOrLoadAll(): Promise<CardRecord[]> {
  if (!cachedAllCards) cachedAllCards = await getAllCards();
  return cachedAllCards;
}

interface Props {
  entries: DeckEntry[];
  onAdd: (entry: DeckEntry) => void;
}

export default function CardForm({ entries, onAdd }: Props) {
  const [form, setForm] = useState<FormState>(INIT);
  const [errors, setErrors] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<CardRecord[]>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
        terrain: info.terrain,
        feature: info.feature,
        link: info.link,
      }));
    } catch {
      setFetchError('カード情報の取得に失敗しました');
    } finally {
      setFetching(false);
    }
  }

  async function handleNameInput(value: string) {
    set('name', value);
    setActiveIdx(-1);
    if (!value.trim()) { setSuggestions([]); return; }
    const all = await getOrLoadAll();
    const q = value.toLowerCase();
    const filtered = all.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 12);
    setSuggestions(filtered);
  }

  function applyCard(card: CardRecord) {
    setForm((prev) => ({
      ...prev,
      cardNo: card.cardNo,
      name: card.name,
      cardType: card.cardType,
      color: card.color,
      level: String(card.level),
      cost: String(card.cost),
      terrain: card.terrain,
      feature: card.feature,
      link: card.link,
    }));
    setSuggestions([]);
    setActiveIdx(-1);
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!suggestions.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      applyCard(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setSuggestions([]);
      setActiveIdx(-1);
    }
  }

  function handleNameBlur() {
    blurTimer.current = setTimeout(() => setSuggestions([]), 150);
  }

  function handleSuggestionMouseDown(card: CardRecord) {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    applyCard(card);
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
      ...(form.terrain ? { terrain: form.terrain } : {}),
      ...(form.feature ? { feature: form.feature } : {}),
      ...(form.link ? { link: form.link } : {}),
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
          <div className={styles.nameWrapper}>
            <input
              value={form.name}
              onChange={(e) => handleNameInput(e.target.value)}
              onKeyDown={handleNameKeyDown}
              onBlur={handleNameBlur}
              placeholder="ガンダム"
              required
              autoComplete="off"
            />
            {suggestions.length > 0 && (
              <ul className={styles.suggestions}>
                {suggestions.map((card, i) => (
                  <li
                    key={card.cardNo}
                    className={`${styles.suggestion} ${i === activeIdx ? styles.suggestionActive : ''}`}
                    onMouseDown={() => handleSuggestionMouseDown(card)}
                  >
                    <span>{card.name}</span>
                    <span className={styles.suggestionMeta}>
                      {card.cardNo}・{card.cardType}・{card.color}・Lv{card.level}・C{card.cost}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
        <div className={styles.formFull}>
          <label>地形</label>
          <input value={form.terrain} onChange={(e) => set('terrain', e.target.value)} placeholder="例: 宇宙 地球" />
        </div>
        <div className={styles.formFull}>
          <label>特徴</label>
          <input value={form.feature} onChange={(e) => set('feature', e.target.value)} placeholder="例: 〔地球連邦〕 〔WB隊〕" />
        </div>
        <div className={styles.formFull}>
          <label>リンク</label>
          <input value={form.link} onChange={(e) => set('link', e.target.value)} placeholder="例: 「アムロ・レイ」" />
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
