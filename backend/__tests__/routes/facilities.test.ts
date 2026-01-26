// @TASK T1.1 - 시설 검색 API 테스트
// @SPEC docs/planning/02-trd.md#API-설계

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

describe('POST /api/facilities/search', () => {
  beforeAll(async () => {
    // 테스트 데이터 삽입
    await prisma.facility.createMany({
      data: [
        {
          id: 'toilet-test-1',
          category: 'toilet',
          name: '테스트 화장실 1',
          address: '서울시 강남구 테스트로 1',
          lat: 37.5,
          lng: 127.0,
          city: '서울',
          district: '강남구',
          sourceId: 'test-1',
        },
        {
          id: 'toilet-test-2',
          category: 'toilet',
          name: '테스트 화장실 2',
          address: '서울시 강남구 테스트로 2',
          lat: 37.501,
          lng: 127.001,
          city: '서울',
          district: '강남구',
          sourceId: 'test-2',
        },
        {
          id: 'wifi-test-1',
          category: 'wifi',
          name: '테스트 와이파이',
          address: '서울시 서초구 테스트로 3',
          lat: 37.49,
          lng: 127.02,
          city: '서울',
          district: '서초구',
          sourceId: 'test-3',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.facility.deleteMany({
      where: { sourceId: { startsWith: 'test-' } },
    });
    await prisma.$disconnect();
  });

  it('전체 검색 - 페이지네이션', async () => {
    const res = await request(app).post('/api/facilities/search').send({ page: 1, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('items');
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('totalPages');
  });

  it('카테고리 필터', async () => {
    const res = await request(app).post('/api/facilities/search').send({ category: 'toilet' });

    expect(res.status).toBe(200);
    expect(res.body.data.items.every((f: { category: string }) => f.category === 'toilet')).toBe(
      true
    );
  });

  it('키워드 검색', async () => {
    const res = await request(app).post('/api/facilities/search').send({ keyword: '테스트' });

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('위치 기반 검색 (Haversine)', async () => {
    const res = await request(app).post('/api/facilities/search').send({
      lat: 37.5,
      lng: 127.0,
      radius: 2000,
    });

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
    // 거리순 정렬 확인
    if (res.body.data.items.length > 1) {
      expect(res.body.data.items[0].distance).toBeLessThanOrEqual(res.body.data.items[1].distance);
    }
  });

  it('지역 필터', async () => {
    const res = await request(app)
      .post('/api/facilities/search')
      .send({ city: '서울', district: '강남구' });

    expect(res.status).toBe(200);
    expect(
      res.body.data.items.every(
        (f: { city: string; district: string }) => f.city === '서울' && f.district === '강남구'
      )
    ).toBe(true);
  });

  it('유효하지 않은 요청 - 422', async () => {
    const res = await request(app)
      .post('/api/facilities/search')
      .send({ lat: 37.5 }); // lng 없이 lat만

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});
