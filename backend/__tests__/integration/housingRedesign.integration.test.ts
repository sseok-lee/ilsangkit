import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Prisma } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { getDetailPage, getDetailSnapshot } from '../../src/services/realEstateDetailService.js';
import { __resetHomeMarketCacheForTest, getHomeMarket } from '../../src/services/homeMarketService.js';
import type { DealMode } from '../../src/types/housingRedesign.js';

const PREFIX = `t12-${Date.now()}-`;
const SEOUL_BJD = '11680';
const NOW = new Date('2026-05-10T03:00:00.000Z');
const artifactDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../../.superpowers/sdd/2026-09-21-housing-redesign/artifacts/task-12');

type CaseKey =
  | 'apt-sale-sale'
  | 'villa-sale-sale'
  | 'offitel-sale-sale'
  | 'apt-rent-jeonse'
  | 'apt-rent-wolse'
  | 'villa-rent-jeonse'
  | 'villa-rent-wolse'
  | 'offitel-rent-jeonse'
  | 'offitel-rent-wolse';

interface FixtureCase {
  type: 'apt-sale' | 'villa-sale' | 'offitel-sale' | 'apt-rent' | 'villa-rent' | 'offitel-rent';
  mode: DealMode;
  buildingName: string;
  expectedIds: number[];
}

interface PerfTruthRow {
  id: number;
  date: string | Date;
  amount: number | bigint;
}

const cases = new Map<CaseKey, FixtureCase>();

beforeAll(async () => {
  await mkdir(artifactDir, { recursive: true });
  await seedRegions();
});

afterAll(async () => {
  await cleanupPrefixedRows();
  await prisma.$disconnect();
});

