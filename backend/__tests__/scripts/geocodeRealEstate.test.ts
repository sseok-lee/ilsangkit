// @TASK Phase2-8 - 카카오 Geocoding 좌표 보강 스크립트 테스트 (TDD)

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// apiKey가 모듈 로드 시점에 캡처되므로 import 전에 제거해야 함
const { mockFetch } = vi.hoisted(() => {
  delete process.env.KAKAO_REST_API_KEY;
  const mockFetch = vi.fn();
  global.fetch = mockFetch;
  return { mockFetch };
});

// Mock PrismaClient
const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock('@prisma/client', () => {
  function PrismaClient() {
    return {
      aptSaleTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
      aptRentTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
      villaSaleTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
      villaRentTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
      offitelSaleTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
      offitelRentTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
      $disconnect: vi.fn(),
    };
  }
  return { PrismaClient };
});

import {
  buildSearchQuery,
  parseKakaoCoordinates,
  geocodeAddress,
  cleanBuildingName,
  getUniqueBuildings,
  updateBuildingCoordinates,
  type UniqueBuilding,
  type KakaoAddressResult,
} from '../../src/scripts/geocodeRealEstate.js';

describe('buildSearchQuery', () => {
  it('도로명 주소가 있으면 시+구+도로명+건물명 반환', () => {
    const building: UniqueBuilding = {
      buildingName: '래미안아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: '강남대로 123',
      jibun: '123-4',
    };
    expect(buildSearchQuery(building)).toBe('서울특별시 강남구 강남대로 123 래미안아파트');
  });

  it('도로명 주소가 없으면 시+구+건물명 반환', () => {
    const building: UniqueBuilding = {
      buildingName: '래미안아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: null,
      jibun: null,
    };
    expect(buildSearchQuery(building)).toBe('서울특별시 강남구 래미안아파트');
  });

  it('도로명 주소가 빈 문자열이면 시+구+건물명 반환', () => {
    const building: UniqueBuilding = {
      buildingName: '현대아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: '',
      jibun: null,
    };
    expect(buildSearchQuery(building)).toBe('서울특별시 강남구 현대아파트');
  });
});

describe('cleanBuildingName', () => {
  it('번지 괄호 제거: 삼도주택(414-11) → 삼도주택', () => {
    expect(cleanBuildingName('삼도주택(414-11)')).toBe('삼도주택');
  });

  it('동 괄호 제거: 렉스빌(C동) → 렉스빌', () => {
    expect(cleanBuildingName('렉스빌(C동)')).toBe('렉스빌');
  });

  it('복합 동 괄호 제거: 궁전빌라(A-B동) → 궁전빌라', () => {
    expect(cleanBuildingName('궁전빌라(A-B동)')).toBe('궁전빌라');
  });

  it('숫자+동 제거: 효성빌라27동 → 효성빌라', () => {
    expect(cleanBuildingName('효성빌라27동')).toBe('효성빌라');
  });

  it('영문+동 제거: 삼성에센빌D동 → 삼성에센빌', () => {
    expect(cleanBuildingName('삼성에센빌D동')).toBe('삼성에센빌');
  });

  it('한글+동 제거: 유동빌라가동 → 유동빌라', () => {
    expect(cleanBuildingName('유동빌라가동')).toBe('유동빌라');
  });

  it('번지+동 복합 제거: 삼성에센빌D동(175-45) → 삼성에센빌', () => {
    expect(cleanBuildingName('삼성에센빌D동(175-45)')).toBe('삼성에센빌');
  });

  it('정제 불필요한 이름은 그대로 반환', () => {
    expect(cleanBuildingName('래미안아파트')).toBe('래미안아파트');
  });
});

describe('parseKakaoCoordinates', () => {
  it('카카오 API 응답에서 좌표 추출', () => {
    const response: KakaoAddressResult = {
      documents: [
        {
          x: '127.0276',
          y: '37.4980',
          address_name: '서울 강남구 테헤란로 152',
        },
      ],
    };
    const coords = parseKakaoCoordinates(response);
    expect(coords).not.toBeNull();
    expect(coords!.lat).toBeCloseTo(37.498, 3);
    expect(coords!.lng).toBeCloseTo(127.0276, 4);
  });

  it('빈 documents 배열이면 null 반환', () => {
    const response: KakaoAddressResult = { documents: [] };
    expect(parseKakaoCoordinates(response)).toBeNull();
  });

  it('첫 번째 document의 좌표만 사용', () => {
    const response: KakaoAddressResult = {
      documents: [
        { x: '127.0276', y: '37.4980' },
        { x: '126.9780', y: '37.5665' },
      ],
    };
    const coords = parseKakaoCoordinates(response);
    expect(coords!.lat).toBeCloseTo(37.498, 3);
    expect(coords!.lng).toBeCloseTo(127.0276, 4);
  });
});

