import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getPricedSliceHotspots, getWolseHotspots, getPropertyHotspots, _hotspotCache } from '../../src/services/realEstateHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getPricedSliceHotspots (sale/jeonse 슬라이스)', () => {
  it('rising은 changePct DESC, falling은 ASC, active는 volumeChangePct DESC 정렬', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 100n, changePct: 5, volumeChangePct: 30 },
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'mapo-gu', district: '마포구',
        pricePerPyeong: 5000, txnCount: 60n, changePct: -3, volumeChangePct: 10 },
      { citySlug: 'busan', city: '부산광역시', districtSlug: 'haeundae-gu', district: '해운대구',
        pricePerPyeong: 4000, txnCount: 80n, changePct: 2, volumeChangePct: 50 },
    ]);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising.map((r) => r.district)).toEqual(['강남구', '해운대구']);
    expect(bundle.falling.map((r) => r.district)).toEqual(['마포구']);
    expect(bundle.active.map((r) => r.district)).toEqual(['해운대구', '강남구', '마포구']);
  });

  it('changePct가 null인 행은 rising/falling에서 제외, active에는 영향 없음', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 100n, changePct: null, volumeChangePct: 30 },
    ]);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toEqual([]);
    expect(bundle.falling).toEqual([]);
    expect(bundle.active).toHaveLength(1);
  });

  it('각 시그널 최대 5개로 자름', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      citySlug: `city-${i}`,
      city: `시-${i}`,
      districtSlug: `dist-${i}`,
      district: `구-${i}`,
      pricePerPyeong: 5000 + i,
      txnCount: 100n,
      changePct: i + 1,
      volumeChangePct: i + 1,
    }));
    mockQueryRaw.mockResolvedValue(rows);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toHaveLength(5);
    expect(bundle.active).toHaveLength(5);
  });

  it('BigInt txnCount는 number로 변환됨', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 12345n, changePct: 5, volumeChangePct: 30 },
    ]);
    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });
    expect(bundle.rising[0].txnCount).toBe(12345);
    expect(typeof bundle.rising[0].txnCount).toBe('number');
  });

  it('Decimal string(Prisma raw 반환) 도 number로 정규화', async () => {
    // Prisma raw query는 DECIMAL 컬럼을 문자열로 반환할 수 있음
    mockQueryRaw.mockResolvedValue([
      { city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: '1034.265', txnCount: 61n, changePct: '52.32', volumeChangePct: '15.09' },
    ]);
    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });
    const row = bundle.rising[0];
    expect(typeof row.pricePerPyeong).toBe('number');
    expect(typeof row.changePct).toBe('number');
    expect(typeof row.volumeChangePct).toBe('number');
    expect(row.pricePerPyeong).toBeCloseTo(1034.265, 3);
    expect(row.changePct).toBeCloseTo(52.32, 2);
  });

  it('citySlug는 city 한글명에서 자동 계산 (short/full 모두)', async () => {
    mockQueryRaw.mockResolvedValue([
      { city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 50n, changePct: 5, volumeChangePct: 10 },
      { city: '전북', districtSlug: 'iksan', district: '익산시',
        pricePerPyeong: 1000, txnCount: 60n, changePct: 3, volumeChangePct: 8 },
    ]);
    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });
    const seoul = bundle.rising.find((r) => r.district === '강남구');
    const jeonbuk = bundle.rising.find((r) => r.district === '익산시');
    expect(seoul?.citySlug).toBe('seoul');
    expect(jeonbuk?.citySlug).toBe('jeonbuk');
  });
});

describe('getWolseHotspots', () => {
  it('pricePerPyeong과 changePct는 null로 채워짐', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        txnCount: 150n, volumeChangePct: 40 },
    ]);

    const bundle = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 30 });

    expect(bundle.active).toHaveLength(1);
    expect(bundle.active[0].pricePerPyeong).toBeNull();
    expect(bundle.active[0].changePct).toBeNull();
    expect(bundle.active[0].volumeChangePct).toBe(40);
    expect(bundle.active[0].txnCount).toBe(150);
  });

  it('volumeChangePct DESC 정렬 + 최대 5개', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      citySlug: `c-${i}`, city: `시-${i}`, districtSlug: `d-${i}`, district: `구-${i}`,
      txnCount: 100n, volumeChangePct: 10 - i,
    }));
    mockQueryRaw.mockResolvedValue(rows);

    const bundle = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 30 });

    expect(bundle.active).toHaveLength(5);
    expect(bundle.active.map((r) => r.volumeChangePct)).toEqual([10, 9, 8, 7, 6]);
  });
});

describe('getPropertyHotspots (aggregator)', () => {
  beforeEach(() => {
    _hotspotCache.clear();
  });

  it('apt 호출 시 3개 슬라이스(sale/jeonse/wolse) 모두 채워짐', async () => {
    mockQueryRaw.mockResolvedValue([]);
    const result = await getPropertyHotspots('apt');
    expect(result.sale).toBeDefined();
    expect(result.sale.rising).toEqual([]);
    expect(result.jeonse).toBeDefined();
    expect(result.wolse).toBeDefined();
    expect(result.wolse.active).toEqual([]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('동일 propertyType 두 번째 호출은 캐시 사용 (DB 호출 X)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getPropertyHotspots('apt');
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    await getPropertyHotspots('apt');
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('다른 propertyType은 별도 캐시 키', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getPropertyHotspots('apt');
    await getPropertyHotspots('villa');
    expect(mockQueryRaw).toHaveBeenCalledTimes(6);
  });
});