describe('housing redesign live MySQL integration', () => {
  it('MySQL 8 returns NULL for invalid calendar dates before Prisma-backed services import data', async () => {
    const rows = await prisma.$queryRaw<Array<{ version: string; invalidDate: Date | null; invalidBetween: number }>>`
      SELECT VERSION() AS version,
        STR_TO_DATE('2026-4-31', '%Y-%c-%e') AS invalidDate,
        STR_TO_DATE('2026-4-31', '%Y-%c-%e') BETWEEN '2026-04-11' AND '2026-05-10' AS invalidBetween
    `;

    expect(rows[0].version).toContain('8.0.');
    expect(rows[0].invalidDate).toBeNull();
    expect(Number(rows[0].invalidBetween)).toBe(0);
  });

  it('validates strict dates, exact identity, exact area, cancellation, deposits, addresses, and table pages across all housing modes', async () => {
    await seedNineModeFixtures();

    for (const fixture of cases.values()) {
      const snapshot = await getDetailSnapshot(fixture.type, {
        bjdCode: SEOUL_BJD,
        buildingName: fixture.buildingName,
        mode: fixture.mode,
        months: 6,
        area: '84.90',
        deposit: fixture.mode === 'wolse' ? 0 : undefined,
      }, NOW);

      expect(snapshot.points.map((point) => point.id)).toEqual([...fixture.expectedIds].sort((a, b) => a - b));
      expect(snapshot.table.items.map((row) => row.id)).toEqual([...fixture.expectedIds].sort((a, b) => b - a));
      expect(snapshot.table.total).toBe(fixture.expectedIds.length);
      expect(snapshot.points.every((point) => point.date <= '2026-05-10')).toBe(true);
      expect(snapshot.points.every((point) => point.area === '84.90')).toBe(true);
      if (fixture.mode === 'wolse') {
        expect(snapshot.filters.deposit).toBe(0);
        expect(snapshot.points.every((point) => point.deposit === 0)).toBe(true);
      }
    }

    const overview = await import('../../src/services/realEstateDetailService.js')
      .then((module) => module.getDetailOverview('apt-sale', {
        bjdCode: SEOUL_BJD,
        buildingName: cases.get('apt-sale-sale')!.buildingName,
      }, NOW));
    expect(overview?.addresses).toHaveLength(2);
    expect(overview?.locationAmbiguous).toBe(true);

    const pageBuilding = `${PREFIX}page-building`;
    const pageIds = await seedPagedAptSaleFixture(pageBuilding);
    const snapshot = await getDetailSnapshot('apt-sale', {
      bjdCode: SEOUL_BJD,
      buildingName: pageBuilding,
      mode: 'sale',
      months: 6,
      area: '84.90',
    }, NOW);
    const secondPage = await getDetailPage('apt-sale', {
      bjdCode: SEOUL_BJD,
      buildingName: pageBuilding,
      mode: 'sale',
      months: 6,
      area: '84.90',
      page: 2,
    }, NOW);

    expect(snapshot.points.map((point) => point.id)).toEqual([...pageIds].sort((a, b) => a - b));
    expect([...snapshot.table.items, ...secondPage.items].map((row) => row.id).sort((a, b) => a - b))
      .toEqual([...pageIds].sort((a, b) => a - b));
    expect(snapshot.table.total).toBe(25);
    expect(secondPage.items).toHaveLength(5);
  });

  it('home market uses 30 daily buckets, excludes invalid dates, supports legacy regions, and orders same-day types before ids', async () => {
    __resetHomeMarketCacheForTest();
    const homeSale = (sourceId: string, buildingName: string, area: number, year: number, month: number, day: number | null, amount: bigint) => ({
      ...saleData(sourceId, buildingName, area, year, month, day, amount),
      district: '검증구',
      bjdCode: '11999',
    });
    const apt = await prisma.aptSaleTransaction.create({ data: homeSale(`${PREFIX}home-apt`, `${PREFIX}home-apt`, 84.90, 2026, 5, 10, 70000n) });
    const offitel = await prisma.offitelSaleTransaction.create({ data: homeSale(`${PREFIX}home-offitel`, `${PREFIX}home-offitel`, 84.90, 2026, 5, 10, 71000n) });
    const villa = await prisma.villaSaleTransaction.create({ data: { ...homeSale(`${PREFIX}home-villa`, `${PREFIX}home-villa`, 84.90, 2026, 5, 10, 72000n), houseType: '연립다세대' } });
    await prisma.aptSaleTransaction.create({ data: homeSale(`${PREFIX}home-invalid`, `${PREFIX}home-invalid`, 84.90, 2026, 4, 31, 999999n) });

    const market = await getHomeMarket({ city: 'seoul', district: 'task12' }, NOW);

    expect(market.window).toEqual({ from: '2026-04-11', to: '2026-05-10' });
    expect(market.counts.apt.status).toBe('ok');
    expect(market.counts.apt.data?.daily).toHaveLength(30);
    expect(market.counts.apt.data?.daily.find((day) => day.date === '2026-05-10')?.count).toBeGreaterThanOrEqual(1);
    expect(market.counts.apt.data?.daily.find((day) => day.date === '2026-04-30')?.count ?? 0).toBe(0);
    expect(market.recent.status).toBe('ok');
    expect(market.recent.data?.slice(0, 3).map((row) => `${row.type}:${row.transactionId}`)).toEqual([
      `apt:${apt.id}`,
      `offitel:${offitel.id}`,
      `villa:${villa.id}`,
    ]);

    __resetHomeMarketCacheForTest();
    await prisma.aptSaleTransaction.create({
      data: {
        ...saleData(`${PREFIX}legacy-gwangju`, `${PREFIX}legacy-gwangju`, 84.90, 2026, 5, 10, 73000n),
        city: '전남광주통합특별시',
        district: '동구',
        bjdCode: '12210',
        dongName: '충장동',
      },
    });
    const legacy = await getHomeMarket({ city: 'gwangju' }, NOW);
    expect(legacy.region).toEqual({ city: 'gwangju', district: null, label: '광주' });
    expect(legacy.counts.apt.status).toBe('ok');
    expect(legacy.counts.apt.data?.total).toBeGreaterThan(0);
  });

  it('keeps all 5000 SQL points and records cold/warm response, bytes, and EXPLAIN row estimates', async () => {
    const buildingName = `${PREFIX}perf-building`;
    const ids = await seedPerformanceAptSaleFixture(buildingName);
    const query = {
      bjdCode: SEOUL_BJD,
      buildingName,
      mode: 'sale' as const,
      months: 6 as const,
      area: '84.90',
    };

    const coldStart = performance.now();
    const cold = await getDetailSnapshot('apt-sale', query, NOW);
    const coldElapsedMs = performance.now() - coldStart;
    const warmStart = performance.now();
    const warm = await getDetailSnapshot('apt-sale', query, NOW);
    const warmElapsedMs = performance.now() - warmStart;
    const explain = await explainPerfQuery(buildingName);
    const sqlTruth = await fetchPerformanceTruth();

    const pointIds = new Set(cold.points.map((point) => point.id));
    expect(cold.points).toHaveLength(5000);
    expect(warm.points).toHaveLength(5000);
    expect(pointIds.size).toBe(5000);
    expect([...pointIds].sort((a, b) => a - b)).toEqual([...ids].sort((a, b) => a - b));
    expect(sqlTruth.size).toBe(5000);
    for (const point of cold.points) {
      expect(sqlTruth.get(point.id)).toEqual({ date: point.date, amount: point.amount });
    }

    const sqlTruthSignature = pointSignature([...sqlTruth.entries()].map(([id, value]) => ({ id, ...value })));
    const coldPointSignature = pointSignature(cold.points);
    const warmPointSignature = pointSignature(warm.points);
    expect(warmPointSignature).toBe(coldPointSignature);
    expect(coldPointSignature).toBe(sqlTruthSignature);

    const homeNationalFirst = await measureHomeMarket({});
    const homeNationalRepeat = await measureHomeMarket({});
    const homeRegionalFirst = await measureHomeMarket({ city: 'seoul', district: 'task12' });
    const homeRegionalRepeat = await measureHomeMarket({ city: 'seoul', district: 'task12' });
    const homeExplain = await explainHomeMarketQueries();

    const sqlPoints = cold.points.map((point) => ({
      id: point.id,
      date: point.date,
      amount: point.amount,
      area: point.area,
      floor: point.floor,
      deposit: point.deposit,
    }));
    const metrics = {
      fixtureRows: ids.length,
      firstRequestElapsedMs: Number(coldElapsedMs.toFixed(2)),
      repeatRequestElapsedMs: Number(warmElapsedMs.toFixed(2)),
      responseBytes: Buffer.byteLength(JSON.stringify(cold)),
      pointSignature: coldPointSignature,
      sqlTruthSignature,
      explainRows: explain.map(normalizeExplainRow),
      homeMarket: {
        national: {
          firstRequestElapsedMs: homeNationalFirst.elapsedMs,
          repeatRequestElapsedMs: homeNationalRepeat.elapsedMs,
          responseBytes: homeNationalFirst.responseBytes,
        },
        regional: {
          firstRequestElapsedMs: homeRegionalFirst.elapsedMs,
          repeatRequestElapsedMs: homeRegionalRepeat.elapsedMs,
          responseBytes: homeRegionalFirst.responseBytes,
        },
        explainRows: homeExplain,
      },
    };
    await writeFile(resolve(artifactDir, 'backend-sql-points.json'), `${JSON.stringify({ fixtureRows: ids.length, pointSignature: coldPointSignature, sqlTruthSignature, points: sqlPoints }, null, 2)}\n`);
    await writeFile(resolve(artifactDir, 'backend-sql-performance.json'), `${JSON.stringify(metrics, null, 2)}\n`);
  }, 120_000);
});

