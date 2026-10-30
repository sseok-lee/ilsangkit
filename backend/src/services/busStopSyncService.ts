/**
 * 버스정류장 동기화 서비스 — 판(YYYYMMDD) 단위 통째 교체.
 * 같은 판이면 API 호출 없이 건너뛰고, 새 판은 upsert 가 끝난 뒤에만 옛 판을 지운다.
 */

import { readFileSync } from 'fs';
import { runSync, batchUpsertRaw, type SyncStats } from './baseSyncService.js';
import {
  normalizeBusStopRows,
  parseBusStopCsvFile,
  type BusStopRawRow,
} from './busStopDataSource.js';
import { fetchLatestBusStopVersion, fetchAllBusStopRows } from './busStopApiClient.js';
import prisma from '../lib/prisma.js';

export interface BusStopSyncInput {
  version: string;
  // 판 비교 뒤에만 호출한다 (같은 판이면 호출 0회)
  loadRows: () => Promise<BusStopRawRow[]>;
}

export type BusStopSyncResult = SyncStats & { outcome: 'loaded' | 'skipped' };

// 새 판이 이전 건수의 이 비율보다 작으면 부분 응답으로 보고 중단한다
const MIN_RETAIN_RATIO = 0.8;
const UPSERT_BATCH_SIZE = 500;

export async function syncBusStops(input: BusStopSyncInput): Promise<BusStopSyncResult> {
  const { version, loadRows } = input;
  let outcome: 'loaded' | 'skipped' = 'loaded';

  const stats = await runSync(
    'bus-stop',
    async (s) => {
      // 건너뛰기: 테이블이 비어 있지 않고 옛 판 행이 하나도 없을 때만.
      // (이전 실행이 중간 실패해 새 판/옛 판이 섞여 있으면 다시 적재해야 한다)
      const prevCount = await prisma.busStop.count();
      const staleCount =
        prevCount > 0
          ? await prisma.busStop.count({ where: { sourceVersion: { not: version } } })
          : 0;
      if (prevCount > 0 && staleCount === 0) {
        console.info(`BusStop 판 ${version} 은 이미 적재됨 — 건너뜁니다`);
        outcome = 'skipped';
        return;
      }

      const raw = await loadRows();
      const { records, skipped } = normalizeBusStopRows(raw);
      s.totalRecords = records.length;
      s.skippedRecords += skipped;
      console.info(`BusStop 정규화: ${records.length}건 (제외 ${skipped}건), 판 ${version}`);

      // 0건은 업스트림 장애/오디코딩 신호다 — 성공 처리도, 삭제도 하지 않는다
      if (records.length === 0) {
        throw new Error(`버스정류장 판 ${version} 정규화 결과가 0건입니다 (원본 ${raw.length}행)`);
      }

      if (prevCount > 0 && records.length < prevCount * MIN_RETAIN_RATIO) {
        throw new Error(
          `버스정류장 새 판 ${records.length}건이 기존 ${prevCount}건의 80% 미만이라 중단합니다 (부분 응답 의심)`,
        );
      }

      const now = new Date();
      const rows = records.map((r) => ({
        nodeId: r.nodeId,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        mobileId: r.mobileId,
        cityCode: r.cityCode,
        cityName: r.cityName,
        adminName: r.adminName,
        collectedAt: r.collectedAt,
        sourceVersion: version,
        updatedAt: now,
        syncedAt: now,
      }));

      const { newCount, updateCount } = await batchUpsertRaw(
        'BusStop',
        rows,
        UPSERT_BATCH_SIZE,
        undefined,
        { exactStats: true, uniqueKey: 'nodeId' },
      );
      s.newRecords = newCount;
      s.updatedRecords = updateCount;

      // upsert 가 모두 성공한 뒤에만 옛 판을 지운다
      const deleted = await prisma.busStop.deleteMany({
        where: { sourceVersion: { not: version } },
      });
      console.info(`BusStop 옛 판 ${deleted.count}건 삭제`);
    },
    { allowEmpty: true },
  );

  return { ...stats, outcome };
}

// 정보수집일(YYYY-MM-DD 등)에서 숫자만 뽑아 YYYYMMDD 로 만든다
function versionFromRows(rows: BusStopRawRow[]): string {
  const digits = String(rows[0]?.['정보수집일'] ?? '').replace(/\D/g, '');
  if (digits.length !== 8) {
    throw new Error('--version 이 없고 첫 행 정보수집일에서도 판을 얻지 못했습니다');
  }
  return digits;
}

export async function syncLatestBusStops(
  opts: { localCsv?: string; version?: string } = {},
): Promise<BusStopSyncResult> {
  if (opts.localCsv) {
    const rows = parseBusStopCsvFile(readFileSync(opts.localCsv));
    const version = opts.version ?? versionFromRows(rows);
    return syncBusStops({ version, loadRows: async () => rows });
  }

  const ver = await fetchLatestBusStopVersion();
  return syncBusStops({
    version: opts.version ?? ver.version,
    loadRows: () => fetchAllBusStopRows(ver),
  });
}

export default { syncBusStops, syncLatestBusStops };
