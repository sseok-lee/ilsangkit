#!/usr/bin/env tsx

import { syncSports } from '../services/sportsSyncService.js';

async function main(): Promise<void> {
  console.info('Starting sports facility data sync...');
  await syncSports();
  console.info('\n=== Sync process completed ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
