// @TASK T9.1.2 - 공영주차장 동기화 서비스 (API + CSV)

import { prisma } from '../lib/prisma.js';
import { parseParkingCSV, transformParkingRow, TransformedParking } from './csvParser.js';
import type { ParkingCSVRow } from './csvParser.js';
import { PublicApiClient } from './publicApiClient.js';
import type { SyncStatus, SyncHistory } from '@prisma/client';

// 동기화 통계 타입
export interface SyncStats {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errors: string[];
}

// 동기화 히스토리 업데이트 데이터
export interface SyncHistoryUpdateData {
  status?: SyncStatus;
  totalRecords?: number;
  newRecords?: number;
  updatedRecords?: number;
  errorMessage?: string;
}

/**
 * 동기화 히스토리 레코드 생성 (시작 시점)
 */
export async function createSyncHistory(category: string): Promise<SyncHistory> {
  return prisma.syncHistory.create({
    data: {
      category,
      status: 'running',
      totalRecords: 0,
      newRecords: 0,
      updatedRecords: 0,
    },
  });
}

/**
 * 동기화 히스토리 업데이트 (완료/실패 시점)
 */
export async function updateSyncHistory(
  id: number,
  data: SyncHistoryUpdateData
): Promise<SyncHistory> {
  return prisma.syncHistory.update({
    where: { id },
    data: {
      ...data,
      completedAt: new Date(),
    },
  });
}

/**
 * 배치 단위로 Parking 데이터 upsert
 */
async function upsertParkings(
  parkingData: TransformedParking[],
  batchSize: number = 100
): Promise<{ newCount: number; updateCount: number }> {
  let newCount = 0;
  let updateCount = 0;

  for (let i = 0; i < parkingData.length; i += batchSize) {
    const batch = parkingData.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (parking) => {
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

        if (existing) {
          updateCount++;
        } else {
          newCount++;
        }
      })
    );

    console.info(`Processed ${Math.min(i + batchSize, parkingData.length)}/${parkingData.length} records`);
  }

  return { newCount, updateCount };
}

/**
 * 공영주차장 데이터 동기화 메인 함수
 */
export async function syncParking(csvFilePath: string): Promise<SyncStats> {
  const stats: SyncStats = {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  };

  const syncHistory = await createSyncHistory('parking');

  try {
    console.info('Starting parking data sync...');
    console.info(`CSV file: ${csvFilePath}`);

    // CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseParkingCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    // 데이터 변환
    console.info('Transforming data...');
    const parkingData: TransformedParking[] = [];

    for (const row of rows) {
      try {
        const parking = transformParkingRow(row);
        if (parking) {
          parkingData.push(parking);
        } else {
          stats.skippedRecords++;
        }
      } catch (error) {
        stats.skippedRecords++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Row transform error: ${errorMsg}`);
      }
    }

    // sourceId 기준 중복 제거
    const uniqueMap = new Map<string, TransformedParking>();
    for (const parking of parkingData) {
      uniqueMap.set(parking.sourceId, parking);
    }
    const uniqueParkings = Array.from(uniqueMap.values());
    const duplicateCount = parkingData.length - uniqueParkings.length;

    console.info(`Transformed ${parkingData.length} valid records, skipped ${stats.skippedRecords}`);
    if (duplicateCount > 0) {
      console.info(`Removed ${duplicateCount} duplicate records`);
    }

    // DB Upsert
    console.info('Upserting to database...');
    const { newCount, updateCount } = await upsertParkings(uniqueParkings);
    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    // 동기화 히스토리 업데이트 (성공)
    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info('Sync completed successfully!');
    console.info(`Total: ${stats.totalRecords}, New: ${stats.newRecords}, Updated: ${stats.updatedRecords}, Skipped: ${stats.skippedRecords}`);

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('Sync failed:', errorMessage);
    throw error;
  }
}

/**
 * 공영주차장 데이터 API 동기화 함수
 * data.go.kr 표준데이터 API에서 직접 데이터를 수집
 */
export async function syncParkingFromApi(): Promise<SyncStats> {
  const stats: SyncStats = {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  };

  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const syncHistory = await createSyncHistory('parking');

  try {
    console.info('Starting parking data sync (API mode)...');

    // API 클라이언트 생성
    const client = new PublicApiClient(
      'http://api.data.go.kr/openapi/tn_pubr_prkplce_info_api',
      serviceKey,
      { maxRetries: 3, retryDelay: 1000 }
    );

    // 모든 페이지 데이터 조회
    const rows = await client.fetchAllPages<ParkingCSVRow>(100);
    stats.totalRecords = rows.length;
    console.info(`Fetched ${rows.length} records from API`);

    // 데이터 변환
    console.info('Transforming data...');
    const parkingData: TransformedParking[] = [];

    for (const row of rows) {
      try {
        const parking = transformParkingRow(row);
        if (parking) {
          parkingData.push(parking);
        } else {
          stats.skippedRecords++;
        }
      } catch (error) {
        stats.skippedRecords++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Row transform error: ${errorMsg}`);
      }
    }

    // sourceId 기준 중복 제거
    const uniqueMap = new Map<string, TransformedParking>();
    for (const parking of parkingData) {
      uniqueMap.set(parking.sourceId, parking);
    }
    const uniqueParkings = Array.from(uniqueMap.values());
    const duplicateCount = parkingData.length - uniqueParkings.length;

    console.info(`Transformed ${parkingData.length} valid records, skipped ${stats.skippedRecords}`);
    if (duplicateCount > 0) {
      console.info(`Removed ${duplicateCount} duplicate records`);
    }

    // DB Upsert
    console.info('Upserting to database...');
    const { newCount, updateCount } = await upsertParkings(uniqueParkings);
    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    // 동기화 히스토리 업데이트 (성공)
    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info('Sync completed successfully!');
    console.info(`Total: ${stats.totalRecords}, New: ${stats.newRecords}, Updated: ${stats.updatedRecords}, Skipped: ${stats.skippedRecords}`);

    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('Sync failed:', errorMessage);
    throw error;
  }
}

export default {
  syncParking,
  syncParkingFromApi,
  createSyncHistory,
  updateSyncHistory,
};
