import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAptSaleFindFirst, mockAptSaleAggregate, mockAptSaleGroupBy, mockAptSaleCount,
  mockAptRentFindFirst, mockAptRentAggregate, mockAptRentGroupBy, mockAptRentCount,
} = vi.hoisted(() => ({
  mockAptSaleFindFirst: vi.fn(), mockAptSaleAggregate: vi.fn(), mockAptSaleGroupBy: vi.fn(), mockAptSaleCount: vi.fn(),
  mockAptRentFindFirst: vi.fn(), mockAptRentAggregate: vi.fn(), mockAptRentGroupBy: vi.fn(), mockAptRentCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const models = {
    aptSaleTransaction: { findFirst: mockAptSaleFindFirst, aggregate: mockAptSaleAggregate, groupBy: mockAptSaleGroupBy, count: mockAptSaleCount, findMany: vi.fn() },
    aptRentTransaction: { findFirst: mockAptRentFindFirst, aggregate: mockAptRentAggregate, groupBy: mockAptRentGroupBy, count: mockAptRentCount, findMany: vi.fn() },
    villaSaleTransaction: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    villaRentTransaction: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    offitelSaleTransaction: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    offitelRentTransaction: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    realEstateBuildingSummary: { findMany: vi.fn(), count: vi.fn() },
    $queryRawUnsafe: vi.fn(),
  };
  return { prisma: models, default: models };
});

import { getBuildingInfo } from '../../src/services/realEstateService.js';

const sampleRecord = {
  id: 1,
  buildingName: '래미안에든',
  city: '서울특별시',
  district: '강남구',
  bjdCode: '11680',
  dongName: '역삼동',
  roadName: null,
  jibun: '123',
  buildYear: 2010,
  floor: 12,
  exclusiveArea: 84.82,
  dealAmount: BigInt(82500),
  dealYear: 2024,
  dealMonth: 1,
  dealDay: 15,
  lat: 37.5,
  lng: 127.0,
};

const sampleAgg = {
  _min: { exclusiveArea: 59.5 },
  _max: { exclusiveArea: 84.82 },
};

const sampleCoordsOnly = {
  lat: 37.5001,
  lng: 127.0001,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBuildingInfo - bjdCode fallback', () => {
  it('bjdCode 가 빈 문자열이면 groupBy 로 거래 최다 bjdCode 를 찾아 사용한다', async () => {
    mockAptSaleGroupBy
      .mockResolvedValueOnce([{ bjdCode: '11680', _count: { _all: 42 } }])
      .mockResolvedValueOnce([{ dongName: '역삼동', _count: { _all: 42 } }]);
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord);
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', '', '래미안에든');

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(2);
    expect(mockAptSaleGroupBy).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        by: ['bjdCode'],
        where: { buildingName: '래미안에든' },
        take: 1,
      })
    );
    expect(mockAptSaleGroupBy).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        by: ['dongName'],
        take: 1,
      })
    );
    expect(mockAptSaleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bjdCode: '11680', buildingName: '래미안에든', cancelDealDay: null },
      })
    );
    expect(result).not.toBeNull();
    expect(result?.bjdCode).toBe('11680');
  });

  it('bjdCode 가 제공되면 bjdCode fallback groupBy 는 호출하지 않고 dongName groupBy 만 호출한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { _all: 10 } }]);
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord);
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', '11680', '래미안에든');

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(1);
    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['dongName'],
        take: 1,
      })
    );
    expect(mockAptSaleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bjdCode: '11680', buildingName: '래미안에든', cancelDealDay: null },
      })
    );
    expect(result?.bjdCode).toBe('11680');
  });

  it('bjdCode 가 비어있고 buildingName 에 매칭되는 bjdCode 가 없으면 null 을 반환한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([]);

    const result = await getBuildingInfo('apt-sale', '', '존재하지않음');

    expect(result).toBeNull();
    expect(mockAptSaleFindFirst).not.toHaveBeenCalled();
  });

  it('fallback 으로 선정된 bjdCode 에 실제 최신 레코드가 없으면 null 을 반환한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([{ bjdCode: '11680', _count: { _all: 42 } }]);
    mockAptSaleFindFirst.mockResolvedValue(null);
    mockAptSaleAggregate.mockResolvedValue({ _min: { exclusiveArea: null }, _max: { exclusiveArea: null } });

    const result = await getBuildingInfo('apt-sale', '', '래미안에든');

    expect(result).toBeNull();
  });

  it('반환 payload 에 bjdCode 필드가 포함된다', async () => {
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord);
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', '11680', '래미안에든');

    expect(result).toHaveProperty('bjdCode', '11680');
    expect(result).toHaveProperty('buildingName', '래미안에든');
    expect(result).toHaveProperty('city', '서울특별시');
  });

  it('최신 거래에 좌표가 없으면 같은 건물의 최근 좌표 보유 거래를 fallback 으로 사용한다', async () => {
    mockAptSaleFindFirst
      .mockResolvedValueOnce({ ...sampleRecord, lat: null, lng: null })
      .mockResolvedValueOnce(sampleCoordsOnly);
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', '11680', '래미안에든');

    expect(mockAptSaleFindFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          bjdCode: '11680',
          buildingName: '래미안에든',
          cancelDealDay: null,
          lat: { not: null },
          lng: { not: null },
        },
        select: { lat: true, lng: true },
      })
    );
    expect(result?.lat).toBe(sampleCoordsOnly.lat);
    expect(result?.lng).toBe(sampleCoordsOnly.lng);
  });

  // 회귀: getComplexList(summary)에서 온 bjdCode가 트랜잭션과 어긋나도(stale summary /
  // startsWith 오매칭) buildingName으로 회수해 false noindex 를 막는다.
  it('힌트 bjdCode 에 거래가 없으면 buildingName 으로 bjdCode 를 회수한다', async () => {
    mockAptSaleFindFirst
      .mockResolvedValueOnce(null) // 힌트 'STALE' 로는 최신 거래 없음
      .mockResolvedValueOnce(sampleRecord); // 회수된 '11680' 의 최신 거래
    mockAptSaleGroupBy
      .mockResolvedValueOnce([]) // 힌트 buildForBjdCode 의 dongName groupBy (latest null 이라 미사용)
      .mockResolvedValueOnce([{ bjdCode: '11680', _count: { _all: 9 } }]) // buildingName 재해석
      .mockResolvedValueOnce([{ dongName: '역삼동', _count: { _all: 9 } }]); // 회수 후 dongName
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', 'STALE_BJD_0000', '래미안에든');

    expect(result).not.toBeNull();
    expect(result?.bjdCode).toBe('11680');
    // buildingName 기반 bjdCode 재해석이 실제로 호출됐는지 확인
    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bjdCode'],
        where: { buildingName: '래미안에든' },
        take: 1,
      })
    );
  });

  it('힌트 bjdCode 도 buildingName 회수도 실패하면 null 을 반환한다', async () => {
    mockAptSaleFindFirst.mockResolvedValue(null); // 힌트로 최신 거래 없음
    mockAptSaleGroupBy.mockResolvedValue([]); // buildingName 회수도 0건

    const result = await getBuildingInfo('apt-sale', 'STALE_BJD_0000', '없는건물');

    expect(result).toBeNull();
  });
});

