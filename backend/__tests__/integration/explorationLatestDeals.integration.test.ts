import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import {
  getLatestDeals,
  LATEST_DEAL_INDEX,
  latestDealsKey,
} from '../../src/services/realEstateLatestDeals.js';
import { kstCalendarToday } from '../../src/lib/kstDate.js';
import { overviewDateThrough, saleNotCanceled } from '../../src/lib/realEstateDealSql.js';
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


describe('exploration latest deals edge cases match the previous ROW_NUMBER() ranking', () => {
  beforeAll(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(FIXED_NOW);
    await cleanupFixtures();
    await seedEdgeFixtures();
  });

  afterAll(async () => {
    try {
      await cleanupFixtures();
    } finally {
      vi.useRealTimers();
      await prisma.$disconnect();
    }
  });

  it('hints only indexes that exist in the pushed schema', async () => {
    for (const [table, indexName] of Object.entries(LATEST_DEAL_INDEX)) {
      const rows = await prisma.$queryRaw<Array<{ columns: string }>>`
        SELECT GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
        FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ${table} AND INDEX_NAME = ${indexName}
      `;
      expect(rows[0]?.columns, `${table}.${indexName}`).toBe('buildingName,bjdCode,dealYear,dealMonth,dealDay');
    }
  });

  it.each(EDGE_CASES.map((edge) => [edge.name, edge] as const))('%s', async (_name, edge) => {
    const key = edgeKey(edge.name, edge.keyJibun);
    const result = (await getLatestDeals([key], 'all')).get(latestDealsKey(key));

    // 옛 구현의 창 함수 SQL 을 그대로 돌린 기준값과 같아야 한다.
    expect(snapshotOf(result)).toEqual(await previousRankingSnapshot(key));
    // 그리고 시나리오가 뜻하는 값(고정 기대값)이어야 한다.
    expect(snapshotOf(result)).toEqual(edge.expected);
  });
});

type EdgeSnapshot = {
  sale: number | null;
  jeonse: number | null;
  wolse: number | null;
};

type EdgeCase = {
  name: string;
  keyJibun: string | null;
  sale: Array<{ day: number | null; month?: number; floor: number; canceled?: boolean; jibun?: string | null }>;
  rent: Array<{ rentType: string; day: number | null; month?: number; floor: number; monthlyRent?: number | null; jibun?: string | null }>;
  // 각 칸은 고른 거래의 floor(시나리오 안에서 거래마다 다르게 둔 식별값)
  expected: EdgeSnapshot;
};

const EDGE_CASES: EdgeCase[] = [
  {
    // 같은 달 일자 NULL 거래보다 일자 있는 거래가 먼저, 일자 NULL 만 있는 최신 달은 그 거래가 최신
    name: 'deal day NULL sorts after known days in the same month',
    keyJibun: '1',
    sale: [{ day: null, floor: 1 }, { day: 5, floor: 2 }, { day: 30, month: 8, floor: 3 }],
    rent: [{ rentType: '전세', day: null, floor: 4 }, { rentType: '전세', day: 30, month: 8, floor: 5 }],
    expected: { sale: 2, jeonse: 4, wolse: null },
  },
  {
    name: 'same-day deals resolve to the highest id',
    keyJibun: '1',
    sale: [{ day: 10, floor: 1 }, { day: 10, floor: 2 }, { day: 10, floor: 3 }],
    rent: [{ rentType: '월세', day: 10, floor: 4, monthlyRent: 50 }, { rentType: '월세', day: 10, floor: 5, monthlyRent: 60 }],
    expected: { sale: 3, jeonse: null, wolse: 5 },
  },
  {
    name: 'canceled latest sale falls back to the previous valid sale',
    keyJibun: '1',
    sale: [{ day: 15, floor: 9, canceled: true }, { day: 1, floor: 1 }],
    rent: [],
    expected: { sale: 1, jeonse: null, wolse: null },
  },
  {
    // utf8mb4_unicode_ci 는 끝 공백을 무시해 '전세 ' 가 '전세' 파티션의 최신이 되지만,
    // 응답 매핑은 정확히 '전세' 만 받으므로 전세 칸은 비어 있다(옛 동작 그대로).
    name: 'trailing-space rent type wins its partition but is not mapped',
    keyJibun: '1',
    sale: [],
    rent: [{ rentType: '전세 ', day: 18, floor: 1 }, { rentType: '전세', day: 1, floor: 2 }],
    expected: { sale: null, jeonse: null, wolse: null },
  },
  {
    name: 'NULL and empty jibun share one address',
    keyJibun: null,
    sale: [{ day: 3, floor: 1, jibun: null }, { day: 9, floor: 2, jibun: '' }],
    rent: [{ rentType: '전세', day: 9, floor: 3, jibun: null }, { rentType: '전세', day: 3, floor: 4, jibun: '' }],
    expected: { sale: 2, jeonse: 3, wolse: null },
  },
  {
    name: 'building without wolse keeps wolse empty',
    keyJibun: '1',
    sale: [],
    rent: [{ rentType: '전세', day: 2, floor: 1 }, { rentType: '월세', day: 3, floor: 2, monthlyRent: null }],
    expected: { sale: null, jeonse: 1, wolse: null },
  },
];

