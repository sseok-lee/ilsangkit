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
import { fetchAllTagoRows } from './busStopTagoClient.js';
import prisma from '../lib/prisma.js';

export interface BusStopSyncInput {
  version: string;
  // true 면 같은 판이어도 다시 받는다 (TAGO 보충분을 새로 받을 때)
  force?: boolean;
  // 판 비교 뒤에만 호출한다 (같은 판이면 호출 0회)
  loadRows: () => Promise<BusStopRawRow[]>;
}

export type BusStopSyncResult = SyncStats & { outcome: 'loaded' | 'skipped' };

// 새 판이 이전 건수의 이 비율보다 작으면 부분 응답으로 보고 중단한다
const MIN_RETAIN_RATIO = 0.8;
const UPSERT_BATCH_SIZE = 500;

export async function syncBusStops(input: BusStopSyncInput): Promise<BusStopSyncResult> {
  const { version, loadRows, force = false } = input;
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
      // 같은 판만 남아 있어도 첫 적재가 중간 실패했을 수 있다(upsert 는 500건 배치별 커밋).
      // 그래서 직전 실행의 SyncHistory 가 success 일 때만 건너뛴다.
      // runSync 가 이미 이번 실행의 'running' 행을 만들었고 콜백은 그 id 를 모르므로,
      // 최신 id 순 2건을 읽어 첫 행(=이번 실행)을 빼고 둘째 행을 직전 실행으로 본다.
      let prevRunSucceeded = false;
      if (prevCount > 0 && staleCount === 0) {
        const recent = await prisma.syncHistory.findMany({
          where: { category: 'bus-stop' },
          orderBy: { id: 'desc' },
          take: 2,
          select: { id: true, status: true },
        });
        prevRunSucceeded = recent[1]?.status === 'success';
      }
      if (!force && prevCount > 0 && staleCount === 0 && prevRunSucceeded) {
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

// 파일 행 뒤에 TAGO 행을 붙인다. 정규화가 같은 정류장번호의 첫 행만 남기므로 파일 데이터가 우선한다.
async function withTago(loadFile: () => Promise<BusStopRawRow[]>, tago: boolean): Promise<BusStopRawRow[]> {
  const fileRows = await loadFile();
  if (!tago) return fileRows;
  const { rows, cities, failedCities } = await fetchAllTagoRows();
  console.info(
    `TAGO 보충: ${cities}개 도시 ${rows.length}건${failedCities.length ? ` (실패 ${failedCities.join(', ')})` : ''}`,
  );
  return [...fileRows, ...rows];
}

export async function syncLatestBusStops(
  opts: { localCsv?: string; version?: string; force?: boolean; tago?: boolean } = {},
): Promise<BusStopSyncResult> {
  const tago = opts.tago ?? true;
  if (opts.localCsv) {
    const rows = parseBusStopCsvFile(readFileSync(opts.localCsv));
    const version = opts.version ?? versionFromRows(rows);
    return syncBusStops({ version, force: opts.force, loadRows: () => withTago(async () => rows, tago) });
  }

  const ver = await fetchLatestBusStopVersion();
  return syncBusStops({
    version: opts.version ?? ver.version,
    force: opts.force,
    loadRows: () => withTago(() => fetchAllBusStopRows(ver), tago),
  });
}

export default { syncBusStops, syncLatestBusStops };