async function seedRegions(): Promise<void> {
  await prisma.region.upsert({
    where: { bjdCode: SEOUL_BJD },
    update: { city: '서울특별시', district: '강남구', slug: 'gangnam', lat: new Prisma.Decimal('37.5172000'), lng: new Prisma.Decimal('127.0473000') },
    create: { bjdCode: SEOUL_BJD, city: '서울특별시', district: '강남구', slug: 'gangnam', lat: new Prisma.Decimal('37.5172000'), lng: new Prisma.Decimal('127.0473000') },
  });
  await prisma.region.upsert({
    where: { bjdCode: '12210' },
    update: { city: '전남광주통합특별시', district: '동구', slug: 'dong', lat: new Prisma.Decimal('35.1465000'), lng: new Prisma.Decimal('126.9231000') },
    create: { bjdCode: '12210', city: '전남광주통합특별시', district: '동구', slug: 'dong', lat: new Prisma.Decimal('35.1465000'), lng: new Prisma.Decimal('126.9231000') },
  });
  await prisma.region.upsert({
    where: { bjdCode: '12110' },
    update: { city: '전남광주통합특별시', district: '목포시', slug: 'mokpo', lat: new Prisma.Decimal('34.8118000'), lng: new Prisma.Decimal('126.3922000') },
    create: { bjdCode: '12110', city: '전남광주통합특별시', district: '목포시', slug: 'mokpo', lat: new Prisma.Decimal('34.8118000'), lng: new Prisma.Decimal('126.3922000') },
  });
  await prisma.region.upsert({
    where: { bjdCode: '11999' },
    update: { city: '서울특별시', district: '검증구', slug: 'task12', lat: new Prisma.Decimal('37.5100000'), lng: new Prisma.Decimal('127.0500000') },
    create: { bjdCode: '11999', city: '서울특별시', district: '검증구', slug: 'task12', lat: new Prisma.Decimal('37.5100000'), lng: new Prisma.Decimal('127.0500000') },
  });
}

