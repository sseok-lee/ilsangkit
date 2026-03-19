#!/usr/bin/env tsx

import { syncSports } from '../services/sportsSyncService.js';
import { prisma } from '../lib/prisma.js';
import { submitIndexNow, buildFacilityUrls } from '../services/indexNowService.js';

async function main(): Promise<void> {
  console.info('Starting sports facility data sync...');
  await syncSports();

  // IndexNow: 동기화된 시설 URL 제출
  const items = await prisma.sports.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  if (items.length > 0) {
    await submitIndexNow(buildFacilityUrls('sports', items.map(i => i.id)));
  }

  console.info('\n=== Sync process completed ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
