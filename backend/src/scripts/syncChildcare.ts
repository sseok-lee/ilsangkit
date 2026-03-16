#!/usr/bin/env tsx

import { syncChildcare } from '../services/childcareSyncService.js';

async function main(): Promise<void> {
  console.info('Starting childcare data sync...');
  await syncChildcare();
  console.info('\n=== Sync process completed ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
