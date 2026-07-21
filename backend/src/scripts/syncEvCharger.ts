#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { syncEvChargers } from '../services/evChargerSyncService.js';
import { prisma } from '../lib/prisma.js';
import { submitIndexNow, buildFacilityUrls } from '../services/indexNowService.js';

/**
 * 최근 동기화된 충전소(station) ID 목록을 조회한다.
 * EvCharger 테이블은 충전기(row) 단위(`id` = statId-chgerId, ~51만행)지만
 * 상세페이지/사이트맵은 충전소(statId) 단위이므로, IndexNow도 반드시
 * DISTINCT statId로 조회해야 실제 페이지 URL과 일치한다.
 */
export async function getRecentlySyncedStationIds(cutoff: Date): Promise<string[]> {
  const stations = await prisma.evCharger.findMany({
    where: { syncedAt: { gte: cutoff }, statId: { not: null } },
    select: { statId: true },
    distinct: ['statId'],
  });
  return stations.map((s) => s.statId!);
}

async function main(): Promise<void> {
  console.info('Starting ev-charger data sync...');
  await syncEvChargers();

  // IndexNow: 동기화된 충전소(statId) URL 제출
  const statIds = await getRecentlySyncedStationIds(new Date(Date.now() - 2 * 60 * 60 * 1000));
  if (statIds.length > 0) {
    await submitIndexNow(buildFacilityUrls('ev-charger', statIds));
  }

  console.info('\n=== Sync process completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
