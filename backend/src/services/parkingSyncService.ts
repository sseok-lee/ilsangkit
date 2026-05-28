import { transformParkingRow } from './csvParser.js';
import type { ParkingCSVRow } from './csvParser.js';
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

async function syncParkingRows(rows: ParkingCSVRow[], stats: SyncStats, syncHistoryId: number): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  console.info('Transforming data...');
  const uniqueParkings = transformAndDedupe(
    rows,
    transformParkingRow,
    (p) => p.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueParkings.length} valid records, skipped ${stats.skippedRecords}`);

  console.info('Upserting to database...');
  const now = new Date();
  const rowsForUpsert = uniqueParkings.map((p) => ({
    id: p.id,
    name: p.name,
    address: p.address,
    roadAddress: p.roadAddress,
    lat: p.lat,
    lng: p.lng,
    city: p.city,
    district: p.district,
    sourceId: p.sourceId,
    parkingType: p.parkingType,
    lotType: p.lotType,
    capacity: p.capacity,
    baseFee: p.baseFee,
    baseTime: p.baseTime,
    additionalFee: p.additionalFee,
    additionalTime: p.additionalTime,
    dailyMaxFee: p.dailyMaxFee,
    monthlyFee: p.monthlyFee,
    operatingHours: p.operatingHours,
    phone: p.phone,
    paymentMethod: p.paymentMethod,
    remarks: p.remarks,
    hasDisabledParking: p.hasDisabledParking,
    zoneClass: p.zoneClass,
    alternateParking: p.alternateParking,
    operatingDays: p.operatingDays,
    feeType: p.feeType,
    dailyMaxFeeHours: p.dailyMaxFeeHours,
    managingOrg: p.managingOrg,
    dataDate: p.dataDate,
    providerCode: p.providerCode,
    providerName: p.providerName,
    // createdAt 생략 — schema @default(now())가 처리
    updatedAt: now,
    syncedAt: now,
  }));

  const { newCount, updateCount } = await batchUpsertRaw(
    'Parking',
    rowsForUpsert,
    100,
    syncHistoryId,
    { exactStats: true, uniqueKey: 'sourceId' }
  );
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

export async function syncParkingFromApi(): Promise<SyncStats> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('parking');

  try {
    console.info('Starting parking data sync (API mode)...');

    const client = new PublicApiClient(
      'http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api',
      serviceKey,
      { maxRetries: SYNC.MAX_RETRIES, retryDelay: SYNC.RETRY_BASE_DELAY_MS }
    );

    const rows = await client.fetchAllPages<ParkingCSVRow>(SYNC.PAGE_SIZE);
    await syncParkingRows(rows, stats, syncHistory.id);

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`parking API sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('parking API sync failed:', errorMessage);
    throw error;
  }
}

export default { syncParkingFromApi, createSyncHistory, updateSyncHistory };
