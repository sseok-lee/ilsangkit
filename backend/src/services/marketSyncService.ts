import { prisma } from '../lib/prisma.js';
import { transformMarketRow, TransformedMarket } from './csvParser.js';
import type { MarketCSVRow } from './csvParser.js';
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

async function upsertOneMarket(market: TransformedMarket): Promise<'new' | 'updated'> {
  const existing = await prisma.market.findUnique({
    where: { sourceId: market.sourceId },
  });

  await prisma.market.upsert({
    where: { sourceId: market.sourceId },
    update: {
      name: market.name,
      address: market.address,
      roadAddress: market.roadAddress,
      lat: market.lat,
      lng: market.lng,
      city: market.city,
      district: market.district,
      marketType: market.marketType,
      openingCycle: market.openingCycle,
      storeCount: market.storeCount,
      products: market.products,
      giftCertificates: market.giftCertificates,
      homepageUrl: market.homepageUrl,
      hasPublicToilet: market.hasPublicToilet,
      hasParking: market.hasParking,
      foundedYear: market.foundedYear,
      phoneNumber: market.phoneNumber,
      dataDate: market.dataDate,
      providerCode: market.providerCode,
      providerName: market.providerName,
      syncedAt: new Date(),
    },
    create: {
      id: market.id,
      name: market.name,
      address: market.address,
      roadAddress: market.roadAddress,
      lat: market.lat,
      lng: market.lng,
      city: market.city,
      district: market.district,
      sourceId: market.sourceId,
      marketType: market.marketType,
      openingCycle: market.openingCycle,
      storeCount: market.storeCount,
      products: market.products,
      giftCertificates: market.giftCertificates,
      homepageUrl: market.homepageUrl,
      hasPublicToilet: market.hasPublicToilet,
      hasParking: market.hasParking,
      foundedYear: market.foundedYear,
      phoneNumber: market.phoneNumber,
      dataDate: market.dataDate,
      providerCode: market.providerCode,
      providerName: market.providerName,
    },
  });

  return existing ? 'updated' : 'new';
}

async function syncMarketRows(rows: MarketCSVRow[], stats: SyncStats, syncHistoryId: number): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  console.info('Transforming data...');
  const uniqueMarkets = transformAndDedupe(
    rows,
    transformMarketRow,
    (m) => m.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueMarkets.length} unique records, skipped ${stats.skippedRecords}`);

  console.info('Upserting to database...');
  const { newCount, updateCount } = await batchUpsert(uniqueMarkets, upsertOneMarket, 100, syncHistoryId);
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

export async function syncMarketsFromApi(): Promise<SyncStats> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('market');

  try {
    console.info('Starting market data sync (API mode)...');

    const client = new PublicApiClient(
      'https://api.data.go.kr/openapi/tn_pubr_public_trdit_mrkt_api',
      serviceKey,
      { maxRetries: SYNC.MAX_RETRIES, retryDelay: SYNC.RETRY_BASE_DELAY_MS }
    );

    const rows = await client.fetchAllPages<MarketCSVRow>(SYNC.PAGE_SIZE);
    await syncMarketRows(rows, stats, syncHistory.id);

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`market API sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('market API sync failed:', errorMessage);
    throw error;
  }
}

export default { syncMarketsFromApi, createSyncHistory, updateSyncHistory };
