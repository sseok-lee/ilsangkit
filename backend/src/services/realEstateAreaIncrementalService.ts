import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { kstCalendarToday } from '../lib/kstDate.js';
import { buildingKeySql } from '../lib/realEstateBuildingIdentity.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { TABLE_NAME_MAP } from './realEstateService.js';
import { writeAreaSummaryBatch, type BuildingRow, type AreaSummaryResult } from './realEstateAreaSummaryService.js';
import type { PropertyType } from '../types/realEstateExploration.js';

const PAGE = 1000;
export const AREA_DIRTY_FULL_THRESHOLD = 20_000;
export interface AreaIncrementalOptions { budgetMs?: number; sliceMs?: number }
export interface AreaIncrementalResult extends AreaSummaryResult {
  status: 'complete' | 'partial' | 'waiting' | 'failed';
  mode: 'incremental' | 'full';
  error?: string;
}
interface Checkpoint {
  startedAt: Date; dateThrough: string; readyAt: Date | null; completedAt: Date | null;
  incrementalThrough: Date | null; incrementalDateThrough: string | null; incrementalJob: Job | string | null;
}
interface Job {
  version: 1; mode: 'incremental' | 'full';
  phase: 'purge' | 'metadata' | 'source' | 'maturity' | 'work' | 'discard' | 'full' | 'cleanup';
  runId: string; upper: string; lower: string; dateThrough: string;
  metadataCursor: string; sourceTime: string; sourceId: number; maturityDay: string; maturityId: number;
  fullCursor: string; remaining: number; processed: number; partialDays: number; lastPartialDate: string | null;
}

/** PK 범위를 페이지로 읽는다. 거래 전체 집계나 큰 임시 테이블을 만들지 않는다. */
export function metadataChangesQuery(type: string, cursor: string): Prisma.Sql {
  const fields = ['transactionCount', 'lat', 'lng', 'buildingName', 'bjdCode', 'city', 'district', 'dongName', 'jibun'];
  return Prisma.sql`SELECT /*+ INDEX(s RealEstateBuildingSummaryV2_type_buildingKey_key) INDEX(a PRIMARY) */ s.buildingKey, (a.buildingKey IS NULL OR ${Prisma.raw(fields.map((f) => `NOT(s.${f} <=> a.${f})`).join(' OR '))}) AS dirty
    FROM RealEstateBuildingSummaryV2 s
    LEFT JOIN RealEstateBuildingAreaSummary a
      ON a.type=s.type AND a.buildingKey=s.buildingKey AND a.areaBand=0
    WHERE s.type=${type} AND s.buildingKey>${cursor} ORDER BY s.buildingKey LIMIT ${PAGE}`;
}
export function changedTransactionsQuery(type: string, lower: Date, upper: Date, cursorTime: Date, cursorId: number): Prisma.Sql {
  const table = TABLE_NAME_MAP[type];
  if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  return Prisma.sql`SELECT /*+ INDEX(t ${Prisma.raw(`${table}_syncedAt_idx`)}) */ t.id, t.syncedAt, ${buildingKeySql(type.split('-')[0] as PropertyType, 't')} AS buildingKey
    FROM ${Prisma.raw(table)} t
    WHERE t.syncedAt>=${lower} AND t.syncedAt<=${upper}
      AND (t.syncedAt>${cursorTime} OR (t.syncedAt=${cursorTime} AND t.id>${cursorId}))
    ORDER BY t.syncedAt, t.id LIMIT ${PAGE}`;
}
/** NULL day는 해당 월 첫날부터 적격이다. 월 인덱스의 PK 순서로 페이지한다. */
export function maturityQuery(type: string, year: number, month: number, low: number, high: number, cursorId: number): Prisma.Sql {
  const table = TABLE_NAME_MAP[type];
  if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  return Prisma.sql`SELECT /*+ INDEX(t ${Prisma.raw(`${table}_dealYear_dealMonth_idx`)}) */ t.id, ${buildingKeySql(type.split('-')[0] as PropertyType, 't')} AS buildingKey
    FROM ${Prisma.raw(table)} t
    WHERE t.dealYear=${year} AND t.dealMonth=${month} AND t.id>${cursorId}
      AND COALESCE(t.dealDay,1)>${low} AND COALESCE(t.dealDay,1)<=${high}
    ORDER BY t.id LIMIT ${PAGE}`;
}

