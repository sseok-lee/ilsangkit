import { describe, it, expect, vi, beforeEach } from 'vitest';

// apiKey는 모듈 로드 시점에 캡처되므로 import 전에 제거 (모든 지오코딩 시도가 null 반환).
const { mockFetch } = vi.hoisted(() => {
  delete process.env.KAKAO_REST_API_KEY;
  // 배치/재시도 상한은 기본값(400 / 5)으로 검증 — 명시적으로 제거해 기본값 보장.
  delete process.env.SUBSCRIPTION_GEOCODE_LIMIT;
  delete process.env.SUBSCRIPTION_GEOCODE_MAX_ATTEMPTS;
  const mockFetch = vi.fn();
  global.fetch = mockFetch;
  return { mockFetch };
});

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();

vi.mock('@prisma/client', () => {
  function PrismaClient() {
    return {
      subscription: {
        findMany: mockFindMany,
        update: mockUpdate,
      },
      $disconnect: vi.fn(),
    };
  }
  return { PrismaClient };
});

import {
  searchByAddress,
  searchByKeyword,
  getSubscriptionsToGeocode,
  updateSubscriptionCoordinates,
  markGeocodeAttempted,
  processSubscriptions,
} from '../../src/scripts/geocodeSubscriptions.js';
import { PrismaClient } from '@prisma/client';

function makeEmptyKakaoResponse() {
  return { ok: true, json: async () => ({ documents: [] }) };
}

describe('searchByAddress / searchByKeyword — 에러 스월로잉', () => {
  beforeEach(() => vi.clearAllMocks());

  it('API 키 없으면 fetch 호출 없이 null 반환', async () => {
    expect(await searchByAddress('서울특별시 종로구 1')).toBeNull();
    expect(await searchByKeyword('테스트 단지')).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('getSubscriptionsToGeocode — per-run 상한 + 재시도 차단', () => {
  beforeEach(() => vi.clearAllMocks());

  it('lat=null·시도횟수<MAX 만 조회하고, 배치 상한(take)·미시도 우선 정렬을 적용한다', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([
      { id: 1, supplyLocation: '서울특별시 종로구 1', houseName: '테스트' },
    ]);

    const result = await getSubscriptionsToGeocode(prisma);

    expect(result).toHaveLength(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          lat: null,
          supplyLocation: { not: null },
          geocodeAttempts: { lt: 5 }, // SUBSCRIPTION_GEOCODE_MAX_ATTEMPTS 기본값
        }),
        take: 400, // SUBSCRIPTION_GEOCODE_LIMIT 기본값
        orderBy: { geocodedAt: { sort: 'asc', nulls: 'first' } },
      })
    );
  });

  it('대상 없으면 빈 배열 반환', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([]);
    expect(await getSubscriptionsToGeocode(prisma)).toHaveLength(0);
  });
});

describe('markGeocodeAttempted — 실패 시도 누적', () => {
  beforeEach(() => vi.clearAllMocks());

  it('id 기준으로 geocodedAt 갱신 + geocodeAttempts 1 증가', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockUpdate.mockResolvedValueOnce({});
    await markGeocodeAttempted(prisma, 42);
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 42 },
      data: expect.objectContaining({
        geocodedAt: expect.any(Date),
        geocodeAttempts: { increment: 1 },
      }),
    });
  });
});

describe('updateSubscriptionCoordinates — 성공 시 좌표 저장', () => {
  beforeEach(() => vi.clearAllMocks());

  it('id 기준으로 lat/lng/geocodedAt 업데이트 (시도횟수는 건드리지 않음)', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockUpdate.mockResolvedValueOnce({});
    await updateSubscriptionCoordinates(prisma, 7, { lat: 37.5759, lng: 126.9769 });
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 7 },
      data: expect.objectContaining({
        lat: 37.5759,
        lng: 126.9769,
        geocodedAt: expect.any(Date),
      }),
    });
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.geocodeAttempts).toBeUndefined();
  });
});

describe('processSubscriptions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('대상 없으면 update 호출 안 함', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    mockFindMany.mockResolvedValueOnce([]);
    await processSubscriptions(prisma);
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('지오코딩 실패(키 없음) 시 좌표 없이 geocodeAttempts만 증가시킨다', async () => {
    const prisma = new PrismaClient() as unknown as PrismaClient;
    // 구조적으로 지오코딩 불가능한 청약 주소 — 항상 ✗ 가 나는 케이스
    mockFindMany.mockResolvedValueOnce([
      { id: 99, supplyLocation: '경기도 평택시 장안동 평택브레인시티 공동 7BL', houseName: null },
    ]);
    mockUpdate.mockResolvedValueOnce({});

    await processSubscriptions(prisma);

    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 99 },
      data: expect.objectContaining({ geocodeAttempts: { increment: 1 } }),
    });
    const data = mockUpdate.mock.calls[0][0].data;
    expect(data.lat).toBeUndefined();
    expect(data.lng).toBeUndefined();
  });
});
