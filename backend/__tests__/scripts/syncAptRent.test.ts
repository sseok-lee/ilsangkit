// @TASK Phase2-3 - 아파트 전월세 동기화 스크립트 테스트 (TDD)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsert, mockFindUnique, mockFindMany, mockTransaction } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockTransaction: vi.fn((fn) => fn()),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    aptRentTransaction: { upsert: mockUpsert, findUnique: mockFindUnique },
    region: { findMany: mockFindMany },
    $transaction: mockTransaction,
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transformAptRentItem,
  syncAptRentByLawd,
  type RawAptRentItem,
} from '../../src/scripts/syncAptRent.js';

describe('transformAptRentItem', () => {
  it('API 응답 item을 DB 필드로 변환 (전세)', () => {
    const item: RawAptRentItem = {
      deposit: '30,000',
      monthlyRent: '0',
      buildYear: '2010',
      dealYear: '2024',
      dealMonth: '3',
      dealDay: '10',
      umdNm: '역삼동',
      aptNm: '래미안아파트',
      excluUseAr: '84.99',
      jibun: '123-4',
      sggCd: '11680',
      floor: '10',
      contractTerm: '24',
      roadnm: '강남대로 100',
      contractType: '신규',
      preDeposit: '',
      preMonthlyRent: '',
      useRRRight: '',
      city: '서울특별시',
      district: '강남구',
    };

    const result = transformAptRentItem(item);

    expect(result.deposit).toBe(30000n);
    expect(result.monthlyRent).toBe(0);
    expect(result.rentType).toBe('전세');
    expect(result.contractTerm).toBe('24');
    expect(result.contractType).toBe('신규');
    expect(result.preDeposit).toBeNull();
    expect(result.preMonthlyRent).toBeNull();
    expect(result.useRenewalRight).toBeNull();
    expect(result.buildYear).toBe(2010);
    expect(result.dealYear).toBe(2024);
    expect(result.dealMonth).toBe(3);
    expect(result.dealDay).toBe(10);
    expect(result.dongName).toBe('역삼동');
    expect(result.buildingName).toBe('래미안아파트');
    expect(result.exclusiveArea).toBe('84.99');
    expect(result.jibun).toBe('123-4');
    expect(result.bjdCode).toBe('11680');
    expect(result.floor).toBe(10);
    expect(result.roadName).toBe('강남대로 100');
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
  });

  it('월세 변환 - 보증금+월세 있는 경우', () => {
    const item: RawAptRentItem = {
      deposit: '1,000',
      monthlyRent: '100',
      buildYear: '2005',
      dealYear: '2024',
      dealMonth: '6',
      dealDay: '20',
      umdNm: '논현동',
      aptNm: '현대아파트',
      excluUseAr: '59.99',
      jibun: '50',
      sggCd: '11680',
      floor: '3',
      contractTerm: '12',
      roadnm: '',
      contractType: '',
      preDeposit: '',
      preMonthlyRent: '',
      useRRRight: '',
      city: '서울특별시',
      district: '강남구',
    };

    const result = transformAptRentItem(item);
    expect(result.deposit).toBe(1000n);
    expect(result.monthlyRent).toBe(100);
    expect(result.rentType).toBe('월세');
  });

  it('보증금 쉼표 제거 후 BigInt 변환', () => {
    const item: RawAptRentItem = {
      deposit: '2,500,000',
      monthlyRent: '0',
      buildYear: '2015',
      dealYear: '2024',
      dealMonth: '2',
      dealDay: '1',
      umdNm: '삼성동',
      aptNm: '타워팰리스',
      excluUseAr: '150.00',
      jibun: '1',
      sggCd: '11680',
      floor: '50',
      contractTerm: '24',
      roadnm: '테헤란로 101',
      contractType: '',
      preDeposit: '',
      preMonthlyRent: '',
      useRRRight: '',
      city: '서울특별시',
      district: '강남구',
    };

    const result = transformAptRentItem(item);
    expect(result.deposit).toBe(2500000n);
  });

  it('선택 필드 없을 때 null 처리', () => {
    const item: RawAptRentItem = {
      deposit: '10,000',
      monthlyRent: '',
      buildYear: '',
      dealYear: '2024',
      dealMonth: '4',
      dealDay: '',
      umdNm: '역삼동',
      aptNm: '래미안',
      excluUseAr: '59.99',
      jibun: '',
      sggCd: '11680',
      floor: '',
      contractTerm: '',
      roadnm: '',
      contractType: '',
      preDeposit: '',
      preMonthlyRent: '',
      useRRRight: '',
      city: '서울특별시',
      district: '강남구',
    };

    const result = transformAptRentItem(item);
    expect(result.monthlyRent).toBeNull();
    expect(result.buildYear).toBeNull();
    expect(result.dealDay).toBeNull();
    expect(result.jibun).toBeNull();
    expect(result.floor).toBeNull();
    expect(result.contractTerm).toBeNull();
    expect(result.roadName).toBeNull();
  });

  it('sourceId 형식 검증', () => {
    const item: RawAptRentItem = {
      deposit: '30,000',
      monthlyRent: '0',
      buildYear: '2010',
      dealYear: '2024',
      dealMonth: '3',
      dealDay: '10',
      umdNm: '역삼동',
      aptNm: '래미안아파트',
      excluUseAr: '84.99',
      jibun: '123',
      sggCd: '11680',
      floor: '10',
      contractTerm: '24',
      roadnm: '강남대로 100',
      contractType: '',
      preDeposit: '',
      preMonthlyRent: '',
      useRRRight: '',
      city: '서울특별시',
      district: '강남구',
    };

    const result = transformAptRentItem(item);
    expect(result.sourceId).toBe('aptRent-11680-2010-2024-3-10-10-84.99-30000-0');
  });
});

