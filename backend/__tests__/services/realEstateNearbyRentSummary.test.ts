// 인근 단지 rent 경로 — rentType='all'(SSR 기본값)은 summary 테이블을 쓴다.
//
// 배경(2026-08-03 프로덕션): rent 는 deposit + monthlyRent 를 함께 필요로 하는데
// summary 에 monthlyRent 컬럼이 없어 320만 행 거래 테이블에 ROW_NUMBER() 윈도우를 돌렸다.
// 야간 부동산 sync(18:50 UTC 시작)와 겹치면 그 쿼리가 먼저 무너져 30초 타임아웃이 났다:
//   03:30 평균 0.29s 타임아웃 0 → 03:45 평균 3.40s 타임아웃 7
//   04:00 평균 8.08s 타임아웃 21 → 04:15 평균 0.60s 타임아웃 0   (KST)
// 나간 5xx 27건 중 22건이 rent 였고 그중 1건은 네이버 Yeti 가 받았다.
//
// summary 에 monthlyRent 를 추가해 sale 과 같은 인덱스 경로를 타게 했다.
// 로컬 실측(같은 빌드 A/B): rent all 1.9ms vs rent jeonse 178.2ms.
//
// ⚠️ summary 는 (type, buildingName, bjdCode) 단위라 전세/월세를 한 행으로 합친다.
// 따라서 rentType 필터가 걸린 경우에는 쓸 수 없고 raw 경로를 유지해야 한다.

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw, mockFindMany } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw, realEstateBuildingSummary: { findMany: mockFindMany } },
  default: { $queryRaw: mockQueryRaw, realEstateBuildingSummary: { findMany: mockFindMany } },
}));

import { getNearbyByBjd } from '../../src/services/realEstateService.js';

const summaryRow = (over: Record<string, unknown> = {}) => ({
  buildingName: '역삼아이파크',
  bjdCode: '1168010100',
  city: '서울특별시',
  district: '강남구',
  dongName: '역삼동',
  buildYear: 2015,
  transactionCount: 7,
  latestPrice: 30000n,   // 전월세에서 latestPrice 는 deposit(보증금)
  monthlyRent: 85,
  latestDealYear: 2026,
  latestDealMonth: 7,
  lat: 37.5,
  lng: 127.03,
  ...over,
});

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockFindMany.mockReset();
});

describe('getNearbyByBjd rent — rentType=all (summary 경로)', () => {
  it('raw SQL 이 아니라 summary 를 조회한다', async () => {
    mockFindMany.mockResolvedValue([]);

    await getNearbyByBjd('1168010100', 'rent', { rentType: 'all' });

    expect(mockFindMany).toHaveBeenCalledTimes(3);   // apt/villa/offitel
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('rentType 을 생략해도 기본이 all 이라 summary 를 탄다 (SSR 경로)', async () => {
    mockFindMany.mockResolvedValue([]);

    await getNearbyByBjd('1168010100', 'rent', {});

    expect(mockFindMany).toHaveBeenCalledTimes(3);
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('type 을 {key}-rent 로 조회하고 인덱스가 타도록 where/orderBy 를 고정한다', async () => {
    mockFindMany.mockResolvedValue([]);

    await getNearbyByBjd('1168010100', 'rent', { rentType: 'all', dongName: '역삼동' });

    const types = mockFindMany.mock.calls.map((c) => c[0].where.type);
    expect(types).toEqual(['apt-rent', 'villa-rent', 'offitel-rent']);

    const call = mockFindMany.mock.calls[0][0];
    expect(call.where).toMatchObject({ bjdCode: '1168010100', dongName: '역삼동' });
    expect(call.orderBy).toEqual([
      { latestDealYear: 'desc' },
      { latestDealMonth: 'desc' },
      { transactionCount: 'desc' },
    ]);
  });

  it('보증금(latestPrice)과 월세(monthlyRent)를 함께 돌려준다', async () => {
    mockFindMany.mockResolvedValue([summaryRow()]);

    const r = await getNearbyByBjd('1168010100', 'rent', { rentType: 'all' });

    expect(r.apt[0].latestPrice).toBe(30000);
    expect(r.apt[0].monthlyRent).toBe(85);
    expect(r.apt[0].latestDealYear).toBe(2026);
    expect(r.apt[0].latestDealMonth).toBe(7);
    expect(r.apt[0].transactionCount).toBe(7);
  });

  it('전세(월세 0)와 월세 미기재(NULL)를 구분해 전달한다', async () => {
    mockFindMany
      .mockResolvedValueOnce([summaryRow({ monthlyRent: 0 })])
      .mockResolvedValueOnce([summaryRow({ monthlyRent: null })])
      .mockResolvedValueOnce([]);

    const r = await getNearbyByBjd('1168010100', 'rent', { rentType: 'all' });

    expect(r.apt[0].monthlyRent).toBe(0);      // 전세 — 0 이 null 로 뭉개지면 안 된다
    expect(r.villa[0].monthlyRent).toBeNull(); // 미기재
  });

  it('excludeBuildingName 을 그대로 넘긴다', async () => {
    mockFindMany.mockResolvedValue([]);

    await getNearbyByBjd('1168010100', 'rent', { rentType: 'all', excludeBuildingName: '역삼아이파크' });

    expect(mockFindMany.mock.calls[0][0].where.buildingName).toEqual({ not: '역삼아이파크' });
  });

  it('전세/월세 필터는 summary 를 쓰지 않는다 (한 행으로 합쳐져 구분 불가)', async () => {
    mockQueryRaw.mockResolvedValue([]);

    await getNearbyByBjd('1168010100', 'rent', { rentType: 'wolse' });

    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
