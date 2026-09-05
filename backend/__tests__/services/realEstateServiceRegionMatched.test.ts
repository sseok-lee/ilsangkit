/**
 * getBuildingInfo 의 regionMatched 플래그 회귀 테스트.
 *
 * 프로덕션 실측(2026-09-04): bjdCode 힌트가 빗나가면 buildingName 만으로 전국 groupBy 를 돌려
 * 거래가 가장 많은 bjdCode 를 다시 고르는데, 그 결과가 요청 지역 밖일 때도 조용히 200 으로
 * 렌더됐다. /villa-sale/{seoul/gangnam, busan/haeundae, daegu/suseong}/현대 세 URL 이 모두
 * "제주 서귀포시 현대" 문서를 self-canonical 로 발행 — 중복 title 22.5만 건의 주범.
 *
 * 회수 자체는 유지한다(stale summary 로 상세가 비어 false noindex 가 되는 걸 막는 장치).
 * 대신 regionMatched 로 드러내, 프론트가 실제 지역 URL 로 301 하거나 noindex 할 수 있게 한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindFirst, mockAggregate, mockGroupBy, mockCount } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(), mockAggregate: vi.fn(), mockGroupBy: vi.fn(), mockCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const model = {
    findFirst: mockFindFirst,
    aggregate: mockAggregate,
    groupBy: mockGroupBy,
    count: mockCount,
    findMany: vi.fn(),
  };
  const models = {
    aptSaleTransaction: model,
    aptRentTransaction: model,
    villaSaleTransaction: model,
    villaRentTransaction: model,
    offitelSaleTransaction: model,
    offitelRentTransaction: model,
    realEstateBuildingSummary: { findMany: vi.fn(), count: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
  return { prisma: models, default: models };
});

import {
  getBuildingInfo,
  isSameSigunguBjdCode,
  sigunguPrefix,
} from '../../src/services/realEstateService.js';

const 서귀포_현대 = {
  id: 1,
  buildingName: '현대',
  city: '제주특별자치도',
  district: '서귀포시',
  bjdCode: '50130',
  dongName: '동홍동',
  roadName: null,
  jibun: '1',
  buildYear: 1998,
  exclusiveArea: 59.9,
  dealAmount: 21500,
  dealYear: 2026,
  dealMonth: 7,
  dealDay: 3,
  lat: 33.25,
  lng: 126.56,
};

const agg = { _min: { exclusiveArea: 39.9 }, _max: { exclusiveArea: 84.9 } };

beforeEach(() => {
  vi.clearAllMocks();
  mockAggregate.mockResolvedValue(agg);
});

describe('sigunguPrefix / isSameSigunguBjdCode (순수 로직)', () => {
  it('법정동코드 앞 5자리(시도 2 + 시군구 3)를 뽑는다', () => {
    expect(sigunguPrefix('1168010100')).toBe('11680');
    expect(sigunguPrefix('11680')).toBe('11680');
    expect(sigunguPrefix(' 50130 ')).toBe('50130');
  });

  it('5자리를 못 채우면 null — 비교 근거 없음', () => {
    expect(sigunguPrefix('')).toBeNull();
    expect(sigunguPrefix('116')).toBeNull();
    expect(sigunguPrefix(null)).toBeNull();
    expect(sigunguPrefix(undefined)).toBeNull();
  });

  it('시군구가 다르면 false', () => {
    expect(isSameSigunguBjdCode('11680', '50130')).toBe(false);
    expect(isSameSigunguBjdCode('1168010100', '5013025000')).toBe(false);
  });

  it('같은 시군구면 법정동이 달라도 true', () => {
    expect(isSameSigunguBjdCode('1168010100', '1168010300')).toBe(true);
  });

  it('한쪽 근거가 없으면 fail-open — 어긋났다고 단정하지 않는다', () => {
    // 근거 없는 false 는 멀쩡한 상세를 301/noindex 로 보내버린다.
    expect(isSameSigunguBjdCode('', '50130')).toBe(true);
    expect(isSameSigunguBjdCode('11680', '')).toBe(true);
    expect(isSameSigunguBjdCode(null, undefined)).toBe(true);
  });
});

describe('getBuildingInfo - regionMatched', () => {
  it('힌트 bjdCode 가 그대로 통하면 regionMatched=true 이고 재해석 groupBy 를 부르지 않는다', async () => {
    mockFindFirst.mockResolvedValue({ ...서귀포_현대, bjdCode: '11680', city: '서울특별시', district: '강남구' });
    mockGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 4 } }]);

    const result = await getBuildingInfo('villa-sale', '11680', '현대');

    expect(result?.regionMatched).toBe(true);
    // happy-path 에 추가 쿼리가 없어야 한다 — dongName groupBy 1회가 전부
    expect(mockGroupBy).toHaveBeenCalledTimes(1);
    expect(mockGroupBy).not.toHaveBeenCalledWith(expect.objectContaining({ by: ['bjdCode'] }));
  });

  it('요청 시군구 밖에서 회수하면 regionMatched=false (프로덕션 현대 사례)', async () => {
    mockFindFirst
      .mockResolvedValueOnce(null)          // 힌트 11680(강남구) 에는 '현대' 거래가 없다
      .mockResolvedValueOnce(서귀포_현대);   // 전국 최다는 50130(서귀포시)
    mockGroupBy
      .mockResolvedValueOnce([])                                        // 힌트 쪽 dongName groupBy
      .mockResolvedValueOnce([{ bjdCode: '50130', _count: { _all: 27 } }]) // buildingName 재해석
      .mockResolvedValueOnce([{ dongName: '동홍동', _count: { dongName: 27 } }]);

    const result = await getBuildingInfo('villa-sale', '11680', '현대');

    expect(result?.regionMatched).toBe(false);
    // null 로 죽이지 않는다 — 프론트가 실제 지역으로 301 하려면 어디 건물인지 알아야 한다
    expect(result?.city).toBe('제주특별자치도');
    expect(result?.district).toBe('서귀포시');
  });

  it('같은 시군구 안에서 회수한 stale 힌트 복구는 regionMatched=true 로 남는다', async () => {
    mockFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...서귀포_현대, bjdCode: '1168010300', city: '서울특별시', district: '강남구' });
    mockGroupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ bjdCode: '1168010300', _count: { _all: 9 } }])
      .mockResolvedValueOnce([{ dongName: '역삼동', _count: { dongName: 9 } }]);

    const result = await getBuildingInfo('villa-sale', '1168010100', '현대');

    expect(result?.regionMatched).toBe(true);
    expect(result?.bjdCode).toBe('1168010300');
  });

  it('힌트가 아예 없으면(외부 유입) regionMatched=true — 대조할 요청 지역이 없다', async () => {
    mockFindFirst.mockResolvedValue(서귀포_현대);
    mockGroupBy
      .mockResolvedValueOnce([{ bjdCode: '50130', _count: { _all: 27 } }])
      .mockResolvedValueOnce([{ dongName: '동홍동', _count: { dongName: 27 } }]);

    const result = await getBuildingInfo('villa-sale', '', '현대');

    expect(result?.regionMatched).toBe(true);
  });
});