describe('syncAptRentByLawd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATA_GO_KR_SERVICE_KEY = 'test-service-key';
  });

  it('API 응답에서 데이터를 가져와 upsert 수행', async () => {
    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL SERVICE.</resultMsg>
  </header>
  <body>
    <totalCount>1</totalCount>
    <items>
      <item>
        <deposit>30,000</deposit>
        <monthlyRent>0</monthlyRent>
        <buildYear>2010</buildYear>
        <dealYear>2024</dealYear>
        <dealMonth>3</dealMonth>
        <dealDay>10</dealDay>
        <umdNm>역삼동</umdNm>
        <aptNm>래미안아파트</aptNm>
        <excluUseAr>84.99</excluUseAr>
        <jibun>123</jibun>
        <sggCd>11680</sggCd>
        <floor>10</floor>
        <contractTerm>24</contractTerm>
        <roadnm>강남대로 100</roadnm>
      </item>
    </items>
  </body>
</response>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => xmlResponse,
    });

    mockFindMany.mockResolvedValueOnce([
      { bjdCode: '11680', city: '서울특별시', district: '강남구' },
    ]);

    mockUpsert.mockResolvedValue({ id: 1 });

    const regionMap = new Map([
      ['11680', { city: '서울특별시', district: '강남구' }],
    ]);

    await syncAptRentByLawd('11680', '202403', 'test-service-key', regionMap);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it('API 응답이 빈 items이면 upsert 안함', async () => {
    const xmlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL SERVICE.</resultMsg>
  </header>
  <body>
    <totalCount>0</totalCount>
    <items/>
  </body>
</response>`;

    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => xmlResponse,
    });

    mockFindMany.mockResolvedValueOnce([
      { bjdCode: '11680', city: '서울특별시', district: '강남구' },
    ]);

    const regionMap = new Map([
      ['11680', { city: '서울특별시', district: '강남구' }],
    ]);

    await syncAptRentByLawd('11680', '202403', 'test-service-key', regionMap);

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
