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

  it('캐시는 limit/period 별로 분리된다 (다른 파라미터끼리 섞이지 않음)', async () => {
    mockGroupBy.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ keyword: `kw${i}`, _count: { keyword: 100 - i } }))
    );
    const now = 1_000_000;
    const a = await getPopular({ limit: 5, period: 'day' }, now);
    const b = await getPopular({ limit: 12, period: 'month' }, now); // 캐시 TTL 내, 다른 파라미터
    expect(a.items).toHaveLength(5);
    expect(b.items).toHaveLength(12); // a의 5건이 재사용되면 실패
    // 같은 키는 캐시 재사용 → groupBy 호출 수가 키 개수(2)와 일치
    await getPopular({ limit: 5, period: 'day' }, now + 1);
    expect(mockGroupBy).toHaveBeenCalledTimes(2);
  });
});
