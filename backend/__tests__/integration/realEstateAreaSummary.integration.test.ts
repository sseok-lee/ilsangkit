import { makeBuildingKey } from '../../src/lib/realEstateBuildingIdentity.js';
import { refreshBuildingAreaSummariesIncremental } from '../../src/services/realEstateAreaIncrementalService.js';
import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import * as areaWriter from '../../src/services/realEstateAreaSummaryService.js';
import { AREA_BANDS, refreshBuildingAreaSummariesUnlocked } from '../../src/services/realEstateAreaSummaryService.js';
import { getLatestDeals, latestDealsKey } from '../../src/services/realEstateLatestDeals.js';
import { fetchBuildings } from '../../src/services/realEstateMapService.js';
import { resolveMapFilter } from '../../src/schemas/realEstateMap.js';
import type { BuildingKey, LatestDeals, PropertyType } from '../../src/types/realEstateExploration.js';

const BJD = '99996';
const PREFIX = `area-summary-${Date.now().toString(36)}-`;
const properties: PropertyType[] = ['apt', 'villa', 'offitel'];
const types = properties.flatMap((p) => [`${p}-sale`, `${p}-rent`]);
const keyFor = (p: PropertyType): BuildingKey => ({ propertyType: p, buildingName: `${PREFIX}${p}`, bjdCode: BJD, dongName: '테스트동', jibun: '1' });
const hashFor = (p: PropertyType) => makeBuildingKey(keyFor(p));
const models = {
  apt: [prisma.aptSaleTransaction, prisma.aptRentTransaction],
  villa: [prisma.villaSaleTransaction, prisma.villaRentTransaction],
  offitel: [prisma.offitelSaleTransaction, prisma.offitelRentTransaction],
};

async function cleanup() {
  for (const p of properties) {
    for (const model of models[p]) await model.deleteMany({ where: { sourceId: { startsWith: PREFIX } } });
  }
  await prisma.realEstatePublicUrl.deleteMany({ where: { buildingKey: { in: properties.map(hashFor) } } });
  await prisma.realEstateBuildingAreaSummary.deleteMany({ where: { bjdCode: BJD } });
  await prisma.realEstateBuildingSummaryV2.deleteMany({ where: { bjdCode: BJD } });
  await prisma.realEstateAreaSummaryState.deleteMany({ where: { scope: BJD } });
}

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-27T03:00:00Z'));
  await cleanup();
  for (const p of properties) {
    const k = keyFor(p);
    const base = { buildingName: k.buildingName, bjdCode: BJD, city: '테스트시', district: '테스트구', dongName: '테스트동', jibun: '1', syncedAt: new Date('2026-10-25T00:00Z'), dealYear: 2026, dealMonth: 10, dealDay: 1, lat: 37.5, lng: 127, buildYear: 2000 };
    for (const [i, area] of [60, 60.01, 85, 85.01, 135, 135.01, null].entries()) {
      await models[p][0].create({ data: { ...base, sourceId: `${PREFIX}${p}-sale-${i}`, exclusiveArea: area, floor: i, dealAmount: BigInt(10000 + i) } } as never);
      for (const rentType of ['전세', '월세']) {
        await models[p][1].create({ data: { ...base, sourceId: `${PREFIX}${p}-${rentType}-${i}`, exclusiveArea: area, floor: i, rentType, deposit: BigInt(10000 + i), monthlyRent: rentType === '월세' ? 101 : null } } as never);
      }
    }
    // 최신으로 보이지만 취소/미래/잘못된 날짜인 행은 계산에서도 제외되어야 한다.
    for (const [i, override] of [{ cancelDealType: '해제' }, { dealYear: 2027 }, { dealMonth: 2, dealDay: 30 }].entries()) {
      await models[p][0].create({ data: { ...base, exclusiveArea: 84, dealDay: 26, floor: 99, dealAmount: 999999n, sourceId: `${PREFIX}${p}-excluded-${i}`, ...override } } as never);
    }
    for (const type of [`${p}-sale`, `${p}-rent`]) {
      await prisma.realEstateBuildingSummaryV2.create({ data: { type, buildingKey: hashFor(p), buildingName: k.buildingName, bjdCode: BJD, city: '테스트시', district: '테스트구', dongName: '테스트동', jibun: '1', lat: 37.5, lng: 127, transactionCount: 99 } });
      const path = `/real-estate/${type}/test/test/${hashFor(p)}`;
      const pathHash = createHash('sha256').update(path).digest('hex');
      await prisma.realEstatePublicUrl.create({ data: { type, buildingKey: hashFor(p), buildingName: k.buildingName, bjdCode: BJD,
        basePath: path, basePathHash: pathHash, canonicalPath: path, pathHash,
        addressSnapshot: {}, evidence: {}, sourceFingerprint: '0'.repeat(64) } });
    }
  }
}, 30000);

