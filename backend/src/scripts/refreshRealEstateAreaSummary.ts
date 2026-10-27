import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { refreshBuildingAreaSummariesIncremental, areaRefreshExitCode } from '../services/realEstateAreaIncrementalService.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
installRuntimeGuard({ maxMinutes: 25, name: 'areaIncremental', prisma });
try {
  const results = await refreshBuildingAreaSummariesIncremental();
  process.exitCode = areaRefreshExitCode(results);
  console.info(`[AreaIncremental] ${process.exitCode === 75 ? 'partial progress saved' : 'finished'} ${JSON.stringify(results)}`);
} catch (error) {
  console.error('[AreaIncremental] failed; transaction and V2 results are preserved', error);
  process.exitCode = 6;
} finally {
  await prisma.$disconnect();
}
