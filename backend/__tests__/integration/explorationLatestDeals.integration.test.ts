import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import {
  getLatestDeals,
  latestDealsKey,
} from '../../src/services/realEstateLatestDeals.js';
import type { BuildingKey, PropertyType } from '../../src/types/realEstateExploration.js';

const PREFIX = `t1-${Date.now().toString(36)}-`;
const BJD = '11680';
const OTHER_BJD = '11710';
const FIXED_NOW = new Date('2026-09-22T03:00:00.000Z');
const properties: PropertyType[] = ['apt', 'villa', 'offitel'];

const modelByProperty = {
  apt: {
    sale: prisma.aptSaleTransaction,
    rent: prisma.aptRentTransaction,
  },
  villa: {
    sale: prisma.villaSaleTransaction,
    rent: prisma.villaRentTransaction,
  },
  offitel: {
    sale: prisma.offitelSaleTransaction,
    rent: prisma.offitelRentTransaction,
  },
} as const;

describe('exploration latest deals live MySQL integration', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    await cleanupFixtures();
    await seedFixtures();
  });

  afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      vi.useRealTimers();
      await prisma.$disconnect();
    }
  });

  it('returns latest sale, jeonse, and wolse from the same source rows across all property types', async () => {
    const keys = properties.flatMap((propertyType) => [
      buildingKey(propertyType),
      { propertyType, buildingName: `${PREFIX}${propertyType}-empty`, bjdCode: BJD },
    ]);

    const result = await getLatestDeals(keys, 'all');

    for (const propertyType of properties) {
      const bundle = result.get(latestDealsKey(buildingKey(propertyType)));
      expect(bundle?.sale).toMatchObject({
        kind: 'sale',
        amount: 125000,
        deposit: null,
        monthlyRent: null,
        exclusiveArea: null,
        floor: 12,
        dealYear: 2026,
        dealMonth: 9,
        dealDay: 20,
      });
      expect(bundle?.jeonse).toMatchObject({
        kind: 'jeonse',
        amount: null,
        deposit: 70000,
        monthlyRent: null,
        exclusiveArea: 59.98,
        floor: 4,
        dealYear: 2026,
        dealMonth: 9,
        dealDay: 19,
      });
      expect(bundle?.wolse).toMatchObject({
        kind: 'wolse',
        amount: null,
        deposit: 0,
        monthlyRent: 120,
        exclusiveArea: 49.5,
        floor: 5,
        dealYear: 2026,
        dealMonth: 9,
        dealDay: null,
      });
      expect(result.get(latestDealsKey({
        propertyType,
        buildingName: `${PREFIX}${propertyType}-empty`,
        bjdCode: BJD,
      }))).toEqual({ sale: null, jeonse: null, wolse: null });
    }
  });

  it('keeps same-name buildings isolated by bjdCode and honors sale/rent scopes', async () => {
    const key = buildingKey('apt');
    const otherBjdKey: BuildingKey = {
      propertyType: 'apt',
      buildingName: key.buildingName,
      bjdCode: OTHER_BJD,
    };

    const saleOnly = await getLatestDeals([key, otherBjdKey], 'sale');
    expect(saleOnly.get(latestDealsKey(key))?.sale?.amount).toBe(125000);
    expect(saleOnly.get(latestDealsKey(key))?.jeonse).toBeNull();
    expect(saleOnly.get(latestDealsKey(otherBjdKey))?.sale?.amount).toBe(990000);

    const rentOnly = await getLatestDeals([key], 'rent');
    expect(rentOnly.get(latestDealsKey(key))?.sale).toBeNull();
    expect(rentOnly.get(latestDealsKey(key))?.jeonse?.deposit).toBe(70000);
    expect(rentOnly.get(latestDealsKey(key))?.wolse?.monthlyRent).toBe(120);
  });
});

async function seedFixtures(): Promise<void> {
  for (const propertyType of properties) {
    await seedSaleRows(propertyType);
    await seedRentRows(propertyType);
  }
}

async function seedSaleRows(propertyType: PropertyType): Promise<void> {
  const model = modelByProperty[propertyType].sale;
  const key = buildingKey(propertyType);

  await model.create({
    data: saleData(propertyType, `${propertyType}-older`, key.buildingName, key.bjdCode, 2026, 9, 20, 125000n, 3, new Prisma.Decimal('84.92')),
  } as never);
  await model.create({
    data: saleData(propertyType, `${propertyType}-latest`, key.buildingName, key.bjdCode, 2026, 9, 20, 125000n, 12, null),
  } as never);
  await model.create({
    data: {
      ...saleData(propertyType, `${propertyType}-canceled`, key.buildingName, key.bjdCode, 2026, 9, 21, 999999n, 30, new Prisma.Decimal('100.00')),
      cancelDealType: '해제',
    },
  } as never);
  await model.create({
    data: saleData(propertyType, `${propertyType}-future`, key.buildingName, key.bjdCode, 2026, 10, 1, 888888n, 29, new Prisma.Decimal('100.00')),
  } as never);
  await model.create({
    data: saleData(propertyType, `${propertyType}-invalid`, key.buildingName, key.bjdCode, 2026, 9, 31, 777777n, 28, new Prisma.Decimal('100.00')),
  } as never);
  await model.create({
    data: saleData(propertyType, `${propertyType}-other-bjd`, key.buildingName, OTHER_BJD, 2026, 9, 21, 990000n, 27, new Prisma.Decimal('101.00')),
  } as never);
}

