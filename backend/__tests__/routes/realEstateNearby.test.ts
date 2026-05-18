import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/lib/prisma.js';

const TEST_BJD = '1144012799';

describe('GET /api/real-estate/nearby', () => {
  beforeAll(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
    await prisma.realEstateBuildingSummary.createMany({
      data: [
        { type: 'apt-sale', buildingName: 'A아파트', bjdCode: TEST_BJD, city: '서울특별시', district: '마포구', dongName: '한강로동', transactionCount: 5, latestPrice: 1_500_000_000, latestDealYear: 2026, latestDealMonth: 4 },
        { type: 'villa-sale', buildingName: 'B빌라', bjdCode: TEST_BJD, city: '서울특별시', district: '마포구', dongName: '한강로동', transactionCount: 2, latestPrice: 300_000_000, latestDealYear: 2026, latestDealMonth: 3 },
      ],
    });
  });
  afterAll(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
  });

  it('필수 파라미터 없으면 422', async () => {
    const res = await request(app).get('/api/real-estate/nearby');
    expect(res.status).toBe(422);
  });

  it('정상 응답 — apt/villa/offitel 3개 키 포함', async () => {
    const res = await request(app)
      .get('/api/real-estate/nearby')
      .query({ bjdCode: TEST_BJD, mode: 'sale' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(['apt', 'offitel', 'villa']);
    expect(res.body.data.apt[0].buildingName).toBe('A아파트');
    expect(res.body.data.villa[0].buildingName).toBe('B빌라');
    expect(res.body.data.offitel).toEqual([]);
  });

  it('excludeBuildingName 동작', async () => {
    const res = await request(app)
      .get('/api/real-estate/nearby')
      .query({ bjdCode: TEST_BJD, mode: 'sale', excludeBuildingName: 'A아파트' });
    expect(res.status).toBe(200);
    expect(res.body.data.apt).toEqual([]);
  });
});
