import { prisma } from '../lib/prisma.js';
import { transformParkingRow, TransformedParking } from './csvParser.js';
import type { ParkingCSVRow } from './csvParser.js';
import { PublicApiClient } from './publicApiClient.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsert,
} from './baseSyncService.js';
import { SYNC } from '../constants/index.js';

export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

async function upsertOneParking(parking: TransformedParking): Promise<'new' | 'updated'> {
  const existing = await prisma.parking.findUnique({
    where: { sourceId: parking.sourceId },
  });

  await prisma.parking.upsert({
    where: { sourceId: parking.sourceId },
    update: {
      name: parking.name,
      address: parking.address,
      roadAddress: parking.roadAddress,
      lat: parking.lat,
      lng: parking.lng,
      city: parking.city,
      district: parking.district,
      syncedAt: new Date(),
      parkingType: parking.parkingType,
      lotType: parking.lotType,
      capacity: parking.capacity,
      baseFee: parking.baseFee,
      baseTime: parking.baseTime,
      additionalFee: parking.additionalFee,
      additionalTime: parking.additionalTime,
      dailyMaxFee: parking.dailyMaxFee,
      monthlyFee: parking.monthlyFee,
      operatingHours: parking.operatingHours,
      phone: parking.phone,
      paymentMethod: parking.paymentMethod,
      remarks: parking.remarks,
      hasDisabledParking: parking.hasDisabledParking,
      zoneClass: parking.zoneClass,
      alternateParking: parking.alternateParking,
      operatingDays: parking.operatingDays,
      feeType: parking.feeType,
      dailyMaxFeeHours: parking.dailyMaxFeeHours,
      managingOrg: parking.managingOrg,
      dataDate: parking.dataDate,
      providerCode: parking.providerCode,
      providerName: parking.providerName,
    },
    create: {
      id: parking.id,
      name: parking.name,
      address: parking.address,
      roadAddress: parking.roadAddress,
      lat: parking.lat,
      lng: parking.lng,
      city: parking.city,
      district: parking.district,
      sourceId: parking.sourceId,
      parkingType: parking.parkingType,
      lotType: parking.lotType,
      capacity: parking.capacity,
      baseFee: parking.baseFee,
      baseTime: parking.baseTime,
      additionalFee: parking.additionalFee,
      additionalTime: parking.additionalTime,
      dailyMaxFee: parking.dailyMaxFee,
      monthlyFee: parking.monthlyFee,
      operatingHours: parking.operatingHours,
      phone: parking.phone,
      paymentMethod: parking.paymentMethod,
      remarks: parking.remarks,
      hasDisabledParking: parking.hasDisabledParking,
      zoneClass: parking.zoneClass,
      alternateParking: parking.alternateParking,
      operatingDays: parking.operatingDays,
      feeType: parking.feeType,
      dailyMaxFeeHours: parking.dailyMaxFeeHours,
      managingOrg: parking.managingOrg,
      dataDate: parking.dataDate,
      providerCode: parking.providerCode,
      providerName: parking.providerName,
    },
  });

  return existing ? 'updated' : 'new';
}

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
  const { newCount, updateCount } = await batchUpsert(uniqueParkings, upsertOneParking, 100, syncHistoryId);
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
