import { refreshAllSummaries } from '../services/realEstateSummaryService.js';
import { prisma } from '../lib/prisma.js';

const start = Date.now();
console.info('[Summary] Starting full refresh...');

await refreshAllSummaries();

console.info(`[Summary] Done in ${((Date.now() - start) / 1000).toFixed(1)}s`);
await prisma.$disconnect();
