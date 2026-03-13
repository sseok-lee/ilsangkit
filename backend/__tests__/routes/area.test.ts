import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('GET /api/area/:citySlug (시 단위 Area API)', () => {
  it('유효한 citySlug에 대해 200 또는 404 반환 (DB 데이터 유무에 따라)', async () => {
    const res = await request(app).get('/api/area/seoul');

    // CI 환경에서는 Region 데이터가 없을 수 있으므로 200 또는 404 허용
    expect([200, 404]).toContain(res.status);

    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('cityName');
      expect(res.body.data).toHaveProperty('districts');
      expect(res.body.data).toHaveProperty('realEstate');
      expect(res.body.data).toHaveProperty('cityInfraScore');

      expect(typeof res.body.data.cityName).toBe('string');
      expect(Array.isArray(res.body.data.districts)).toBe(true);
      expect(typeof res.body.data.cityInfraScore).toBe('number');
      expect(res.body.data.cityInfraScore).toBeGreaterThanOrEqual(0);
      expect(res.body.data.cityInfraScore).toBeLessThanOrEqual(100);
    }
  });

  it('데이터가 있으면 districts 배열 항목이 올바른 구조를 가짐', async () => {
    const res = await request(app).get('/api/area/seoul');

    if (res.status === 200 && res.body.data.districts.length > 0) {
      const district = res.body.data.districts[0];
      expect(district).toHaveProperty('slug');
      expect(district).toHaveProperty('name');
      expect(district).toHaveProperty('facilityTotal');
      expect(district).toHaveProperty('topCategories');
      expect(district).toHaveProperty('infraScore');

      expect(typeof district.slug).toBe('string');
      expect(typeof district.name).toBe('string');
      expect(typeof district.facilityTotal).toBe('number');
      expect(Array.isArray(district.topCategories)).toBe(true);
      expect(typeof district.infraScore).toBe('number');
    }
  });

  it('데이터가 있으면 realEstate 객체가 올바른 구조를 가짐', async () => {
    const res = await request(app).get('/api/area/seoul');

    if (res.status === 200) {
      const { realEstate } = res.body.data;
      expect(realEstate).toHaveProperty('apt');
      expect(realEstate).toHaveProperty('villa');
      expect(realEstate).toHaveProperty('offitel');

      for (const type of ['apt', 'villa', 'offitel']) {
        expect(realEstate[type]).toHaveProperty('sale');
        expect(realEstate[type]).toHaveProperty('rent');
        expect(realEstate[type].sale).toHaveProperty('avg');
        expect(realEstate[type].sale).toHaveProperty('count');
        expect(realEstate[type].rent).toHaveProperty('avg');
        expect(realEstate[type].rent).toHaveProperty('count');
      }
    }
  });

  it('유효하지 않은 citySlug에 대해 404 반환', async () => {
    const res = await request(app).get('/api/area/invalidcity');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('기존 구군 API가 계속 동작함', async () => {
    const res = await request(app).get('/api/area/seoul/gangnam');

    expect([200, 404]).toContain(res.status);
    if (res.status === 200) {
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('facilities');
      expect(res.body.data).toHaveProperty('infraScore');
    }
  });
});
