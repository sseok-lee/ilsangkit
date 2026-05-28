/**
 * 지하철역 동기화 서비스 — toilet/library 패턴을 그대로 차용한 CSV 기반 sync.
 */

import {
  runSync,
  batchUpsertRaw,
  type SyncStats,
} from './baseSyncService.js';
import {
  parseSubwayCSV,
  transformAll,
} from './subwayDataSource.js';

export async function syncSubwayStations(csvPath: string): Promise<SyncStats> {
  return runSync('subway', async (stats) => {
    console.info(`Parsing CSV: ${csvPath}`);
    const rows = await parseSubwayCSV(csvPath);
    stats.totalRecords = rows.length;
    console.info(`Parsed ${rows.length} CSV rows`);

    const { stations, skipped } = transformAll(rows);
    stats.skippedRecords += skipped;
    console.info(`Transformed ${stations.length} unique stations (skipped ${skipped})`);

    const now = new Date();
    const rowsForUpsert = stations.map((s) => ({
      id: s.id,
      sourceId: s.sourceId,
      name: s.name,
      nameSlug: s.nameSlug,
      line: s.line,
      transferLines: s.transferLines,
      operator: s.operator,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      roadAddress: s.roadAddress,
      city: s.city,
      district: s.district,
      regionSlug: s.regionSlug,
      phoneNumber: s.phoneNumber,
      dataDate: s.dataDate,
      // createdAt 생략 — schema @default(now())가 처리
      updatedAt: now,
      syncedAt: now,
    }));

    const { newCount, updateCount } = await batchUpsertRaw(
      'SubwayStation',
      rowsForUpsert,
      100,
      undefined,
      { exactStats: true, uniqueKey: 'sourceId' }
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
  });
}

export default { syncSubwayStations };