async function seedRentRows(propertyType: PropertyType): Promise<void> {
  const model = modelByProperty[propertyType].rent;
  const key = buildingKey(propertyType);

  await model.create({
    data: rentData(propertyType, `${propertyType}-jeonse`, key.buildingName, key.bjdCode, '전세', 2026, 9, 19, 70000n, null, 4, new Prisma.Decimal('59.98')),
  } as never);
  await model.create({
    data: rentData(propertyType, `${propertyType}-jeonse-future`, key.buildingName, key.bjdCode, '전세', 2026, 10, 1, 999999n, null, 9, new Prisma.Decimal('59.98')),
  } as never);
  await model.create({
    data: rentData(propertyType, `${propertyType}-wolse`, key.buildingName, key.bjdCode, '월세', 2026, 9, null, 0n, 120, 5, new Prisma.Decimal('49.50')),
  } as never);
  await model.create({
    data: rentData(propertyType, `${propertyType}-wolse-null-rent`, key.buildingName, key.bjdCode, '월세', 2026, 9, 20, 10000n, null, 8, new Prisma.Decimal('49.50')),
  } as never);
  await model.create({
    data: rentData(propertyType, `${propertyType}-rent-invalid`, key.buildingName, key.bjdCode, '전세', 2026, 9, 31, 999999n, null, 10, new Prisma.Decimal('59.98')),
  } as never);
}

async function cleanupFixtures(): Promise<void> {
  await Promise.all([
    prisma.aptSaleTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.villaSaleTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.offitelSaleTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.aptRentTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.villaRentTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.offitelRentTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
  ]);
}

function buildingKey(propertyType: PropertyType): BuildingKey {
  return {
    propertyType,
    buildingName: `${PREFIX}${propertyType}-building`,
    bjdCode: BJD,
  };
}

function saleData(
  propertyType: PropertyType,
  sourceSuffix: string,
  buildingName: string,
  bjdCode: string,
  dealYear: number,
  dealMonth: number,
  dealDay: number | null,
  dealAmount: bigint,
  floor: number,
  exclusiveArea: Prisma.Decimal | null,
): Record<string, unknown> {
  return {
    city: '서울특별시',
    district: '강남구',
    bjdCode,
    dongName: '역삼동',
    buildingName,
    buildYear: 2010,
    floor,
    exclusiveArea,
    jibun: '1',
    roadName: '테헤란로',
    lat: new Prisma.Decimal('37.5000000'),
    lng: new Prisma.Decimal('127.0000000'),
    dealYear,
    dealMonth,
    dealDay,
    dealAmount,
    dealType: '중개거래',
    cancelDealDay: null,
    cancelDealType: null,
    buyerType: null,
    sellerType: null,
    sourceId: `${PREFIX}${sourceSuffix}`,
    ...(propertyType === 'apt' ? { aptDong: null, registrationDate: null } : {}),
    ...(propertyType === 'villa' ? { houseType: '연립다세대', registrationDate: null } : {}),
  };
}

function rentData(
  propertyType: PropertyType,
  sourceSuffix: string,
  buildingName: string,
  bjdCode: string,
  rentType: '전세' | '월세',
  dealYear: number,
  dealMonth: number,
  dealDay: number | null,
  deposit: bigint,
  monthlyRent: number | null,
  floor: number,
  exclusiveArea: Prisma.Decimal | null,
): Record<string, unknown> {
  return {
    city: '서울특별시',
    district: '강남구',
    bjdCode,
    dongName: '역삼동',
    buildingName,
    buildYear: 2010,
    floor,
    exclusiveArea,
    jibun: '1',
    roadName: '테헤란로',
    lat: new Prisma.Decimal('37.5000000'),
    lng: new Prisma.Decimal('127.0000000'),
    dealYear,
    dealMonth,
    dealDay,
    rentType,
    deposit,
    monthlyRent,
    contractTerm: null,
    contractType: null,
    preDeposit: null,
    preMonthlyRent: null,
    useRenewalRight: null,
    sourceId: `${PREFIX}${sourceSuffix}`,
    ...(propertyType === 'villa' ? { houseType: '연립다세대' } : {}),
  };
}