async function seedNineModeFixtures(): Promise<void> {
  const saleModels = [
    ['apt-sale-sale', prisma.aptSaleTransaction, saleData] as const,
    ['villa-sale-sale', prisma.villaSaleTransaction, villaSaleData] as const,
    ['offitel-sale-sale', prisma.offitelSaleTransaction, offitelSaleData] as const,
  ];
  for (const [key, model, factory] of saleModels) {
    const buildingName = `${PREFIX}${key}`;
    const first = await model.create({ data: factory(`${PREFIX}${key}-valid-1`, buildingName, 84.90, 2026, 5, 10, 80000n) });
    const second = await model.create({ data: factory(`${PREFIX}${key}-valid-2`, buildingName, 84.90, 2026, 5, 10, 81000n) });
    await model.create({ data: factory(`${PREFIX}${key}-null-day`, buildingName, 84.90, 2026, 5, null, 990001n) });
    await model.create({ data: factory(`${PREFIX}${key}-invalid-day`, buildingName, 84.90, 2026, 4, 31, 990002n) });
    await model.create({ data: factory(`${PREFIX}${key}-future`, buildingName, 84.90, 2026, 5, 11, 990003n) });
    await model.create({ data: { ...factory(`${PREFIX}${key}-cancelled`, buildingName, 84.90, 2026, 5, 9, 990004n), cancelDealDay: '20260510' } });
    await model.create({ data: factory(`${PREFIX}${key}-a2`, `${buildingName}2`, 84.90, 2026, 5, 10, 990005n) });
    await model.create({ data: factory(`${PREFIX}${key}-area`, buildingName, 84.91, 2026, 5, 10, 990006n) });
    if (key === 'apt-sale-sale') {
      const address = await prisma.aptSaleTransaction.create({
        data: {
          ...saleData(`${PREFIX}${key}-address-2`, buildingName, 84.90, 2026, 5, 10, 82000n),
          jibun: '2',
          roadName: '테헤란로 2',
          lat: new Prisma.Decimal('37.5001000'),
          lng: new Prisma.Decimal('127.0301000'),
        },
      });
      cases.set(key, { type: 'apt-sale', mode: 'sale', buildingName, expectedIds: [first.id, second.id, address.id] });
    } else {
      cases.set(key, {
        type: key.startsWith('villa') ? 'villa-sale' : 'offitel-sale',
        mode: 'sale',
        buildingName,
        expectedIds: [first.id, second.id],
      });
    }
  }

  const rentModels = [
    ['apt-rent', prisma.aptRentTransaction, rentData] as const,
    ['villa-rent', prisma.villaRentTransaction, villaRentData] as const,
    ['offitel-rent', prisma.offitelRentTransaction, offitelRentData] as const,
  ];
  for (const [type, model, factory] of rentModels) {
    for (const mode of ['jeonse', 'wolse'] as const) {
      const buildingName = `${PREFIX}${type}-${mode}`;
      const rentType = mode === 'jeonse' ? '전세' : '월세';
      const first = await model.create({ data: factory(`${PREFIX}${type}-${mode}-valid-1`, buildingName, rentType, 0n, mode === 'wolse' ? 120 : null, 2026, 5, 10, 84.90) });
      const second = await model.create({ data: factory(`${PREFIX}${type}-${mode}-valid-2`, buildingName, rentType, 0n, mode === 'wolse' ? 130 : null, 2026, 5, 10, 84.90) });
      await model.create({ data: factory(`${PREFIX}${type}-${mode}-null-day`, buildingName, rentType, 0n, mode === 'wolse' ? 990 : null, 2026, 5, null, 84.90) });
      await model.create({ data: factory(`${PREFIX}${type}-${mode}-invalid-day`, buildingName, rentType, 0n, mode === 'wolse' ? 991 : null, 2026, 4, 31, 84.90) });
      await model.create({ data: factory(`${PREFIX}${type}-${mode}-future`, buildingName, rentType, 0n, mode === 'wolse' ? 992 : null, 2026, 5, 11, 84.90) });
      await model.create({ data: factory(`${PREFIX}${type}-${mode}-a2`, `${buildingName}2`, rentType, 0n, mode === 'wolse' ? 993 : null, 2026, 5, 10, 84.90) });
      await model.create({ data: factory(`${PREFIX}${type}-${mode}-area`, buildingName, rentType, 0n, mode === 'wolse' ? 994 : null, 2026, 5, 10, 84.91) });
      if (mode === 'wolse') {
        await model.create({ data: factory(`${PREFIX}${type}-${mode}-deposit`, buildingName, rentType, 10000n, 995, 2026, 5, 10, 84.90) });
      }
      cases.set(`${type}-${mode}` as CaseKey, { type, mode, buildingName, expectedIds: [first.id, second.id] });
    }
  }
}

