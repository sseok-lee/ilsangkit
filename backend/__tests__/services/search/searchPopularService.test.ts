import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGroupBy = vi.fn();
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { searchLog: { groupBy: (...a: unknown[]) => mockGroupBy(...a) } },
  default: { searchLog: { groupBy: (...a: unknown[]) => mockGroupBy(...a) } },
}));

import { getPopular, __clearPopularCache } from '../../../src/services/search/searchPopularService.js';

describe('getPopular', () => {
  beforeEach(() => { mockGroupBy.mockReset(); __clearPopularCache(); });

  it('집계 키워드가 임계치 미만이면 static fallback', async () => {
    mockGroupBy.mockResolvedValue([{ keyword: '화장실', _count: { keyword: 3 } }]);
    const res = await getPopular({ limit: 8, period: 'week' });
    expect(res.source).toBe('static');
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('집계 키워드가 충분하면 aggregated', async () => {
    mockGroupBy.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ keyword: `kw${i}`, _count: { keyword: 100 - i } }))
    );
    const res = await getPopular({ limit: 8, period: 'week' });
    expect(res.source).toBe('aggregated');
    expect(res.items).toHaveLength(8);
    expect(res.items[0].keyword).toBe('kw0');
  });

  it('임계치만큼(10) 데이터가 있으면 limit(8) 미만이어도 aggregated', async () => {
    mockGroupBy.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => ({ keyword: `kw${i}`, _count: { keyword: 50 - i } }))
    );
    const res = await getPopular({ limit: 8, period: 'week' });
    expect(res.source).toBe('aggregated');
    expect(res.items).toHaveLength(8);
  });
});
