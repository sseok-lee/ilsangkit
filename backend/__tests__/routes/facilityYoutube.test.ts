import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetOrFetch, mockFindParking } = vi.hoisted(() => ({
  mockGetOrFetch: vi.fn(),
  mockFindParking: vi.fn(),
}));

vi.mock('../../src/services/youtubeCacheService.js', () => ({
  getOrFetchYoutubeVideos: mockGetOrFetch,
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    parking: { findUnique: mockFindParking },
  };
  return { default: prismaClient, prisma: prismaClient };
});

import app from '../../src/app';

describe('GET /api/facilities/:category/:id/youtube', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('정상: { success: true, data: { videos } } 형태로 응답', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetOrFetch.mockResolvedValueOnce([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: 'thumb', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
    ]);

    const res = await request(app).get('/api/facilities/parking/123/youtube');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { videos: [expect.objectContaining({ videoId: 'a' })] } });
  });

  it('시설이 없으면 404', async () => {
    mockFindParking.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/facilities/parking/missing/youtube');
    expect(res.status).toBe(404);
  });

  it('잘못된 category는 422', async () => {
    const res = await request(app).get('/api/facilities/INVALID/1/youtube');
    expect(res.status).toBe(422);
  });

  it('영상이 없으면 빈 배열로 정상 응답', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetOrFetch.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/facilities/parking/123/youtube');
    expect(res.status).toBe(200);
    expect(res.body.data.videos).toEqual([]);
  });
});
