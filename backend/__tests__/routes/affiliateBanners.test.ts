import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { mockGetRandomAffiliateBanner } = vi.hoisted(() => ({
  mockGetRandomAffiliateBanner: vi.fn(),
}));

vi.mock('../../src/services/publicAffiliateBannerService.js', () => ({
  getRandomAffiliateBanner: mockGetRandomAffiliateBanner,
}));

import app from '../../src/app.js';

const publicBanner = {
  id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
  provider: 'coupang',
  imageUrl: 'https://images.example.com/banner.png',
  targetUrl: 'https://example.com/go?a=%2B&a=2+b',
  altText: '여름 준비',
  disclosureText: '쿠팡 기본 문구',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetRandomAffiliateBanner.mockResolvedValue(publicBanner);
});

describe('GET /api/affiliate-banners/random', () => {
  it('returns a no-store public banner response without admin authentication', async () => {
    const res = await request(app).get('/api/affiliate-banners/random');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ success: true, data: publicBanner });
    expect(mockGetRandomAffiliateBanner).toHaveBeenCalledTimes(1);
  });

  it('returns null when there is no valid public banner candidate', async () => {
    mockGetRandomAffiliateBanner.mockResolvedValue(null);

    const res = await request(app).get('/api/affiliate-banners/random');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: null });
  });
});
