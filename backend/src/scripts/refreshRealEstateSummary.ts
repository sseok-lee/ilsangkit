import { refreshSummariesForActiveMode } from '../services/realEstateSummaryService.js';
import { readSummaryMode } from '../lib/realEstateSummaryStore.js';
import { TABLE_NAME_MAP, type RealEstateType } from '../services/realEstateService.js';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';

installRuntimeGuard({ maxMinutes: 30, name: 'refreshSummary', prisma });

const start = Date.now();
const mode = readSummaryMode(process.env);
console.info(`[Summary] Starting full refresh in ${mode} mode...`);

const types = Object.keys(TABLE_NAME_MAP) as RealEstateType[];
const result = await refreshSummariesForActiveMode(types);
const failedSet = new Set(result.batches.filter((batch) => batch.status === 'failed').map((batch) => batch.type as RealEstateType));
const done = types.filter((type) => !failedSet.has(type));
const failed = types.filter((type) => failedSet.has(type));
const total = types.length;

// 완주 여부를 한 줄로 남긴다. 종전에는 타입별 성공 로그만 있어서, 뒤쪽 타입이
// 아예 안 돌았을 때 "없는 줄" 을 눈치채야 알 수 있었다 — 아무도 못 봤다.
// 이 줄이 있으면 `N/M` 만 보고 판정된다.
console.info(`[Summary] 완료 ${done.length}/${total} (${((Date.now() - start) / 1000).toFixed(1)}s)`);

if (failed.length > 0) {
  console.error(`[Summary] 실패한 타입: ${failed.join(', ')}`);
}

// 부분 완료를 종료 코드로 알린다. 4 는 generateSitemaps.js 의 "부분 갱신" 과 같은 규약이며
// 워크플로가 그 값을 보고 ::warning:: 을 띄운다.
//
// ⚠️ 바깥 `timeout` 이 프로세스를 죽이는 경우(exit 124)에는 이 코드가 실행조차 되지 않는다.
// 워크플로가 124 도 별도로 처리해야 하는 이유다 — 실제로 2026-08-08·08-09 에 그 경로로
// villa-rent·offitel 이 조용히 스킵됐다.
if (failed.length > 0) {
  process.exitCode = 4;
}

await prisma.$disconnect();
