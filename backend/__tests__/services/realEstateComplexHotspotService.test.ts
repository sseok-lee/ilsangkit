import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getNewHigh, getActive, getTopPyeong, getComplexHotspots, _complexHotspotCache } from '../../src/services/realEstateComplexHotspotService.js';

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

describe('getTopPyeong — 평당가 TOP 카드', () => {
  it('avgPyeongPrice DESC + 시별 캡 2 (서울 3건 중 2건만 선택)', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: 'A', bjdCode: '1', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
        avgPyeongPrice: 12000, txnCount: 5n },
      { buildingName: 'B', bjdCode: '2', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
        avgPyeongPrice: 11000, txnCount: 4n },
      { buildingName: 'C', bjdCode: '3', city: '서울특별시', district: '용산구', districtSlug: 'yongsan-gu',
        avgPyeongPrice: 10500, txnCount: 3n },
      { buildingName: 'D', bjdCode: '4', city: '경기도', district: '성남시 분당구', districtSlug: 'seongnam-bundang',
        avgPyeongPrice: 9000, txnCount: 6n },
      { buildingName: 'E', bjdCode: '5', city: '부산광역시', district: '해운대구', districtSlug: 'haeundae-gu',
        avgPyeongPrice: 8500, txnCount: 7n },
    ]);

    const result = await getTopPyeong('AptSaleTransaction');

    expect(result.map((r) => r.buildingName)).toEqual(['A', 'B', 'D', 'E']);
  });

  it('최대 5건', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      buildingName: `B${i}`, bjdCode: String(i),
      city: `시${i % 10}`, district: `구${i}`, districtSlug: `d-${i}`,
      avgPyeongPrice: 12000 - i, txnCount: 5n,
    }));
    mockQueryRaw.mockResolvedValueOnce(rows);
    const result = await getTopPyeong('AptSaleTransaction');
    expect(result.length).toBeLessThanOrEqual(5);
  });
});

describe('getComplexHotspots — 자산별 3카드 조립', () => {
  beforeEach(() => {
    _complexHotspotCache.clear();
  });

  it('apt 호출 시 AptSaleTransaction에 대해 3개 쿼리 실행 후 합쳐 반환', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])   // newHigh
      .mockResolvedValueOnce([])   // active
      .mockResolvedValueOnce([]);  // topPyeong

    const result = await getComplexHotspots('apt');

    expect(result).toEqual({ newHigh: [], active: [], topPyeong: [] });
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('자산별 캐시: 같은 propertyType 재호출 시 쿼리 실행 안 됨', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getComplexHotspots('offitel');
    await getComplexHotspots('offitel');

    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('자산별 캐시는 독립: villa 호출은 apt 캐시와 무관', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await getComplexHotspots('apt');
    await getComplexHotspots('villa');

    expect(mockQueryRaw).toHaveBeenCalledTimes(6);
  });
});
