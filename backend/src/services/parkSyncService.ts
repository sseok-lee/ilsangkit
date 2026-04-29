import { prisma } from '../lib/prisma.js';
import { transformParkRow, TransformedPark } from './csvParser.js';
import type { ParkCSVRow } from './csvParser.js';
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

async function upsertOnePark(park: TransformedPark): Promise<'new' | 'updated'> {
  const existing = await prisma.park.findUnique({
    where: { sourceId: park.sourceId },
  });

  await prisma.park.upsert({
    where: { sourceId: park.sourceId },
    update: {
      name: park.name,
      address: park.address,
      roadAddress: park.roadAddress,
      lat: park.lat,
      lng: park.lng,
      city: park.city,
      district: park.district,
      parkType: park.parkType,
      area: park.area,
      exerciseFacilities: park.exerciseFacilities,
      playFacilities: park.playFacilities,
      convenienceFacilities: park.convenienceFacilities,
      cultureFacilities: park.cultureFacilities,
      otherFacilities: park.otherFacilities,
      designatedDate: park.designatedDate,
      managingOrg: park.managingOrg,
      phoneNumber: park.phoneNumber,
      dataDate: park.dataDate,
      providerCode: park.providerCode,
      providerName: park.providerName,
      syncedAt: new Date(),
    },
    create: {
      id: park.id,
      name: park.name,
      address: park.address,
      roadAddress: park.roadAddress,
      lat: park.lat,
      lng: park.lng,
      city: park.city,
      district: park.district,
      sourceId: park.sourceId,
      parkType: park.parkType,
      area: park.area,
      exerciseFacilities: park.exerciseFacilities,
      playFacilities: park.playFacilities,
      convenienceFacilities: park.convenienceFacilities,
      cultureFacilities: park.cultureFacilities,
      otherFacilities: park.otherFacilities,
      designatedDate: park.designatedDate,
      managingOrg: park.managingOrg,
      phoneNumber: park.phoneNumber,
      dataDate: park.dataDate,
      providerCode: park.providerCode,
      providerName: park.providerName,
    },
  });

  return existing ? 'updated' : 'new';
}

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
  const { newCount, updateCount } = await batchUpsert(uniqueParks, upsertOnePark, 100, syncHistoryId);
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
