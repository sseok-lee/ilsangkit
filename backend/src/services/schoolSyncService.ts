import { parseSchoolCSV, transformSchoolRow } from './csvParser.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsertRaw,
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
    const now = new Date();
    const rowsForUpsert = uniqueSchools.map((s) => ({
      id: s.id,
      name: s.name,
      address: s.address,
      roadAddress: s.roadAddress,
      lat: s.lat,
      lng: s.lng,
      city: s.city,
      district: s.district,
      sourceId: s.sourceId,
      schoolLevel: s.schoolLevel,
      foundedDate: s.foundedDate,
      foundationType: s.foundationType,
      branchType: s.branchType,
      operationStatus: s.operationStatus,
      sidoEduCode: s.sidoEduCode,
      sidoEduName: s.sidoEduName,
      localEduCode: s.localEduCode,
      localEduName: s.localEduName,
      createdDate: s.createdDate,
      modifiedDate: s.modifiedDate,
      dataDate: s.dataDate,
      providerCode: s.providerCode,
      providerName: s.providerName,
      // createdAt 생략 — schema @default(now())가 처리
      updatedAt: now,
      syncedAt: now,
    }));

    const { newCount, updateCount } = await batchUpsertRaw(
      'School',
      rowsForUpsert,
      100,
      syncHistory.id,
      { exactStats: true, uniqueKey: 'sourceId' }
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
