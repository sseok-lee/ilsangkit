#!/usr/bin/env tsx

import 'dotenv/config';
import prisma from '../lib/prisma.js';
import { syncChildcare } from '../services/childcareSyncService.js';
import { submitIndexNow, buildFacilityUrls } from '../services/indexNowService.js';

async function main(): Promise<void> {
  // Region 테이블에서 전국 bjdCode 조회 → arcode로 사용
  const regions = await prisma.region.findMany({ select: { bjdCode: true } });
  const arcodes = regions.map(r => r.bjdCode);
  console.info(`전국 ${arcodes.length}개 지역 동기화 시작`);
  await syncChildcare(arcodes);

  // IndexNow: 동기화된 시설 URL 제출
  const items = await prisma.childcare.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { id: true },
  });
  if (items.length > 0) {
    await submitIndexNow(buildFacilityUrls('childcare', items.map(i => i.id)));
  }

  console.info('\n=== Sync process completed ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
