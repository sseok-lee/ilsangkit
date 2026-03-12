// @TASK Phase2-2 - 아파트 매매 동기화 스크립트 테스트 (TDD)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsert, mockFindMany } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    aptSaleTransaction: { upsert: mockUpsert },
    region: { findMany: mockFindMany },
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transformAptSaleItem,
  syncAptSaleByLawd,
  type AptSaleItem,
} from '../../src/scripts/syncAptSale.js';

describe('transformAptSaleItem', () => {
  it('API 응답 item을 DB 필드로 변환', () => {
    const item: AptSaleItem = {
      dealAmount: '50,000',
      buildYear: '2010',
      dealYear: '2024',
      dealMonth: '3',
      dealDay: '15',
      umdNm: '역삼동',
      aptNm: '래미안아파트',
      excluUseAr: '84.99',
      jibun: '123-4',
      sggCd: '11680',
      floor: '10',
      dealingGbn: '중개거래',
      aptDong: '101동',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '개인',
      slerGbn: '개인',
      rgstDate: '20260310',
    };

    const result = transformAptSaleItem(item, '서울특별시', '강남구');

    expect(result.dealAmount).toBe(50000n);
    expect(result.buildYear).toBe(2010);
    expect(result.dealYear).toBe(2024);
    expect(result.dealMonth).toBe(3);
    expect(result.dealDay).toBe(15);
    expect(result.dongName).toBe('역삼동');
    expect(result.buildingName).toBe('래미안아파트');
    expect(result.exclusiveArea).toBe('84.99');
    expect(result.jibun).toBe('123-4');
    expect(result.bjdCode).toBe('11680');
    expect(result.floor).toBe(10);
    expect(result.dealType).toBe('중개거래');
    expect(result.roadName).toBeNull();
    expect(result.city).toBe('서울특별시');
    expect(result.district).toBe('강남구');
    expect(result.aptDong).toBe('101동');
    expect(result.cancelDealDay).toBeNull();
    expect(result.cancelDealType).toBeNull();
    expect(result.buyerType).toBe('개인');
    expect(result.sellerType).toBe('개인');
    expect(result.registrationDate).toBe('20260310');
  });

  it('거래금액 쉼표 제거 후 BigInt 변환', () => {
    const item: AptSaleItem = {
      dealAmount: '1,234,567',
      buildYear: '2005',
      dealYear: '2024',
      dealMonth: '1',
      dealDay: '5',
      umdNm: '역삼동',
      aptNm: '현대아파트',
      excluUseAr: '59.99',
      jibun: '50',
      sggCd: '11680',
      floor: '5',
      dealingGbn: '직거래',
      aptDong: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '개인',
      slerGbn: '개인',
      rgstDate: '20260310',
    };

    const result = transformAptSaleItem(item, '서울특별시', '강남구');
    expect(result.dealAmount).toBe(1234567n);
  });

  it('선택 필드 없을 때 null 처리', () => {
    const item: AptSaleItem = {
      dealAmount: '30,000',
      buildYear: '',
      dealYear: '2024',
      dealMonth: '6',
      dealDay: '',
      umdNm: '논현동',
      aptNm: '신축빌라',
      excluUseAr: '45.00',
      jibun: '',
      sggCd: '11680',
      floor: '',
      dealingGbn: '',
      aptDong: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '',
      slerGbn: '',
      rgstDate: '',
    };

    const result = transformAptSaleItem(item, '서울특별시', '강남구');
    expect(result.buildYear).toBeNull();
    expect(result.dealDay).toBeNull();
    expect(result.jibun).toBeNull();
    expect(result.floor).toBeNull();
    expect(result.dealType).toBeNull();
    expect(result.roadName).toBeNull();
  });

  it('sourceId 형식 검증', () => {
    const item: AptSaleItem = {
      dealAmount: '50,000',
      buildYear: '2010',
      dealYear: '2024',
      dealMonth: '3',
      dealDay: '15',
      umdNm: '역삼동',
      aptNm: '래미안아파트',
      excluUseAr: '84.99',
      jibun: '123',
      sggCd: '11680',
      floor: '10',
      dealingGbn: '중개거래',
      aptDong: '101동',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '개인',
      slerGbn: '개인',
      rgstDate: '20260310',
    };

    const result = transformAptSaleItem(item, '서울특별시', '강남구');
    expect(result.sourceId).toBe('aptSale-11680-2010-2024-3-15-10-84.99');
  });

  it('sourceId - 선택 필드 없을 때 빈 문자열로 처리', () => {
    const item: AptSaleItem = {
      dealAmount: '30,000',
      buildYear: '',
      dealYear: '2024',
      dealMonth: '6',
      dealDay: '',
      umdNm: '역삼동',
      aptNm: '래미안아파트',
      excluUseAr: '84.99',
      jibun: '',
      sggCd: '11680',
      floor: '',
      dealingGbn: '',
      aptDong: '',
      cdealDay: '',
      cdealType: '',
      buyerGbn: '',
      slerGbn: '',
      rgstDate: '',
    };

    const result = transformAptSaleItem(item, '서울특별시', '강남구');
    expect(result.sourceId).toBe('aptSale-11680--2024-6---84.99');
  });
});

describe('syncAptSaleByLawd', () => {
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
        <dealAmount>50,000</dealAmount>
        <buildYear>2010</buildYear>
        <dealYear>2024</dealYear>
        <dealMonth>3</dealMonth>
        <dealDay>15</dealDay>
        <umdNm>역삼동</umdNm>
        <aptNm>래미안아파트</aptNm>
        <excluUseAr>84.99</excluUseAr>
        <jibun>123</jibun>
        <sggCd>11680</sggCd>
        <floor>10</floor>
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

    const stats = await syncAptSaleByLawd('11680', '202403');

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

    const stats = await syncAptSaleByLawd('11680', '202403');

    expect(mockUpsert).not.toHaveBeenCalled();
    expect(stats.totalRecords).toBe(0);
  });
});
