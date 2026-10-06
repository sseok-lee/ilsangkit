import { mkdir, mkdtemp, readFile, readdir, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type AssetRow = {
  id: string;
  storageKey: string;
  mimeType: string;
  byteSize: number;
  status: 'pending' | 'ready' | 'deleting';
  unlinkedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  banner?: { id: string } | null;
};

const { mockTransaction, mockFindMany, mockFindUnique, mockDeleteMany, mockQueryRaw } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockDeleteMany: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    $transaction: mockTransaction,
    affiliateBannerAsset: {
      findMany: mockFindMany,
      findUnique: mockFindUnique,
      deleteMany: mockDeleteMany,
    },
  },
}));

import { cleanupAffiliateBannerAssets } from '../../src/services/affiliateBannerCleanupService.js';

const now = new Date('2026-10-06T12:00:00.000Z');
const old = new Date(now.getTime() - 24 * 60 * 60 * 1000);
const almostOld = new Date(now.getTime() - (24 * 60 * 60 * 1000 - 60 * 1000));

let uploadRoot: string;
let rows: AssetRow[];
let queryRawCalls: string[];
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

function asset(id: string, status: AssetRow['status'], overrides: Partial<AssetRow> = {}): AssetRow {
  return {
    id,
    storageKey: `affiliate-banners/${id}.png`,
    mimeType: 'image/png',
    byteSize: 4,
    status,
    unlinkedAt: status === 'ready' ? old : null,
    createdAt: old,
    updatedAt: old,
    banner: null,
    ...overrides,
  };
}

function tx() {
  return {
    $queryRaw: mockQueryRaw,
    affiliateBannerAsset: {
      findUnique: mockFindUnique,
      updateMany: vi.fn(async ({ where, data }) => {
        const row = rows.find((item) => item.id === where.id && (!where.status || item.status === where.status));
        if (!row) return { count: 0 };
        Object.assign(row, data, { updatedAt: now });
        return { count: 1 };
      }),
    },
  };
}

async function writeAssetFiles(row: AssetRow, options: { staging?: boolean; final?: boolean } = { final: true }) {
  const staging = path.join(uploadRoot, '.affiliate-banner-staging', `${row.id}.part`);
  const final = path.join(uploadRoot, row.storageKey);
  await mkdir(path.dirname(staging), { recursive: true });
  await mkdir(path.dirname(final), { recursive: true });
  if (options.staging) await writeFile(staging, Buffer.from('part'));
  if (options.final) await writeFile(final, Buffer.from('file'));
  await Promise.all([
    options.staging ? utimes(staging, old, old) : Promise.resolve(),
    options.final ? utimes(final, old, old) : Promise.resolve(),
  ]);
}

async function listFiles(dir: string): Promise<string[]> {
  try {
    return (await readdir(dir)).sort();
  } catch {
    return [];
  }
}

beforeEach(async () => {
  uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'affiliate-banner-cleanup-'));
  process.env.UPLOAD_DIR = uploadRoot;
  rows = [];
  queryRawCalls = [];
  mockFindMany.mockImplementation(async ({ where, take, cursor, skip, orderBy }) => {
    expect(take).toBe(100);
    expect(orderBy).toEqual({ id: 'asc' });
    const eligible = rows
      .filter((row) => {
        if (row.status === 'deleting') return true;
        if (row.status === 'ready') return row.unlinkedAt !== null && row.unlinkedAt <= old;
        if (row.status === 'pending') return row.createdAt <= old;
        return false;
      })
      .sort((a, b) => a.id.localeCompare(b.id));
    const startIndex = cursor ? eligible.findIndex((row) => row.id === cursor.id) + skip : 0;
    return eligible.slice(startIndex, startIndex + take);
  });
  mockFindUnique.mockImplementation(async ({ where, include }) => {
    expect(include).toEqual({ banner: { select: { id: true } } });
    return rows.find((row) => row.id === where.id) ?? null;
  });
  mockDeleteMany.mockImplementation(async ({ where }) => {
    const index = rows.findIndex((row) => row.id === where.id && (!where.status || row.status === where.status));
    if (index === -1) return { count: 0 };
    rows.splice(index, 1);
    return { count: 1 };
  });
  mockTransaction.mockImplementation(async (work) => work(tx()));
  mockQueryRaw.mockImplementation(async (strings, ...values) => {
    queryRawCalls.push(String(strings[0]));
    return [{ id: values[0] }];
  });
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(async () => {
  consoleErrorSpy.mockRestore();
  vi.clearAllMocks();
  delete process.env.UPLOAD_DIR;
  await rm(uploadRoot, { recursive: true, force: true });
});

