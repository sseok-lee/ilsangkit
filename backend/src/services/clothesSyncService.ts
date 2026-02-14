// @TASK T2.3.1 - 의류수거함 CSV 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { prisma } from '../lib/prisma.js';
import { parseClothesCSV, transformClothesRow } from './csvParser.js';
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
 * 의류수거함 데이터 동기화 메인 함수
 */
export async function syncClothes(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('clothes');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    // CSV 파싱
    console.info('Parsing CSV file...');
    const rows = await parseClothesCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    // 데이터 변환 + 중복 제거
    console.info('Transforming data...');
    const uniqueClothes = transformAndDedupe(
      rows,
      transformClothesRow,
      (c) => c.sourceId,
      stats
    );

    console.info(`Transformed ${uniqueClothes.length} valid records, skipped ${stats.skippedRecords}`);

    // DB Upsert (트랜잭션 래핑 + 진행 상황 추적)
    console.info('Upserting to database...');
    const { newCount, updateCount } = await batchUpsert(
      uniqueClothes,
      async (clothes) => {
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
            managementAgency: clothes.managementAgency,
            phoneNumber: clothes.phoneNumber,
            dataDate: clothes.dataDate,
            detailLocation: clothes.detailLocation,
            providerCode: clothes.providerCode,
            providerName: clothes.providerName,
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
            managementAgency: clothes.managementAgency,
            phoneNumber: clothes.phoneNumber,
            dataDate: clothes.dataDate,
            detailLocation: clothes.detailLocation,
            providerCode: clothes.providerCode,
            providerName: clothes.providerName,
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

    console.info(`clothes sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('clothes sync failed:', errorMessage);
    throw error;
  }
}

export default {
  syncClothes,
  createSyncHistory,
  updateSyncHistory,
};
