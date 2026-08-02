// GET /api/facilities/nearby-counts — 주변 시설 개수 요약
//
// 회귀 방지 대상: 부동산 상세 SSR 이 POST /search 의 20건 페이지에서 카테고리를 세어
// 반경 1km 병원 893곳을 "6곳"으로 렌더하던 문제(2026-08). 이 엔드포인트는 페이지 크기와
// 무관하게 실제 개수를 돌려줘야 한다.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/lib/prisma';

// 서해 한복판. 실제 시설 데이터가 없는 좌표를 일부러 쓴다.
//
// 처음엔 (37.5, 127.0) = 강남 근처로 잡았다가 CI 에서만 깨졌다. 로컬 개발 DB 에는 실제
// 시설이 동기화돼 있어 주변 병원이 같이 세어져 통과했고, CI 는 prisma db push 만 한 빈 DB 라
// 시드한 행만 잡혔다. 좌표를 빈 바다로 옮기면 양쪽에서 개수가 결정적이라 정확값으로 단언할 수 있다.
const CENTER = { lat: 36.0, lng: 125.0 };
const SRC = 'nbc-test-';

// 이 위도에서 경도 0.0001° ≈ 8.9m (111km × cos36°).
const LNG_DEG_PER_M = 1 / (111_000 * Math.cos((36 * Math.PI) / 180));

/** 중심에서 정동쪽으로 약 9m 간격 — 24번째도 약 215m 라 반경 300m 안에 전부 들어온다. */
function nearRow(i: number, prefix: string) {
  return {
    id: `${prefix}-${i}`,
    name: `${prefix} ${i}`,
    address: '테스트 주소',
    lat: CENTER.lat,
    lng: CENTER.lng + i * 0.0001,
    city: '테스트시',
    district: '테스트구',
    sourceId: `${SRC}${prefix}-${i}`,
  };
}

/** 중심에서 정동쪽 약 900m — 300m 밖, 2000m 안. */
const FAR_LNG = CENTER.lng + 900 * LNG_DEG_PER_M;

describe('GET /api/facilities/nearby-counts', () => {
  beforeAll(async () => {
    // 병원 25곳: 페이지 기본 크기(20)보다 많게 두어 "페이지에서 세기" 회귀를 잡는다
    await prisma.hospital.createMany({ data: Array.from({ length: 25 }, (_, i) => nearRow(i, 'hos')) });
    // 약국 3곳 (hpid 는 Pharmacy 필수 필드)
    await prisma.pharmacy.createMany({
      data: Array.from({ length: 3 }, (_, i) => ({ ...nearRow(i, 'pha'), hpid: `${SRC}hpid-${i}` })),
    });
    // 학교 2곳: 중심 근처 1곳 + 약 900m 밖 1곳 → 반경 필터가 실제로 걸리는지 본다
    await prisma.school.createMany({
      data: [nearRow(0, 'sch'), { ...nearRow(1, 'sch'), lng: FAR_LNG }],
    });
  });

  afterAll(async () => {
    for (const model of [prisma.hospital, prisma.pharmacy, prisma.school]) {
      await model.deleteMany({ where: { sourceId: { startsWith: SRC } } });
    }
  });

  it('페이지 크기(20)를 넘는 개수도 실제 값으로 센다', async () => {
    // 이 단언이 회귀 가드의 핵심 — 구 구현은 목록 20건에서 세어 25 를 20 이하로 잘랐다.
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 300, categories: 'hospital,pharmacy' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.counts.hospital).toEqual({ count: 25, exact: true });
    expect(res.body.data.counts.pharmacy).toEqual({ count: 3, exact: true });
  });

  it('반경 밖 시설은 세지 않는다', async () => {
    // 학교는 근처 1곳 + 900m 밖 1곳을 심었다.
    const near = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 300, categories: 'school' });
    const far = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: CENTER.lat, lng: CENTER.lng, radius: 2000, categories: 'school' });

    expect(near.body.data.counts.school.count).toBe(1);
    expect(far.body.data.counts.school.count).toBe(2);
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