describe('getBuildingInfo - 전·월세 건수 (rent 전용, 건물-레벨)', () => {
  beforeEach(() => vi.clearAllMocks())

  const rentRecord = {
    buildingName: '래미안', bjdCode: '11680', city: '서울', district: '강남구', dongName: '역삼동',
    roadName: null, jibun: '1', buildYear: 2009, dealYear: 2024, dealMonth: 1, dealDay: 15,
    lat: 37.5, lng: 127.0, deposit: 120000, monthlyRent: 0, exclusiveArea: 84.8,
  }

  it('rent 타입이면 jeonseCount/wolseCount 를 건물-레벨로 채운다', async () => {
    mockAptRentFindFirst.mockResolvedValue(rentRecord)
    mockAptRentAggregate.mockResolvedValue({ _min: { exclusiveArea: 59.9 }, _max: { exclusiveArea: 114.8 } })
    mockAptRentGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 5 } }])
    mockAptRentCount.mockResolvedValueOnce(7).mockResolvedValueOnce(3) // 전세, 월세

    const result = await getBuildingInfo('apt-rent', '11680', '래미안')

    expect(result?.jeonseCount).toBe(7)
    expect(result?.wolseCount).toBe(3)
    expect(mockAptRentCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bjdCode: '11680', buildingName: '래미안', rentType: '전세' } }),
    )
    expect(mockAptRentCount).toHaveBeenCalledWith(
      expect.objectContaining({ where: { bjdCode: '11680', buildingName: '래미안', rentType: '월세' } }),
    )
  })

  it('sale 타입이면 카운트하지 않고 필드도 없다', async () => {
    mockAptSaleFindFirst.mockResolvedValue({ ...rentRecord, dealAmount: 250000 })
    mockAptSaleAggregate.mockResolvedValue({ _min: { exclusiveArea: 59.9 }, _max: { exclusiveArea: 114.8 } })
    mockAptSaleGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 5 } }])

    const result = await getBuildingInfo('apt-sale', '11680', '래미안')

    expect(result?.jeonseCount).toBeUndefined()
    expect(result?.wolseCount).toBeUndefined()
    expect(mockAptSaleCount).not.toHaveBeenCalled()
  })
})

