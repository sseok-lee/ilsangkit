// @TASK T2.1 - 공공화장실 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { prisma } from '../lib/prisma.js';
import { parseToiletCSV, transformToiletRow } from './csvParser.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsert,
} from './baseSyncService.js';

// Re-export for backward compatibility (tests import from here)
export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

/**
 * 공공화장실 데이터 동기화 메인 함수
 */
export async function syncToilets(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('toilet');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    // CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseToiletCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    // 데이터 변환 + 중복 제거
    console.info('Transforming data...');
    const uniqueToilets = transformAndDedupe(
      rows,
      transformToiletRow,
      (t) => t.sourceId,
      stats
    );

    console.info(`Transformed ${uniqueToilets.length} unique records, skipped ${stats.skippedRecords}`);

    // DB Upsert (트랜잭션 래핑 + 진행 상황 추적)
    console.info('Upserting to database...');
    const { newCount, updateCount } = await batchUpsert(
      uniqueToilets,
      async (toilet) => {
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

        return existing ? 'updated' : 'new';
      },
      100,
      syncHistory.id
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    // 성공 시 SyncHistory 업데이트
    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`toilet sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('toilet sync failed:', errorMessage);
    throw error;
  }
}

export default {
  syncToilets,
  createSyncHistory,
  updateSyncHistory,
};
