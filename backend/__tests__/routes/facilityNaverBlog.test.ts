import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetFacility, mockFindParking } = vi.hoisted(() => ({
  mockGetFacility: vi.fn(),
  mockFindParking: vi.fn(),
}));

vi.mock('../../src/services/naverBlogCacheService.js', () => ({
  getOrFetchNaverBlogForFacility: mockGetFacility,
  getOrFetchNaverBlogForRealEstate: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = { parking: { findUnique: mockFindParking } };
  return { default: prismaClient, prisma: prismaClient };
});

import app from '../../src/app.js';

describe('GET /api/facilities/:category/:id/naver-blog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('정상 응답', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetFacility.mockResolvedValueOnce([
      { url: 'u', title: 't', description: 'd'.repeat(40), bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101' },
    ]);
    const res = await request(app).get('/api/facilities/parking/123/naver-blog');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { posts: [expect.objectContaining({ url: 'u' })] } });
  });

  it('시설 미존재 404', async () => {
    mockFindParking.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/facilities/parking/missing/naver-blog');
    expect(res.status).toBe(404);
  });

  it('잘못된 category 422', async () => {
    const res = await request(app).get('/api/facilities/INVALID/1/naver-blog');
    expect(res.status).toBe(422);
  });

  it('빈 배열', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetFacility.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/facilities/parking/123/naver-blog');
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toEqual([]);
  });

  it('?ssr=1 cache-only 전달', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetFacility.mockResolvedValueOnce([]);
    await request(app).get('/api/facilities/parking/123/naver-blog?ssr=1');
    expect(mockGetFacility).toHaveBeenCalledWith('parking', '123', expect.any(Object), { cacheOnly: true });
  });
});
