// @TASK T2.1 - 공공화장실 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { prisma } from '../lib/prisma.js';
import { parseToiletCSV, transformToiletRow, TransformedFacility } from './csvParser.js';
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
 * 배치 단위로 Facility 데이터 upsert
 */
async function upsertFacilities(
  facilities: TransformedFacility[],
  batchSize: number = 100
): Promise<{ newCount: number; updateCount: number }> {
  let newCount = 0;
  let updateCount = 0;

  // 배치 처리
  for (let i = 0; i < facilities.length; i += batchSize) {
    const batch = facilities.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (facility) => {
        // 기존 레코드 확인
        const existing = await prisma.facility.findUnique({
          where: {
            category_sourceId: {
              category: 'toilet',
              sourceId: facility.sourceId,
            },
          },
        });

        await prisma.facility.upsert({
          where: {
            category_sourceId: {
              category: 'toilet',
              sourceId: facility.sourceId,
            },
          },
          update: {
            name: facility.name,
            address: facility.address,
            roadAddress: facility.roadAddress,
            lat: facility.lat,
            lng: facility.lng,
            city: facility.city,
            district: facility.district,
            details: facility.details,
            syncedAt: new Date(),
          },
          create: {
            id: facility.id,
            category: 'toilet',
            name: facility.name,
            address: facility.address,
            roadAddress: facility.roadAddress,
            lat: facility.lat,
            lng: facility.lng,
            city: facility.city,
            district: facility.district,
            sourceId: facility.sourceId,
            details: facility.details,
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
    console.info(`Processed ${Math.min(i + batchSize, facilities.length)}/${facilities.length} records`);
  }

  return { newCount, updateCount };
}

/**
 * 공공화장실 데이터 동기화 메인 함수
 */
export async function syncToilets(csvFilePath: string): Promise<SyncStats> {
  const stats: SyncStats = {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
    errors: [],
  };

  // 1. 동기화 히스토리 생성
  const syncHistory = await createSyncHistory('toilet');

  try {
    console.info('Starting toilet data sync...');
    console.info(`CSV file: ${csvFilePath}`);

    // 2. CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseToiletCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    // 3. 데이터 변환
    console.info('Transforming data...');
    const facilities: TransformedFacility[] = [];

    for (const row of rows) {
      try {
        const facility = transformToiletRow(row);
        if (facility) {
          facilities.push(facility);
        } else {
          stats.skippedRecords++;
        }
      } catch (error) {
        stats.skippedRecords++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Row transform error: ${errorMsg}`);
      }
    }

    console.info(`Transformed ${facilities.length} valid records, skipped ${stats.skippedRecords}`);

    // 4. DB Upsert
    console.info('Upserting to database...');
    const { newCount, updateCount } = await upsertFacilities(facilities);
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
  syncToilets,
  createSyncHistory,
  updateSyncHistory,
};
