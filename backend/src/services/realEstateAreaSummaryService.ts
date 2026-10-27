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
}
interface AreaState {
  runId: string;
  lastBuildingKey: string;
  dateThrough: string;
  completedAt: Date | null;
}
interface BuildingRow {
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
}

/** 공개 진입점은 거래/요약 writer와 같은 잠금을 사용한다. */
export async function refreshBuildingAreaSummaries(options: AreaSummaryOptions = {}): Promise<AreaSummaryResult[]> {
  return withRealEstateWriteLock('refreshBuildingAreaSummaries', () => refreshBuildingAreaSummariesUnlocked(options));
}

/** 이미 writer 잠금 안인 일일 요약 갱신에서 사용한다. */
export async function refreshBuildingAreaSummariesUnlocked(options: AreaSummaryOptions = {}): Promise<AreaSummaryResult[]> {
  const types = options.types ?? Object.keys(TABLE_NAME_MAP);
  const batchSize = options.batchSize ?? 25;
  const pauseMs = options.pauseMs ?? (process.env.NODE_ENV === 'test' ? 0 : 100);
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('batchSize must be 1..100');
  if (!Number.isInteger(pauseMs) || pauseMs < 0 || pauseMs > 10_000) throw new Error('pauseMs must be 0..10000');
  if (options.bjdCode && !/^\d{5,10}$/.test(options.bjdCode)) throw new Error('Invalid bjdCode');
  for (const type of types) if (!TABLE_NAME_MAP[type]) throw new Error(`Unknown real estate type: ${type}`);
  const results: AreaSummaryResult[] = [];
  for (const type of types) results.push(await refreshType(type, options, batchSize, pauseMs));
  return results;
}

