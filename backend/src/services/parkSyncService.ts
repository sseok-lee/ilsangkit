import { prisma } from '../lib/prisma.js';
import { parseParkCSV, transformParkRow } from './csvParser.js';
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
 * 공원 데이터 동기화 메인 함수
 */
export async function syncParks(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('park');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    console.info('Parsing CSV file...');
    const rows = await parseParkCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    console.info('Transforming data...');
    const uniqueParks = transformAndDedupe(
      rows,
      transformParkRow,
      (p) => p.sourceId,
      stats
    );

    console.info(`Transformed ${uniqueParks.length} unique records, skipped ${stats.skippedRecords}`);

    console.info('Upserting to database...');
    const { newCount, updateCount } = await batchUpsert(
      uniqueParks,
      async (park) => {
        const existing = await prisma.park.findUnique({
          where: { sourceId: park.sourceId },
        });

        await prisma.park.upsert({
          where: { sourceId: park.sourceId },
          update: {
            name: park.name,
            address: park.address,
            roadAddress: park.roadAddress,
            lat: park.lat,
            lng: park.lng,
            city: park.city,
            district: park.district,
            parkType: park.parkType,
            area: park.area,
            exerciseFacilities: park.exerciseFacilities,
            playFacilities: park.playFacilities,
            convenienceFacilities: park.convenienceFacilities,
            cultureFacilities: park.cultureFacilities,
            otherFacilities: park.otherFacilities,
            designatedDate: park.designatedDate,
            managingOrg: park.managingOrg,
            phoneNumber: park.phoneNumber,
            dataDate: park.dataDate,
            providerCode: park.providerCode,
            providerName: park.providerName,
            syncedAt: new Date(),
          },
          create: {
            id: park.id,
            name: park.name,
            address: park.address,
            roadAddress: park.roadAddress,
            lat: park.lat,
            lng: park.lng,
            city: park.city,
            district: park.district,
            sourceId: park.sourceId,
            parkType: park.parkType,
            area: park.area,
            exerciseFacilities: park.exerciseFacilities,
            playFacilities: park.playFacilities,
            convenienceFacilities: park.convenienceFacilities,
            cultureFacilities: park.cultureFacilities,
            otherFacilities: park.otherFacilities,
            designatedDate: park.designatedDate,
            managingOrg: park.managingOrg,
            phoneNumber: park.phoneNumber,
            dataDate: park.dataDate,
            providerCode: park.providerCode,
            providerName: park.providerName,
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

    console.info(`park sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('park sync failed:', errorMessage);
    throw error;
  }
}

export default { syncParks, createSyncHistory, updateSyncHistory };
