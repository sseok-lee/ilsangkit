// @TASK T1.3 - 지역별 조회 API 테스트
// @SPEC docs/planning/02-trd.md#API-설계

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

describe('GET /api/facilities/region/:city/:district/:category', () => {
  beforeAll(async () => {
    // 기존 테스트 데이터 정리
    await prisma.facility.deleteMany({
      where: { sourceId: { startsWith: 'region-' } },
    });
    await prisma.region.deleteMany({
      where: { bjdCode: { in: ['99901', '99902'] } },
    });

    // Region 테스트 데이터 삽입 (테스트용 임시 bjdCode 사용)
    await prisma.region.create({
      data: {
        bjdCode: '99901',
        city: '테스트시',
        district: '테스트구',
        slug: 'testgu',
        lat: 37.5172,
        lng: 127.0473,
      },
    });

    await prisma.region.create({
      data: {
        bjdCode: '99902',
        city: '테스트시',
        district: '테스트2구',
        slug: 'test2gu',
        lat: 37.4837,
        lng: 127.0324,
      },
    });

    // Facility 테스트 데이터 삽입
    await prisma.facility.createMany({
      data: [
        {
          id: 'region-test-1',
          category: 'toilet',
          name: '테스트구 화장실 1',
          address: '테스트시 테스트구 테스트로 1',
          lat: 37.5,
          lng: 127.0,
          city: '테스트시',
          district: '테스트구',
          sourceId: 'region-1',
        },
        {
          id: 'region-test-2',
          category: 'toilet',
          name: '테스트구 화장실 2',
          address: '테스트시 테스트구 테스트로 2',
          lat: 37.501,
          lng: 127.001,
          city: '테스트시',
          district: '테스트구',
          sourceId: 'region-2',
        },
        {
          id: 'region-test-3',
          category: 'wifi',
          name: '테스트2구 와이파이',
          address: '테스트시 테스트2구 테스트로 3',
          lat: 37.49,
          lng: 127.02,
          city: '테스트시',
          district: '테스트2구',
          sourceId: 'region-3',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.facility.deleteMany({
      where: { sourceId: { startsWith: 'region-' } },
    });
    await prisma.region.deleteMany({
      where: { bjdCode: { in: ['99901', '99902'] } },
    });
    await prisma.$disconnect();
  });

  it('지역별 시설 목록 반환', async () => {
    const res = await request(app).get(
      '/api/facilities/region/' + encodeURIComponent('테스트시') + '/' + encodeURIComponent('테스트구') + '/toilet'
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.region.city).toBe('테스트시');
    expect(res.body.data.region.district).toBe('테스트구');
    expect(res.body.data.category).toBe('toilet');
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(
      res.body.data.items.every(
        (f: { city: string; district: string }) => f.city === '테스트시' && f.district === '테스트구'
      )
    ).toBe(true);
  });

  it('slug로 지역 조회 (testgu -> 테스트구)', async () => {
    // Region 테이블에서 slug 변환 지원
    const res = await request(app).get(
      '/api/facilities/region/' + encodeURIComponent('테스트시') + '/testgu/toilet'
    );

    expect(res.status).toBe(200);
    expect(res.body.data.region.city).toBe('테스트시');
    expect(res.body.data.region.district).toBe('테스트구');
  });

  it('페이지네이션', async () => {
    const res = await request(app).get(
      '/api/facilities/region/' + encodeURIComponent('테스트시') + '/' + encodeURIComponent('테스트구') + '/toilet?page=1&limit=1'
    );

    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBe(1);
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.totalPages).toBeGreaterThanOrEqual(2);
  });

  it('빈 결과', async () => {
    const res = await request(app).get(
      '/api/facilities/region/' + encodeURIComponent('테스트시') + '/' + encodeURIComponent('테스트구') + '/kiosk'
    ); // kiosk는 없음

    expect(res.status).toBe(200);
    expect(res.body.data.items).toHaveLength(0);
    expect(res.body.data.total).toBe(0);
  });

  it('잘못된 카테고리 - 422', async () => {
    const res = await request(app).get(
      '/api/facilities/region/' + encodeURIComponent('테스트시') + '/' + encodeURIComponent('테스트구') + '/invalid'
    );

    expect(res.status).toBe(422);
  });
});
