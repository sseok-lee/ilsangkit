import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), save: vi.fn(), run: vi.fn() }));
vi.mock('../../src/services/publicRentalSources.js', () => ({ fetchPublicRentalNotices: mocks.fetch }));
vi.mock('../../src/services/publicRentalSyncService.js', () => ({ savePublicRentalNotices: mocks.save }));
vi.mock('../../src/services/baseSyncService.js', () => ({ runSync: mocks.run }));
import { syncPublicRental } from '../../src/scripts/syncPublicRental.js';

describe('public rental sync command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fetch.mockResolvedValue([{ publicRental: { sources: ['LH'] }, status: 'unknown' }]);
    mocks.run.mockImplementation(async (_category, fn) => fn({ totalRecords: 0 }));
  });
  it('defaults to a dry run without writing notices or sync history', async () => {
    await syncPublicRental([], 'key');
    expect(mocks.fetch).toHaveBeenCalledWith('key');
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.run).not.toHaveBeenCalled();
  });
  it('writes all fetched sources through tracked sync only with --write', async () => {
    await syncPublicRental(['--write'], 'key');
    expect(mocks.run).toHaveBeenCalledWith('sub-public-rent', expect.any(Function));
    expect(mocks.save).toHaveBeenCalledWith(expect.any(Array), { totalRecords: 0 });
  });
  it('fails without data writes if any upstream source fails', async () => {
    mocks.fetch.mockRejectedValue(new Error('LH unavailable'));
    await expect(syncPublicRental(['--write'], 'key')).rejects.toThrow('LH unavailable');
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it('rejects missing credentials and ambiguous or unknown options before fetching', async () => {
    await expect(syncPublicRental([], '')).rejects.toThrow('OPENAPI_SERVICE_KEY');
    await expect(syncPublicRental(['--write', '--dry-run'], 'key')).rejects.toThrow('Usage');
    await expect(syncPublicRental(['--writ'], 'key')).rejects.toThrow('Usage');
    expect(mocks.fetch).not.toHaveBeenCalled();
  });
  it('rejects an empty snapshot rather than recording successful collection', async () => {
    mocks.fetch.mockResolvedValue([]);
    await expect(syncPublicRental(['--write'], 'key')).rejects.toThrow('0');
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
