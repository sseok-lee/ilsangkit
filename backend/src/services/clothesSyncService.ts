import { transformClothesRow } from './csvParser.js';
import type { ClothesCSVRow } from './csvParser.js';
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

async function syncClothesRows(rows: ClothesCSVRow[], stats: SyncStats, syncHistoryId: number): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  console.info('Transforming data...');
  const uniqueClothes = transformAndDedupe(
    rows,
    transformClothesRow,
    (c) => c.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueClothes.length} valid records, skipped ${stats.skippedRecords}`);

  console.info('Upserting to database...');
  const now = new Date();
  const rowsForUpsert = uniqueClothes.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    roadAddress: c.roadAddress,
    lat: c.lat,
    lng: c.lng,
    city: c.city,
    district: c.district,
    sourceId: c.sourceId,
    managementAgency: c.managementAgency,
    phoneNumber: c.phoneNumber,
    dataDate: c.dataDate,
    detailLocation: c.detailLocation,
    providerCode: c.providerCode,
    providerName: c.providerName,
    // createdAt 생략 — schema @default(now())가 처리
    updatedAt: now,
    syncedAt: now,
  }));

  const { newCount, updateCount } = await batchUpsertRaw(
    'Clothes',
    rowsForUpsert,
    100,
    syncHistoryId,
    { exactStats: true, uniqueKey: 'sourceId' }
  );
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

export async function syncClothesFromApi(): Promise<SyncStats> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('clothes');

  try {
    console.info('Starting clothes data sync (API mode)...');

    const client = new PublicApiClient(
      'https://api.data.go.kr/openapi/tn_pubr_public_clothing_collect_bins_api',
      serviceKey,
      { maxRetries: SYNC.MAX_RETRIES, retryDelay: SYNC.RETRY_BASE_DELAY_MS }
    );

    const rows = await client.fetchAllPages<ClothesCSVRow>(SYNC.PAGE_SIZE);
    await syncClothesRows(rows, stats, syncHistory.id);

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`clothes API sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('clothes API sync failed:', errorMessage);
    throw error;
  }
}

export default { syncClothesFromApi, createSyncHistory, updateSyncHistory };
