// @TASK T9.1.2 - 공영주차장 동기화 서비스 (API + CSV)

import { prisma } from '../lib/prisma.js';
import { parseParkingCSV, transformParkingRow, TransformedParking } from './csvParser.js';
import type { ParkingCSVRow } from './csvParser.js';
import { PublicApiClient } from './publicApiClient.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  runSync,
  transformAndDedupe,
  batchUpsert,
} from './baseSyncService.js';

// Re-export for backward compatibility (tests import from here)
export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

/**
 * 개별 Parking 레코드 upsert
 */
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
    },
  });

  return existing ? 'updated' : 'new';
}

/**
 * 공통 parking 동기화 로직 (CSV rows 또는 API rows를 받아 처리)
 */
async function syncParkingRows(rows: ParkingCSVRow[], stats: SyncStats): Promise<void> {
  stats.totalRecords = rows.length;
  console.info(`Found ${rows.length} records`);

  // 데이터 변환 + 중복 제거
  console.info('Transforming data...');
  const uniqueParkings = transformAndDedupe(
    rows,
    transformParkingRow,
    (p) => p.sourceId,
    stats
  );

  console.info(`Transformed ${uniqueParkings.length} valid records, skipped ${stats.skippedRecords}`);

  // DB Upsert
  console.info('Upserting to database...');
  const { newCount, updateCount } = await batchUpsert(uniqueParkings, upsertOneParking);
  stats.newRecords = newCount;
  stats.updatedRecords = updateCount;
}

/**
 * 공영주차장 데이터 동기화 메인 함수
 */
export async function syncParking(csvFilePath: string): Promise<SyncStats> {
  return runSync('parking', async (stats) => {
    console.info(`CSV file: ${csvFilePath}`);

    // CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseParkingCSV(csvFilePath);
    await syncParkingRows(rows, stats);
  });
}

/**
 * 공영주차장 데이터 API 동기화 함수
 */
export async function syncParkingFromApi(): Promise<SyncStats> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  return runSync('parking', async (stats) => {
    console.info('Starting parking data sync (API mode)...');

    const client = new PublicApiClient(
      'http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api',
      serviceKey,
      { maxRetries: 3, retryDelay: 1000 }
    );

    const rows = await client.fetchAllPages<ParkingCSVRow>(100);
    await syncParkingRows(rows, stats);
  });
}

export default {
  syncParking,
  syncParkingFromApi,
  createSyncHistory,
  updateSyncHistory,
};
