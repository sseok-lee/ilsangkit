import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryRaw = vi.fn();
vi.mock('../../src/lib/prisma', () => ({
  default: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) },
}));

import {
  getCompetitionRanking,
  _resetCompetitionCacheForTests,
} from '../../src/services/subscriptionService';

function flattenSql(call: unknown[]): string {
  const tpl = call[0] as { strings?: readonly string[]; sql?: string };
  if (typeof tpl === 'object' && tpl && 'strings' in tpl && tpl.strings) return tpl.strings.join('?');
  if (typeof tpl === 'object' && tpl && 'sql' in tpl && tpl.sql) return tpl.sql;
  if (Array.isArray(call[0])) return (call[0] as string[]).join('?');
  return JSON.stringify(call[0]);
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetCompetitionCacheForTests();
});

describe('getCompetitionRanking (metric=rate)', () => {
  it('숫자형 경쟁률만 집계하도록 REGEXP 화이트리스트를 건다', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cnt: 1n }]);
    mockQueryRaw.mockResolvedValueOnce([
      { subscriptionId: 10, houseName: 'A단지', regionName: '서울 강남구', sourceType: 'APT', winnerDate: null, maxRate: '12.34', totalApplicants: 1200n, totalSupply: 100n },
    ]);
    const res = await getCompetitionRanking({ metric: 'rate', page: 1, limit: 20 });
    const sql = flattenSql(mockQueryRaw.mock.calls[1]);
    expect(sql).toContain("REGEXP '^[0-9,]+");
    expect(sql).toContain("rank = 1");
    expect(sql).toContain("regionCode = '01'");
    expect(res.items[0]).toMatchObject({ subscriptionId: 10, maxRate: 12.34, totalApplicants: 1200, totalSupply: 100 });
    expect(typeof res.items[0].totalApplicants).toBe('number');
    expect(res.total).toBe(1);
  });

  it('같은 날 동일 파라미터 두 번째 호출은 캐시 (queryRaw 재호출 없음)', async () => {
    mockQueryRaw.mockResolvedValue([{ cnt: 0n }]);
    await getCompetitionRanking({ metric: 'rate', page: 1, limit: 20 });
    const callsAfterFirst = mockQueryRaw.mock.calls.length;
    await getCompetitionRanking({ metric: 'rate', page: 1, limit: 20 });
    expect(mockQueryRaw.mock.calls.length).toBe(callsAfterFirst);
  });
});

describe('getCompetitionRanking (metric=score)', () => {
  it('avgScore 숫자형 화이트리스트 + 가점 필드 매핑', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ cnt: 1n }]);
    mockQueryRaw.mockResolvedValueOnce([
      { subscriptionId: 7, houseName: 'B단지', regionName: '경기 성남시', sourceType: 'APT', winnerDate: null, minCut: '64.0', maxCut: '74.0', avgCut: '69.5' },
    ]);
    const res = await getCompetitionRanking({ metric: 'score', page: 1, limit: 20 });
    const sql = flattenSql(mockQueryRaw.mock.calls[1]);
    expect(sql).toContain('avgScore');
    expect(sql).toContain("REGEXP '^[0-9,]+");
    expect(res.items[0]).toMatchObject({ subscriptionId: 7, minCut: 64, maxCut: 74, avgCut: 69.5 });
  });
});
