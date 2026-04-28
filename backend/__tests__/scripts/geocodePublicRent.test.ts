import { describe, it, expect, vi, beforeEach } from 'vitest';

// apiKey는 모듈 로드 시점에 캡처되므로 import 전에 제거
const { mockFetch } = vi.hoisted(() => {
  delete process.env.KAKAO_REST_API_KEY;
  const mockFetch = vi.fn();
  global.fetch = mockFetch;
  return { mockFetch };
});

const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();

vi.mock('@prisma/client', () => {
  function PrismaClient() {
    return {
      publicRentalComplex: {
        findMany: mockFindMany,
        updateMany: mockUpdateMany,
      },
      $disconnect: vi.fn(),
    };
  }
  return { PrismaClient };
});

import {
  searchByAddress,
  searchByKeyword,
  getPublicRentalsToGeocode,
  updatePublicRentalCoordinates,
  markGeocodeAttempted,
  processPublicRentals,
} from '../../src/scripts/geocodePublicRent.js';
import { PrismaClient } from '@prisma/client';

function makeKakaoResponse(x: string, y: string) {
  return { ok: true, json: async () => ({ documents: [{ x, y }] }) };
}

function makeEmptyKakaoResponse() {
  return { ok: true, json: async () => ({ documents: [] }) };
}

describe('searchByAddress', () => {
  beforeEach(() => vi.clearAllMocks());

  it('API 키 없으면 null 반환 (모듈 로드 시점 캡처)', async () => {
    const result = await searchByAddress('서울특별시 구로구 디지털로 100');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API 오류 응답이면 null 반환', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    expect(await searchByAddress('주소')).toBeNull();
  });

  it('fetch 예외 시 null 반환', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    expect(await searchByAddress('주소')).toBeNull();
  });

  it('빈 documents이면 null 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeEmptyKakaoResponse());
    expect(await searchByAddress('없는주소')).toBeNull();
  });
});

describe('searchByKeyword', () => {
  beforeEach(() => vi.clearAllMocks());

  it('API 키 없으면 null 반환', async () => {
    const result = await searchByKeyword('구로 LH아파트');
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('API 오류 응답이면 null 반환', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    expect(await searchByKeyword('키워드')).toBeNull();
  });

  it('빈 documents이면 null 반환', async () => {
    mockFetch.mockResolvedValueOnce(makeEmptyKakaoResponse());
    expect(await searchByKeyword('없는키워드')).toBeNull();
  });
});

describe('getPublicRentalsToGeocode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lat이 null이고 geocodedAt이 null인 레코드 조회 (complexCode distinct)', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([
      { complexCode: '12345', complexName: '서울 구로 디지털로 100', complexNameKor: 'LH구로단지', city: '서울특별시', district: '구로구' },
    ]);
    const result = await getPublicRentalsToGeocode(prisma);
    expect(result).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lat: null }),
        distinct: ['complexCode'],
      })
    );
  });

  it('대상 없으면 빈 배열 반환', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([]);
    expect(await getPublicRentalsToGeocode(prisma)).toHaveLength(0);
  });
});

describe('updatePublicRentalCoordinates', () => {
  beforeEach(() => vi.clearAllMocks());

  it('complexCode 기준으로 모든 variant에 lat/lng/geocodedAt 업데이트', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockUpdateMany.mockResolvedValueOnce({ count: 3 });
    await updatePublicRentalCoordinates(prisma, '12345', { lat: 37.498, lng: 127.027 });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { complexCode: '12345' },
      data: expect.objectContaining({ lat: 37.498, lng: 127.027, geocodedAt: expect.any(Date) }),
    });
  });
});

describe('markGeocodeAttempted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('complexCode 기준으로 모든 variant에 geocodedAt만 업데이트', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockUpdateMany.mockResolvedValueOnce({ count: 2 });
    await markGeocodeAttempted(prisma, 'C99');
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { complexCode: 'C99' },
      data: expect.objectContaining({ geocodedAt: expect.any(Date) }),
    });
  });
});

describe('processPublicRentals', () => {
  beforeEach(() => vi.clearAllMocks());

  it('대상 없으면 updateMany 호출 안 함', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([]);
    await processPublicRentals(prisma);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('지오코딩 실패 시 complexCode 기준으로 geocodedAt만 기록', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([
      { complexCode: '99999', complexName: '없는주소 999', complexNameKor: null, city: '서울특별시', district: '구로구' },
    ]);
    // API 키 없으므로 모든 geocoding 시도가 null 반환
    mockUpdateMany.mockResolvedValueOnce({ count: 1 });
    await processPublicRentals(prisma);
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { complexCode: '99999' },
      data: expect.objectContaining({ geocodedAt: expect.any(Date) }),
    });
    // lat/lng는 설정되지 않아야 함
    const callData = mockUpdateMany.mock.calls[0][0].data;
    expect(callData.lat).toBeUndefined();
    expect(callData.lng).toBeUndefined();
  });
});
