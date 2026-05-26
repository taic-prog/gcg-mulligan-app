import { CARD_COLOR_SET, CARD_TYPE_SET, DECK_SIZE, MAX_COST, MAX_LEVEL, MAX_SAME_CARD } from '../types';
import type { Card, DeckEntry, ValidationError } from '../types';

/** cardNo・name・cardType・color・level・cost の基本6フィールドを検証する共通コア */
export function isCardLike(c: Record<string, unknown>): boolean {
  return (
    typeof c.cardNo === 'string' && c.cardNo.length > 0 &&
    typeof c.name === 'string' && c.name.trim() !== '' &&
    CARD_TYPE_SET.has(c.cardType as string) &&
    CARD_COLOR_SET.has(c.color as string) &&
    Number.isInteger(c.level) && (c.level as number) >= 0 &&
    Number.isInteger(c.cost) && (c.cost as number) >= 0
  );
}

const MAX_COLORS = 2;

export function validateCard(card: Partial<Card>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!card.name || card.name.trim() === '') {
    errors.push({ field: 'name', message: 'カード名は必須です' });
  }

  if (card.cost === undefined || card.cost === null) {
    errors.push({ field: 'cost', message: 'コストは必須です' });
  } else if (!Number.isInteger(card.cost) || card.cost < 0 || card.cost > MAX_COST) {
    errors.push({ field: 'cost', message: `コストは0〜${MAX_COST}の整数で入力してください` });
  }

  if (card.level === undefined || card.level === null) {
    errors.push({ field: 'level', message: 'Lv.は必須です' });
  } else if (!Number.isInteger(card.level) || card.level < 0 || card.level > MAX_LEVEL) {
    errors.push({ field: 'level', message: `Lv.は0〜${MAX_LEVEL}の整数で入力してください` });
  }

  return errors;
}

export function validateDeck(entries: DeckEntry[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
  if (totalCount !== DECK_SIZE) {
    errors.push({
      field: 'deck',
      message: `デッキは${DECK_SIZE}枚ちょうどにしてください（現在${totalCount}枚）`,
    });
  }

  const cardNoCounts = new Map<string, number>();
  for (const entry of entries) {
    cardNoCounts.set(entry.card.cardNo, (cardNoCounts.get(entry.card.cardNo) ?? 0) + entry.count);
  }
  for (const [cardNo, count] of cardNoCounts) {
    if (count > MAX_SAME_CARD) {
      errors.push({
        field: 'cardNo',
        message: `カードNo.「${cardNo}」は${MAX_SAME_CARD}枚までです（現在${count}枚）`,
      });
    }
  }

  const colors = new Set(entries.map((e) => e.card.color));
  if (colors.size > MAX_COLORS) {
    errors.push({
      field: 'color',
      message: `使用色は${MAX_COLORS}色までです（現在${colors.size}色）`,
    });
  }

  return errors;
}

export function canAddCard(entries: DeckEntry[], cardNo: string, addCount: number): boolean {
  const totalCount = entries.reduce((sum, e) => sum + e.count, 0);
  if (totalCount + addCount > DECK_SIZE) return false;

  const sameCardCount = entries
    .filter((e) => e.card.cardNo === cardNo)
    .reduce((sum, e) => sum + e.count, 0);
  if (sameCardCount + addCount > MAX_SAME_CARD) return false;

  return true;
}

export function buildCard(
  fields: Omit<Card, 'id' | 'terrain' | 'feature' | 'link'>,
  optional: { terrain?: string; feature?: string; link?: string } = {}
): Card {
  return {
    id: crypto.randomUUID(),
    ...fields,
    ...(optional.terrain ? { terrain: optional.terrain } : {}),
    ...(optional.feature ? { feature: optional.feature } : {}),
    ...(optional.link ? { link: optional.link } : {}),
  };
}
