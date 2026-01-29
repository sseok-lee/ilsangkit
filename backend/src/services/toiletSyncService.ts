// @TASK T2.1 - 공공화장실 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { prisma } from '../lib/prisma.js';
import { parseToiletCSV, transformToiletRow, TransformedToilet } from './csvParser.js';
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
 * 배치 단위로 Toilet 데이터 upsert
 */
async function upsertToilets(
  toilets: TransformedToilet[],
  batchSize: number = 100
): Promise<{ newCount: number; updateCount: number }> {
  let newCount = 0;
  let updateCount = 0;

  // 배치 처리
  for (let i = 0; i < toilets.length; i += batchSize) {
    const batch = toilets.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (toilet) => {
        // 기존 레코드 확인
        const existing = await prisma.toilet.findUnique({
          where: { sourceId: toilet.sourceId },
        });

        await prisma.toilet.upsert({
          where: { sourceId: toilet.sourceId },
          update: {
            name: toilet.name,
            address: toilet.address,
            roadAddress: toilet.roadAddress,
            lat: toilet.lat,
            lng: toilet.lng,
            city: toilet.city,
            district: toilet.district,
            operatingHours: toilet.operatingHours,
            maleToilets: toilet.maleToilets,
            maleUrinals: toilet.maleUrinals,
            femaleToilets: toilet.femaleToilets,
            hasDisabledToilet: toilet.hasDisabledToilet,
            openTime: toilet.openTime,
            managingOrg: toilet.managingOrg,
            syncedAt: new Date(),
          },
          create: {
            id: `toilet-${toilet.sourceId}`,
            name: toilet.name,
            address: toilet.address,
            roadAddress: toilet.roadAddress,
            lat: toilet.lat,
            lng: toilet.lng,
            city: toilet.city,
            district: toilet.district,
            sourceId: toilet.sourceId,
            operatingHours: toilet.operatingHours,
            maleToilets: toilet.maleToilets,
            maleUrinals: toilet.maleUrinals,
            femaleToilets: toilet.femaleToilets,
            hasDisabledToilet: toilet.hasDisabledToilet,
            openTime: toilet.openTime,
            managingOrg: toilet.managingOrg,
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
    console.info(`Processed ${Math.min(i + batchSize, toilets.length)}/${toilets.length} records`);
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
    const toilets: TransformedToilet[] = [];

    for (const row of rows) {
      try {
        const toilet = transformToiletRow(row);
        if (toilet) {
          toilets.push(toilet);
        } else {
          stats.skippedRecords++;
        }
      } catch (error) {
        stats.skippedRecords++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        stats.errors.push(`Row transform error: ${errorMsg}`);
      }
    }

    // 중복 sourceId 제거
    const uniqueToilets = Array.from(
      new Map(toilets.map((t) => [t.sourceId, t])).values()
    );
    const duplicateCount = toilets.length - uniqueToilets.length;
    stats.skippedRecords += duplicateCount;

    console.info(`Transformed ${uniqueToilets.length} unique records, skipped ${stats.skippedRecords} (including ${duplicateCount} duplicates)`);

    // 4. DB Upsert
    console.info('Upserting to database...');
    const { newCount, updateCount } = await upsertToilets(uniqueToilets);
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