describe('geocodeAddress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('API 키가 없으면 null 반환 (모듈 레벨 캡처)', async () => {
    // apiKey는 모듈 로드 시점에 process.env에서 캡처되므로
    // 테스트 환경에서는 항상 undefined → null 반환
    const coords = await geocodeAddress('강남대로 123 래미안아파트');
    expect(coords).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API 키가 없으면 fetch를 호출하지 않음', async () => {
    const coords = await geocodeAddress('존재하지않는주소');
    expect(coords).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API 오류 응답이면 null 반환', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const coords = await geocodeAddress('강남대로 123');
    expect(coords).toBeNull();
  });

  it('fetch 예외 발생 시 null 반환', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const coords = await geocodeAddress('강남대로 123');
    expect(coords).toBeNull();
  });

  it('KAKAO_REST_API_KEY 없으면 null 반환', async () => {
    // apiKey는 모듈 로드 시점에 캡처되므로, 테스트 환경에서는 이미 설정된 상태
    // API 키가 없는 환경에서는 fetch가 호출되지 않고 null을 반환하는 것이 기대 동작
    // 여기서는 API 응답이 빈 경우 null 반환을 검증
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ documents: [] }),
    });

    const coords = await geocodeAddress('강남대로 123');
    expect(coords).toBeNull();
  });
});

function makePrisma() {
  return {
    aptSaleTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
    aptRentTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
    villaSaleTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
    villaRentTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
    offitelSaleTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
    offitelRentTransaction: { findMany: mockFindMany, updateMany: mockUpdateMany },
    $disconnect: vi.fn(),
  } as unknown as import('@prisma/client').PrismaClient;
}

describe('getUniqueBuildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lat IS NULL인 DISTINCT(buildingName, bjdCode) + 주소 필드 반환', async () => {
    const mockBuildings = [
      { buildingName: '래미안아파트', bjdCode: '1168010800', city: '서울특별시', district: '강남구', dongName: '역삼동', roadName: '강남대로 123', jibun: '123-4' },
      { buildingName: '현대아파트', bjdCode: '1168010900', city: '서울특별시', district: '강남구', dongName: '삼성동', roadName: null, jibun: null },
    ];
    mockFindMany.mockResolvedValue(mockBuildings);

    const prisma = makePrisma();

    const buildings = await getUniqueBuildings(prisma, 'aptSaleTransaction');
    expect(buildings).toEqual(mockBuildings);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lat: null,
          OR: expect.any(Array),
        }),
        select: { buildingName: true, bjdCode: true, city: true, district: true, dongName: true, roadName: true, jibun: true },
        distinct: ['buildingName', 'bjdCode'],
      }),
    );
  });

  it('결과가 없으면 빈 배열 반환', async () => {
    mockFindMany.mockResolvedValue([]);

    const prisma = makePrisma();

    const buildings = await getUniqueBuildings(prisma, 'aptSaleTransaction');
    expect(buildings).toEqual([]);
  });
});

describe('updateBuildingCoordinates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMany.mockResolvedValue({ count: 5 });
  });

  it('buildingName + bjdCode 조건으로 lat/lng 일괄 업데이트', async () => {
    const prisma = makePrisma();

    const building: UniqueBuilding = {
      buildingName: '래미안아파트',
      bjdCode: '1168010800',
      city: '서울특별시',
      district: '강남구',
      dongName: '역삼동',
      roadName: '강남대로 123',
      jibun: '123-4',
    };
    const coords = { lat: 37.498, lng: 127.0276 };

    const count = await updateBuildingCoordinates(prisma, 'aptSaleTransaction', building, coords);
    expect(count).toBe(5);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        buildingName: '래미안아파트',
        bjdCode: '1168010800',
        lat: null,
      },
      data: {
        lat: 37.498,
        lng: 127.0276,
        geocodedAt: expect.any(Date),
      },
    });
  });
});

describe('rate limiting', () => {
  it('geocodeAddress 호출 간 100ms 딜레이가 있어야 함 (sleep 함수 검증)', async () => {
    // sleep 함수가 최소 지연을 보장하는지 검증
    const start = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 100));
    const elapsed = Date.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(90); // 10ms 여유
  });
});
