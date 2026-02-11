#!/usr/bin/env tsx
// @TASK T9.1.2 - 공영주차장 동기화 스크립트

/**
 * 공영주차장 데이터 동기화 CLI
 *
 * 사용법:
 *   npm run sync:parking                          # CSV 모드 (기본)
 *   npm run sync:parking -- --file /path/to.csv   # CSV 파일 모드 (경로 지정)
 *   npm run sync:parking -- --mode api            # API 모드 (서비스키 필요)
 *   npm run sync:parking -- --mode csv            # 기본 CSV 파일 경로로 동기화
 */

import * as path from 'path';
import * as fs from 'fs';
import { syncParking, syncParkingFromApi } from '../services/parkingSyncService.js';

async function main(): Promise<void> {
  console.log('=== 공영주차장 데이터 동기화 시작 ===\n');

  const args = process.argv.slice(2);
  const fileIndex = args.indexOf('--file');
  const modeIndex = args.indexOf('--mode');

  // 모드 결정: --file 옵션이 있으면 CSV, --mode로 명시적 지정, 기본은 CSV
  let mode: 'api' | 'csv' = 'csv';

  if (fileIndex !== -1) {
    mode = 'csv';
  } else if (modeIndex !== -1 && args[modeIndex + 1]) {
    const modeArg = args[modeIndex + 1];
    if (modeArg === 'api' || modeArg === 'csv') {
      mode = modeArg;
    } else {
      console.error(`알 수 없는 모드: ${modeArg} (api 또는 csv를 지정하세요)`);
      process.exit(1);
    }
  }

  if (mode === 'api') {
    console.log('모드: API (data.go.kr Open API)');
    const result = await syncParkingFromApi();

    console.log('\n=== 동기화 결과 ===');
    console.log(`전체: ${result.totalRecords}건`);
    console.log(`신규: ${result.newRecords}건`);
    console.log(`업데이트: ${result.updatedRecords}건`);
    console.log(`스킵: ${result.skippedRecords}건`);

    if (result.errors.length > 0) {
      console.log(`\n오류 (${result.errors.length}건):`);
      result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (result.errors.length > 10) {
        console.log(`  ... 외 ${result.errors.length - 10}건`);
      }
    }
  } else {
    // CSV 모드
    let csvFilePath: string;

    if (fileIndex !== -1 && args[fileIndex + 1]) {
      csvFilePath = path.resolve(args[fileIndex + 1]);
    } else {
      csvFilePath = path.resolve(
        import.meta.dirname,
        '../../prisma/data/parking.csv'
      );
    }

    if (!fs.existsSync(csvFilePath)) {
      console.error(`CSV 파일을 찾을 수 없습니다: ${csvFilePath}`);
      console.error('--file 옵션으로 CSV 파일 경로를 지정하세요.');
      process.exit(1);
    }

    console.log(`모드: CSV 파일`);
    console.log(`CSV 파일: ${csvFilePath}`);

    const result = await syncParking(csvFilePath);

    console.log('\n=== 동기화 결과 ===');
    console.log(`전체: ${result.totalRecords}건`);
    console.log(`신규: ${result.newRecords}건`);
    console.log(`업데이트: ${result.updatedRecords}건`);
    console.log(`스킵: ${result.skippedRecords}건`);

    if (result.errors.length > 0) {
      console.log(`\n오류 (${result.errors.length}건):`);
      result.errors.slice(0, 10).forEach(err => console.log(`  - ${err}`));
      if (result.errors.length > 10) {
        console.log(`  ... 외 ${result.errors.length - 10}건`);
      }
    }
  }
}

main().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
