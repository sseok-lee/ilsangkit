// @TASK T1.2 - 시설 상세 조회 API 테스트
// @SPEC docs/planning/02-trd.md#API-설계

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

describe('GET /api/facilities/:category/:id', () => {
  const testToilet = {
    id: 'toilet-detail-test',
    name: '상세 테스트 화장실',
    address: '서울시 강남구 테스트로 100',
    roadAddress: '서울시 강남구 테스트로 100',
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    sourceId: 'detail-test-1',
    // Toilet 전용 필드 (flat)
    operatingHours: '00:00~24:00',
    femaleToilets: 5,
    maleToilets: 3,
    maleUrinals: 2,
    hasDisabledToilet: true,
    viewCount: 10,
  };

  beforeAll(async () => {
    await prisma.toilet.create({ data: testToilet });
  });

  afterAll(async () => {
    await prisma.toilet.delete({ where: { id: testToilet.id } });
    await prisma.$disconnect();
  });

  it('시설 상세 정보 반환', async () => {
    const res = await request(app).get('/api/facilities/toilet/toilet-detail-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('toilet-detail-test');
    expect(res.body.data.name).toBe('상세 테스트 화장실');
    // Toilet 전용 필드 확인 (flat 또는 details 객체로 변환됨)
    expect(res.body.data.operatingHours || res.body.data.details?.operatingHours).toBe('00:00~24:00');
  });

  it('조회수 증가', async () => {
    // 이전 테스트의 비동기 조회수 업데이트가 완료될 때까지 대기
    await new Promise((resolve) => setTimeout(resolve, 150));
    const before = await prisma.toilet.findUnique({ where: { id: testToilet.id } });

    await request(app).get('/api/facilities/toilet/toilet-detail-test');

    // 비동기 조회수 업데이트를 기다림
    await new Promise((resolve) => setTimeout(resolve, 100));

    const after = await prisma.toilet.findUnique({ where: { id: testToilet.id } });
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

describe('GET /api/facilities/hospital/:id', () => {
  const testHospital = {
    id: 'hospital-detail-test',
    name: '상세 테스트 병원',
    address: '서울시 강남구 테스트로 200',
    roadAddress: '서울시 강남구 테스트로 200',
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    sourceId: 'detail-test-h1',
    phone: '02-1234-5678',
    clCdNm: '의원',
    drTotCnt: 5,
    viewCount: 10,
  };

  beforeAll(async () => {
    await prisma.hospital.create({ data: testHospital });
  });

  afterAll(async () => {
    await prisma.hospital.delete({ where: { id: testHospital.id } });
    await prisma.$disconnect();
  });

  it('병원 상세 정보 반환', async () => {
    const res = await request(app).get('/api/facilities/hospital/hospital-detail-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('hospital-detail-test');
    expect(res.body.data.name).toBe('상세 테스트 병원');
    expect(res.body.data.details?.clCdNm).toBe('의원');
  });

  it('조회수 증가', async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const before = await prisma.hospital.findUnique({ where: { id: testHospital.id } });

    await request(app).get('/api/facilities/hospital/hospital-detail-test');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const after = await prisma.hospital.findUnique({ where: { id: testHospital.id } });
    expect(after!.viewCount).toBe(before!.viewCount + 1);
  });

  it('존재하지 않는 병원 - 404', async () => {
    const res = await request(app).get('/api/facilities/hospital/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /api/facilities/pharmacy/:id', () => {
  const testPharmacy = {
    id: 'pharmacy-detail-test',
    name: '상세 테스트 약국',
    address: '서울시 강남구 테스트로 300',
    roadAddress: '서울시 강남구 테스트로 300',
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    sourceId: 'detail-test-p1',
    phone: '02-9876-5432',
    hpid: 'PHARM-TEST-001',
    dutyTime1s: '0900',
    dutyTime1c: '1800',
    viewCount: 5,
  };

  beforeAll(async () => {
    await prisma.pharmacy.create({ data: testPharmacy });
  });

  afterAll(async () => {
    await prisma.pharmacy.delete({ where: { id: testPharmacy.id } });
    await prisma.$disconnect();
  });

  it('약국 상세 정보 반환', async () => {
    const res = await request(app).get('/api/facilities/pharmacy/pharmacy-detail-test');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe('pharmacy-detail-test');
    expect(res.body.data.details?.phone).toBe('02-9876-5432');
    expect(res.body.data.details?.dutyTime1s).toBe('0900');
  });

  it('조회수 증가', async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
    const before = await prisma.pharmacy.findUnique({ where: { id: testPharmacy.id } });

    await request(app).get('/api/facilities/pharmacy/pharmacy-detail-test');

    await new Promise((resolve) => setTimeout(resolve, 100));

    const after = await prisma.pharmacy.findUnique({ where: { id: testPharmacy.id } });
    expect(after!.viewCount).toBe(before!.viewCount + 1);
  });

  it('존재하지 않는 약국 - 404', async () => {
    const res = await request(app).get('/api/facilities/pharmacy/non-existent-id');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
