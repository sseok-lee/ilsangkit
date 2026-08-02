// GET /api/facilities/nearby-counts — 주변 시설 개수 요약
//
// 회귀 방지 대상: 부동산 상세 SSR 이 POST /search 의 20건 페이지에서 카테고리를 세어
// 반경 1km 병원 893곳을 "6곳"으로 렌더하던 문제(2026-08). 이 엔드포인트는 페이지 크기와
// 무관하게 실제 개수를 돌려줘야 한다.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

const CENTER = { lat: 37.5, lng: 127.0 };
const SRC = 'nbc-test-';

/** 중심에서 정동쪽 약 70m 간격으로 흩뿌린다 — 모두 반경 300m 안. */
function nearRow(i: number, prefix: string) {
  return {
    id: `${prefix}-${i}`,
    name: `${prefix} ${i}`,
    address: '서울시 강남구 테스트로',
    lat: CENTER.lat,
    lng: CENTER.lng + i * 0.0008, // ≈70m
    city: '서울',
    district: '강남구',
    sourceId: `${SRC}${prefix}-${i}`,
  };
}

describe('GET /api/facilities/nearby-counts', () => {
  beforeAll(async () => {
    // 병원 25곳: 페이지 기본 크기(20)보다 많게 두어 "페이지에서 세기" 회귀를 잡는다
    await prisma.hospital.createMany({ data: Array.from({ length: 25 }, (_, i) => nearRow(i, 'hos')) });
    // 약국 3곳 (hpid 는 Pharmacy 필수 필드)
    await prisma.pharmacy.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({ ...nearRow(i, 'pha'), hpid: `${SRC}hpid-${i}` })),
    });
    // 반경 밖(약 900m 동쪽) 학교 1곳 — 300m 조회에서 빠져야 한다
    await prisma.school.createMany({
      data: [{ ...nearRow(0, 'sch'), lng: CENTER.lng + 0.0102 }],
    });
  });

  afterAll(async () => {
    for (const model of [prisma.hospital, prisma.pharmacy, prisma.school]) {
      await model.deleteMany({ where: { sourceId: { startsWith: SRC } } });
    }
  });

  it('페이지 크기(20)를 넘는 개수도 실제 값으로 센다', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 300, categories: 'hospital,pharmacy' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.counts.hospital.count).toBeGreaterThanOrEqual(25);
    expect(res.body.data.counts.hospital.exact).toBe(true);
    expect(res.body.data.counts.pharmacy.count).toBeGreaterThanOrEqual(3);
  });

  it('반경 밖 시설은 세지 않는다', async () => {
    const near = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 300, categories: 'school' });
    const far = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 2000, categories: 'school' });

    expect(far.body.data.counts.school.count).toBeGreaterThan(near.body.data.counts.school.count);
  });

  it('categories 를 생략하면 전 카테고리 키를 돌려준다', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 300 });

    expect(res.status).toBe(200);
    expect(Object.keys(res.body.data.counts)).toContain('hospital');
    expect(Object.keys(res.body.data.counts)).toContain('toilet');
    // 좌표 없는 trash, 충전기 행 단위인 ev-charger 는 제외 대상
    expect(Object.keys(res.body.data.counts)).not.toContain('trash');
    expect(Object.keys(res.body.data.counts)).not.toContain('ev-charger');
  });

  it('radius 를 생략하면 기본 300m 를 쓴다', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, categories: 'hospital' });

    expect(res.status).toBe(200);
    expect(res.body.data.radius).toBe(300);
  });

  it('요약용 반경 상한(2km)을 넘으면 422 로 막는다', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 5000 });

    expect(res.status).toBe(422);
  });

  it('좌표가 한국 영역 밖이면 422', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: 10, lng: 100, radius: 300 });

    expect(res.status).toBe(422);
  });

  it('알 수 없는 카테고리는 422', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, categories: 'hospital,unicorn' });

    expect(res.status).toBe(422);
  });
});