async function seedPagedAptSaleFixture(buildingName: string): Promise<number[]> {
  const ids: number[] = [];
  for (let index = 0; index < 25; index += 1) {
    const row = await prisma.aptSaleTransaction.create({
      data: saleData(`${PREFIX}page-${index}`, buildingName, 84.90, 2026, 4 + Math.floor(index / 20), (index % 20) + 1, BigInt(70000 + index)),
    });
    ids.push(row.id);
  }
  return ids;
}

async function seedPerformanceAptSaleFixture(buildingName: string): Promise<number[]> {
  const rows = Array.from({ length: 5000 }, (_, index) => ({
    ...saleData(`${PREFIX}perf-${index}`, buildingName, 84.90, 2026, 1 + (index % 4), 1 + (index % 28), BigInt(50000 + index)),
    floor: index % 40,
  }));
  for (let offset = 0; offset < rows.length; offset += 500) {
    await prisma.aptSaleTransaction.createMany({ data: rows.slice(offset, offset + 500) });
  }
  const created = await prisma.aptSaleTransaction.findMany({
    where: { sourceId: { startsWith: `${PREFIX}perf-` } },
    select: { id: true },
  });
  return created.map((row) => row.id);
}

async function fetchPerformanceTruth(): Promise<Map<number, { date: string; amount: number }>> {
  const rows = await prisma.$queryRawUnsafe<PerfTruthRow[]>(`
    SELECT id,
      DATE_FORMAT(STR_TO_DATE(CONCAT(dealYear, '-', dealMonth, '-', dealDay), '%Y-%c-%e'), '%Y-%m-%d') AS date,
      dealAmount AS amount
    FROM AptSaleTransaction
    WHERE sourceId LIKE ?
    ORDER BY id ASC
  `, `${PREFIX}perf-%`);

  return new Map(rows.map((row) => [row.id, {
    date: formatSqlDate(row.date),
    amount: Number(row.amount),
  }]));
}

async function explainPerfQuery(buildingName: string): Promise<Array<Record<string, unknown>>> {
  return prisma.$queryRawUnsafe(`
    EXPLAIN SELECT id
    FROM AptSaleTransaction
    WHERE bjdCode = ?
      AND buildingName = ?
      AND exclusiveArea = ?
      AND dealYear BETWEEN 2025 AND 2026
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth, 2, '0'), '-', LPAD(dealDay, 2, '0')), '%Y-%m-%d') BETWEEN ? AND ?
    ORDER BY dealYear ASC, dealMonth ASC, dealDay ASC, id ASC
  `, SEOUL_BJD, buildingName, new Prisma.Decimal('84.90'), '2025-11-10', '2026-05-10');
}

async function measureHomeMarket(region: { city?: string; district?: string }): Promise<{ elapsedMs: number; responseBytes: number }> {
  __resetHomeMarketCacheForTest();
  const start = performance.now();
  const result = await getHomeMarket(region, NOW);
  return {
    elapsedMs: Number((performance.now() - start).toFixed(2)),
    responseBytes: Buffer.byteLength(JSON.stringify(result)),
  };
}

