// @TASK T2.3.1 - 의류수거함 CSV 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { prisma } from '../lib/prisma.js';
import { parseClothesCSV, transformClothesRow, TransformedClothes } from './csvParser.js';
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
 * 배치 단위로 Clothes 데이터 upsert
 */
async function upsertClothes(
  clothesData: TransformedClothes[],
  batchSize: number = 100
): Promise<{ newCount: number; updateCount: number }> {
  let newCount = 0;
  let updateCount = 0;

  // 배치 처리
  for (let i = 0; i < clothesData.length; i += batchSize) {
    const batch = clothesData.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (clothes) => {
        // 기존 레코드 확인 (sourceId 기준)
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
            // Clothes 전용 필드
            managementAgency: clothes.managementAgency,
            phoneNumber: clothes.phoneNumber,
            dataDate: clothes.dataDate,
            detailLocation: clothes.detailLocation,
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
            // Clothes 전용 필드
            managementAgency: clothes.managementAgency,
            phoneNumber: clothes.phoneNumber,
            dataDate: clothes.dataDate,
            detailLocation: clothes.detailLocation,
          },
        });

        if (existing) {
          updateCount++;
        } else {
          newCount++;
        }
      })
    );

    // 진행 상황 로깅
    console.info(`Processed ${Math.min(i + batchSize, clothesData.length)}/${clothesData.length} records`);
  }

  return { newCount, updateCount };
}

/**
 * 의류수거함 데이터 동기화 메인 함수
 */
export async function syncClothes(csvFilePath: string): Promise<SyncStats> {
  const stats: SyncStats = {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  };

  // 1. 동기화 히스토리 생성
  const syncHistory = await createSyncHistory('clothes');

  try {
    console.info('Starting clothes data sync...');
    console.info(`CSV file: ${csvFilePath}`);

    // 2. CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseClothesCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    // 3. 데이터 변환
    console.info('Transforming data...');
    const clothesData: TransformedClothes[] = [];

    for (const row of rows) {
      try {
        const clothes = transformClothesRow(row);
        if (clothes) {
          clothesData.push(clothes);
        } else {
          stats.skippedRecords++;
        }
      } catch (error) {
        stats.skippedRecords++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Row transform error: ${errorMsg}`);
      }
    }

    // sourceId 기준 중복 제거 (마지막 레코드 유지)
    const uniqueMap = new Map<string, TransformedClothes>();
    for (const clothes of clothesData) {
      uniqueMap.set(clothes.sourceId, clothes);
    }
    const uniqueClothes = Array.from(uniqueMap.values());
    const duplicateCount = clothesData.length - uniqueClothes.length;

    console.info(`Transformed ${clothesData.length} valid records, skipped ${stats.skippedRecords}`);
    if (duplicateCount > 0) {
      console.info(`Removed ${duplicateCount} duplicate records (same coordinates)`);
    }

    // 4. DB Upsert
    console.info('Upserting to database...');
    const { newCount, updateCount } = await upsertClothes(uniqueClothes);
    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    // 5. 동기화 히스토리 업데이트 (성공)
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
    // 에러 발생 시 히스토리 업데이트 (실패)
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
  syncClothes,
  createSyncHistory,
  updateSyncHistory,
};
