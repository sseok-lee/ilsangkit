// @TASK Phase2-4 - 빌라 매매 동기화 스크립트 테스트 (TDD)

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
const { mockUpsert, mockFindMany } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    villaSaleTransaction: { upsert: mockUpsert },
    region: { findMany: mockFindMany },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transformVillaSaleItem,
  syncVillaSaleByLawd,
  type VillaSaleItem,
} from '../../src/scripts/syncVillaSale.js';

describe('transformVillaSaleItem', () => {
  it('API 응답 item을 DB 필드로 변환', () => {
    const item: VillaSaleItem = {
      dealAmount: '15,000',
      buildYear: '2005',
      dealYear: '2024',
      dealMonth: '5',
      dealDay: '20',
      umdNm: '역삼동',
      mhouseNm: '역삼빌라',
      excluUseAr: '59.99',
      jibun: '55-3',
      sggCd: '11680',
      floor: '3',
      dealingGbn: '중개거래',
      houseType: '연립다세대',
      cdealDay: '25',
      cdealType: '취소',
      buyerGbn: '개인',
      slerGbn: '개인',
      rgstDate: '20240601',
    };

    const result = transformVillaSaleItem(item, '서울특별시', '강남구');

    expect(result.dealAmount).toBe(15000n);
    expect(result.buildYear).toBe(2005);
    expect(result.dealYear).toBe(2024);
    expect(result.dealMonth).toBe(5);
    expect(result.dealDay).toBe(20);
    expect(result.dongName).toBe('역삼동');
    expect(result.buildingName).toBe('역삼빌라');
    expect(result.exclusiveArea).toBe('59.99');
    expect(result.jibun).toBe('55-3');
    expect(result.bjdCode).toBe('11680');
    expect(result.floor).toBe(3);
    expect(result.dealType).toBe('중개거래');
    expect(result.roadName).toBeNull();
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
    expect(result.houseType).toBe('연립다세대');
    expect(result.cancelDealDay).toBe('25');
    expect(result.cancelDealType).toBe('취소');
    expect(result.buyerType).toBe('개인');
    expect(result.sellerType).toBe('개인');
    expect(result.registrationDate).toBe('20240601');
  });

  it('mhouseNm 필드를 buildingName으로 매핑', () => {
    const item: VillaSaleItem = {
      dealAmount: '20,000',
      buildYear: '2000',
      dealYear: '2024',
      dealMonth: '7',
      dealDay: '1',
      umdNm: '논현동',
      mhouseNm: '논현빌라',
      excluUseAr: '49.50',
      jibun: '100',
      sggCd: '11680',
      floor: '2',
      dealingGbn: '직거래',
      houseType: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '',
      slerGbn: '',
      rgstDate: '',
    };

    const result = transformVillaSaleItem(item, '서울특별시', '강남구');
    expect(result.buildingName).toBe('논현빌라');
  });

  it('dealAmount 쉼표 제거 후 BigInt 변환', () => {
    const item: VillaSaleItem = {
      dealAmount: '1,500,000',
      buildYear: '2000',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '10',
      umdNm: '역삼동',
      mhouseNm: '역삼빌라',
      excluUseAr: '84.99',
      jibun: '1',
      sggCd: '11680',
      floor: '1',
      dealingGbn: '중개거래',
      houseType: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '',
      slerGbn: '',
      rgstDate: '',
    };

    const result = transformVillaSaleItem(item, '서울특별시', '강남구');
    expect(result.dealAmount).toBe(1500000n);
  });

  it('선택 필드 없을 때 null 처리', () => {
    const item: VillaSaleItem = {
      dealAmount: '8,000',
      buildYear: '',
      dealYear: '2024',
      dealMonth: '8',
      dealDay: '',
      umdNm: '역삼동',
      mhouseNm: '역삼빌라',
      excluUseAr: '33.00',
      jibun: '',
      sggCd: '11680',
      floor: '',
      dealingGbn: '',
      houseType: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '',
      slerGbn: '',
      rgstDate: '',
    };

    const result = transformVillaSaleItem(item, '서울특별시', '강남구');
    expect(result.buildYear).toBeNull();
    expect(result.dealDay).toBeNull();
    expect(result.jibun).toBeNull();
    expect(result.floor).toBeNull();
    expect(result.dealType).toBeNull();
    expect(result.roadName).toBeNull();
  });

  it('sourceId 형식 검증 (villaSale 접두사)', () => {
    const item: VillaSaleItem = {
      dealAmount: '15,000',
      buildYear: '2005',
      dealYear: '2024',
      dealMonth: '5',
      dealDay: '20',
      umdNm: '역삼동',
      mhouseNm: '역삼빌라',
      excluUseAr: '59.99',
      jibun: '55',
      sggCd: '11680',
      floor: '3',
      dealingGbn: '중개거래',
      houseType: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '',
      slerGbn: '',
      rgstDate: '',
    };

    const result = transformVillaSaleItem(item, '서울특별시', '강남구');
    expect(result.sourceId).toBe('villaSale-11680-2005-2024-5-20-3-59.99');
  });
});

describe('syncVillaSaleByLawd', () => {
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
        <dealAmount>15,000</dealAmount>
        <buildYear>2005</buildYear>
        <dealYear>2024</dealYear>
        <dealMonth>5</dealMonth>
        <dealDay>20</dealDay>
        <umdNm>역삼동</umdNm>
        <mhouseNm>역삼빌라</mhouseNm>
        <excluUseAr>59.99</excluUseAr>
        <jibun>55</jibun>
        <sggCd>11680</sggCd>
        <floor>3</floor>
        <dealingGbn>중개거래</dealingGbn>
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

    const stats = await syncVillaSaleByLawd('11680', '202405');

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
    expect(stats.totalRecords).toBe(1);
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

    const stats = await syncVillaSaleByLawd('11680', '202405');

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(stats.totalRecords).toBe(0);
  });
});
