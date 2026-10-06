import { cleanupAffiliateBannerAssets } from '../services/affiliateBannerCleanupService.js';

const DEFAULT_INTERVAL_MS = 3_600_000;

type CleanupJobOptions = {
  run?: () => Promise<unknown>;
  intervalMs?: number;
};

type CleanupJob = {
  stop(): Promise<void>;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function startAffiliateBannerCleanup(options: CleanupJobOptions = {}): CleanupJob {
  const run = options.run ?? cleanupAffiliateBannerAssets;
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  let stopped = false;
  let running: Promise<void> | null = null;

  const runOnce = (): void => {
    if (stopped || running) return;
    running = Promise.resolve()
      .then(async () => {
        console.info('affiliate-banner-cleanup-started');
        const result = await run();
        if (isCleanupResult(result)) {
          console.info('affiliate-banner-cleanup-finished', result);
        } else {
          console.info('affiliate-banner-cleanup-finished');
        }
      })
      .catch((error: unknown) => {
        console.error('affiliate-banner-cleanup-failed', { error: errorMessage(error) });
      })
      .finally(() => {
        running = null;
      });
  };

  const timer = setInterval(runOnce, intervalMs);
  setTimeout(runOnce, 0);

  return {
    async stop(): Promise<void> {
      stopped = true;
      clearInterval(timer);
      if (running) await running;
    },
  };
}

function isCleanupResult(value: unknown): value is { deleted: number; failed: number } {
  return typeof value === 'object'
    && value !== null
    && 'deleted' in value
    && 'failed' in value
    && typeof value.deleted === 'number'
    && typeof value.failed === 'number';
}
