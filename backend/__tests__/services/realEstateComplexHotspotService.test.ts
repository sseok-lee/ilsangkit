import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getNewHigh } from '../../src/services/realEstateComplexHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getNewHigh — 신고가 갱신 카드', () => {
  it('changePct DESC 정렬, 최대 5건', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      buildingName: `단지${i}`,
      bjdCode: `1100000${i}`,
      city: '서울특별시',
      district: '강남구',
      districtSlug: 'gangnam-gu',
      dealDate: '2026-05-20',
      newPyeong: 7000 + i,
      prevMaxPyeong: 6000,
      changePct: 10 + i,
    }));
    mockQueryRaw.mockResolvedValueOnce(rows);

    const result = await getNewHigh('AptSaleTransaction');

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.changePct)).toEqual([17, 16, 15, 14, 13]);
  });

  it('citySlug는 cityMapping에서 정식명 변환', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: '래미안', bjdCode: '1168000000', city: '서울특별시', district: '강남구',
        districtSlug: 'gangnam-gu', dealDate: '2026-05-20',
        newPyeong: 8000, prevMaxPyeong: 7000, changePct: 14.28 },
    ]);
    const result = await getNewHigh('AptSaleTransaction');
    expect(result[0].citySlug).toBe('seoul');
  });

  it('Decimal/BigInt 응답을 number로 정규화', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: '래미안', bjdCode: '1168000000', city: '서울특별시', district: '강남구',
        districtSlug: 'gangnam-gu', dealDate: '2026-05-20',
        newPyeong: '8000.5', prevMaxPyeong: '7000', changePct: '14.28' },
    ]);
    const result = await getNewHigh('AptSaleTransaction');
    expect(typeof result[0].newPyeong).toBe('number');
    expect(result[0].newPyeong).toBe(8000.5);
    expect(typeof result[0].changePct).toBe('number');
  });
});
