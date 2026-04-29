#!/usr/bin/env tsx

import { syncParksFromApi } from '../services/parkSyncService.js';

async function main(): Promise<void> {
  console.log('=== 공원 데이터 동기화 시작 (API) ===\n');
  const result = await syncParksFromApi();
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

main().catch(error => {
  console.error('치명적 오류:', error);
  process.exit(1);
});