/** 매일 첫 유형을 바꾸고, 한 바퀴 뒤에도 예산이 남으면 미완료 유형에 재분배한다. */
export function rotateAreaTypes(types: string[], now = new Date()): string[] {
  if (!types.length) return [];
  const offset = Math.floor(kstCalendarToday(now).getTime() / 86400000) % types.length;
  return [...types.slice(offset), ...types.slice(0, offset)];
}
export function areaRefreshExitCode(results: AreaIncrementalResult[]): number {
  if (results.some((r) => r.status === 'failed')) return 6;
  return results.some((r) => r.status !== 'complete') ? 75 : 0;
}
export async function refreshBuildingAreaSummariesIncremental(
  types = Object.keys(TABLE_NAME_MAP), options: AreaIncrementalOptions = {},
): Promise<AreaIncrementalResult[]> {
  for (const type of types) if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  const budget = options.budgetMs ?? 24 * 60000; // 25분 watchdog 전에 체크포인트하고 잠금을 푼다.
  const slice = options.sliceMs ?? 60000;
  if (!Number.isFinite(budget) || budget < 0 || !Number.isFinite(slice) || slice <= 0) throw new Error('Invalid area budget');
  return withRealEstateWriteLock('refreshBuildingAreaSummariesIncremental', async () => {
    const started = Date.now();
    const deadline = started + budget;
    const order = rotateAreaTypes([...new Set(types)]);
    const results = new Map(order.map((type) => [type, { type, buildings: 0, writtenRows: 0, deletedRows: 0, elapsedMs: 0,
      status: 'partial', mode: 'incremental' } as AreaIncrementalResult]));
    const done = new Set<string>();
    while (Date.now() < deadline && done.size < order.length) {
      for (const type of order) {
        if (done.has(type) || Date.now() >= deadline) continue;
        const result = results.get(type)!;
        const from = Date.now();
        try {
          const [state] = await prisma.$queryRaw<Checkpoint[]>(Prisma.sql`SELECT startedAt, dateThrough, readyAt, completedAt,
            incrementalThrough, incrementalDateThrough, incrementalJob FROM RealEstateAreaSummaryState WHERE type=${type} AND scope=''`);
          if (!state?.readyAt || !state.completedAt) {
            result.status = 'waiting';
            if (state && Date.now() - state.startedAt.getTime() >= 3 * 86400000) console.warn(`[AreaIncremental] ${type} backfill pending for 3 days`);
            done.add(type);
            continue;
          }
          let job = state.incrementalJob ? (typeof state.incrementalJob === 'string' ? JSON.parse(state.incrementalJob) : state.incrementalJob) as Job : null;
          if (!job) {
            const through = state.incrementalThrough ?? state.startedAt;
            if (Date.now() - through.getTime() > 3 * 86400000) console.warn(`[AreaIncremental] ${type} last success older than 3 days`);
            const lower = new Date(through.getTime() - 120000).toISOString();
            const day = new Date(`${state.incrementalDateThrough ?? state.dateThrough}T00:00:00Z`);
            day.setUTCDate(day.getUTCDate() + 1);
            job = { version: 1, mode: 'incremental', phase: 'purge', runId: randomUUID(), upper: new Date().toISOString(), lower,
              dateThrough: kstCalendarToday().toISOString().slice(0, 10), metadataCursor: '', sourceTime: lower, sourceId: 0,
              maturityDay: day.toISOString().slice(0, 10), maturityId: 0, fullCursor: '', remaining: 0, processed: 0, partialDays: 0, lastPartialDate: null };
            await saveJob(type, job);
          }
          if (job.version !== 1) throw new Error('Unknown area job version');
          const until = Math.min(deadline, from + slice);
          while (Date.now() < until && job) {
            result.mode = job.mode;
            job = await advanceJob(type, job, result);
            if (job) result.mode = job.mode;
          }
          if (!job) { result.status = 'complete'; done.add(type); }
        } catch (error) {
          result.status = 'failed'; result.error = String(error); done.add(type);
          console.error(`[AreaIncremental] ${type} failed; committed progress preserved`, error);
        } finally { result.elapsedMs += Date.now() - from; }
      }
    }
    for (const result of results.values()) {
      if (result.status === 'partial') await markPartial(result.type);
      console.info(`[AreaIncremental] ${JSON.stringify(result)}`);
    }
    return [...results.values()];
  });
}