function edgeKey(name: string, jibun: string | null): BuildingKey {
  return {
    propertyType: 'apt',
    buildingName: `${PREFIX}edge-${EDGE_CASES.findIndex((edge) => edge.name === name)}`,
    bjdCode: BJD,
    dongName: '역삼동',
    jibun,
  };
}

async function seedEdgeFixtures(): Promise<void> {
  for (const [index, edge] of EDGE_CASES.entries()) {
    const key = edgeKey(edge.name, edge.keyJibun);
    // 같은 날 동률은 id 로 갈리므로 순서대로 하나씩 넣는다.
    for (const [rowIndex, row] of edge.sale.entries()) {
      await prisma.aptSaleTransaction.create({
        data: {
          ...saleData('apt', `edge-${index}-sale-${rowIndex}`, key.buildingName, key.bjdCode,
            2026, row.month ?? 9, row.day, 100000n + BigInt(row.floor), row.floor, null),
          jibun: row.jibun === undefined ? key.jibun : row.jibun,
          ...(row.canceled ? { cancelDealType: '해제' } : {}),
        },
      } as never);
    }
    for (const [rowIndex, row] of edge.rent.entries()) {
      await prisma.aptRentTransaction.create({
        data: {
          ...rentData('apt', `edge-${index}-rent-${rowIndex}`, key.buildingName, key.bjdCode,
            '전세', 2026, row.month ?? 9, row.day, 10000n + BigInt(row.floor), row.monthlyRent ?? null, row.floor, null),
          rentType: row.rentType,
          jibun: row.jibun === undefined ? key.jibun : row.jibun,
        },
      } as never);
    }
  }
}

function snapshotOf(bundle: { sale: { floor: number | null } | null; jeonse: { floor: number | null } | null; wolse: { floor: number | null } | null } | undefined): EdgeSnapshot {
  return {
    sale: bundle?.sale?.floor ?? null,
    jeonse: bundle?.jeonse?.floor ?? null,
    wolse: bundle?.wolse?.floor ?? null,
  };
}

// 성능 개선 전 realEstateLatestDeals.ts 의 창 함수 SQL(주소형 키 조건) — 결과 동등성의 기준값.
async function previousRankingSnapshot(key: BuildingKey): Promise<EdgeSnapshot> {
  const today = kstCalendarToday().toISOString().slice(0, 10);
  const where = Prisma.sql`(t.bjdCode = ${key.bjdCode} AND t.buildingName = ${key.buildingName}
    AND TRIM(t.dongName) = ${key.dongName?.trim() ?? ''} AND COALESCE(TRIM(t.jibun), '') = ${key.jibun?.trim() ?? ''})`;
  const sale = await prisma.$queryRaw<Array<{ floor: number }>>`
    SELECT floor FROM (
      SELECT t.floor, ROW_NUMBER() OVER (
        PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), '')
        ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
      ) AS rn
      FROM AptSaleTransaction t
      WHERE ${where} AND ${saleNotCanceled('t')} AND t.dealAmount IS NOT NULL AND ${overviewDateThrough(today, 't')}
    ) ranked WHERE rn = 1
  `;
  const rent = await prisma.$queryRaw<Array<{ floor: number; rentType: string }>>`
    SELECT floor, rentType FROM (
      SELECT t.floor, t.rentType, ROW_NUMBER() OVER (
        PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), ''), t.rentType
        ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
      ) AS rn
      FROM AptRentTransaction t
      WHERE ${where}
        AND ((t.rentType = '전세' AND t.deposit IS NOT NULL)
          OR (t.rentType = '월세' AND t.deposit IS NOT NULL AND t.monthlyRent IS NOT NULL))
        AND ${overviewDateThrough(today, 't')}
    ) ranked WHERE rn = 1
  `;
  return {
    sale: sale[0]?.floor ?? null,
    jeonse: rent.find((row) => row.rentType === '전세')?.floor ?? null,
    wolse: rent.find((row) => row.rentType === '월세')?.floor ?? null,
  };
}

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
