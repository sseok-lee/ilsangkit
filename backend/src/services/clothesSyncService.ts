import { prisma } from '../lib/prisma.js';
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
  batchUpsert,
} from './baseSyncService.js';
import { SYNC } from '../constants/index.js';

export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

async function upsertOneClothes(clothes: ReturnType<typeof transformClothesRow> & object): Promise<'new' | 'updated'> {
  const existing = await prisma.clothes.findUnique({
    where: { sourceId: clothes.sourceId },
  });

  await prisma.clothes.upsert({
    where: { sourceId: clothes.sourceId },
    update: {
      name: clothes.name,
      address: clothes.address,
      roadAddress: clothes.roadAddress,
      lat: clothes.lat,
      lng: clothes.lng,
      city: clothes.city,
      district: clothes.district,
      syncedAt: new Date(),
      managementAgency: clothes.managementAgency,
      phoneNumber: clothes.phoneNumber,
      dataDate: clothes.dataDate,
      detailLocation: clothes.detailLocation,
      providerCode: clothes.providerCode,
      providerName: clothes.providerName,
    },
    create: {
      id: clothes.id,
      name: clothes.name,
      address: clothes.address,
      roadAddress: clothes.roadAddress,
      lat: clothes.lat,
      lng: clothes.lng,
      city: clothes.city,
      district: clothes.district,
      sourceId: clothes.sourceId,
      managementAgency: clothes.managementAgency,
      phoneNumber: clothes.phoneNumber,
      dataDate: clothes.dataDate,
      detailLocation: clothes.detailLocation,
      providerCode: clothes.providerCode,
      providerName: clothes.providerName,
    },
  });

  return existing ? 'updated' : 'new';
}

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
  const { newCount, updateCount } = await batchUpsert(uniqueClothes, upsertOneClothes, 100, syncHistoryId);
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
      'http://api.data.go.kr/openapi/tn_pubr_public_clothing_collect_bins_api',
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
