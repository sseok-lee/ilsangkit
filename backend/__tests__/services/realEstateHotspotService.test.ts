import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Prisma } from '@prisma/client';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getPricedSliceHotspots, getWolseHotspots, getPropertyHotspots, _hotspotCache, normalizeAndGuard } from '../../src/services/realEstateHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getPricedSliceHotspots (sale/jeonse 슬라이스)', () => {
  it('rising은 changePct DESC, falling은 ASC, active는 volumeChangePct DESC 정렬', async () => {
    // 1) anchor 최신일 조회, 2) 본 slice 쿼리
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
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
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
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
      city: '서울',
      bjdCode: '11110',
      districtSlug: `dist-${i}`,
      district: `구-${i}`,
      pricePerPyeong: 5000 + i,
      txnCount: 100n,
      changePct: i + 1,
      volumeChangePct: i + 1,
    }));
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce(rows);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toHaveLength(5);
    expect(bundle.active).toHaveLength(5);
  });

  it('BigInt txnCount는 number로 변환됨', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
        { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
          pricePerPyeong: 8000, txnCount: 12345n, changePct: 5, volumeChangePct: 30 },
      ]);
    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });
    expect(bundle.rising[0].txnCount).toBe(12345);
    expect(typeof bundle.rising[0].txnCount).toBe('number');
  });

  it('Decimal string(Prisma raw 반환) 도 number로 정규화', async () => {
    // Prisma raw query는 DECIMAL 컬럼을 문자열로 반환할 수 있음
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
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
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
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

  it('거래가 없으면(anchor 빈 결과) 빈 번들 반환', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // anchor 0행
    const res = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 1 });
    expect(res.rising).toEqual([]);
    expect(res.falling).toEqual([]);
    expect(res.active).toEqual([]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1); // slice 쿼리는 실행 안 함
  });
});

describe('getWolseHotspots', () => {
  it('pricePerPyeong과 changePct는 null로 채워짐', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
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
      city: '서울', bjdCode: '11110', districtSlug: `d-${i}`, district: `구-${i}`,
      txnCount: 100n, volumeChangePct: 10 - i,
    }));
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce(rows);

    const bundle = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 30 });

    expect(bundle.active).toHaveLength(5);
    expect(bundle.active.map((r) => r.volumeChangePct)).toEqual([10, 9, 8, 7, 6]);
  });

  it('한글 districtSlug 행은 active에서 제외 (방어 가드)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
        { city: '인천', bjdCode: '28275', districtSlug: '서해구', district: '서해구', txnCount: 67n, volumeChangePct: 71 },
        { city: '서울', bjdCode: '11110', districtSlug: 'gangnam-gu', district: '강남구', txnCount: 50n, volumeChangePct: 10 },
      ]);
    const bundle = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 30 });
    expect(bundle.active).toHaveLength(1);
    expect(bundle.active[0].district).toBe('강남구');
  });

  it('거래가 없으면(anchor 빈 결과) 빈 active 반환', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const res = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 1 });
    expect(res.active).toEqual([]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('anchor dealDay가 null이면 day 1로 처리 (COALESCE 대체 fallback) — 슬라이스 쿼리 날짜 경계 검증', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: null }])
      .mockResolvedValueOnce([]);

    const res = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 1 });

    expect(Array.isArray(res.active)).toBe(true);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2); // anchor + slice (빈 배열이어도 slice는 실행됨)

    // latest = Date.UTC(2026, 1, dealDay ?? 1) → dealDay:null 이 1로 fallback 되어야 latest=2026-02-01.
    // 만약 ?? 1 이 깨져 0으로 처리되면 Date.UTC(2026,1,0)=2026-01-31 로 하루 밀려 아래 경계가 전부 어긋난다.
    // slice 쿼리(2번째 $queryRaw 호출) 템플릿의 인터폴레이션 순서:
    //   [tableRaw, recentSql, sampleThreshold, tableRaw, priorSql, sampleThreshold]
    // → calls[1][2]=recentSql(recentFrom~recentTo), calls[1][5]=priorSql(priorFrom~priorTo)
    const recentSql = mockQueryRaw.mock.calls[1][2] as Prisma.Sql;
    const priorSql = mockQueryRaw.mock.calls[1][5] as Prisma.Sql;

    expect(recentSql.values).toContain('2026-01-25'); // recentFrom = latest(2026-02-01) - 7일
    expect(recentSql.values).toContain('2026-02-01'); // recentTo = latest
    expect(priorSql.values).toContain('2026-01-18'); // priorFrom = latest - 14일
    expect(priorSql.values).toContain('2026-01-24'); // priorTo = latest - 8일
  });
});

describe('normalizeAndGuard (통합시 되돌림 + 방어 가드)', () => {
  it('통합시 광주 자치구(코드12)를 gwangju/광주로 되돌림', () => {
    const out = normalizeAndGuard([
      { city: '전남광주통합특별시', bjdCode: '12240', districtSlug: 'seo', district: '서구',
        pricePerPyeong: 1500, txnCount: 88n, changePct: 12, volumeChangePct: 50 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].citySlug).toBe('gwangju');
    expect(out[0].city).toBe('광주');
    expect(out[0].districtSlug).toBe('seo');
  });

  it('통합시 전남 시·군(코드12)을 jeonnam/전남으로 되돌림', () => {
    const out = normalizeAndGuard([
      { city: '전남광주통합특별시', bjdCode: '12130', districtSlug: 'yeosu', district: '여수시',
        pricePerPyeong: 1000, txnCount: 40n, changePct: 5, volumeChangePct: 10 },
    ]);
    expect(out[0].citySlug).toBe('jeonnam');
    expect(out[0].city).toBe('전남');
  });

  it('districtSlug가 한글(미로마자)인 행은 제외 (404 방지)', () => {
    const out = normalizeAndGuard([
      { city: '인천', bjdCode: '28275', districtSlug: '서해구', district: '서해구',
        pricePerPyeong: 1687, txnCount: 67n, changePct: -11, volumeChangePct: 71 },
    ]);
    expect(out).toHaveLength(0);
  });

  it('citySlug를 못 구하는 행(미매핑 도시)은 제외', () => {
    const out = normalizeAndGuard([
      { city: '없는시', bjdCode: '99999', districtSlug: 'foo', district: '없는구',
        pricePerPyeong: 1000, txnCount: 40n, changePct: 5, volumeChangePct: 10 },
    ]);
    expect(out).toHaveLength(0);
  });

  it('정상 행은 유지 + citySlug 계산', () => {
    const out = normalizeAndGuard([
      { city: '충남', bjdCode: '44200', districtSlug: 'asan', district: '아산시',
        pricePerPyeong: 1384, txnCount: 65n, changePct: 24, volumeChangePct: -27 },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].citySlug).toBe('chungnam');
    expect(out[0].city).toBe('충남');
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
