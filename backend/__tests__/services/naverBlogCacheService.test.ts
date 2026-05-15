import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUniqueF, mockUpsertF, mockFindUniqueR, mockUpsertR, mockQuotaTry, mockFetchNaver } = vi.hoisted(() => ({
  mockFindUniqueF: vi.fn(),
  mockUpsertF: vi.fn(),
  mockFindUniqueR: vi.fn(),
  mockUpsertR: vi.fn(),
  mockQuotaTry: vi.fn(),
  mockFetchNaver: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    facilityNaverBlogCache: { findUnique: mockFindUniqueF, upsert: mockUpsertF },
    realEstateNaverBlogCache: { findUnique: mockFindUniqueR, upsert: mockUpsertR },
  };
  return { default: prismaClient, prisma: prismaClient };
});

vi.mock('../../src/services/naverBlogQuotaService.js', () => ({
  naverBlogQuotaCounter: { tryConsume: mockQuotaTry, used: () => 0 },
}));

vi.mock('../../src/services/naverBlogService.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/naverBlogService.js')>(
    '../../src/services/naverBlogService.js',
  );
  return { ...actual, fetchFromNaver: mockFetchNaver };
});

import { getOrFetchNaverBlogForFacility, facilityInFlight } from '../../src/services/naverBlogCacheService.js';

function makePosts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    url: `u${i}`, title: 't', description: 'd'.repeat(40),
    bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101',
  }));
}

describe('getOrFetchNaverBlogForFacility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    facilityInFlight.clear();
    process.env.NAVER_CLIENT_ID = 'CID';
    process.env.NAVER_CLIENT_SECRET = 'CSEC';
  });
  const facility = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('캐시 히트', async () => {
    mockFindUniqueF.mockResolvedValueOnce({
      posts: makePosts(3), itemCount: 3,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toHaveLength(3);
    expect(mockFetchNaver).not.toHaveBeenCalled();
  });

  it('미스 + quota 여유 → fetch + upsert', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(5));
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toHaveLength(5);
    expect(mockUpsertF).toHaveBeenCalledTimes(1);
  });

  it('미스 + quota 소진 → 빈 배열', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(false);
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockUpsertF).not.toHaveBeenCalled();
  });

  it('만료 캐시 → 미스 처리', async () => {
    mockFindUniqueF.mockResolvedValueOnce({
      posts: makePosts(3), itemCount: 3, expiresAt: new Date(Date.now() - 1000),
    });
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(4));
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toHaveLength(4);
  });

  it('필터링 결과 < MIN_RESULTS → negative caching, 빈 배열', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(2));
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockUpsertF).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ itemCount: 0, posts: [] }),
    }));
  });

  it('cacheOnly + 미스 → 빈 배열 + fetch 호출 안 함', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility, { cacheOnly: true });
    expect(out).toEqual([]);
    expect(mockFetchNaver).not.toHaveBeenCalled();
    expect(mockUpsertF).not.toHaveBeenCalled();
  });

  it('in-flight dedup', async () => {
    mockFindUniqueF.mockResolvedValue(null);
    mockQuotaTry.mockReturnValue(true);
    mockUpsertF.mockResolvedValue({});
    let resolve!: (v: unknown) => void;
    mockFetchNaver.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const p1 = getOrFetchNaverBlogForFacility('parking', 'dup', facility);
    const p2 = getOrFetchNaverBlogForFacility('parking', 'dup', facility);
    await Promise.resolve(); await Promise.resolve();
    resolve(makePosts(5));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(mockFetchNaver).toHaveBeenCalledTimes(1);
  });
});
