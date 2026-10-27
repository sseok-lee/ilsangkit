import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { kstCalendarToday } from '../lib/kstDate.js';
import { buildingKeySql } from '../lib/realEstateBuildingIdentity.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { TABLE_NAME_MAP } from './realEstateService.js';
import { cleanupAreaSummaries, writeAreaSummaryBatch, type BuildingRow, type AreaSummaryResult } from './realEstateAreaSummaryService.js';
import type { PropertyType } from '../types/realEstateExploration.js';

interface Checkpoint { startedAt: Date; dateThrough: string; readyAt: Date | null; incrementalThrough: Date | null; incrementalDateThrough: string | null }
const PAGE = 1000;

/** PK 범위를 페이지로 읽는다. 거래 전체 집계나 큰 임시 테이블을 만들지 않는다. */
export function metadataChangesQuery(type: string, cursor: string): Prisma.Sql {
  const fields = ['transactionCount', 'lat', 'lng', 'buildingName', 'bjdCode', 'city', 'district', 'dongName', 'jibun'];
  return Prisma.sql`SELECT s.buildingKey, (a.buildingKey IS NULL OR ${Prisma.raw(fields.map((f) => `NOT(s.${f} <=> a.${f})`).join(' OR '))}) AS dirty
    FROM RealEstateBuildingSummaryV2 s FORCE INDEX(RealEstateBuildingSummaryV2_type_buildingKey_key)
    LEFT JOIN RealEstateBuildingAreaSummary a FORCE INDEX(PRIMARY)
      ON a.type=s.type AND a.buildingKey=s.buildingKey AND a.areaBand=0
    WHERE s.type=${type} AND s.buildingKey>${cursor} ORDER BY s.buildingKey LIMIT ${PAGE}`;
}
export function changedTransactionsQuery(type: string, lower: Date, upper: Date, cursorTime: Date, cursorId: number): Prisma.Sql {
  const table = TABLE_NAME_MAP[type];
  if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  return Prisma.sql`SELECT t.id, t.syncedAt, ${buildingKeySql(type.split('-')[0] as PropertyType, 't')} AS buildingKey
    FROM ${Prisma.raw(table)} t FORCE INDEX(${Prisma.raw(`${table}_syncedAt_idx`)})
    WHERE t.syncedAt>=${lower} AND t.syncedAt<=${upper}
      AND (t.syncedAt>${cursorTime} OR (t.syncedAt=${cursorTime} AND t.id>${cursorId}))
    ORDER BY t.syncedAt, t.id LIMIT ${PAGE}`;
}
/** NULL day는 해당 월 첫날부터 적격이다. 월 인덱스의 PK 순서로 페이지한다. */
export function maturityQuery(type: string, year: number, month: number, low: number, high: number, cursorId: number): Prisma.Sql {
  const table = TABLE_NAME_MAP[type];
  if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  return Prisma.sql`SELECT t.id, ${buildingKeySql(type.split('-')[0] as PropertyType, 't')} AS buildingKey
    FROM ${Prisma.raw(table)} t FORCE INDEX(${Prisma.raw(`${table}_dealYear_dealMonth_idx`)})
    WHERE t.dealYear=${year} AND t.dealMonth=${month} AND t.id>${cursorId}
      AND COALESCE(t.dealDay,1)>${low} AND COALESCE(t.dealDay,1)<=${high}
    ORDER BY t.id LIMIT ${PAGE}`;
}

