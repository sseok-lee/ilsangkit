/**
 * 지하철역 동기화 서비스 — toilet/library 패턴을 그대로 차용한 CSV 기반 sync.
 */

import { prisma } from '../lib/prisma.js';
import {
  runSync,
  batchUpsert,
  type SyncStats,
} from './baseSyncService.js';
import {
  parseSubwayCSV,
  transformAll,
  type TransformedSubwayStation,
} from './subwayDataSource.js';

async function upsertStation(s: TransformedSubwayStation): Promise<'new' | 'updated'> {
  const existing = await prisma.subwayStation.findUnique({
    where: { sourceId: s.sourceId },
    select: { id: true },
  });

  await prisma.subwayStation.upsert({
    where: { sourceId: s.sourceId },
    update: {
      name: s.name,
      nameSlug: s.nameSlug,
      line: s.line,
      transferLines: s.transferLines,
      operator: s.operator,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      roadAddress: s.roadAddress,
      city: s.city,
      district: s.district,
      regionSlug: s.regionSlug,
      phoneNumber: s.phoneNumber,
      dataDate: s.dataDate,
      syncedAt: new Date(),
    },
    create: {
      id: s.id,
      sourceId: s.sourceId,
      name: s.name,
      nameSlug: s.nameSlug,
      line: s.line,
      transferLines: s.transferLines,
      operator: s.operator,
      lat: s.lat,
      lng: s.lng,
      address: s.address,
      roadAddress: s.roadAddress,
      city: s.city,
      district: s.district,
      regionSlug: s.regionSlug,
      phoneNumber: s.phoneNumber,
      dataDate: s.dataDate,
    },
  });

  return existing ? 'updated' : 'new';
}

export async function syncSubwayStations(csvPath: string): Promise<SyncStats> {
  return runSync('subway', async (stats) => {
    console.info(`Parsing CSV: ${csvPath}`);
    const rows = await parseSubwayCSV(csvPath);
    stats.totalRecords = rows.length;
    console.info(`Parsed ${rows.length} CSV rows`);

    const { stations, skipped } = transformAll(rows);
    stats.skippedRecords += skipped;
    console.info(`Transformed ${stations.length} unique stations (skipped ${skipped})`);

    const { newCount, updateCount } = await batchUpsert(
      stations,
      upsertStation,
      100,
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
  });
}

export default { syncSubwayStations };
