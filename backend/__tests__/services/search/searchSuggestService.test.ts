import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../../src/services/search/searchRegionIndex.js');
  return { ...actual, getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]) };
});

const mockGroupBy = vi.fn();
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { realEstateBuildingSummary: { findMany: (...a: unknown[]) => mockGroupBy(...a) } },
  default: { realEstateBuildingSummary: { findMany: (...a: unknown[]) => mockGroupBy(...a) } },
}));

import { suggest } from '../../../src/services/search/searchSuggestService.js';

describe('suggest', () => {
  it('"강남" → 지역 추천(강남구) 포함, 건물 조회는 startsWith로 호출', async () => {
    mockGroupBy.mockResolvedValue([
      { buildingName: '강남효성해링턴', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 32 },
    ]);
    const res = await suggest('강남');
    const types = res.items.map(i => i.type);
    expect(types).toContain('region');
    expect(types).toContain('building');
    const arg = mockGroupBy.mock.calls[0][0];
    expect(arg.where.buildingName).toEqual({ startsWith: '강남' });
  });

  it('q가 1자면 건물 조회를 하지 않는다(>=2 가드)', async () => {
    mockGroupBy.mockClear();
    await suggest('강');
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it('"화장실" → 카테고리 추천(toilet) 포함', async () => {
    mockGroupBy.mockResolvedValue([]);
    const res = await suggest('화장실');
    expect(res.items.some(i => i.type === 'category' && i.category === 'toilet')).toBe(true);
  });

  it('빈 q → 빈 결과', async () => {
    const res = await suggest('');
    expect(res.items).toEqual([]);
  });

  it('scope=realestate → 카테고리 추천 억제, 건물명 유지', async () => {
    mockGroupBy.mockResolvedValue([
      { buildingName: '화장품타워', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 5 },
    ]);
    const res = await suggest('화장', 'realestate');
    expect(res.items.some(i => i.type === 'category')).toBe(false);
    expect(res.items.some(i => i.type === 'building')).toBe(true);
  });

  it('scope=facility:toilet → 단지명(building) 억제, 카테고리/지역 유지', async () => {
    mockGroupBy.mockResolvedValue([
      { buildingName: '화장품타워', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 5 },
    ]);
    const res = await suggest('화장', 'facility:toilet');
    expect(res.items.some(i => i.type === 'building')).toBe(false);
    expect(res.items.some(i => i.type === 'category')).toBe(true);
  });

  it('scope 없음 → 현행 혼합(회귀)', async () => {
    mockGroupBy.mockResolvedValue([
      { buildingName: '강남효성', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 5 },
    ]);
    const res = await suggest('강남');
    const types = res.items.map(i => i.type);
    expect(types).toContain('region');
    expect(types).toContain('building');
  });
});
