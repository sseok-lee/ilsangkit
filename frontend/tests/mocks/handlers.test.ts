// @TASK T0.5.3 - MSW 핸들러 테스트
// @SPEC docs/planning/02-trd.md#계약-정의
// @TEST tests/mocks/handlers.test.ts

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { setupServer } from 'msw/node';
import { facilityHandlers } from '../../mocks/handlers/facilities';

const server = setupServer(...facilityHandlers);

describe('MSW Facility Handlers', () => {
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  afterAll(() => server.close());
  afterEach(() => server.resetHandlers());

  const API_BASE = 'http://localhost:8000';

  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const response = await fetch(`${API_BASE}/api/health`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('status', 'ok');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
    });
  });

  describe('GET /api/meta/categories', () => {
    it('should return active categories', async () => {
      const response = await fetch(`${API_BASE}/api/meta/categories`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      const category = data.data[0];
      expect(category).toHaveProperty('id');
      expect(category).toHaveProperty('name');
      expect(category).toHaveProperty('icon');
      expect(category.isActive).toBe(true);
    });
  });

  describe('GET /api/meta/regions', () => {
    it('should return regions list', async () => {
      const response = await fetch(`${API_BASE}/api/meta/regions`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeGreaterThan(0);

      const region = data.data[0];
      expect(region).toHaveProperty('id');
      expect(region).toHaveProperty('bjdCode');
      expect(region).toHaveProperty('city');
      expect(region).toHaveProperty('district');
      expect(region).toHaveProperty('slug');
      expect(region).toHaveProperty('lat');
      expect(region).toHaveProperty('lng');
    });
  });

  describe('POST /api/facilities/search', () => {
    it('should return all facilities without filters', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('items');
      expect(data.data).toHaveProperty('total');
      expect(data.data).toHaveProperty('page');
      expect(data.data).toHaveProperty('totalPages');
      expect(Array.isArray(data.data.items)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: 'toilet' }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items.every((f: any) => f.category === 'toilet')).toBe(true);
    });

    it('should paginate results', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: 1, limit: 5 }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.page).toBe(1);
      expect(data.data.items.length).toBeLessThanOrEqual(5);
    });

    it('should filter by location and radius', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: 37.4979,
          lng: 127.0276,
          radius: 300,
        }),
      });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.items.every((f: any) => f.distance <= 300)).toBe(true);
    });
  });

  describe('GET /api/facilities/:category/:id', () => {
    it('should return facility details', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/toilet/toilet-1`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.id).toBe('toilet-1');
      expect(data.data.category).toBe('toilet');
      expect(data.data).toHaveProperty('details');
      expect(data.data).toHaveProperty('viewCount');
      expect(data.data).toHaveProperty('createdAt');
      expect(data.data).toHaveProperty('updatedAt');
    });

    it('should return 404 for non-existent facility', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/toilet/non-existent`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for wrong category', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/wifi/toilet-1`);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
    });
  });

  describe('GET /api/facilities/region/:city/:district/:category', () => {
    it('should return facilities by region and category', async () => {
      const response = await fetch(
        `${API_BASE}/api/facilities/region/서울/강남구/toilet`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data.region).toEqual({ city: '서울', district: '강남구' });
      expect(data.data.category).toBe('toilet');
      expect(Array.isArray(data.data.items)).toBe(true);
      expect(
        data.data.items.every(
          (f: any) => f.city === '서울' && f.district === '강남구' && f.category === 'toilet'
        )
      ).toBe(true);
    });
  });

  describe('GET /api/facilities/popular', () => {
    it('should return popular facilities', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/popular?limit=5`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(5);
    });

    it('should filter popular facilities by category', async () => {
      const response = await fetch(
        `${API_BASE}/api/facilities/popular?category=toilet&limit=3`
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.data.every((f: any) => f.category === 'toilet')).toBe(true);
      expect(data.data.length).toBeLessThanOrEqual(3);
    });
  });

  describe('GET /api/facilities/stats', () => {
    it('should return facility statistics', async () => {
      const response = await fetch(`${API_BASE}/api/facilities/stats`);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('total');
      expect(data.data).toHaveProperty('byCategory');
      expect(data.data).toHaveProperty('lastUpdated');
      expect(Array.isArray(data.data.byCategory)).toBe(true);

      const categoryStat = data.data.byCategory[0];
      expect(categoryStat).toHaveProperty('category');
      expect(categoryStat).toHaveProperty('count');
    });
  });
});
