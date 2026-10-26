// GET /api/facilities/nearby-grouped — 카테고리별 개수 + 가까운 N곳 (부동산 상세 "주변 생활시설")
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { findMany: mockFindMany, count: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const prismaClient = {
    toilet: model, wifi: model, clothes: model, parking: model, aed: model,
    library: model, hospital: model, pharmacy: model, park: model, school: model,
    market: model, childcare: model, evCharger: model, sports: model,
    subwayStation: model, wasteSchedule: model,
    region: { findFirst: vi.fn() },
    $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn(),
  };
  return { default: prismaClient, prisma: prismaClient };
});

import app from '../../src/app';

const URL = '/api/facilities/nearby-grouped';
const CENTER = { lat: 37.5, lng: 127.0 };

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindMany.mockResolvedValue([{ id: 's1', name: '가람초등학교', lat: 37.5, lng: 127.001 }]);
});

describe('GET /api/facilities/nearby-grouped', () => {
  it('카테고리별 count/exact/items 와 radius 를 돌려준다(기본 radius 2000)', async () => {
    const res = await request(app).get(URL).query({ ...CENTER, categories: 'school,park' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.radius).toBe(2000);
    expect(Object.keys(res.body.data.groups)).toEqual(['school', 'park']);
    expect(res.body.data.groups.school).toEqual({
      count: 1,
      exact: true,
      items: [{ id: 's1', name: '가람초등학교', category: 'school', distance: 88 }],
    });
    expect(res.headers['cache-control']).toBe('public, max-age=600, stale-while-revalidate=1800');
  });

  it('limit 기본값은 5', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, name: `공원${i}`, lat: 37.5, lng: 127.0 + i * 0.001 })),
    );
    const res = await request(app).get(URL).query({ ...CENTER, categories: 'park' });

    expect(res.body.data.groups.park.items).toHaveLength(5);
    expect(res.body.data.groups.park.count).toBe(8);
  });

  it('categories 가 없으면 422', async () => {
    const res = await request(app).get(URL).query({ ...CENTER });
    expect(res.status).toBe(422);
  });

  it('알 수 없는 카테고리(ev-charger 포함)는 422', async () => {
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school,unicorn' })).status).toBe(422);
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'ev-charger' })).status).toBe(422);
  });

  it('radius 는 100~2000 만 허용', async () => {
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', radius: 99 })).status).toBe(422);
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', radius: 2001 })).status).toBe(422);
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', radius: 100 })).status).toBe(200);
  });

  it('limit 는 1~10 정수만 허용', async () => {
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', limit: 0 })).status).toBe(422);
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', limit: 11 })).status).toBe(422);
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', limit: 2.5 })).status).toBe(422);
    expect((await request(app).get(URL).query({ ...CENTER, categories: 'school', limit: 10 })).status).toBe(200);
  });

  it('좌표가 한국 영역 밖이면 422', async () => {
    const res = await request(app).get(URL).query({ lat: 10, lng: 100, categories: 'school' });
    expect(res.status).toBe(422);
  });
});
