// @TASK T9.3.2 - 공공도서관 동기화 서비스

import { prisma } from '../lib/prisma.js';
import { parseLibraryCSV, transformLibraryRow } from './csvParser.js';
import {
  type SyncStats,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsert,
} from './baseSyncService.js';
import type { TransformedLibrary } from './csvParser.js';

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
    },
  });

  return existing ? 'updated' : 'new';
}

/**
 * 공공도서관 데이터 동기화 메인 함수
 */
export async function syncLibraries(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('library');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    // CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseLibraryCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

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
    const { newCount, updateCount } = await batchUpsert(uniqueLibraries, upsertOneLibrary, 100, syncHistory.id);
    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

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
