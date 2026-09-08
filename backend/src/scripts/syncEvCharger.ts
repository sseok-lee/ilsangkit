#!/usr/bin/env tsx

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { syncEvChargers } from '../services/evChargerSyncService.js';

async function main(): Promise<void> {
  console.info('Starting ev-charger data sync...');
  await syncEvChargers();

  console.info('\n=== Sync process completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
