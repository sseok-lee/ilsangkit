// @TASK T1.4 - 메타 API 테스트
// @SPEC docs/planning/02-trd.md#메타-API

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

describe('GET /api/meta/categories', () => {
  beforeAll(async () => {
    // 테스트 카테고리 데이터 삽입
    await prisma.category.createMany({
      data: [
        { id: 'toilet', name: '공공화장실', icon: '🚻', sortOrder: 1, isActive: true },
        { id: 'trash', name: '쓰레기 배출', icon: '🗑️', sortOrder: 2, isActive: true },
        { id: 'wifi', name: '무료 와이파이', icon: '📶', sortOrder: 3, isActive: true },
        { id: 'inactive', name: '비활성', icon: '❌', sortOrder: 99, isActive: false },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.category.deleteMany({
      where: { id: { in: ['toilet', 'trash', 'wifi', 'inactive'] } },
    });
  });

  it('활성화된 카테고리 목록 반환', async () => {
    const res = await request(app).get('/api/meta/categories');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // 카테고리 구조 확인
    const category = res.body.data[0];
    expect(category).toHaveProperty('id');
    expect(category).toHaveProperty('name');
    expect(category).toHaveProperty('icon');
    expect(category).toHaveProperty('sortOrder');

    // 비활성 카테고리는 제외
    const inactiveCategory = res.body.data.find((c: { id: string }) => c.id === 'inactive');
    expect(inactiveCategory).toBeUndefined();
  });

  it('정렬 순서대로 반환', async () => {
    const res = await request(app).get('/api/meta/categories');

    const orders = res.body.data.map((c: { sortOrder: number }) => c.sortOrder);
    const sorted = [...orders].sort((a: number, b: number) => a - b);
    expect(orders).toEqual(sorted);
  });
});

describe('GET /api/meta/regions', () => {
  beforeAll(async () => {
    // 테스트 지역 데이터 삽입
    await prisma.region.createMany({
      data: [
        { bjdCode: '11010', city: '서울', district: '종로구', slug: 'jongro', lat: 37.5735, lng: 126.979 },
        { bjdCode: '11020', city: '서울', district: '중구', slug: 'jung', lat: 37.5641, lng: 126.998 },
        { bjdCode: '26010', city: '부산', district: '중구', slug: 'jung', lat: 35.1064, lng: 129.033 },
      ],
      skipDuplicates: true,
    });
  });

  afterAll(async () => {
    await prisma.region.deleteMany({
      where: { bjdCode: { in: ['11010', '11020', '26010'] } },
    });
  });

  it('지역 목록 반환', async () => {
    const res = await request(app).get('/api/meta/regions');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);

    // 지역 구조 확인
    const region = res.body.data[0];
    expect(region).toHaveProperty('bjdCode');
    expect(region).toHaveProperty('city');
    expect(region).toHaveProperty('district');
    expect(region).toHaveProperty('slug');
    expect(region).toHaveProperty('lat');
    expect(region).toHaveProperty('lng');

    // lat, lng가 숫자 타입인지 확인
    expect(typeof region.lat).toBe('number');
    expect(typeof region.lng).toBe('number');
  });

  it('city 파라미터로 필터링', async () => {
    const res = await request(app).get('/api/meta/regions?city=서울');

    expect(res.status).toBe(200);
    expect(res.body.data.every((r: { city: string }) => r.city === '서울')).toBe(true);
  });

  it('정렬 순서 확인 (city, district)', async () => {
    const res = await request(app).get('/api/meta/regions');

    // city 기준 정렬 확인
    for (let i = 1; i < res.body.data.length; i++) {
      const prev = res.body.data[i - 1];
      const curr = res.body.data[i];
      // 같은 city 내에서는 district 오름차순
      if (prev.city === curr.city) {
        expect(prev.district.localeCompare(curr.district, 'ko')).toBeLessThanOrEqual(0);
      }
    }
  });
});

describe('GET /api/meta/stats', () => {
  it('시설 통계 반환 (기존 필드 유지)', async () => {
    const res = await request(app).get('/api/meta/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('toilet');
    expect(res.body.data).toHaveProperty('wifi');
    expect(res.body.data).toHaveProperty('clothes');
    expect(res.body.data).toHaveProperty('kiosk');
    expect(res.body.data).toHaveProperty('trash');
    expect(res.body.data).toHaveProperty('parking');
    expect(res.body.data).toHaveProperty('aed');
    expect(res.body.data).toHaveProperty('library');
    expect(res.body.data).toHaveProperty('hospital');
    expect(res.body.data).toHaveProperty('pharmacy');
    expect(res.body.data).toHaveProperty('total');
  });

  it('부동산 거래 통계 포함', async () => {
    const res = await request(app).get('/api/meta/stats');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('realEstate');

    const { realEstate } = res.body.data;
    expect(realEstate).toHaveProperty('aptSale');
    expect(realEstate).toHaveProperty('aptRent');
    expect(realEstate).toHaveProperty('villaSale');
    expect(realEstate).toHaveProperty('villaRent');
    expect(realEstate).toHaveProperty('offitelSale');
    expect(realEstate).toHaveProperty('offitelRent');

    expect(typeof realEstate.aptSale).toBe('number');
    expect(typeof realEstate.aptRent).toBe('number');
    expect(typeof realEstate.villaSale).toBe('number');
    expect(typeof realEstate.villaRent).toBe('number');
    expect(typeof realEstate.offitelSale).toBe('number');
    expect(typeof realEstate.offitelRent).toBe('number');
  });
});

describe('GET /api/health', () => {
  it('헬스체크 응답', async () => {
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');

    // timestamp가 ISO 형식인지 확인
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    // uptime이 숫자인지 확인
    expect(typeof res.body.uptime).toBe('number');
  });
});