export async function refreshBuildingAreaSummariesIncremental(types = Object.keys(TABLE_NAME_MAP)): Promise<AreaSummaryResult[]> {
  for (const type of types) if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  return withRealEstateWriteLock('refreshBuildingAreaSummariesIncremental', async () => {
    const results: AreaSummaryResult[] = [];
    for (const type of types) results.push(await refreshType(type));
    return results;
  });
}
async function refreshType(type: string): Promise<AreaSummaryResult> {
  const started = new Date();
  const dateThrough = kstCalendarToday(started).toISOString().slice(0, 10);
  const [state] = await prisma.$queryRaw<Checkpoint[]>(Prisma.sql`SELECT startedAt, dateThrough, readyAt, incrementalThrough, incrementalDateThrough
    FROM RealEstateAreaSummaryState WHERE type=${type} AND scope=''`);
  if (!state?.readyAt) throw new Error(`${type}: full area backfill required before incremental refresh`);
  const through = state.incrementalThrough ?? state.startedAt;
  if (started.getTime() - through.getTime() > 3 * 86400000) console.warn(`[AreaIncremental] ${type} last success older than 3 days: ${through.toISOString()}`);
  // 성공 시각 대신 실행 시작 시각을 저장하고 2분 겹쳐 읽어 늦게 커밋된 sync도 포착한다.
  const lower = new Date(through.getTime() - 120000);
  const dirty = new Set<string>();
  let cursor = '';
  while (true) {
    const rows = await prisma.$queryRaw<Array<{ buildingKey: string; dirty: number | bigint }>>(metadataChangesQuery(type, cursor));
    for (const row of rows) if (Number(row.dirty)) dirty.add(row.buildingKey);
    if (rows.length < PAGE) break;
    cursor = rows.at(-1)!.buildingKey;
  }
  let cursorTime = lower;
  let cursorId = 0;
  while (true) {
    const rows = await prisma.$queryRaw<Array<{ id: number; syncedAt: Date; buildingKey: string }>>(changedTransactionsQuery(type, lower, started, cursorTime, cursorId));
    for (const row of rows) dirty.add(row.buildingKey);
    if (rows.length < PAGE) break;
    cursorTime = rows.at(-1)!.syncedAt;
    cursorId = rows.at(-1)!.id;
  }
  const oldDate = state.incrementalDateThrough ?? state.dateThrough;
  const day = new Date(`${oldDate}T00:00:00Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  while (day.toISOString().slice(0, 10) <= dateThrough) {
    const year = day.getUTCFullYear();
    const month = day.getUTCMonth() + 1;
    const low = day.getUTCDate() - 1;
    const end = new Date(Math.min(Date.UTC(year, month, 0), new Date(`${dateThrough}T00:00:00Z`).getTime()));
    cursorId = 0;
    while (true) {
      const rows = await prisma.$queryRaw<Array<{ id: number; buildingKey: string }>>(maturityQuery(type, year, month, low, end.getUTCDate(), cursorId));
      rows.forEach((r) => dirty.add(r.buildingKey));
      if (rows.length < PAGE) break;
      cursorId = rows.at(-1)!.id;
    }
    day.setUTCFullYear(year, month, 1);
  }
  let buildings = 0;
  let writtenRows = 0;
  const runId = randomUUID();
  const keys = [...dirty];
  for (let i = 0; i < keys.length; i += 25) {
    const rows = await prisma.$queryRaw<BuildingRow[]>(Prisma.sql`SELECT buildingKey, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount
      FROM RealEstateBuildingSummaryV2 WHERE type=${type} AND buildingKey IN (${Prisma.join(keys.slice(i, i + 25))})`);
    if (rows.length) writtenRows += await writeAreaSummaryBatch(type, rows, dateThrough, runId);
    buildings += rows.length;
  }
  const deletedRows = await cleanupAreaSummaries(type);
  // 실패/타임아웃 때는 이전 성공 기준을 보존한다. 재실행의 동일 행은 writer가 건너뛴다.
  await prisma.$executeRaw(Prisma.sql`UPDATE RealEstateAreaSummaryState SET incrementalThrough=${started}, incrementalDateThrough=${dateThrough}
    WHERE type=${type} AND scope=''`);
  const result = { type, buildings, writtenRows, deletedRows, elapsedMs: Date.now() - started.getTime() };
  console.info(`[AreaIncremental] ${JSON.stringify(result)}`);
  return result;
}