async function refreshType(type: string, options: AreaSummaryOptions, batchSize: number, pauseMs: number): Promise<AreaSummaryResult> {
  const started = Date.now();
  const scope = options.bjdCode ?? '';
  const states = await prisma.$queryRawUnsafe<AreaState[]>(
    'SELECT runId, lastBuildingKey, dateThrough, completedAt FROM RealEstateAreaSummaryState WHERE type = ? AND scope = ?', type, scope,
  );
  const previous = states[0];
  // 완료된 실행에 --resume이면 다시 스캔하지 않는다. 매일 갱신은 --resume 없이 실행한다.
  if (options.resume && previous?.completedAt) return { type, buildings: 0, elapsedMs: Date.now() - started };
  const reuse = options.resume && previous;
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
  const regionSql = scope ? ' AND bjdCode = ?' : '';
  const regionParams = scope ? [scope] : [];
  while (true) {
    const rows = await prisma.$queryRawUnsafe<BuildingRow[]>(
      `SELECT buildingKey, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount
       FROM RealEstateBuildingSummaryV2 WHERE type = ? AND buildingKey > ?${regionSql}
       ORDER BY buildingKey LIMIT ${batchSize}`, type, lastBuildingKey, ...regionParams,
    );
    if (rows.length === 0) break;
    const keys: BuildingKey[] = rows.map((r) => ({
      propertyType: type.split('-')[0] as PropertyType, buildingName: r.buildingName,
      bjdCode: r.bjdCode, dongName: r.dongName, jibun: r.jibun,
    }));
    const values: Prisma.Sql[] = [];
    // 전 기간 창 함수 대신 기존의 단지별 인덱스 역방향 LIMIT 1을 그대로 공유한다.
    for (let band = 0; band < AREA_BANDS.length; band++) {
      const bundles = await getLatestDeals(keys, type.endsWith('-sale') ? 'sale' : 'rent', { area: AREA_BANDS[band], dateThrough });
      rows.forEach((row, index) => {
        const deals: LatestDeals = bundles.get(latestDealsKey(keys[index]))!;
        values.push(Prisma.sql`(${type}, ${row.buildingKey}, ${band}, ${row.buildingName}, ${row.bjdCode},
          ${row.city}, ${row.district}, ${row.dongName}, ${row.jibun}, ${row.lat}, ${row.lng}, ${row.transactionCount},
          ${deals.sale?.amount ?? null}, ${deals.jeonse?.deposit ?? null}, ${deals.wolse?.monthlyRent ?? null},
          ${JSON.stringify(deals)}, ${runId}, NOW(3))`);
      });
    }
    const nextCursor = rows[rows.length - 1].buildingKey;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`INSERT INTO RealEstateBuildingAreaSummary
        (type, buildingKey, areaBand, buildingName, bjdCode, city, district, dongName, jibun, lat, lng, transactionCount,
         saleAmount, jeonseDeposit, wolseMonthlyRent, latestDeals, refreshRunId, updatedAt)
        VALUES ${Prisma.join(values)}
        ON DUPLICATE KEY UPDATE buildingName=VALUES(buildingName), bjdCode=VALUES(bjdCode), city=VALUES(city),
          district=VALUES(district), dongName=VALUES(dongName), jibun=VALUES(jibun), lat=VALUES(lat), lng=VALUES(lng),
          transactionCount=VALUES(transactionCount), saleAmount=VALUES(saleAmount), jeonseDeposit=VALUES(jeonseDeposit),
          wolseMonthlyRent=VALUES(wolseMonthlyRent), latestDeals=VALUES(latestDeals), refreshRunId=VALUES(refreshRunId), updatedAt=NOW(3)`);
      await tx.$executeRawUnsafe('UPDATE RealEstateAreaSummaryState SET lastBuildingKey = ? WHERE type = ? AND scope = ? AND runId = ?', nextCursor, type, scope, runId);
    }, { timeout: 30_000 });
    lastBuildingKey = nextCursor;
    buildings += rows.length;
    console.info(`[AreaSummary] ${type}/${scope || '*'} buildings=${buildings} lastBuildingKey=${lastBuildingKey} elapsedMs=${Date.now() - started}`);
    if (pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  }
  // 성공한 범위만 정리한다. 중단/오류면 이전 행이 유지되고 커서부터 재개한다.
  let deleted: number;
  do {
    deleted = await prisma.$executeRawUnsafe(
      `DELETE FROM RealEstateBuildingAreaSummary WHERE type = ?${regionSql} AND NOT EXISTS (
        SELECT 1 FROM RealEstateBuildingSummaryV2 s
        WHERE s.type = RealEstateBuildingAreaSummary.type AND s.buildingKey = RealEstateBuildingAreaSummary.buildingKey
      ) LIMIT 500`,
      type, ...regionParams,
    );
    if (deleted && pauseMs) await new Promise((resolve) => setTimeout(resolve, pauseMs));
  } while (deleted > 0);
  // 중단 중 V2에 커서보다 앞선 새 키가 추가되어도, 불완전한 초기 결과를 공개하지 않는다.
  // 구간은 0~4만 세고 PK가 중복을 막으므로, 전체×5이면 모든 단지에 다섯 행이 있다.
  const [coverage] = await prisma.$queryRawUnsafe<Array<{ sourceCount: bigint | number; summaryCount: bigint | number }>>(
    `SELECT (SELECT COUNT(*) FROM RealEstateBuildingSummaryV2 WHERE type = ?${regionSql}) AS sourceCount,
       (SELECT COUNT(*) FROM RealEstateBuildingAreaSummary WHERE type = ?${regionSql} AND areaBand BETWEEN 0 AND 4) AS summaryCount`,
    type, ...regionParams, type, ...regionParams,
  );
  if (!coverage || Number(coverage.summaryCount) !== Number(coverage.sourceCount) * AREA_BANDS.length) {
    throw new Error('Area summary coverage changed; restart backfill without --resume');
  }
  await prisma.$executeRawUnsafe(
    'UPDATE RealEstateAreaSummaryState SET completedAt = NOW(3), readyAt = NOW(3) WHERE type = ? AND scope = ? AND runId = ?', type, scope, runId,
  );
  const result = { type, buildings, elapsedMs: Date.now() - started };
  console.info(`[AreaSummary] complete ${type}/${scope || '*'} ${JSON.stringify(result)}`);
  return result;
}
