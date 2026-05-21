import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getNewHigh, getActive } from '../../src/services/realEstateComplexHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getNewHigh — 신고가 갱신 카드', () => {
  it('changePct DESC 정렬, 최대 5건', async () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({
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
    expect(result.map((r) => r.changePct)).toEqual([10, 11, 12, 13, 14]);
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

describe('getActive — 거래 활발 카드', () => {
  it('txnCount DESC, 동률은 latestDealDate DESC (mock 입력 순서가 SQL 결과를 모사)', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: 'C', bjdCode: '3', city: '부산광역시', district: '해운대구', districtSlug: 'haeundae-gu',
        txnCount: 15n, latestDealDate: '2026-05-08', avgPyeongPrice: 4000 },
      { buildingName: 'B', bjdCode: '2', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
        txnCount: 10n, latestDealDate: '2026-05-15', avgPyeongPrice: 9000 },
      { buildingName: 'A', bjdCode: '1', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
        txnCount: 10n, latestDealDate: '2026-05-10', avgPyeongPrice: 8000 },
    ]);

    const result = await getActive('AptSaleTransaction');

    expect(result.map((r) => r.buildingName)).toEqual(['C', 'B', 'A']);
  });

  it('시별 최대 2단지 캡 (서울 3건 중 2건만 노출, 부산은 별도 카운트)', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: 'A', bjdCode: '1', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
        txnCount: 10n, latestDealDate: '2026-05-15', avgPyeongPrice: 8000 },
      { buildingName: 'B', bjdCode: '2', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
        txnCount: 9n, latestDealDate: '2026-05-14', avgPyeongPrice: 9000 },
      { buildingName: 'C', bjdCode: '3', city: '서울특별시', district: '송파구', districtSlug: 'songpa-gu',
        txnCount: 8n, latestDealDate: '2026-05-13', avgPyeongPrice: 7000 },
      { buildingName: 'D', bjdCode: '4', city: '부산광역시', district: '해운대구', districtSlug: 'haeundae-gu',
        txnCount: 7n, latestDealDate: '2026-05-12', avgPyeongPrice: 4000 },
    ]);

    const result = await getActive('AptSaleTransaction');

    const seoulCount = result.filter((r) => r.city === '서울특별시').length;
    expect(seoulCount).toBe(2);
    expect(result.map((r) => r.buildingName)).toEqual(['A', 'B', 'D']);
  });

  it('최대 5건 (시 다양성 충분할 때)', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      buildingName: `건물${i}`, bjdCode: String(i),
      city: `시${i}`, district: `구${i}`, districtSlug: `dist-${i}`,
      txnCount: BigInt(20 - i), latestDealDate: '2026-05-20', avgPyeongPrice: 5000,
    }));
    mockQueryRaw.mockResolvedValueOnce(rows);
    const result = await getActive('AptSaleTransaction');
    expect(result).toHaveLength(5);
  });
});
