import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRaw } = vi.hoisted(() => ({ queryRaw: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: { $queryRaw: queryRaw }, default: { $queryRaw: queryRaw } }));
import { checkActiveSummaryReadiness } from '../../src/services/realEstateSummaryReadiness.js';

beforeEach(() => {
  queryRaw.mockReset();
  queryRaw.mockResolvedValueOnce([{ status: 'ready', runId: 'summary-ready', validatedAt: new Date() }])
    .mockResolvedValueOnce([{ cnt: 2n }]);
});
afterEach(() => vi.unstubAllEnvs());

describe('URL registry release readiness', () => {
  it('refuses URL preservation when the summary is ready but its URL registry is unavailable', async () => {
    vi.stubEnv('REAL_ESTATE_URL_MODE', 'preserved');
    queryRaw.mockRejectedValue(new Error('registry unavailable'));
    expect(await checkActiveSummaryReadiness()).toMatchObject({
      ready: false, reason: 'public-url-registry-not-ready', runId: 'summary-ready',
    });
  });

  it('allows existing keyed releases without requiring the new table', async () => {
    vi.stubEnv('REAL_ESTATE_URL_MODE', 'keyed');
    expect(await checkActiveSummaryReadiness()).toMatchObject({ ready: true, runId: 'summary-ready' });
  });
});
