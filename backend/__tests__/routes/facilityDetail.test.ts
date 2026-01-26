// @TASK T1.2 - 시설 상세 조회 API 테스트
// @SPEC docs/planning/02-trd.md#API-설계

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

describe('GET /api/facilities/:category/:id', () => {
  const testFacility = {
    id: 'toilet-detail-test',
    category: 'toilet' as const,
    name: '상세 테스트 화장실',
    address: '서울시 강남구 테스트로 100',
    roadAddress: '서울시 강남구 테스트로 100',
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    sourceId: 'detail-test-1',
    details: {
      operatingHours: '00:00~24:00',
      femaleToilets: 5,
      maleToilets: 3,
      disabledToilet: true,
      emergencyBell: true,
    },
    viewCount: 10,
  };

  beforeAll(async () => {
    await prisma.facility.create({ data: testFacility });
  });

  afterAll(async () => {
    await prisma.facility.delete({ where: { id: testFacility.id } });
    await prisma.$disconnect();
  });

  it('시설 상세 정보 반환', async () => {
    const res = await request(app).get('/api/facilities/toilet/toilet-detail-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('toilet-detail-test');
    expect(res.body.data.name).toBe('상세 테스트 화장실');
    expect(res.body.data.details).toHaveProperty('operatingHours');
    expect(res.body.data.details.femaleToilets).toBe(5);
  });

  it('조회수 증가', async () => {
    const before = await prisma.facility.findUnique({ where: { id: testFacility.id } });

    await request(app).get('/api/facilities/toilet/toilet-detail-test');

    // 비동기 조회수 업데이트를 기다림
    await new Promise((resolve) => setTimeout(resolve, 100));

    const after = await prisma.facility.findUnique({ where: { id: testFacility.id } });
    expect(after!.viewCount).toBe(before!.viewCount + 1);
  });

  it('존재하지 않는 시설 - 404', async () => {
    const res = await request(app).get('/api/facilities/toilet/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('카테고리 불일치 - 404', async () => {
    const res = await request(app).get('/api/facilities/wifi/toilet-detail-test'); // 실제는 toilet

    expect(res.status).toBe(404);
  });

  it('잘못된 카테고리 - 422', async () => {
    const res = await request(app).get('/api/facilities/invalid-category/some-id');

    expect(res.status).toBe(422);
  });
});
