import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/logic/cardCache', () => ({
  getCached: vi.fn(),
}));

import { getCached } from '../../src/logic/cardCache';
import { fetchCardInfo } from '../../src/logic/cardFetch';
import type { FetchedCardInfo } from '../../src/logic/cardFetch';

const mockCard: FetchedCardInfo = {
  name: 'ガンダム',
  cardType: 'ユニット',
  color: '青',
  level: 1,
  cost: 2,
  terrain: '宇宙',
  feature: '〔地球連邦〕',
  link: '',
};

describe('fetchCardInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('キャッシュに存在すればその値を返す', async () => {
    vi.mocked(getCached).mockResolvedValue(mockCard);
    const result = await fetchCardInfo('GD01-001');
    expect(result).toEqual(mockCard);
    expect(getCached).toHaveBeenCalledWith('GD01-001');
  });

  it('キャッシュになければカードNoを含むエラーをスロー', async () => {
    vi.mocked(getCached).mockResolvedValue(null);
    await expect(fetchCardInfo('GD01-999')).rejects.toThrow('GD01-999');
  });
});
