import { beforeEach, describe, it, expect, vi } from 'vitest';

const { mockGroupBy, mockAttachCanonicalPaths } = vi.hoisted(() => ({
  mockGroupBy: vi.fn(),
  mockAttachCanonicalPaths: vi.fn((rows: unknown[]) => Promise.resolve(rows)),
}));

vi.mock('../../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../../src/services/search/searchRegionIndex.js');
  return { ...actual, getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]) };
});

vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => mockGroupBy(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => mockGroupBy(...a) },
}));
vi.mock('../../../src/services/realEstateUrlRegistry.js', () => ({
  attachRealEstateCanonicalPaths: mockAttachCanonicalPaths,
}));

import { suggest } from '../../../src/services/search/searchSuggestService.js';

describe('suggest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAttachCanonicalPaths.mockImplementation((rows: unknown[]) => Promise.resolve(rows));
  });

  it('keeps same-name suggestions tied to their individual addresses', async () => {
    const rows = [
      { buildingKey: 'a'.repeat(64), dongName: '대치동', jibun: '934-2' },
      { buildingKey: 'b'.repeat(64), dongName: '역삼동', jibun: '785-10' },
    ].map(address => ({ ...address, buildingName: '스톤빌리지', type: 'villa-sale', city: '서울', district: '강남구', bjdCode: '11680', transactionCount: 9 }));
    mockGroupBy.mockResolvedValue(rows);
    const result = await suggest('스톤빌리지', 'realestate');
    const buildings = result.items.filter(item => item.type === 'building');
    expect(buildings.map(item => item.buildingKey)).toEqual(rows.map(row => row.buildingKey));
    expect(buildings[0].sublabel).toContain('대치동 934-2');
    expect(buildings[1].sublabel).toContain('역삼동 785-10');
    expect(String(mockGroupBy.mock.lastCall?.[0])).toContain('buildingKey, dongName, jibun');
  });

  it('returns canonicalPath for building suggestions from the registry batch', async () => {
    const key = 'c'.repeat(64);
    mockGroupBy.mockResolvedValue([
      { buildingKey: key, buildingName: '캐슬타워', type: 'apt-sale', city: '서울', district: '강남구', dongName: '역삼동', jibun: '10', bjdCode: '11680', transactionCount: 7 },
    ]);
    mockAttachCanonicalPaths.mockImplementationOnce((rows: Array<{ buildingKey?: string }>) =>
      Promise.resolve(rows.map((row) => ({ ...row, canonicalPath: `/registered/${row.buildingKey}` }))),
    );

    const result = await suggest('캐슬', 'realestate');

    expect(result.items.find(item => item.type === 'building')).toMatchObject({
      buildingKey: key,
      canonicalPath: `/registered/${key}`,
    });
  });

  it('"강남" → 지역 추천(강남구) 포함, 건물 조회는 startsWith로 호출', async () => {
    mockGroupBy.mockResolvedValue([
      { buildingName: '강남효성해링턴', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 32 },
    ]);
    const res = await suggest('강남');
    const types = res.items.map(i => i.type);
    expect(types).toContain('region');
    expect(types).toContain('building');
    expect(mockGroupBy.mock.calls[0][1]).toBe('강남');
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
