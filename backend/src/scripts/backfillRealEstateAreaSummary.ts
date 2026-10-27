import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { refreshBuildingAreaSummaries, type AreaSummaryOptions } from '../services/realEstateAreaSummaryService.js';
import { installRuntimeGuard } from './_runtimeGuard.js';

/** --type apt-rent --bjd-code 11680 --resume --batch-size 25 --pause-ms 100 */
export function parseAreaSummaryArgs(args: string[]): AreaSummaryOptions {
  const options: AreaSummaryOptions = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--resume') { options.resume = true; continue; }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--type') options.types = value.split(',');
    else if (flag === '--bjd-code') options.bjdCode = value;
    else if (flag === '--batch-size') options.batchSize = Number(value);
    else if (flag === '--pause-ms') options.pauseMs = Number(value);
    else throw new Error(`Unknown option: ${flag}`);
  }
  return options;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  installRuntimeGuard({ maxMinutes: 360, name: 'backfillAreaSummary', prisma });
  refreshBuildingAreaSummaries(parseAreaSummaryArgs(process.argv.slice(2)))
    .then((results) => console.info(JSON.stringify(results)))
    .catch((error) => { console.error(error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
