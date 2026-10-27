import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { refreshBuildingAreaSummariesIncremental } from '../services/realEstateAreaIncrementalService.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
installRuntimeGuard({ maxMinutes: 25, name: 'areaIncremental', prisma });
try {
  console.info(JSON.stringify(await refreshBuildingAreaSummariesIncremental()));
} catch (error) {
  console.error('[AreaIncremental] failed; transaction and V2 results are preserved', error);
  process.exitCode = 6;
} finally {
  await prisma.$disconnect();
}