async function explainHomeMarketQueries(): Promise<Record<string, unknown>[]> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    EXPLAIN SELECT DATE_FORMAT(STR_TO_DATE(CONCAT(dealYear, '-', dealMonth, '-', dealDay), '%Y-%c-%e'), '%Y-%m-%d') AS date, COUNT(*) AS count
    FROM AptSaleTransaction
    WHERE dealDay IS NOT NULL
      AND STR_TO_DATE(CONCAT(dealYear, '-', dealMonth, '-', dealDay), '%Y-%c-%e') BETWEEN STR_TO_DATE(?, '%Y-%m-%d') AND STR_TO_DATE(?, '%Y-%m-%d')
      AND (cancelDealDay IS NULL OR cancelDealDay = '')
      AND (cancelDealType IS NULL OR cancelDealType = '')
      AND city LIKE ?
      AND district = ?
    GROUP BY DATE_FORMAT(STR_TO_DATE(CONCAT(dealYear, '-', dealMonth, '-', dealDay), '%Y-%c-%e'), '%Y-%m-%d')
    ORDER BY date ASC
  `, '2026-04-11', '2026-05-10', '%서울%', '검증구');
  return rows.map(normalizeExplainRow);
}

function formatSqlDate(value: string | Date): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : value.slice(0, 10);
}

function pointSignature(points: Array<{ id: number; date: string; amount: number }>): string {
  const stable = points.map((point) => `${point.id}:${point.date}:${point.amount}`).sort().join('|');
  return createHash('sha256').update(stable).digest('hex');
}

function normalizeExplainRow(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: toJsonValue(row.id ?? row.f0),
    selectType: toJsonValue(row.select_type ?? row.f1),
    table: toJsonValue(row.table ?? row.f2),
    type: toJsonValue(row.type ?? row.f4),
    possibleKeys: toJsonValue(row.possible_keys ?? row.f5),
    key: toJsonValue(row.key ?? row.f6),
    rows: toJsonValue(row.rows ?? row.f9),
    filtered: toJsonValue(row.filtered ?? row.f10),
    extra: toJsonValue(row.Extra ?? row.f11),
  };
}

function toJsonValue(value: unknown): unknown {
  return typeof value === 'bigint' ? Number(value) : value;
}

async function cleanupPrefixedRows(): Promise<void> {
  await Promise.all([
    prisma.aptSaleTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.villaSaleTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.offitelSaleTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.aptRentTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.villaRentTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
    prisma.offitelRentTransaction.deleteMany({ where: { sourceId: { startsWith: PREFIX } } }),
  ]);
}

function saleData(sourceId: string, buildingName: string, area: number, year: number, month: number, day: number | null, amount: bigint) {
  return {
    city: '서울특별시',
    district: '강남구',
    bjdCode: SEOUL_BJD,
    dongName: '역삼동',
    buildingName,
    exclusiveArea: new Prisma.Decimal(area.toFixed(2)),
    jibun: '1',
    roadName: '테헤란로 1',
    lat: new Prisma.Decimal('37.5000000'),
    lng: new Prisma.Decimal('127.0300000'),
    dealYear: year,
    dealMonth: month,
    dealDay: day,
    dealAmount: amount,
    sourceId,
  };
}

function villaSaleData(sourceId: string, buildingName: string, area: number, year: number, month: number, day: number | null, amount: bigint) {
  return { ...saleData(sourceId, buildingName, area, year, month, day, amount), houseType: '연립다세대' };
}

function offitelSaleData(sourceId: string, buildingName: string, area: number, year: number, month: number, day: number | null, amount: bigint) {
  return saleData(sourceId, buildingName, area, year, month, day, amount);
}

function rentData(sourceId: string, buildingName: string, rentType: string, deposit: bigint, monthlyRent: number | null, year: number, month: number, day: number | null, area: number) {
  return {
    city: '서울특별시',
    district: '강남구',
    bjdCode: SEOUL_BJD,
    dongName: '역삼동',
    buildingName,
    exclusiveArea: new Prisma.Decimal(area.toFixed(2)),
    jibun: '1',
    roadName: '테헤란로 1',
    lat: new Prisma.Decimal('37.5000000'),
    lng: new Prisma.Decimal('127.0300000'),
    dealYear: year,
    dealMonth: month,
    dealDay: day,
    rentType,
    deposit,
    monthlyRent,
    contractTerm: '24',
    contractType: '신규',
    sourceId,
  };
}

function villaRentData(sourceId: string, buildingName: string, rentType: string, deposit: bigint, monthlyRent: number | null, year: number, month: number, day: number | null, area: number) {
  return { ...rentData(sourceId, buildingName, rentType, deposit, monthlyRent, year, month, day, area), houseType: '연립다세대' };
}

function offitelRentData(sourceId: string, buildingName: string, rentType: string, deposit: bigint, monthlyRent: number | null, year: number, month: number, day: number | null, area: number) {
  return rentData(sourceId, buildingName, rentType, deposit, monthlyRent, year, month, day, area);
}
