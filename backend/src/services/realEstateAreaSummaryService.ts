import { isDeepStrictEqual } from 'node:util';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { kstCalendarToday } from '../lib/kstDate.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import { AREA_BUCKETS, bucketRange, type ValueRange } from '../schemas/realEstateMap.js';
import { getLatestDeals, latestDealsKey } from './realEstateLatestDeals.js';
import { TABLE_NAME_MAP } from './realEstateService.js';
import type { BuildingKey, LatestDeals, PropertyType } from '../types/realEstateExploration.js';

/** 0은 면적 제한 없음. 구간 경계는 API와 같은 정의를 사용한다. */
export const AREA_BANDS: readonly (ValueRange | null)[] = [null, ...AREA_BUCKETS.map(bucketRange)];
export function areaBandFor(area: ValueRange | null): number {
  const band = AREA_BANDS.findIndex((r) => r?.min === area?.min && r?.max === area?.max);
  if (band < 0) throw new Error('Unknown map area band');
  return band;
}

export interface AreaSummaryOptions {
  types?: string[];
  bjdCode?: string;
  resume?: boolean;
  batchSize?: number;
  pauseMs?: number;
  /** KST 다음 HH:MM의 5분 전부터 새 배치를 시작하지 않는다. */
  until?: string;
}
interface AreaState {
  startedAt: Date;
  runId: string;
  lastBuildingKey: string;
  dateThrough: string;
  completedAt: Date | null;
}
export interface BuildingRow {
  buildingKey: string;
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  jibun: string | null;
  lat: Prisma.Decimal | null;
  lng: Prisma.Decimal | null;
  transactionCount: number;
}

export interface AreaSummaryResult {
  type: string;
  buildings: number;
  elapsedMs: number;
  writtenRows: number;
  deletedRows: number;
}

/** 공개 진입점은 거래/요약 writer와 같은 잠금을 사용한다. */
export async function refreshBuildingAreaSummaries(options: AreaSummaryOptions = {}): Promise<AreaSummaryResult[]> {
  return withRealEstateWriteLock('refreshBuildingAreaSummaries', () => refreshBuildingAreaSummariesUnlocked(options));
}

/** 잠금을 이미 가진 수동 백필/CI에서 사용한다. 일일 작업은 별도 증분 서비스다. */
export async function refreshBuildingAreaSummariesUnlocked(options: AreaSummaryOptions = {}): Promise<AreaSummaryResult[]> {
  const types = options.types ?? Object.keys(TABLE_NAME_MAP);
  const batchSize = options.batchSize ?? 25;
  const pauseMs = options.pauseMs ?? (process.env.NODE_ENV === 'test' ? 0 : 100);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('batchSize must be 1..100');
  if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 10_000) throw new Error('pauseMs must be 0..10000');
  if (options.bjdCode && !/^\d{5,10}$/.test(options.bjdCode)) throw new Error('Invalid bjdCode');
  for (const type of types) if (!Object.hasOwn(TABLE_NAME_MAP, type)) throw new Error(`Unknown real estate type: ${type}`);
  const deadline = backfillDeadline(options.until);
  const results: AreaSummaryResult[] = [];
  for (const type of types) results.push(await refreshType(type, options, batchSize, pauseMs, deadline));
  return results;
}

