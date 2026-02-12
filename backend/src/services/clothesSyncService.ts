// @TASK T2.3.1 - 의류수거함 CSV 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { prisma } from '../lib/prisma.js';
import { parseClothesCSV, transformClothesRow } from './csvParser.js';
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
 * 의류수거함 데이터 동기화 메인 함수
 */
export async function syncClothes(csvFilePath: string): Promise<SyncStats> {
  return runSync('clothes', async (stats) => {
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

    // DB Upsert
    console.info('Upserting to database...');
    const { newCount, updateCount } = await batchUpsert(uniqueClothes, async (clothes) => {
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
        },
      });

      return existing ? 'updated' : 'new';
    });

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
  });
}

export default {
  syncClothes,
  createSyncHistory,
  updateSyncHistory,
};
