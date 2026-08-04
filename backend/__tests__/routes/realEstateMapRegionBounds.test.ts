// GET /api/real-estate/:type/map 의 지역(region) 분기가 요청 bbox 를 실제로
// fetchRegions 까지 배선하는지 HTTP 레벨에서 검증한다.
//
// __tests__/routes/realEstateMap.test.ts 는 실제 로컬 DB(supertest + app, prisma 미모킹)를
// 쓰는 통합 테스트라 지역 집계가 로컬 스테일 데이터 때문에 언제나 [] 를 낼 수 있어(주석 참고)
// 서울/부산을 구분하는 단언이 불가능하다. 이 파일은 prisma 를 모킹해 그 배선만 별도로 검증한다.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRawUnsafe: mockQueryRawUnsafe };
  return { prisma, default: prisma };
});

import app from '../../src/app.js';
import { __resetMapCacheForTest } from '../../src/services/realEstateMapService.js';

const SEOUL_ROW = { name: '서울특별시', district: '강남구', lat: '37.5172', lng: '127.0473', avgPricePerPyeong: 5000n, transactionCount: 10n };
const BUSAN_ROW = { name: '부산광역시', district: '서구', lat: '35.0975', lng: '129.0242', avgPricePerPyeong: 3000n, transactionCount: 5n };

const SEOUL_BBOX = { swLat: '37.4', swLng: '126.8', neLat: '37.7', neLng: '127.2' };
const KOREA_BBOX = { swLat: '33', swLng: '124', neLat: '39', neLng: '132' };

describe('GET /api/real-estate/:type/map — region 분기 bbox 배선', () => {
  beforeEach(() => {
    __resetMapCacheForTest();
    mockQueryRawUnsafe.mockReset();
    mockQueryRawUnsafe.mockResolvedValue([SEOUL_ROW, BUSAN_ROW]);
  });

  it('서울 bbox 는 서울 지역만 반환한다 — 부산 구·군이 섞이지 않는다', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 9, ...SEOUL_BBOX });

    expect(res.status).toBe(200);
    const names = (res.body.data.items as Array<{ name: string }>).map((i) => i.name);
    expect(names).toEqual(['서울특별시']);
    expect(names).not.toContain('부산광역시');
  });

  it('total 은 필터된 개수와 같다 — 전국 카운트(251 류)가 아니다', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 9, ...SEOUL_BBOX });

    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.total).toBe(1);
  });

  it('전국(whole-Korea) bbox 는 서울/부산을 모두 포함한다 — SSR 크롤러블 콘텐츠 보존', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 9, ...KOREA_BBOX });

    const names = (res.body.data.items as Array<{ name: string }>).map((i) => i.name).sort();
    expect(names).toEqual(['부산광역시', '서울특별시']);
    expect(res.body.data.total).toBe(2);
  });

  it('서로 다른 bbox 로 두 번 호출해도 DB 쿼리는 한 번만 나간다 (캐시 키는 type:level 뿐)', async () => {
    await request(app).get('/api/real-estate/apt-sale/map').query({ level: 9, ...SEOUL_BBOX });
    await request(app).get('/api/real-estate/apt-sale/map').query({ level: 9, ...KOREA_BBOX });

    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
  });
});
