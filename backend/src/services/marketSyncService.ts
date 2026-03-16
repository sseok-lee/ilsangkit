import { prisma } from '../lib/prisma.js';
import { parseMarketCSV, transformMarketRow } from './csvParser.js';
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
 * 전통시장 데이터 동기화 메인 함수
 */
export async function syncMarkets(csvFilePath: string): Promise<SyncStats> {
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('market');

  try {
    console.info(`CSV file: ${csvFilePath}`);

    console.info('Parsing CSV file...');
    const rows = await parseMarketCSV(csvFilePath);
    stats.totalRecords = rows.length;
    console.info(`Found ${rows.length} records in CSV`);

    console.info('Transforming data...');
    const uniqueMarkets = transformAndDedupe(
      rows,
      transformMarketRow,
      (m) => m.sourceId,
      stats
    );

    console.info(`Transformed ${uniqueMarkets.length} unique records, skipped ${stats.skippedRecords}`);

    console.info('Upserting to database...');
    const { newCount, updateCount } = await batchUpsert(
      uniqueMarkets,
      async (market) => {
        const existing = await prisma.market.findUnique({
          where: { sourceId: market.sourceId },
        });

        await prisma.market.upsert({
          where: { sourceId: market.sourceId },
          update: {
            name: market.name,
            address: market.address,
            roadAddress: market.roadAddress,
            lat: market.lat,
            lng: market.lng,
            city: market.city,
            district: market.district,
            marketType: market.marketType,
            openingCycle: market.openingCycle,
            storeCount: market.storeCount,
            products: market.products,
            giftCertificates: market.giftCertificates,
            homepageUrl: market.homepageUrl,
            hasPublicToilet: market.hasPublicToilet,
            hasParking: market.hasParking,
            foundedYear: market.foundedYear,
            phoneNumber: market.phoneNumber,
            dataDate: market.dataDate,
            providerCode: market.providerCode,
            providerName: market.providerName,
            syncedAt: new Date(),
          },
          create: {
            id: market.id,
            name: market.name,
            address: market.address,
            roadAddress: market.roadAddress,
            lat: market.lat,
            lng: market.lng,
            city: market.city,
            district: market.district,
            sourceId: market.sourceId,
            marketType: market.marketType,
            openingCycle: market.openingCycle,
            storeCount: market.storeCount,
            products: market.products,
            giftCertificates: market.giftCertificates,
            homepageUrl: market.homepageUrl,
            hasPublicToilet: market.hasPublicToilet,
            hasParking: market.hasParking,
            foundedYear: market.foundedYear,
            phoneNumber: market.phoneNumber,
            dataDate: market.dataDate,
            providerCode: market.providerCode,
            providerName: market.providerName,
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

    console.info(`market sync completed: Total=${stats.totalRecords}, New=${stats.newRecords}, Updated=${stats.updatedRecords}, Skipped=${stats.skippedRecords}`);
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    stats.errors.push(errorMessage);

    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });

    console.error('market sync failed:', errorMessage);
    throw error;
  }
}

export default { syncMarkets, createSyncHistory, updateSyncHistory };
