import { transformLibraryRow } from './csvParser.js';
import type { LibraryCSVRow } from './csvParser.js';
import { PublicApiClient } from './publicApiClient.js';
import {
  type SyncStats,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsertRaw,
} from './baseSyncService.js';
import { SYNC } from '../constants/index.js';

async function syncLibraryRows(rows: LibraryCSVRow[], stats: SyncStats, syncHistoryId: number): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  console.info('Transforming data...');
  const uniqueLibraries = transformAndDedupe(
    rows,
    transformLibraryRow,
    (t) => t.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueLibraries.length} unique records, skipped ${stats.skippedRecords}`);

  console.info('Upserting to database...');
  const now = new Date();
  const rowsForUpsert = uniqueLibraries.map((l) => ({
    id: l.id,
    name: l.name,
    address: l.address,
    roadAddress: l.roadAddress,
    lat: l.lat,
    lng: l.lng,
    city: l.city,
    district: l.district,
    sourceId: l.sourceId,
    libraryType: l.libraryType,
    closedDays: l.closedDays,
    weekdayOpenTime: l.weekdayOpenTime,
    weekdayCloseTime: l.weekdayCloseTime,
    saturdayOpenTime: l.saturdayOpenTime,
    saturdayCloseTime: l.saturdayCloseTime,
    holidayOpenTime: l.holidayOpenTime,
    holidayCloseTime: l.holidayCloseTime,
    seatCount: l.seatCount,
    bookCount: l.bookCount,
    serialCount: l.serialCount,
    nonBookCount: l.nonBookCount,
    loanableBooks: l.loanableBooks,
    loanableDays: l.loanableDays,
    phoneNumber: l.phoneNumber,
    homepageUrl: l.homepageUrl,
    operatingOrg: l.operatingOrg,
    lotArea: l.lotArea,
    buildingArea: l.buildingArea,
    dataDate: l.dataDate,
    providerCode: l.providerCode,
    providerName: l.providerName,
    // createdAt 생략 — schema @default(now())가 처리
    updatedAt: now,
    syncedAt: now,
  }));

  const { newCount, updateCount } = await batchUpsertRaw(
    'Library',
    rowsForUpsert,
    100,
    syncHistoryId,
    { exactStats: true, uniqueKey: 'sourceId' }
  );
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

export async function syncLibrariesFromApi(): Promise<SyncStats> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('library');

  try {
    console.info('Starting library data sync (API mode)...');

    const client = new PublicApiClient(
      'http://api.data.go.kr/openapi/tn_pubr_public_lbrry_api',
      serviceKey,
      { maxRetries: SYNC.MAX_RETRIES, retryDelay: SYNC.RETRY_BASE_DELAY_MS }
    );

    const rows = await client.fetchAllPages<LibraryCSVRow>(SYNC.PAGE_SIZE);
    await syncLibraryRows(rows, stats, syncHistory.id);

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`library API sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('library API sync failed:', errorMessage);
    throw error;
  }
}
