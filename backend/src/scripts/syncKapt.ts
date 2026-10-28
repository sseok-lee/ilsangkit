#!/usr/bin/env tsx
/**
 * K-apt 자료실 주간 파일(단지 기본정보·면적정보·필지고유번호) 동기화.
 *
 *   npm run sync:kapt            # 새 파일이 올라온 데이터셋만 반영
 *   npm run sync:kapt -- --force # 기준일이 같아도 다시 받는다
 *
 * 운영은 scripts/ops/sync-real-estate.sh 가 매일 03:00 KST 에 실행한다.
 */
import 'dotenv/config';
import { syncKaptFiles } from '../services/kaptSyncService.js';
import { prisma } from '../lib/prisma.js';

const force = process.argv.includes('--force');

syncKaptFiles({ force })
  .then((results) => {
    for (const r of results) console.info(`[kapt] ${r.dataset}: ${r.status} (기준일 ${r.fileDate}, ${r.rows.toLocaleString()}행)`);
    return prisma.$disconnect();
  })
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[kapt] 실패:', error instanceof Error ? error.message : error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
