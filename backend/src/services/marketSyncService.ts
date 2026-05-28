import { transformMarketRow } from './csvParser.js';
import type { MarketCSVRow } from './csvParser.js';
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

  // DB Upsert — batchUpsertRaw로 N+1 제거. exactStats=true로 통계 정확성 유지.
  console.info('Upserting to database...');
  const now = new Date();
  const rowsForUpsert = uniqueMarkets.map((m) => ({
    id: `market-${m.sourceId}`,
    name: m.name,
    address: m.address,
    roadAddress: m.roadAddress,
    lat: m.lat,
    lng: m.lng,
    city: m.city,
    district: m.district,
    sourceId: m.sourceId,
    marketType: m.marketType,
    openingCycle: m.openingCycle,
    storeCount: m.storeCount,
    products: m.products,
    giftCertificates: m.giftCertificates,
    homepageUrl: m.homepageUrl,
    hasPublicToilet: m.hasPublicToilet,
    hasParking: m.hasParking,
    foundedYear: m.foundedYear,
    phoneNumber: m.phoneNumber,
    dataDate: m.dataDate,
    providerCode: m.providerCode,
    providerName: m.providerName,
    // createdAt 생략 — schema @default(now())가 처리. SKIP_UPDATE_COLS 의존을 줄이고
    // viewCount/bjdCode/sourceUrl 등 다른 default 컬럼들과 일관.
    updatedAt: now,   // raw INSERT 필수 (schema @updatedAt은 Prisma application-level, raw 우회 시 NULL 위반). UPDATE는 batchUpsertRaw가 NOW()로 강제.
    syncedAt: now,    // 동일 — DB default 있지만 batchUpsertRaw가 ON DUPLICATE 시 NOW()로 갱신하도록 payload 포함.
  }));

  const { newCount, updateCount } = await batchUpsertRaw(
    'Market',
    rowsForUpsert,
    100,
    syncHistoryId,
    { exactStats: true, uniqueKey: 'sourceId' }
  );

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
