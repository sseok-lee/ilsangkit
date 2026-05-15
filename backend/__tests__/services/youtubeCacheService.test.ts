import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpsert, mockQuotaTry, mockFetchYoutube } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockQuotaTry: vi.fn(),
  mockFetchYoutube: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    facilityYoutubeCache: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  };
  return { default: prismaClient, prisma: prismaClient };
});

vi.mock('../../src/services/youtubeQuotaService.js', () => ({
  youtubeQuotaCounter: { tryConsume: mockQuotaTry, used: () => 0 },
}));

vi.mock('../../src/services/youtubeService.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/youtubeService.js')>(
    '../../src/services/youtubeService.js',
  );
  return { ...actual, fetchFromYoutube: mockFetchYoutube };
});

import { getOrFetchYoutubeVideos, inFlight } from '../../src/services/youtubeCacheService.js';

describe('getOrFetchYoutubeVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    inFlight.clear();
    process.env.YOUTUBE_API_KEY = 'KEY';
  });

  const facility = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('캐시 히트: API 호출 없이 캐시된 영상을 반환', async () => {
    mockFindUnique.mockResolvedValueOnce({
      videos: [{ videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }],
      itemCount: 1,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toHaveLength(1);
    expect(mockFetchYoutube).not.toHaveBeenCalled();
  });

  it('캐시 미스 + quota 여유: API 호출 후 upsert 저장', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchYoutube.mockResolvedValueOnce([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
      { videoId: 'b', title: 't2', channelTitle: 'c2', thumbnail: '', publishedAt: '', duration: '' },
    ]);

    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toHaveLength(2);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('캐시 미스 + quota 소진: 빈 배열 반환, upsert 호출 안 함', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(false);
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockFetchYoutube).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('만료된 캐시는 미스로 처리한다', async () => {
    mockFindUnique.mockResolvedValueOnce({
      videos: [{ videoId: 'old', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }],
      itemCount: 1,
      expiresAt: new Date(Date.now() - 1000),
    });
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchYoutube.mockResolvedValueOnce([
      { videoId: 'new', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
      { videoId: 'new2', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
    ]);
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out.map((v) => v.videoId)).toEqual(['new', 'new2']);
  });

  it('결과 < 최소건수: itemCount=0으로 negative caching, 빈 배열 반환', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchYoutube.mockResolvedValueOnce([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
    ]);
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ itemCount: 0, videos: [] }),
    }));
  });

  it('동시 호출은 단 한 번만 fetch한다 (in-flight dedup)', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockQuotaTry.mockReturnValue(true);
    mockUpsert.mockResolvedValue({});
    let resolveFetch!: (v: unknown) => void;
    mockFetchYoutube.mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }));

    const [p1, p2] = [
      getOrFetchYoutubeVideos('parking', 'dup', facility),
      getOrFetchYoutubeVideos('parking', 'dup', facility),
    ];
    // findUnique is async — yield microtasks so fetchFromYoutube is reached and resolveFetch is assigned
    await Promise.resolve();
    await Promise.resolve();
    resolveFetch([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
      { videoId: 'b', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
    ]);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(mockFetchYoutube).toHaveBeenCalledTimes(1);
  });
});