afterAll(async () => { try { await cleanup(); } finally { vi.useRealTimers(); await prisma.$disconnect(); } });

describe('면적 요약 MySQL 동등성', () => {
  it.each(types)('%s 다섯 구간이 getLatestDeals와 같다 (경계·동률 id·취소·미래·NULL 면적)', async (type) => {
    await refreshBuildingAreaSummariesUnlocked({ types: [type], bjdCode: BJD, batchSize: 1, pauseMs: 0 });
    const p = type.split('-')[0] as PropertyType;
    const k = keyFor(p);
    const scope = type.endsWith('sale') ? 'sale' : 'rent';
    const rows = await prisma.realEstateBuildingAreaSummary.findMany({ where: { type, bjdCode: BJD }, orderBy: { areaBand: 'asc' } });
    expect(rows).toHaveLength(5);
    for (const row of rows) {
      const expected = (await getLatestDeals([k], scope, { area: AREA_BANDS[row.areaBand] })).get(latestDealsKey(k))!;
      expect(row.latestDeals).toEqual(expected);
      expect(row.transactionCount).toBe(99);
      expect(row.saleAmount == null ? null : Number(row.saleAmount)).toBe(expected.sale?.amount ?? null);
      expect(row.jeonseDeposit).toBe(expected.jeonse?.deposit ?? null);
      expect(row.wolseMonthlyRent).toBe(expected.wolse?.monthlyRent ?? null);
      const deals = row.latestDeals as unknown as LatestDeals;
      expect((deals.sale ?? deals.jeonse)?.floor).toBe([6, 0, 2, 4, 5][row.areaBand]);
    }
  });

  it('실제 필터 SQL은 면적의 최근 거래로 매매·전세·월세 가격 경계를 판정한다', async () => {
    const bounds = { swLat: 37.499999, swLng: 126.999999, neLat: 37.500001, neLng: 127.000001 };
    for (const type of ['offitel-sale', 'offitel-rent']) {
      const previousState = await prisma.realEstateAreaSummaryState.findUnique({ where: { type_scope: { type, scope: '' } } });
      try {
        await refreshBuildingAreaSummariesUnlocked({ types: [type], pauseMs: 0 });
        const queries = type.endsWith('sale')
          ? [{ area: '60-85', price: '0-30000' }, { area: '60-85', price: '30000-60000' }]
          : [{ area: '60-85', price: '10000-30000', priceKind: 'jeonse' as const }, { area: '60-85', price: '0-10000', priceKind: 'jeonse' as const },
            { area: '60-85', price: '100-', priceKind: 'wolse' as const }, { area: '60-85', price: '50-100', priceKind: 'wolse' as const }];
        for (const [i, query] of queries.entries()) {
          const result = await fetchBuildings(type, bounds, resolveMapFilter(type, query));
          expect(result.total).toBe(i % 2 === 0 ? 1 : 0);
          expect(result.exact).toBe(true);
          expect(result).not.toHaveProperty('filter');
          if (result.items[0]) {
            expect(result.items[0].latestDeals[type.endsWith('sale') ? 'sale' : 'jeonse']?.exclusiveArea).toBe(85);
          }
        }
      } finally {
        await prisma.realEstateAreaSummaryState.deleteMany({ where: { type, scope: '' } });
        if (previousState) await prisma.realEstateAreaSummaryState.create({ data: { ...previousState, incrementalJob: previousState.incrementalJob ?? Prisma.DbNull } });
      }
    }
  });

  it('증분: 한 거래·동일값 무기록·취소·미래 도래·새 단지·삭제', async () => {
    const type = 'apt-sale';
    const previous = await prisma.realEstateAreaSummaryState.findUnique({ where: { type_scope: { type, scope: '' } } });
    const baseline = { type, scope: '', runId: '11111111-1111-1111-1111-111111111111', lastBuildingKey: '', dateThrough: '2026-10-27', startedAt: new Date('2026-10-26T00:00Z'), completedAt: new Date(), readyAt: new Date(), incrementalThrough: new Date('2026-10-27T02:00Z'), incrementalDateThrough: '2026-10-27' };
    const extra = { ...keyFor('apt'), buildingName: `${PREFIX}new` };
    const extraHash = makeBuildingKey(extra);
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = `${process.cwd()}/../.omc/integration-locks`;
    await (await import('node:fs/promises')).mkdir(process.env.REAL_ESTATE_WRITE_LOCK_DIR, { recursive: true });
    try {
      await prisma.realEstateAreaSummaryState.upsert({ where: { type_scope: { type, scope: '' } }, create: baseline, update: baseline });
      const unchangedBefore = await prisma.realEstateBuildingAreaSummary.findMany({ where: { type } });
      const noChange = (await refreshBuildingAreaSummariesIncremental([type]))[0];
      expect(noChange).toMatchObject({ buildings: 0, writtenRows: 0 });
      expect(await prisma.realEstateBuildingAreaSummary.findMany({ where: { type } })).toEqual(unchangedBefore);
      const source = await prisma.aptSaleTransaction.findFirstOrThrow({ where: { sourceId: `${PREFIX}apt-sale-2` } });
      await prisma.aptSaleTransaction.update({ where: { id: source.id }, data: { dealAmount: 99999n, syncedAt: new Date() } });
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0]).toMatchObject({ buildings: 1, writtenRows: 1 });
      const saved = await prisma.realEstateBuildingAreaSummary.findMany({ where: { type } });
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0].writtenRows).toBe(0);
      expect(await prisma.realEstateBuildingAreaSummary.findMany({ where: { type } })).toEqual(saved);
      await prisma.aptSaleTransaction.update({ where: { id: source.id }, data: { cancelDealType: '해제', syncedAt: new Date() } });
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0].writtenRows).toBeGreaterThan(0);
      // 오래 전에 입력한 미래 거래가 기준일 도래만으로 최신값이 된다.
      await prisma.aptSaleTransaction.create({ data: { bjdCode: extra.bjdCode, dongName: extra.dongName, jibun: extra.jibun, sourceId: `${PREFIX}maturity`, city: '테스트시', district: '테스트구', dealYear: 2026, dealMonth: 10, dealDay: 28, exclusiveArea: 84, dealAmount: 77777n, syncedAt: new Date('2026-10-25T00:00Z'), buildingName: keyFor('apt').buildingName } } as never);
      vi.setSystemTime(new Date('2026-10-28T03:00Z'));
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0].writtenRows).toBeGreaterThan(0);
      await prisma.realEstateBuildingSummaryV2.create({ data: { type, buildingKey: extraHash, buildingName: extra.buildingName, bjdCode: BJD, city: '테스트시', district: '테스트구', dongName: extra.dongName, jibun: '1', transactionCount: 0 } });
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0].writtenRows).toBe(5);
      await prisma.realEstateBuildingSummaryV2.delete({ where: { type_buildingKey: { type, buildingKey: extraHash } } });
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0].deletedRows).toBe(5);
    } finally {
      vi.restoreAllMocks();
      vi.setSystemTime(new Date('2026-10-27T03:00Z'));
      await prisma.realEstateAreaSummaryState.deleteMany({ where: { type, scope: '' } });
      if (previous) await prisma.realEstateAreaSummaryState.create({ data: { ...previous, incrementalJob: previous.incrementalJob ?? Prisma.DbNull } });
    }
  }, 30000);

  it('실제 DB에서 요약·작업 체크포인트가 함께 롤백되고, 예산 뒤 다음 날 남은 배치만 재개한다', async () => {
    const type = 'apt-sale';
    const previous = await prisma.realEstateAreaSummaryState.findUnique({ where: { type_scope: { type, scope: '' } } });
    const keys: string[] = [];
    for (let i = 0; i < 40; i++) {
      const identity = { ...keyFor('apt'), buildingName: `${PREFIX}resume-${i}` };
      const buildingKey = makeBuildingKey(identity); keys.push(buildingKey);
      await prisma.realEstateBuildingSummaryV2.create({ data: { type, buildingKey, buildingName: identity.buildingName, bjdCode: BJD, city: '테스트시', district: '테스트구', dongName: identity.dongName, jibun: '1', transactionCount: 0 } });
    }
    const job = { version: 1, mode: 'incremental', phase: 'work', runId: '22222222-2222-2222-2222-222222222222', upper: '2026-10-27T02:00:00.000Z', lower: '2026-10-26T00:00:00.000Z', dateThrough: '2026-10-27', metadataCursor: '', sourceTime: '2026-10-26T00:00:00.000Z', sourceId: 0, maturityDay: '2026-10-28', maturityId: 0, fullCursor: '', remaining: 40, processed: 0, partialDays: 0, lastPartialDate: null };
    const baseline = { type, scope: '', runId: job.runId, lastBuildingKey: '', startedAt: new Date('2026-10-26T00:00Z'), dateThrough: '2026-10-26', completedAt: new Date(), readyAt: new Date(), incrementalThrough: new Date('2026-10-26T00:00Z'), incrementalDateThrough: '2026-10-26', incrementalJob: job };
    await prisma.realEstateAreaSummaryState.upsert({ where: { type_scope: { type, scope: '' } }, create: baseline, update: baseline });
    await prisma.realEstateAreaSummaryWork.createMany({ data: keys.map((buildingKey) => ({ type, buildingKey })) });
    try {
      const original = areaWriter.writeAreaSummaryBatch;
      const fail = vi.spyOn(areaWriter, 'writeAreaSummaryBatch').mockImplementationOnce((t, rows, date, run, checkpoint) => original(t, rows, date, run, async (tx) => {
        await checkpoint!(tx); throw new Error('after checkpoint rollback');
      }));
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0].status).toBe('failed');
      fail.mockRestore();
      expect(await prisma.realEstateBuildingAreaSummary.count({ where: { type, buildingKey: { in: keys } } })).toBe(0);
      expect(await prisma.realEstateAreaSummaryWork.count({ where: { type } })).toBe(40);
      expect((await prisma.realEstateAreaSummaryState.findUniqueOrThrow({ where: { type_scope: { type, scope: '' } } })).incrementalJob).toMatchObject({ processed: 0 });
      let clock = Date.now();
      const timer = vi.spyOn(Date, 'now').mockImplementation(() => clock += 10);
      const partial = (await refreshBuildingAreaSummariesIncremental([type], { budgetMs: 50 }))[0];
      timer.mockRestore();
      expect(partial.status).toBe('partial'); expect(partial.buildings).toBe(25);
      const firstRows = await prisma.realEstateBuildingAreaSummary.findMany({ where: { type, buildingKey: { in: keys } }, orderBy: [{ buildingKey: 'asc' }, { areaBand: 'asc' }] });
      expect(firstRows).toHaveLength(125);
      expect(await prisma.realEstateAreaSummaryWork.count({ where: { type } })).toBe(15);
      vi.setSystemTime(new Date('2026-10-28T03:00Z'));
      expect((await refreshBuildingAreaSummariesIncremental([type]))[0]).toMatchObject({ status: 'complete', buildings: 15 });
      expect(await prisma.realEstateBuildingAreaSummary.findMany({ where: { type, buildingKey: { in: firstRows.map((r) => r.buildingKey) } }, orderBy: [{ buildingKey: 'asc' }, { areaBand: 'asc' }] })).toEqual(firstRows);
      const done = await prisma.realEstateAreaSummaryState.findUniqueOrThrow({ where: { type_scope: { type, scope: '' } } });
      expect(done.incrementalThrough?.toISOString()).toBe(job.upper); expect(done.incrementalJob).toBeNull();
    } finally {
      vi.restoreAllMocks(); vi.setSystemTime(new Date('2026-10-27T03:00Z'));
      await prisma.realEstateAreaSummaryWork.deleteMany({ where: { type } });
      await prisma.realEstateAreaSummaryState.deleteMany({ where: { type, scope: '' } });
      if (previous) await prisma.realEstateAreaSummaryState.create({ data: { ...previous, incrementalJob: previous.incrementalJob ?? Prisma.DbNull } });
    }
  }, 30000);

  it('소스 요약에서 사라진 단지는 완료 후 정리되고 다른 지역은 유지된다', async () => {
    const type = 'apt-sale';
    await prisma.realEstateBuildingSummaryV2.deleteMany({ where: { type, bjdCode: BJD } });
    await refreshBuildingAreaSummariesUnlocked({ types: [type], bjdCode: BJD, pauseMs: 0 });
    expect(await prisma.realEstateBuildingAreaSummary.count({ where: { type, bjdCode: BJD } })).toBe(0);
    const [state] = await prisma.realEstateAreaSummaryState.findMany({ where: { type, scope: BJD } });
    expect(state.readyAt).not.toBeNull();
    expect(await prisma.realEstateBuildingAreaSummary.count({ where: { type: 'apt-rent', bjdCode: BJD } })).toBe(5);
  });
});
