import { transformParkRow } from './csvParser.js';
import type { ParkCSVRow } from './csvParser.js';
import { PublicApiClient } from './publicApiClient.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsertRaw,
} from './baseSyncService.js';
import { SYNC } from '../constants/index.js';

export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

async function syncParkRows(rows: ParkCSVRow[], stats: SyncStats, syncHistoryId: number): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  console.info('Transforming data...');
  const uniqueParks = transformAndDedupe(
    rows,
    transformParkRow,
    (p) => p.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueParks.length} unique records, skipped ${stats.skippedRecords}`);

  console.info('Upserting to database...');
  const now = new Date();
  const rowsForUpsert = uniqueParks.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    roadAddress: p.roadAddress,
    lat: p.lat,
    lng: p.lng,
    city: p.city,
    district: p.district,
    sourceId: p.sourceId,
    parkType: p.parkType,
    area: p.area,
    exerciseFacilities: p.exerciseFacilities,
    playFacilities: p.playFacilities,
    convenienceFacilities: p.convenienceFacilities,
    cultureFacilities: p.cultureFacilities,
    otherFacilities: p.otherFacilities,
    designatedDate: p.designatedDate,
    managingOrg: p.managingOrg,
    phoneNumber: p.phoneNumber,
    dataDate: p.dataDate,
    providerCode: p.providerCode,
    providerName: p.providerName,
    // createdAt 생략 — schema @default(now())가 처리
    updatedAt: now,
    syncedAt: now,
  }));

  const { newCount, updateCount } = await batchUpsertRaw(
    'Park',
    rowsForUpsert,
    100,
    syncHistoryId,
    { exactStats: true, uniqueKey: 'sourceId' }
  );
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

export async function syncParksFromApi(): Promise<SyncStats> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('park');

  try {
    console.info('Starting park data sync (API mode)...');

    const client = new PublicApiClient(
      'https://api.data.go.kr/openapi/tn_pubr_public_cty_park_info_api',
      serviceKey,
      { maxRetries: SYNC.MAX_RETRIES, retryDelay: SYNC.RETRY_BASE_DELAY_MS }
    );

    const rows = await client.fetchAllPages<ParkCSVRow>(SYNC.PAGE_SIZE);
    await syncParkRows(rows, stats, syncHistory.id);

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`park API sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('park API sync failed:', errorMessage);
    throw error;
  }
}

export default { syncParksFromApi, createSyncHistory, updateSyncHistory };
