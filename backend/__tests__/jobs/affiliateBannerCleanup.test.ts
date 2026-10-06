import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCleanup } = vi.hoisted(() => ({
  mockCleanup: vi.fn(),
}));

vi.mock('../../src/services/affiliateBannerCleanupService.js', () => ({
  cleanupAffiliateBannerAssets: mockCleanup,
}));

import { startAffiliateBannerCleanup } from '../../src/jobs/affiliateBannerCleanup.js';

let consoleInfoSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
});

afterEach(() => {
  consoleInfoSpy.mockRestore();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('startAffiliateBannerCleanup', () => {
  it('runs once at startup and then hourly; stops cleanly', async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockResolvedValue({ deleted: 0, failed: 0 });
    const job = startAffiliateBannerCleanup({ run, intervalMs: 3_600_000 });

    await vi.advanceTimersByTimeAsync(0);
    expect(run).toHaveBeenCalledTimes(1);
    expect(consoleInfoSpy).toHaveBeenCalledWith('affiliate-banner-cleanup-started');
    expect(consoleInfoSpy).toHaveBeenCalledWith('affiliate-banner-cleanup-finished', { deleted: 0, failed: 0 });

    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(run).toHaveBeenCalledTimes(2);

    await job.stop();
    await vi.advanceTimersByTimeAsync(3_600_000);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('uses cleanupAffiliateBannerAssets as the default hourly run', async () => {
    vi.useFakeTimers();
    mockCleanup.mockResolvedValue({ deleted: 0, failed: 0 });

    const job = startAffiliateBannerCleanup({ intervalMs: 3_600_000 });
    await vi.advanceTimersByTimeAsync(0);
    await job.stop();

    expect(mockCleanup).toHaveBeenCalledTimes(1);
  });

  it('skips an overlapping tick and waits for the running cleanup on stop', async () => {
    vi.useFakeTimers();
    let resolveRun!: () => void;
    const run = vi.fn(() => new Promise<void>((resolve) => { resolveRun = resolve; }));

    const job = startAffiliateBannerCleanup({ run, intervalMs: 10 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10);

    const stopPromise = job.stop();
    let stopped = false;
    stopPromise.then(() => { stopped = true; });
    await vi.advanceTimersByTimeAsync(10);

    expect(run).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(false);

    resolveRun();
    await stopPromise;
    expect(stopped).toBe(true);
  });

  it('logs run failures and keeps later ticks alive', async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const run = vi.fn()
      .mockRejectedValueOnce(new Error('db unavailable'))
      .mockResolvedValue({ deleted: 0, failed: 0 });

    const job = startAffiliateBannerCleanup({ run, intervalMs: 10 });
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(10);
    await job.stop();

    expect(run).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'affiliate-banner-cleanup-failed',
      expect.objectContaining({ error: 'db unavailable' }),
    );
    consoleErrorSpy.mockRestore();
  });
});
