import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { getNearbyByBjd } from '../../src/services/realEstateService.js';

const TEST_BJD = '1144012700';

async function seedSummary(rows: Array<{ buildingName: string; type: string; latestPrice: number; transactionCount?: number }>) {
  for (const r of rows) {
    await prisma.realEstateBuildingSummary.create({
      data: {
        type: r.type,
        buildingName: r.buildingName,
        bjdCode: TEST_BJD,
        city: '서울특별시',
        district: '마포구',
        dongName: '한강로동',
        transactionCount: r.transactionCount ?? 1,
        latestPrice: r.latestPrice,
        latestDealYear: 2026,
        latestDealMonth: 4,
      },
    });
  }
}

describe('getNearbyByBjd', () => {
  beforeAll(async () => { await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } }); });
  afterAll(async () => { await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } }); });
  beforeEach(async () => { await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } }); });

  it('mode=sale → 3개 키(apt/villa/offitel) 반환', async () => {
    await seedSummary([
      { buildingName: 'A아파트', type: 'apt-sale', latestPrice: 1_500_000_000 },
      { buildingName: 'B빌라', type: 'villa-sale', latestPrice: 300_000_000 },
      { buildingName: 'C오피스텔', type: 'offitel-sale', latestPrice: 400_000_000 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'sale', {});
    expect(Object.keys(result).sort()).toEqual(['apt', 'offitel', 'villa']);
    expect(result.apt[0].buildingName).toBe('A아파트');
    expect(result.villa[0].buildingName).toBe('B빌라');
    expect(result.offitel[0].buildingName).toBe('C오피스텔');
  });

  it('mode=rent + rentType=all → rent summary 사용', async () => {
    await seedSummary([{ buildingName: 'A아파트', type: 'apt-rent', latestPrice: 500_000_000 }]);
    const result = await getNearbyByBjd(TEST_BJD, 'rent', { rentType: 'all' });
    expect(result.apt[0].buildingName).toBe('A아파트');
  });

  it('excludeBuildingName으로 자기 자신 제외', async () => {
    await seedSummary([
      { buildingName: '래미안', type: 'apt-sale', latestPrice: 1_000_000_000 },
      { buildingName: '힐스테이트', type: 'apt-sale', latestPrice: 1_200_000_000 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'sale', { excludeBuildingName: '래미안' });
    expect(result.apt.map(c => c.buildingName)).not.toContain('래미안');
    expect(result.apt.map(c => c.buildingName)).toContain('힐스테이트');
  });

  it('limitPerType으로 카테고리별 결과 수 제한', async () => {
    await seedSummary([
      { buildingName: 'A', type: 'apt-sale', latestPrice: 1, transactionCount: 5 },
      { buildingName: 'B', type: 'apt-sale', latestPrice: 1, transactionCount: 4 },
      { buildingName: 'C', type: 'apt-sale', latestPrice: 1, transactionCount: 3 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'sale', { limitPerType: 2 });
    expect(result.apt).toHaveLength(2);
  });

  it('다른 bjdCode 단지는 제외', async () => {
    await seedSummary([{ buildingName: 'In', type: 'apt-sale', latestPrice: 1 }]);
    await prisma.realEstateBuildingSummary.create({
      data: {
        type: 'apt-sale', buildingName: 'Out', bjdCode: '9999999999',
        city: 'x', district: 'y', dongName: 'z',
        transactionCount: 1, latestPrice: 1, latestDealYear: 2026, latestDealMonth: 1,
      },
    });
    try {
      const result = await getNearbyByBjd(TEST_BJD, 'sale', {});
      expect(result.apt.map(c => c.buildingName)).toEqual(['In']);
    } finally {
      await prisma.realEstateBuildingSummary.deleteMany({ where: { buildingName: 'Out' } });
    }
  });
});
