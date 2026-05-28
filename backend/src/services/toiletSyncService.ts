// @TASK T2.1 - 공공화장실 동기화 서비스
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { parseToiletCSV, transformToiletRow } from './csvParser.js';
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsertRaw,
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

    // DB Upsert — batchUpsertRaw로 N+1 제거. exactStats=true로 통계 정확성 유지.
    console.info('Upserting to database...');
    const now = new Date();
    const rowsForUpsert = uniqueToilets.map((t) => ({
      id: `toilet-${t.sourceId}`,
      name: t.name,
      address: t.address,
      roadAddress: t.roadAddress,
      lat: t.lat,
      lng: t.lng,
      city: t.city,
      district: t.district,
      sourceId: t.sourceId,
      operatingHours: t.operatingHours,
      maleToilets: t.maleToilets,
      maleUrinals: t.maleUrinals,
      femaleToilets: t.femaleToilets,
      hasDisabledToilet: t.hasDisabledToilet,
      openTime: t.openTime,
      managingOrg: t.managingOrg,
      phoneNumber: t.phoneNumber,
      installDate: t.installDate,
      ownershipType: t.ownershipType,
      sewageTreatment: t.sewageTreatment,
      hasEmergencyBell: t.hasEmergencyBell,
      emergencyBellLocation: t.emergencyBellLocation,
      hasCCTV: t.hasCCTV,
      hasDiaperChangingTable: t.hasDiaperChangingTable,
      diaperChangingLocation: t.diaperChangingLocation,
      maleDisabledToilets: t.maleDisabledToilets,
      maleDisabledUrinals: t.maleDisabledUrinals,
      maleChildToilets: t.maleChildToilets,
      maleChildUrinals: t.maleChildUrinals,
      femaleDisabledToilets: t.femaleDisabledToilets,
      femaleChildToilets: t.femaleChildToilets,
      remodelingDate: t.remodelingDate,
      facilityType: t.facilityType,
      legalBasis: t.legalBasis,
      govCode: t.govCode,
      dataDate: t.dataDate,
      // createdAt 생략 — schema @default(now())가 처리. SKIP_UPDATE_COLS 의존을 줄이고
      // viewCount/bjdCode/sourceUrl 등 다른 default 컬럼들과 일관.
      updatedAt: now,   // raw INSERT 필수 (schema @updatedAt은 Prisma application-level, raw 우회 시 NULL 위반). UPDATE는 batchUpsertRaw가 NOW()로 강제.
      syncedAt: now,    // 동일 — DB default 있지만 batchUpsertRaw가 ON DUPLICATE 시 NOW()로 갱신하도록 payload 포함.
    }));

    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      rowsForUpsert,
      100,
      syncHistory.id,
      { exactStats: true, uniqueKey: 'sourceId' }
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
