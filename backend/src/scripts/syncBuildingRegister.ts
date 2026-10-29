#!/usr/bin/env tsx
/**
 * 건축물대장(건축HUB 대용량 파일: 총괄표제부·표제부·전유공용면적) 동기화.
 *
 *   npm run sync:building-register                       # 대상 월이 바뀐 파일만
 *   npm run sync:building-register -- --force            # 총괄·표제부를 다시 받는다
 *   npm run sync:building-register -- --force-units      # 전유공용면적을 3개월 전이라도 받는다
 *   npm run sync:building-register -- --work-dir <경로>  # zip 을 받을 디렉터리
 *
 * 운영은 scripts/ops/sync-building-register.sh 가 매일 06:30 KST 에 실행한다(메모리 상한 512MB).
 */
import 'dotenv/config';
import { syncBuildingRegister } from '../services/buildingRegisterSync.js';
import { prisma } from '../lib/prisma.js';

const args = process.argv.slice(2);
const workDirAt = args.indexOf('--work-dir');

syncBuildingRegister({
  force: args.includes('--force'),
  forceUnits: args.includes('--force-units'),
  workDir: workDirAt >= 0 ? args[workDirAt + 1] : undefined,
})
  .then(({ results, maxRssMb }) => {
    for (const r of results) {
      console.info(`[building-register] ${r.taskCode}: ${r.status} (${r.sourceMonth ?? '-'}, ${r.rows.toLocaleString()}행, 건너뜀 ${r.skipped.toLocaleString()})`);
    }
    console.info(`[building-register] 최대 메모리 ${maxRssMb}MB`);
    return prisma.$disconnect();
  })
  .then(() => process.exit(0))
  .catch(async (error) => {
    console.error('[building-register] 실패:', error instanceof Error ? error.message : error);
    await prisma.$disconnect().catch(() => undefined);
    process.exit(1);
  });