async function refreshType(type: string, options: AreaSummaryOptions, batchSize: number, pauseMs: number, deadline?: Date): Promise<AreaSummaryResult> {
  const started = Date.now();
  const scope = options.bjdCode ?? '';
  const states = await prisma.$queryRawUnsafe<AreaState[]>(
    'SELECT runId, lastBuildingKey, dateThrough, startedAt, completedAt FROM RealEstateAreaSummaryState WHERE type = ? AND scope = ?', type, scope,
  );
  const previous = states[0];
  assertBeforeDeadline(deadline);
  // 미완료 실행은 기본으로 이어받는다. 완료 실행의 --resume은 재스캔하지 않는다.
  if (options.resume && previous?.completedAt) return { type, buildings: 0, elapsedMs: Date.now() - started, writtenRows: 0, deletedRows: 0 };
  const reuse = previous && !previous.completedAt && options.resume !== false;
  const runId = reuse ? previous.runId : randomUUID();
  const dateThrough = reuse ? previous.dateThrough : kstCalendarToday().toISOString().slice(0, 10);
  let lastBuildingKey = reuse ? previous.lastBuildingKey : '';
  if (!reuse) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO RealEstateAreaSummaryState (type, scope, runId, lastBuildingKey, dateThrough, startedAt, completedAt, readyAt)
       VALUES (?, ?, ?, '', ?, NOW(3), NULL, NULL)
       ON DUPLICATE KEY UPDATE runId = VALUES(runId), lastBuildingKey = '', dateThrough = VALUES(dateThrough), startedAt = NOW(3), completedAt = NULL`,
      type, scope, runId, dateThrough,
    );
  }
  let buildings = 0;
  let writtenRows = 0;
  const regionSql = scope ? ' AND bjdCode = ?' : '';
  const regionParams = scope ? [scope] : [];
  while (true) {
    assertBeforeDeadline(deadline);
    const rows = await prisma.$queryRawUnsafe<BuildingRow[]>(
      `SELECT buildingKey, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount
       FROM RealEstateBuildingSummaryV2 WHERE type = ? AND buildingKey > ?${regionSql}
       ORDER BY buildingKey LIMIT ${batchSize}`, type, lastBuildingKey, ...regionParams,
    );
    if (rows.length === 0) break;
    const nextCursor = rows[rows.length - 1].buildingKey;
    writtenRows += await writeAreaSummaryBatch(type, rows, dateThrough, runId, async (tx) => {
      await tx.$executeRawUnsafe('UPDATE RealEstateAreaSummaryState SET lastBuildingKey = ? WHERE type = ? AND scope = ? AND runId = ?', nextCursor, type, scope, runId);
    }, deadline);
    lastBuildingKey = nextCursor;
    buildings += rows.length;
    console.info(`[AreaSummary] ${type}/${scope || '*'} buildings=${buildings} lastBuildingKey=${lastBuildingKey} elapsedMs=${Date.now() - started}`);
    if (pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  // 성공한 범위만 정리한다. 중단/오류면 이전 행이 유지되고 커서부터 재개한다.
  const deletedRows = await cleanupAreaSummaries(type, scope, pauseMs, deadline);
  // 중단 중 V2에 커서보다 앞선 새 키가 추가되어도, 불완전한 초기 결과를 공개하지 않는다.
  // 구간은 0~4만 세고 PK가 중복을 막으므로, 전체×5이면 모든 단지에 다섯 행이 있다.
  const [coverage] = await prisma.$queryRawUnsafe<Array<{ sourceCount: bigint | number; summaryCount: bigint | number }>>(
    `SELECT (SELECT COUNT(*) FROM RealEstateBuildingSummaryV2 WHERE type = ?${regionSql}) AS sourceCount,
       (SELECT COUNT(*) FROM RealEstateBuildingAreaSummary WHERE type = ?${regionSql} AND areaBand BETWEEN 0 AND 4) AS summaryCount`,
    type, ...regionParams, type, ...regionParams,
  );
  if (!coverage || Number(coverage.summaryCount) !== Number(coverage.sourceCount) * AREA_BANDS.length) {
    throw new Error('Area summary coverage changed; restart backfill with --restart');
  }
  await prisma.$executeRawUnsafe(
    'UPDATE RealEstateAreaSummaryState SET completedAt = NOW(3), readyAt = NOW(3), incrementalThrough = startedAt, incrementalDateThrough = dateThrough WHERE type = ? AND scope = ? AND runId = ?', type, scope, runId,
  );
  const result = { type, buildings, writtenRows, deletedRows, elapsedMs: Date.now() - started };
  console.info(`[AreaSummary] complete ${type}/${scope || '*'} ${JSON.stringify(result)}`);
  return result;
}

/** --until은 서버 TZ와 무관한 KST 다음 시각. 최대 5분 여유를 두고 배치 경계에서 멈춘다. */
export function backfillDeadline(until?: string, now = new Date()): Date | undefined {
  if (!until) return undefined;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(until)) throw new Error('until must be HH:MM (KST)');
  const [hour, minute] = until.split(':').map(Number);
  const at = new Date(kstCalendarToday(now).getTime() + (hour * 60 + minute - 540) * 60000);
  if (at.getTime() < now.getTime()) at.setUTCDate(at.getUTCDate() + 1);
  return at;
}
export class AreaSummaryPausedError extends Error {
  constructor() { super('Area summary paused before --until; next run resumes the committed cursor'); }
}
export function assertBeforeDeadline(deadline?: Date): void {
  if (deadline && Date.now() >= deadline.getTime() - 5 * 60000) throw new AreaSummaryPausedError();
}

/** 거래 묶음과 메타데이터가 같으면 runId/updatedAt도 건드리지 않는다. */
export async function writeAreaSummaryBatch(
  type: string, rows: BuildingRow[], dateThrough: string, runId: string,
  checkpoint?: (tx: Prisma.TransactionClient) => Promise<void>, deadline?: Date,
): Promise<number> {
  const old = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
    SELECT * FROM RealEstateBuildingAreaSummary WHERE type = ${type}
      AND buildingKey IN (${Prisma.join(rows.map((r) => r.buildingKey))})`);
  const oldByKey = new Map(old.map((r) => [`${r.buildingKey}:${r.areaBand}`, r]));
  const keys: BuildingKey[] = rows.map((r) => ({ propertyType: type.split('-')[0] as PropertyType,
    buildingName: r.buildingName, bjdCode: r.bjdCode, dongName: r.dongName, jibun: r.jibun }));
  const values: Prisma.Sql[] = [];
  for (let band = 0; band < AREA_BANDS.length; band++) {
    assertBeforeDeadline(deadline);
    const bundles = await getLatestDeals(keys, type.endsWith('-sale') ? 'sale' : 'rent', { area: AREA_BANDS[band], dateThrough });
    rows.forEach((row, index) => {
      const deals: LatestDeals = bundles.get(latestDealsKey(keys[index]))!;
      const scalars = { saleAmount: deals.sale?.amount ?? null, jeonseDeposit: deals.jeonse?.deposit ?? null,
        wolseMonthlyRent: deals.wolse?.monthlyRent ?? null };
      const previous = oldByKey.get(`${row.buildingKey}:${band}`);
      const metadata = ['buildingName', 'bjdCode', 'city', 'district', 'dongName', 'jibun', 'lat', 'lng', 'transactionCount'] as const;
      const same = previous && metadata.every((k) => sameDatabaseValue(previous[k], row[k]))
        && Object.entries(scalars).every(([k, v]) => sameDatabaseValue(previous[k], v))
        && isDeepStrictEqual(typeof previous.latestDeals === 'string' ? JSON.parse(previous.latestDeals) : previous.latestDeals, deals);
      if (same) return;
      values.push(Prisma.sql`(${type}, ${row.buildingKey}, ${band}, ${row.buildingName}, ${row.bjdCode},
        ${row.city}, ${row.district}, ${row.dongName}, ${row.jibun}, ${row.lat}, ${row.lng}, ${row.transactionCount},
        ${scalars.saleAmount}, ${scalars.jeonseDeposit}, ${scalars.wolseMonthlyRent}, ${JSON.stringify(deals)}, ${runId}, NOW(3))`);
    });
  }
  assertBeforeDeadline(deadline);
  if (values.length || checkpoint) await prisma.$transaction(async (tx) => {
    if (values.length) await tx.$executeRaw(Prisma.sql`INSERT INTO RealEstateBuildingAreaSummary
      (type, buildingKey, areaBand, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount,
       saleAmount, jeonseDeposit, wolseMonthlyRent, latestDeals, refreshRunId, updatedAt)
      VALUES ${Prisma.join(values)} ON DUPLICATE KEY UPDATE buildingName=VALUES(buildingName), bjdCode=VALUES(bjdCode),
      city=VALUES(city), district=VALUES(district), dongName=VALUES(dongName), jibun=VALUES(jibun), lat=VALUES(lat), lng=VALUES(lng),
      transactionCount=VALUES(transactionCount), saleAmount=VALUES(saleAmount), jeonseDeposit=VALUES(jeonseDeposit),
      wolseMonthlyRent=VALUES(wolseMonthlyRent), latestDeals=VALUES(latestDeals), refreshRunId=VALUES(refreshRunId), updatedAt=NOW(3)`);
    await checkpoint?.(tx);
  }, { timeout: 30_000 });
  return values.length;
}

export async function cleanupAreaSummaries(type: string, scope = '', pauseMs = 0, deadline?: Date): Promise<number> {
  let deleted: number;
  let total = 0;
  do {
    assertBeforeDeadline(deadline);
    deleted = await prisma.$executeRawUnsafe(`DELETE FROM RealEstateBuildingAreaSummary WHERE type = ?${scope ? ' AND bjdCode = ?' : ''}
      AND NOT EXISTS (SELECT 1 FROM RealEstateBuildingSummaryV2 s
        WHERE s.type = RealEstateBuildingAreaSummary.type AND s.buildingKey = RealEstateBuildingAreaSummary.buildingKey) LIMIT 500`,
      type, ...(scope ? [scope] : []));
    total += deleted;
    if (deleted && pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  } while (deleted > 0);
  return total;
}


function sameDatabaseValue(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  return String(a) === String(b);
}
