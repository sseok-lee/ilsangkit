#!/usr/bin/env tsx
import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import prisma from '../lib/prisma.js';
import { fetchPublicRentalNotices } from '../services/publicRentalSources.js';
import { savePublicRentalNotices } from '../services/publicRentalSyncService.js';
import { runSync } from '../services/baseSyncService.js';
import { installRuntimeGuard } from './_runtimeGuard.js';

export async function syncPublicRental(args: string[], serviceKey: string): Promise<void> {
  if (args.some(arg => !['--write', '--dry-run'].includes(arg)) ||
      (args.includes('--write') && args.includes('--dry-run'))) {
    throw new Error('Usage: syncPublicRental [--dry-run | --write]');
  }
  if (!serviceKey.trim()) throw new Error('OPENAPI_SERVICE_KEY is required');
  const fetchSnapshot = async () => {
    const notices = await fetchPublicRentalNotices(serviceKey);
    if (!notices.length) throw new Error('Public rental sync collected 0 notices');
    const summary = notices.reduce<Record<string, number>>((counts, notice) => {
      counts[notice.status] = (counts[notice.status] ?? 0) + 1;
      return counts;
    }, {});
    console.info(JSON.stringify({ mode: args.includes('--write') ? 'write' : 'dry-run', notices: notices.length, status: summary }));
    return notices;
  };
  if (!args.includes('--write')) {
    await fetchSnapshot();
    return;
  }
  await runSync('sub-public-rent', async stats => {
    // Fetch every source before changing notices. A failed source cannot become a partial snapshot.
    const notices = await fetchSnapshot();
    await savePublicRentalNotices(notices, stats);
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  installRuntimeGuard({ maxMinutes: 20, name: 'syncPublicRental', prisma });
  syncPublicRental(process.argv.slice(2), process.env.OPENAPI_SERVICE_KEY ?? '')
    .catch(error => {
      console.error('Public rental sync failed:', error instanceof Error ? error.message : 'Unknown error');
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
