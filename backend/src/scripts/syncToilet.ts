#!/usr/bin/env tsx
// @TASK T2.1 - 공공화장실 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import * as fs from 'fs';
import * as path from 'path';
import { syncToilets } from '../services/toiletSyncService.js';

/**
 * 메인 함수
 *
 * 사용법:
 *   npm run sync:toilet                              # prisma/data/toilet.csv 사용
 *   npm run sync:toilet -- --local /path/to/file.csv # 다른 경로 지정
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // CSV 파일 경로 결정
  let csvPath: string;

  const localFileIndex = args.indexOf('--local');
  if (localFileIndex !== -1 && args[localFileIndex + 1]) {
    csvPath = path.resolve(args[localFileIndex + 1]);
  } else {
    csvPath = path.resolve(
      import.meta.dirname,
      '../../prisma/data/toilet.csv'
    );
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    console.error('prisma/data/toilet.csv에 파일을 넣거나 --local 옵션으로 경로를 지정하세요.');
    process.exit(1);
  }

  console.info(`Using CSV file: ${csvPath}`);
  await syncToilets(csvPath);
  console.info('\n=== Sync process completed ===');
}

// 스크립트 실행
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
