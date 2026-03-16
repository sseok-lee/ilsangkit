import { prisma } from '../lib/prisma.js';
import { parseSchoolCSV, transformSchoolRow } from './csvParser.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsert,
} from './baseSyncService.js';

export { createSyncHistory, updateSyncHistory };
export type { SyncStats, SyncHistoryUpdateData };

/**
 * 학교 데이터 동기화 메인 함수
 */
export async function syncSchools(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('school');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    console.info('Parsing CSV file...');
    const rows = await parseSchoolCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    console.info('Transforming data...');
    const uniqueSchools = transformAndDedupe(
      rows,
      transformSchoolRow,
      (s) => s.sourceId,
      stats
    );

    console.info(`Transformed ${uniqueSchools.length} unique records, skipped ${stats.skippedRecords}`);

    console.info('Upserting to database...');
    const { newCount, updateCount } = await batchUpsert(
      uniqueSchools,
      async (school) => {
        const existing = await prisma.school.findUnique({
          where: { sourceId: school.sourceId },
        });

        await prisma.school.upsert({
          where: { sourceId: school.sourceId },
          update: {
            name: school.name,
            address: school.address,
            roadAddress: school.roadAddress,
            lat: school.lat,
            lng: school.lng,
            city: school.city,
            district: school.district,
            schoolLevel: school.schoolLevel,
            foundedDate: school.foundedDate,
            foundationType: school.foundationType,
            branchType: school.branchType,
            operationStatus: school.operationStatus,
            sidoEduCode: school.sidoEduCode,
            sidoEduName: school.sidoEduName,
            localEduCode: school.localEduCode,
            localEduName: school.localEduName,
            createdDate: school.createdDate,
            modifiedDate: school.modifiedDate,
            dataDate: school.dataDate,
            providerCode: school.providerCode,
            providerName: school.providerName,
            syncedAt: new Date(),
          },
          create: {
            id: school.id,
            name: school.name,
            address: school.address,
            roadAddress: school.roadAddress,
            lat: school.lat,
            lng: school.lng,
            city: school.city,
            district: school.district,
            sourceId: school.sourceId,
            schoolLevel: school.schoolLevel,
            foundedDate: school.foundedDate,
            foundationType: school.foundationType,
            branchType: school.branchType,
            operationStatus: school.operationStatus,
            sidoEduCode: school.sidoEduCode,
            sidoEduName: school.sidoEduName,
            localEduCode: school.localEduCode,
            localEduName: school.localEduName,
            createdDate: school.createdDate,
            modifiedDate: school.modifiedDate,
            dataDate: school.dataDate,
            providerCode: school.providerCode,
            providerName: school.providerName,
          },
        });

        return existing ? 'updated' : 'new';
      },
      100,
      syncHistory.id
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`school sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('school sync failed:', errorMessage);
    throw error;
  }
}

export default { syncSchools, createSyncHistory, updateSyncHistory };
