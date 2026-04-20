import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockAptSaleFindFirst,
  mockAptSaleAggregate,
  mockAptSaleGroupBy,
} = vi.hoisted(() => ({
  mockAptSaleFindFirst: vi.fn(),
  mockAptSaleAggregate: vi.fn(),
  mockAptSaleGroupBy: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const models = {
    aptSaleTransaction: {
      findFirst: mockAptSaleFindFirst,
      aggregate: mockAptSaleAggregate,
      groupBy: mockAptSaleGroupBy,
      findMany: vi.fn(),
      count: vi.fn(),
    },
    aptRentTransaction: {
      findFirst: vi.fn(),
      aggregate: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getBuildingInfo - bjdCode fallback', () => {
  it('bjdCode 가 빈 문자열이면 groupBy 로 거래 최다 bjdCode 를 찾아 사용한다', async () => {
    mockAptSaleGroupBy.mockResolvedValue([{ bjdCode: '11680', _count: { _all: 42 } }]);
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord);
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', '', '래미안에든');

    expect(mockAptSaleGroupBy).toHaveBeenCalledTimes(1);
    expect(mockAptSaleGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ['bjdCode'],
        where: { buildingName: '래미안에든' },
        take: 1,
      })
    );
    expect(mockAptSaleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bjdCode: '11680', buildingName: '래미안에든' },
      })
    );
    expect(result).not.toBeNull();
    expect(result?.bjdCode).toBe('11680');
  });

  it('bjdCode 가 제공되면 groupBy 를 호출하지 않고 바로 조회한다', async () => {
    mockAptSaleFindFirst.mockResolvedValue(sampleRecord);
    mockAptSaleAggregate.mockResolvedValue(sampleAgg);

    const result = await getBuildingInfo('apt-sale', '11680', '래미안에든');

    expect(mockAptSaleGroupBy).not.toHaveBeenCalled();
    expect(mockAptSaleFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { bjdCode: '11680', buildingName: '래미안에든' },
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
});
