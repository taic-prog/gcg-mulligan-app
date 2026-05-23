import type { Deck } from '../types';

export function exportDeckText(deck: Deck): string {
  const lines: string[] = [`# ${deck.name}`];
  for (const entry of deck.entries) {
    lines.push(`${entry.card.cardNo} ${entry.count}`);
  }
  return lines.join('\n');
}
