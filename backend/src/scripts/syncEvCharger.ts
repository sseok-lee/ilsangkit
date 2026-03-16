#!/usr/bin/env tsx

import { syncEvChargers } from '../services/evChargerSyncService.js';

async function main(): Promise<void> {
  console.info('Starting ev-charger data sync...');
  await syncEvChargers();
  console.info('\n=== Sync process completed ===');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
