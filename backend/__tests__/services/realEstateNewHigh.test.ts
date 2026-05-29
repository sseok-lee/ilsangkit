import { describe, it, expect, vi, beforeEach } from 'vitest';
const mockQueryRaw = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({ default: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) }, prisma: { $queryRaw: (...a: unknown[]) => mockQueryRaw(...a) } }));
import { getNewHighBuildings, _resetNewHighCacheForTests } from '../../src/services/realEstateNewHighService.js';

function flattenSql(call: unknown[]): string {
  const t = call[0] as { strings?: readonly string[] };
  return Array.isArray(t?.strings) ? t.strings.join('?') : (Array.isArray(call[0]) ? (call[0] as string[]).join('?') : JSON.stringify(call[0]));
}
beforeEach(() => { vi.clearAllMocks(); _resetNewHighCacheForTests(); });

describe('getNewHighBuildings', () => {
  it('면적버킷·취소제외·유효명·prior_cnt 가드 SQL + BigInt→Number', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ ym: 202603 }]);
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: '래미안', city: '서울', district: '강남구', bjdCode: '11680', areaBucket: 85, curMax: 250000n, histMax: 230000n, risePct: '8.70', priorCnt: 12n, curYm: 202603 },
    ]);
    const res = await getNewHighBuildings('apt-sale', 30);
    const sql = flattenSql(mockQueryRaw.mock.calls[1]);
    expect(sql).toContain('ROUND(exclusiveArea / 5) * 5');
    expect(sql).toContain("cancelDealDay IS NULL OR cancelDealDay = ''");
    expect(sql).toContain('CHAR_LENGTH(buildingName)');
    expect(sql).toMatch(/prior_cnt\s*>=\s*2/i);
    expect(res.items[0]).toMatchObject({ buildingName: '래미안', curMax: 250000, histMax: 230000 });
    expect(typeof res.items[0].curMax).toBe('number');
    expect(res.asOfYm).toBe(202603);
  });
  it('지원하지 않는 타입은 throw', async () => {
    await expect(getNewHighBuildings('apt-rent' as never, 30)).rejects.toBeTruthy();
  });
});