// 결함4: meta·헤더 최근 거래가 정합의 뿌리 = getBuildingInfo 가 검색 엔드포인트와
// 동일한 규칙(거래일 desc → id desc tie-break, sale 취소거래 제외)으로 '최신 1건'을 고른다.
describe('getBuildingInfo - 결정적 tie-break & 취소거래 제외 (결함4)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sale: 최신 거래 findFirst 의 orderBy 마지막이 { id: "desc" } tie-break', async () => {
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord)
    mockAptSaleAggregate.mockResolvedValue(sampleAgg)
    mockAptSaleGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 3 } }])

    await getBuildingInfo('apt-sale', '11680', '래미안에든')

    expect(mockAptSaleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { dealYear: 'desc' },
          { dealMonth: 'desc' },
          { dealDay: 'desc' },
          { id: 'desc' },
        ],
      }),
    )
  })

  it('sale: findFirst where 에 취소거래 제외(cancelDealDay: null) 를 포함한다', async () => {
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord)
    mockAptSaleAggregate.mockResolvedValue(sampleAgg)
    mockAptSaleGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 3 } }])

    await getBuildingInfo('apt-sale', '11680', '래미안에든')

    expect(mockAptSaleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bjdCode: '11680', buildingName: '래미안에든', cancelDealDay: null },
      }),
    )
  })

  it('rent: findFirst where 에는 cancelDealDay 를 넣지 않는다 (취소 필드 없음)', async () => {
    mockAptRentFindFirst.mockResolvedValue({
      buildingName: '래미안', bjdCode: '11680', city: '서울', district: '강남구', dongName: '역삼동',
      roadName: null, jibun: '1', buildYear: 2009, dealYear: 2024, dealMonth: 1, dealDay: 15,
      lat: 37.5, lng: 127.0, deposit: 120000, monthlyRent: 0, exclusiveArea: 84.8,
    })
    mockAptRentAggregate.mockResolvedValue({ _min: { exclusiveArea: 59.9 }, _max: { exclusiveArea: 114.8 } })
    mockAptRentGroupBy.mockResolvedValue([{ dongName: '역삼동', _count: { dongName: 5 } }])
    mockAptRentCount.mockResolvedValueOnce(7).mockResolvedValueOnce(3)

    await getBuildingInfo('apt-rent', '11680', '래미안')

    const call = mockAptRentFindFirst.mock.calls[0][0]
    expect(call.where).toEqual({ bjdCode: '11680', buildingName: '래미안' })
    expect(call.where).not.toHaveProperty('cancelDealDay')
    // rent 도 동일한 id desc tie-break 로 결정적
    expect(call.orderBy).toEqual([
      { dealYear: 'desc' },
      { dealMonth: 'desc' },
      { dealDay: 'desc' },
      { id: 'desc' },
    ])
  })
})