describe('cleanupAffiliateBannerAssets', () => {
  it('keeps ready assets until they have been unreferenced for at least 24 hours', async () => {
    const kept = asset('11111111-1111-4111-8111-111111111111', 'ready', { unlinkedAt: almostOld });
    rows.push(kept);
    await writeAssetFiles(kept);

    const result = await cleanupAffiliateBannerAssets(now);

    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(rows).toHaveLength(1);
    expect(await readFile(path.join(uploadRoot, kept.storageKey), 'utf8')).toBe('file');
  });

  it('deletes ready unreferenced assets after 24 hours without taking a banner lock', async () => {
    const expired = asset('22222222-2222-4222-8222-222222222222', 'ready');
    rows.push(expired);
    await writeAssetFiles(expired);

    const result = await cleanupAffiliateBannerAssets(now);

    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(rows).toEqual([]);
    expect(await listFiles(path.join(uploadRoot, 'affiliate-banners'))).toEqual([]);
    expect(queryRawCalls.join('\n')).toContain('AffiliateBannerAsset');
    expect(queryRawCalls.join('\n')).not.toContain('AffiliateBanner WHERE');
  });

  it('rechecks the locked row and preserves assets that became referenced', async () => {
    const referenced = asset('33333333-3333-4333-8333-333333333333', 'ready');
    rows.push(referenced);
    await writeAssetFiles(referenced);
    mockFindUnique.mockImplementationOnce(async ({ where }) => ({
      ...rows.find((row) => row.id === where.id),
      banner: { id: 'banner-1' },
      unlinkedAt: null,
    }));

    const result = await cleanupAffiliateBannerAssets(now);

    expect(result).toEqual({ deleted: 0, failed: 0 });
    expect(rows).toHaveLength(1);
    expect(await readFile(path.join(uploadRoot, referenced.storageKey), 'utf8')).toBe('file');
  });

  it('removes expired pending staging and final files including upload CAS recovery rows', async () => {
    const pending = asset('44444444-4444-4444-8444-444444444444', 'pending');
    rows.push(pending);
    await writeAssetFiles(pending, { staging: true, final: true });

    const result = await cleanupAffiliateBannerAssets(now);

    expect(consoleErrorSpy.mock.calls).toEqual([]);
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(rows).toEqual([]);
    expect(await listFiles(path.join(uploadRoot, '.affiliate-banner-staging'))).toEqual([]);
    expect(await listFiles(path.join(uploadRoot, 'affiliate-banners'))).toEqual([]);
  });

  it('keeps deleting rows for retry when unlink fails', async () => {
    const deleting = asset('55555555-5555-4555-8555-555555555555', 'deleting');
    rows.push(deleting);
    await writeAssetFiles(deleting);
    await rm(path.join(uploadRoot, 'affiliate-banners', deleting.id + '.png'), { force: true });
    await mkdir(path.join(uploadRoot, 'affiliate-banners', deleting.id + '.png'));

    const result = await cleanupAffiliateBannerAssets(now);

    expect(result).toEqual({ deleted: 0, failed: 1 });
    expect(rows).toHaveLength(1);
  });

  it('treats missing files and already-deleted rows as successful recovery', async () => {
    const deleting = asset('66666666-6666-4666-8666-666666666666', 'deleting');
    rows.push(deleting);
    mockDeleteMany.mockResolvedValueOnce({ count: 0 });

    const result = await cleanupAffiliateBannerAssets(now);

    expect(consoleErrorSpy.mock.calls).toEqual([]);
    expect(result).toEqual({ deleted: 1, failed: 0 });
  });

  it('uses keyset pagination with batches of 100', async () => {
    for (let index = 0; index < 101; index += 1) {
      const suffix = String(index).padStart(12, '0');
      const id = `77777777-7777-4777-8777-${suffix}`;
      const row = asset(id, 'ready');
      rows.push(row);
      await writeAssetFiles(row);
    }

    const result = await cleanupAffiliateBannerAssets(now);

    expect(result).toEqual({ deleted: 101, failed: 0 });
    expect(mockFindMany).toHaveBeenCalledTimes(2);
    expect(mockFindMany.mock.calls[1][0].where.AND[0]).toEqual({ id: { gt: '77777777-7777-4777-8777-000000000099' } });
  });

  it('fail-closes orphan staging scan to uuid part regular files older than 24h without DB rows', async () => {
    const orphanId = '88888888-8888-4888-8888-888888888888';
    const freshId = '99999999-9999-4999-8999-999999999999';
    const stagingDir = path.join(uploadRoot, '.affiliate-banner-staging');
    await mkdir(stagingDir, { recursive: true });
    await writeFile(path.join(stagingDir, `${orphanId}.part`), 'orphan');
    await writeFile(path.join(stagingDir, `${freshId}.part`), 'fresh');
    await writeFile(path.join(stagingDir, 'not-a-uuid.part'), 'ignored');
    await writeFile(path.join(stagingDir, `${orphanId}.tmp`), 'ignored');
    await symlink(path.join(stagingDir, `${orphanId}.part`), path.join(stagingDir, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.part'));
    await utimes(path.join(stagingDir, `${orphanId}.part`), old, old);
    await utimes(path.join(stagingDir, 'not-a-uuid.part'), old, old);
    await utimes(path.join(stagingDir, `${orphanId}.tmp`), old, old);
    const result = await cleanupAffiliateBannerAssets(now);

    expect(consoleErrorSpy.mock.calls).toEqual([]);
    expect(result).toEqual({ deleted: 1, failed: 0 });
    expect(await listFiles(stagingDir)).toEqual([
      '99999999-9999-4999-8999-999999999999.part',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb.part',
      `${orphanId}.tmp`,
      'not-a-uuid.part',
    ].sort());
  });

  it('does not delete orphan staging files when the DB check fails', async () => {
    const orphanId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const stagingPath = path.join(uploadRoot, '.affiliate-banner-staging', `${orphanId}.part`);
    await mkdir(path.dirname(stagingPath), { recursive: true });
    await writeFile(stagingPath, 'orphan');
    await utimes(stagingPath, old, old);
    mockFindUnique.mockRejectedValueOnce(new Error('db unavailable'));

    const result = await cleanupAffiliateBannerAssets(now);

    expect(result).toEqual({ deleted: 0, failed: 1 });
    expect((await stat(stagingPath)).isFile()).toBe(true);
  });
});
