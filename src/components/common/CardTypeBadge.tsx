import type { Card } from '../../types';
import styles from './CardTypeBadge.module.css';

interface Props { card: Pick<Card, 'color' | 'cardType'> }

export default function CardTypeBadge({ card }: Props) {
  return (
    <span className={styles.badge} data-color={card.color}>{card.cardType}</span>
  );
}
