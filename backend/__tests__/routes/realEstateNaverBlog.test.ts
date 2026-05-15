import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetRealEstate, mockGetBuilding } = vi.hoisted(() => ({
  mockGetRealEstate: vi.fn(),
  mockGetBuilding: vi.fn(),
}));

vi.mock('../../src/services/naverBlogCacheService.js', () => ({
  getOrFetchNaverBlogForFacility: vi.fn(),
  getOrFetchNaverBlogForRealEstate: mockGetRealEstate,
}));

vi.mock('../../src/services/realEstateService.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/realEstateService.js')>(
    '../../src/services/realEstateService.js',
  );
  return { ...actual, getBuildingInfo: mockGetBuilding };
});

import app from '../../src/app.js';

describe('GET /api/real-estate/:type/:city/:district/:buildingName/naver-blog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('정상 응답', async () => {
    mockGetBuilding.mockResolvedValueOnce({ buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' });
    mockGetRealEstate.mockResolvedValueOnce([
      { url: 'u', title: 't', description: 'd'.repeat(40), bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101' },
    ]);
    const res = await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/롯데캐슬 골드/naver-blog');
    expect(res.status).toBe(200);
    expect(res.body.data.posts[0].url).toBe('u');
  });

  it('단지 미존재 404', async () => {
    mockGetBuilding.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/없는단지/naver-blog');
    expect(res.status).toBe(404);
  });

  it('잘못된 type 422', async () => {
    const res = await request(app).get('/api/real-estate/BAD/서울특별시/종로구/롯데캐슬/naver-blog');
    expect(res.status).toBe(422);
  });

  it('빈 배열', async () => {
    mockGetBuilding.mockResolvedValueOnce({ buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' });
    mockGetRealEstate.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/롯데캐슬 골드/naver-blog');
    expect(res.body.data.posts).toEqual([]);
  });

  it('?ssr=1 cache-only 전달', async () => {
    mockGetBuilding.mockResolvedValueOnce({ buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' });
    mockGetRealEstate.mockResolvedValueOnce([]);
    await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/롯데캐슬 골드/naver-blog?ssr=1');
    expect(mockGetRealEstate).toHaveBeenCalledWith(
      'apt-sale',
      expect.stringContaining('서울특별시|종로구|롯데캐슬 골드'),
      expect.any(Object),
      { cacheOnly: true },
    );
  });
});
