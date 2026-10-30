import { refreshRegionMarketSummaries } from '../services/regionMarketSummaryService.js';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';

installRuntimeGuard({ maxMinutes: 14, name: 'refreshRegionMarket', prisma });

const start = Date.now();
try {
  const stats = await refreshRegionMarketSummaries();
  console.info(`[RegionMarket] 완료 ${stats.totalRecords}행 (${((Date.now() - start) / 1000).toFixed(1)}s)`);
} catch (error) {
  console.error('[RegionMarket] 실패:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
