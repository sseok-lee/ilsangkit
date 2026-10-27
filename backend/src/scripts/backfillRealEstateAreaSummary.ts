import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { prisma } from '../lib/prisma.js';
import { refreshBuildingAreaSummaries, type AreaSummaryOptions, AreaSummaryPausedError } from '../services/realEstateAreaSummaryService.js';
import { installRuntimeGuard } from './_runtimeGuard.js';

/** --type apt-rent --bjd-code 11680 --until 02:15 --batch-size 25 --pause-ms 100
 * bjd-code는 V2의 정확한 값(접두어 검색 아님). 미완료 실행은 기본 재개, --restart만 초기화한다.
 * until은 다음 KST HH:MM, 5분 여유로 중단(exit 75). cron 전에 여유 있는 시각을 지정한다.
 */
export function parseAreaSummaryArgs(args: string[]): AreaSummaryOptions {
  const options: AreaSummaryOptions = {};
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--restart') { options.resume = false; continue; }
    if (flag === '--resume') { options.resume = true; continue; }
    const value = args[++i];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${flag}`);
    if (flag === '--until') options.until = value;
    else if (flag === '--type') options.types = value.split(',');
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
    .catch((error) => { console.error(error); process.exitCode = error instanceof AreaSummaryPausedError ? 75 : 1; })
    .finally(() => prisma.$disconnect());
}
