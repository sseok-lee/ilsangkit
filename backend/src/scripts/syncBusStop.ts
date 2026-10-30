#!/usr/bin/env tsx
/**
 * 전국 버스정류장 동기화 스크립트.
 *
 *   npm run sync:bus-stop                                         # odcloud API 최신 판
 *   npm run sync:bus-stop -- --local /path/to/file.csv [--version YYYYMMDD]  # 비상용
 */

import * as path from 'path';
import { syncLatestBusStops } from '../services/busStopSyncService.js';

function argValue(args: string[], flag: string): string | undefined {
  const i = args.indexOf(flag);
  return i !== -1 ? args[i + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const local = argValue(args, '--local');
  const version = argValue(args, '--version');
  if (version !== undefined && !/^\d{8}$/.test(version)) {
    throw new Error(`--version 은 YYYYMMDD 형식이어야 합니다: ${version}`);
  }

  const started = Date.now();
  const result = await syncLatestBusStops({
    localCsv: local ? path.resolve(local) : undefined,
    version,
  });
  const sec = ((Date.now() - started) / 1000).toFixed(1);
  console.info(
    `=== BusStop sync ${result.outcome}: total=${result.totalRecords} new=${result.newRecords} updated=${result.updatedRecords} skipped=${result.skippedRecords} (${sec}s) ===`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
