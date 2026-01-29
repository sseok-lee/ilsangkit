// @TASK T2.3.1 - 의류수거함 데이터 동기화 (CSV 기반)
// @SPEC docs/planning/02-trd.md#데이터-동기화

import * as path from 'path';
import { syncClothes } from '../services/clothesSyncService.js';

// 기본 CSV 파일 경로
const DEFAULT_CSV_PATH = path.resolve(
  import.meta.dirname,
  '../../prisma/data/clothes.csv'
);

/**
 * CLI 인자 파싱
 */
function parseArgs(): { csvPath: string } {
  const args = process.argv.slice(2);
  let csvPath = DEFAULT_CSV_PATH;

  // --local 옵션으로 다른 파일 지정 가능
  const localIndex = args.indexOf('--local');
  if (localIndex !== -1 && args[localIndex + 1]) {
    csvPath = path.resolve(process.cwd(), args[localIndex + 1]);
  }

  return { csvPath };
}

/**
 * 메인 실행 함수
 */
async function main(): Promise<void> {
  const { csvPath } = parseArgs();

  console.info('='.repeat(50));
  console.info('의류수거함 데이터 동기화 시작');
  console.info('='.repeat(50));
  console.info(`CSV 파일: ${csvPath}`);
  console.info('');

  try {
    const stats = await syncClothes(csvPath);

    console.info('');
    console.info('='.repeat(50));
    console.info('동기화 결과');
    console.info('='.repeat(50));
    console.info(`전체 레코드: ${stats.totalRecords}`);
    console.info(`신규 추가: ${stats.newRecords}`);
    console.info(`업데이트: ${stats.updatedRecords}`);
    console.info(`스킵: ${stats.skippedRecords}`);

    if (stats.errors.length > 0) {
      console.info(`에러: ${stats.errors.length}건`);
    }

    process.exit(0);
  } catch (error) {
    console.error('동기화 실패:', error);
    process.exit(1);
  }
}

// CLI 실행
main();
