// @TASK T9.3.2 - 공공도서관 동기화 서비스

import { prisma } from '../lib/prisma.js';
import { parseLibraryCSV, transformLibraryRow } from './csvParser.js';
import type { LibraryCSVRow, TransformedLibrary } from './csvParser.js';
import { PublicApiClient } from './publicApiClient.js';
import {
  type SyncStats,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsert,
} from './baseSyncService.js';
import { SYNC } from '../constants/index.js';

/**
 * 개별 Library 레코드 upsert
 */
async function upsertOneLibrary(library: TransformedLibrary): Promise<'new' | 'updated'> {
  const existing = await prisma.library.findUnique({
    where: { sourceId: library.sourceId },
  });

  await prisma.library.upsert({
    where: { sourceId: library.sourceId },
    update: {
      name: library.name,
      address: library.address,
      roadAddress: library.roadAddress,
      lat: library.lat,
      lng: library.lng,
      city: library.city,
      district: library.district,
      syncedAt: new Date(),
      libraryType: library.libraryType,
      closedDays: library.closedDays,
      weekdayOpenTime: library.weekdayOpenTime,
      weekdayCloseTime: library.weekdayCloseTime,
      saturdayOpenTime: library.saturdayOpenTime,
      saturdayCloseTime: library.saturdayCloseTime,
      holidayOpenTime: library.holidayOpenTime,
      holidayCloseTime: library.holidayCloseTime,
      seatCount: library.seatCount,
      bookCount: library.bookCount,
      serialCount: library.serialCount,
      nonBookCount: library.nonBookCount,
      loanableBooks: library.loanableBooks,
      loanableDays: library.loanableDays,
      phoneNumber: library.phoneNumber,
      homepageUrl: library.homepageUrl,
      operatingOrg: library.operatingOrg,
      lotArea: library.lotArea,
      buildingArea: library.buildingArea,
      dataDate: library.dataDate,
      providerCode: library.providerCode,
      providerName: library.providerName,
    },
    create: {
      id: library.id,
      name: library.name,
      address: library.address,
      roadAddress: library.roadAddress,
      lat: library.lat,
      lng: library.lng,
      city: library.city,
      district: library.district,
      sourceId: library.sourceId,
      libraryType: library.libraryType,
      closedDays: library.closedDays,
      weekdayOpenTime: library.weekdayOpenTime,
      weekdayCloseTime: library.weekdayCloseTime,
      saturdayOpenTime: library.saturdayOpenTime,
      saturdayCloseTime: library.saturdayCloseTime,
      holidayOpenTime: library.holidayOpenTime,
      holidayCloseTime: library.holidayCloseTime,
      seatCount: library.seatCount,
      bookCount: library.bookCount,
      serialCount: library.serialCount,
      nonBookCount: library.nonBookCount,
      loanableBooks: library.loanableBooks,
      loanableDays: library.loanableDays,
      phoneNumber: library.phoneNumber,
      homepageUrl: library.homepageUrl,
      operatingOrg: library.operatingOrg,
      lotArea: library.lotArea,
      buildingArea: library.buildingArea,
      dataDate: library.dataDate,
      providerCode: library.providerCode,
      providerName: library.providerName,
    },
  });

  return existing ? 'updated' : 'new';
}

/**
 * 공통 library 동기화 로직 (CSV rows 또는 API rows를 받아 처리)
 */
async function syncLibraryRows(rows: LibraryCSVRow[], stats: SyncStats, syncHistoryId: number): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  // 데이터 변환 + 중복 제거
  console.info('Transforming data...');
  const uniqueLibraries = transformAndDedupe(
    rows,
    transformLibraryRow,
    (t) => t.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueLibraries.length} unique records, skipped ${stats.skippedRecords}`);

  // DB Upsert (트랜잭션 래핑 + 진행 상황 추적)
  console.info('Upserting to database...');
  const { newCount, updateCount } = await batchUpsert(uniqueLibraries, upsertOneLibrary, 100, syncHistoryId);
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

/**
 * 공공도서관 데이터 동기화 메인 함수 (CSV)
 */
export async function syncLibraries(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('library');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    // CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseLibraryCSV(csvFilePath);
    await syncLibraryRows(rows, stats, syncHistory.id);

    // 성공 시 SyncHistory 업데이트
    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`library sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('library sync failed:', errorMessage);
    throw error;
  }
}

/**
 * 공공도서관 데이터 API 동기화 함수
 */
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

    const rows = await client.fetchAllPages<LibraryCSVRow>(100);
    await syncLibraryRows(rows, stats, syncHistory.id);

    // 성공 시 SyncHistory 업데이트
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
