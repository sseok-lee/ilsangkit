#!/usr/bin/env tsx
/**
 * 지하철역 데이터 동기화 스크립트.
 *
 *   npm run sync:subway                              # prisma/data/subway.csv 사용
 *   npm run sync:subway -- --local /path/to/file.csv # 다른 경로 지정
 */

import * as fs from 'fs';
import * as path from 'path';
import { syncSubwayStations } from '../services/subwaySyncService.js';

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  let csvPath: string;
  const localFileIndex = args.indexOf('--local');
  if (localFileIndex !== -1 && args[localFileIndex + 1]) {
    csvPath = path.resolve(args[localFileIndex + 1]);
  } else {
    csvPath = path.resolve(import.meta.dirname, '../../prisma/data/subway.csv');
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    console.error('prisma/data/subway.csv에 파일을 넣거나 --local 옵션으로 경로를 지정하세요.');
    process.exit(1);
  }

  console.info(`Using CSV file: ${csvPath}`);
  await syncSubwayStations(csvPath);
  console.info('\n=== Subway sync completed ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
