// 토지 매매 동기화 스크립트 테스트 (TDD)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsert, mockFindUnique, mockFindMany, mockTransaction } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockTransaction: vi.fn((fn) => fn()),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    landSaleTransaction: { upsert: mockUpsert, findUnique: mockFindUnique },
    region: { findMany: mockFindMany },
    $transaction: mockTransaction,
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transformLandSaleItem,
  syncLandSaleByLawd,
  type RawLandSaleItem,
} from '../../src/scripts/syncLandSale.js';

function makeItem(overrides: Partial<RawLandSaleItem>): RawLandSaleItem {
  return {
    sggCd: '11680', umdNm: '역삼동', jibun: '123-4', jimok: '대',
    landUse: '제2종일반주거지역', dealArea: '198.30', dealAmount: '1,500,000',
    shareDealingType: '일반', dealingGbn: '중개거래',
    dealYear: '2026', dealMonth: '3', dealDay: '15', cdealType: ' ', cdealDay: ' ',
    city: '서울특별시', district: '강남구',
    ...overrides,
  };
}

describe('transformLandSaleItem', () => {
  it('API 응답 item을 DB 필드로 변환', () => {
    const r = transformLandSaleItem(makeItem({}));
    expect(r.bjdCode).toBe('11680');
    expect(r.dongName).toBe('역삼동');
    expect(r.jibun).toBe('123-4');
    expect(r.jimok).toBe('대');
    expect(r.landUse).toBe('제2종일반주거지역');
    expect(r.dealArea).toBe('198.30');
    expect(r.dealAmount).toBe(1500000n);
    expect(r.shareDeal).toBe(false);
    expect(r.dealType).toBe('중개거래');
    expect(r.dealYear).toBe(2026);
    expect(r.dealMonth).toBe(3);
    expect(r.dealDay).toBe(15);
    expect(r.cancelDealType).toBeNull();
    expect(r.cancelDealDay).toBeNull();
    expect(r.city).toBe('서울특별시');
    expect(r.district).toBe('강남구');
  });

  it('지분거래 구분 → shareDeal true', () => {
    expect(transformLandSaleItem(makeItem({ shareDealingType: '지분' })).shareDeal).toBe(true);
  });

  it('선택 필드 없을 때 null 처리 (공백 포함)', () => {
    const r = transformLandSaleItem(makeItem({ jibun: '', jimok: '', landUse: '', dealDay: '', dealingGbn: '', dealArea: '', cdealType: ' ', cdealDay: ' ' }));
    expect(r.jibun).toBeNull();
    expect(r.jimok).toBeNull();
    expect(r.landUse).toBeNull();
    expect(r.dealDay).toBeNull();
    expect(r.dealType).toBeNull();
    expect(r.dealArea).toBeNull();
    expect(r.cancelDealType).toBeNull();
    expect(r.cancelDealDay).toBeNull();
  });

  it('sourceId 형식 검증', () => {
    const r = transformLandSaleItem(makeItem({}));
    expect(r.sourceId).toBe('landSale-11680-역삼동-123-4-2026-3-15-198.30-1500000');
  });
});

describe('syncLandSaleByLawd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('API 응답에서 데이터를 가져와 upsert 수행', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header>
  <body>
    <totalCount>1</totalCount>
    <items>
      <item>
        <sggCd>11680</sggCd><umdNm>역삼동</umdNm><jibun>123-4</jibun>
        <jimok>대</jimok><landUse>제2종일반주거지역</landUse>
        <dealArea>198.30</dealArea><dealAmount>1,500,000</dealAmount>
        <shareDealingType>일반</shareDealingType><dealingGbn>중개거래</dealingGbn>
        <dealYear>2026</dealYear><dealMonth>3</dealMonth><dealDay>15</dealDay>
      </item>
    </items>
  </body>
</response>`;
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => xml });
    mockUpsert.mockResolvedValue({ id: 1 });
    const regionMap = new Map([['11680', { city: '서울특별시', district: '강남구' }]]);

    await syncLandSaleByLawd('11680', '202603', 'test-key', regionMap);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it('빈 items이면 upsert 안함', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header>
<body><totalCount>0</totalCount><items/></body></response>`;
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => xml });
    const regionMap = new Map([['11680', { city: '서울특별시', district: '강남구' }]]);

    await syncLandSaleByLawd('11680', '202603', 'test-key', regionMap);

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