type Writer = Pick<Prisma.TransactionClient, '$executeRaw'>;
async function saveJob(type: string, job: Job, tx: Writer = prisma): Promise<void> {
  await tx.$executeRaw(Prisma.sql`UPDATE RealEstateAreaSummaryState SET incrementalJob=${JSON.stringify(job)} WHERE type=${type} AND scope=''`);
}
async function enqueue(type: string, job: Job, keys: string[]): Promise<Job> {
  const next = { ...job };
  await prisma.$transaction(async (tx) => {
    if (keys.length) next.remaining += await tx.$executeRaw(Prisma.sql`INSERT IGNORE INTO RealEstateAreaSummaryWork (type,buildingKey)
      VALUES ${Prisma.join([...new Set(keys)].map((key) => Prisma.sql`(${type},${key})`))}`);
    if (next.remaining >= AREA_DIRTY_FULL_THRESHOLD) {
      next.mode = 'full'; next.phase = 'discard';
      console.warn(`[AreaIncremental] ${type} dirty>=${AREA_DIRTY_FULL_THRESHOLD}; switching to resumable full mode`);
    }
    await saveJob(type, next, tx);
  }, { timeout: 30_000 });
  return next;
}

async function advanceJob(type: string, job: Job, result: AreaIncrementalResult): Promise<Job | null> {
  if (job.phase === 'purge' || job.phase === 'discard') {
    const deleted = await prisma.$executeRaw(Prisma.sql`DELETE FROM RealEstateAreaSummaryWork WHERE type=${type} LIMIT 500`);
    const next = { ...job, remaining: 0 };
    if (!deleted) next.phase = job.phase === 'purge' ? 'metadata' : 'full';
    await saveJob(type, next);
    return next;
  }
  if (job.phase === 'metadata') {
    const rows = await prisma.$queryRaw<Array<{ buildingKey: string; dirty: number | bigint }>>(metadataChangesQuery(type, job.metadataCursor));
    return enqueue(type, { ...job, metadataCursor: rows.at(-1)?.buildingKey ?? job.metadataCursor,
      phase: rows.length < PAGE ? 'source' : 'metadata' }, rows.filter((r) => Number(r.dirty)).map((r) => r.buildingKey));
  }
  if (job.phase === 'source') {
    const rows = await prisma.$queryRaw<Array<{ id: number; syncedAt: Date; buildingKey: string }>>(changedTransactionsQuery(type, new Date(job.lower), new Date(job.upper), new Date(job.sourceTime), job.sourceId));
    return enqueue(type, { ...job, sourceTime: rows.at(-1)?.syncedAt.toISOString() ?? job.sourceTime,
      sourceId: rows.at(-1)?.id ?? job.sourceId, phase: rows.length < PAGE ? 'maturity' : 'source' }, rows.map((r) => r.buildingKey));
  }
  if (job.phase === 'maturity') {
    if (job.maturityDay > job.dateThrough) { const next: Job = { ...job, phase: 'work' }; await saveJob(type, next); return next; }
    const day = new Date(`${job.maturityDay}T00:00:00Z`);
    const year = day.getUTCFullYear(); const month = day.getUTCMonth() + 1;
    const end = new Date(Math.min(Date.UTC(year, month, 0), new Date(`${job.dateThrough}T00:00:00Z`).getTime()));
    const rows = await prisma.$queryRaw<Array<{ id: number; buildingKey: string }>>(maturityQuery(type, year, month, day.getUTCDate() - 1, end.getUTCDate(), job.maturityId));
    if (rows.length < PAGE) day.setUTCFullYear(year, month, 1);
    return enqueue(type, { ...job, maturityDay: day.toISOString().slice(0, 10), maturityId: rows.length < PAGE ? 0 : rows.at(-1)!.id }, rows.map((r) => r.buildingKey));
  }
  if (job.phase === 'cleanup') {
    let deleted = 0;
    await prisma.$transaction(async (tx) => {
      deleted = await tx.$executeRaw(Prisma.sql`DELETE FROM RealEstateBuildingAreaSummary WHERE type=${type}
        AND NOT EXISTS (SELECT 1 FROM RealEstateBuildingSummaryV2 s WHERE s.type=RealEstateBuildingAreaSummary.type
          AND s.buildingKey=RealEstateBuildingAreaSummary.buildingKey) LIMIT 500`);
      if (!deleted) await tx.$executeRaw(Prisma.sql`UPDATE RealEstateAreaSummaryState SET incrementalThrough=${new Date(job.upper)},
        incrementalDateThrough=${job.dateThrough}, incrementalJob=NULL WHERE type=${type} AND scope=''`);
    }, { timeout: 30_000 });
    result.deletedRows += deleted;
    return deleted ? job : null;
  }
  let work: Array<{ buildingKey: string }> = [];
  let rows: BuildingRow[];
  if (job.phase === 'full') {
    rows = await prisma.$queryRaw<BuildingRow[]>(Prisma.sql`SELECT buildingKey, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount
      FROM RealEstateBuildingSummaryV2 WHERE type=${type} AND buildingKey>${job.fullCursor} ORDER BY buildingKey LIMIT 25`);
  } else {
    work = await prisma.$queryRaw<Array<{ buildingKey: string }>>(Prisma.sql`SELECT buildingKey FROM RealEstateAreaSummaryWork WHERE type=${type} ORDER BY buildingKey LIMIT 25`);
    rows = work.length ? await prisma.$queryRaw<BuildingRow[]>(Prisma.sql`SELECT buildingKey, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount
      FROM RealEstateBuildingSummaryV2 WHERE type=${type} AND buildingKey IN (${Prisma.join(work.map((r) => r.buildingKey))})`) : [];
  }
  if (!rows.length && !work.length) { const next: Job = { ...job, phase: 'cleanup' }; await saveJob(type, next); return next; }
  const next = { ...job, processed: job.processed + rows.length, remaining: Math.max(0, job.remaining - work.length), fullCursor: rows.at(-1)?.buildingKey ?? job.fullCursor };
  const checkpoint = async (tx: Prisma.TransactionClient): Promise<void> => {
    if (work.length) await tx.$executeRaw(Prisma.sql`DELETE FROM RealEstateAreaSummaryWork WHERE type=${type} AND buildingKey IN (${Prisma.join(work.map((r) => r.buildingKey))})`);
    await saveJob(type, next, tx);
  };
  if (rows.length) result.writtenRows += await writeAreaSummaryBatch(type, rows, job.dateThrough, job.runId, checkpoint);
  else await prisma.$transaction(checkpoint);
  result.buildings += rows.length;
  return next;
}
async function markPartial(type: string): Promise<void> {
  const [state] = await prisma.$queryRaw<Array<{ incrementalJob: Job | string | null }>>(Prisma.sql`SELECT incrementalJob FROM RealEstateAreaSummaryState WHERE type=${type} AND scope=''`);
  if (!state?.incrementalJob) return;
  const job = (typeof state.incrementalJob === 'string' ? JSON.parse(state.incrementalJob) : state.incrementalJob) as Job;
  const today = kstCalendarToday().toISOString().slice(0, 10);
  if (job.lastPartialDate !== today) {
    const yesterday = kstCalendarToday(); yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    job.partialDays = job.lastPartialDate === yesterday.toISOString().slice(0, 10) ? job.partialDays + 1 : 1;
    job.lastPartialDate = today;
    await saveJob(type, job);
  }
  if (job.partialDays >= 3) console.warn(`[AreaIncremental] ${type} incomplete for ${job.partialDays} consecutive days; phase=${job.phase} processed=${job.processed}`);
}
