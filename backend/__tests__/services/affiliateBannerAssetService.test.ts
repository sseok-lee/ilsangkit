import { mkdtemp, readFile, readdir, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAssetCreate, mockAssetUpdateMany, mockAssetDeleteMany, mockRandomUUID } = vi.hoisted(() => ({
  mockAssetCreate: vi.fn(),
  mockAssetUpdateMany: vi.fn(),
  mockAssetDeleteMany: vi.fn(),
  mockRandomUUID: vi.fn(),
}));

vi.mock('node:crypto', async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return { ...actual, randomUUID: mockRandomUUID };
});

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    affiliateBannerAsset: {
      create: mockAssetCreate,
      updateMany: mockAssetUpdateMany,
      deleteMany: mockAssetDeleteMany,
    },
  },
}));

import { getAffiliateAssetPaths, uploadAffiliateBannerImage } from '../../src/services/affiliateBannerAssetService.js';

const assetId = '11111111-1111-4111-8111-111111111111';
let uploadRoot: string;
let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

async function listFiles(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

beforeEach(async () => {
  uploadRoot = await mkdtemp(path.join(os.tmpdir(), 'affiliate-banner-assets-'));
  process.env.UPLOAD_DIR = uploadRoot;
  mockRandomUUID.mockReturnValue(assetId);
  mockAssetCreate.mockResolvedValue({ id: assetId });
  mockAssetUpdateMany.mockResolvedValue({ count: 1 });
  mockAssetDeleteMany.mockResolvedValue({ count: 1 });
  consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
  vi.clearAllMocks();
  delete process.env.UPLOAD_DIR;
});

describe('getAffiliateAssetPaths', () => {
  it('keeps affiliate banner assets inside the configured image root', () => {
    const paths = getAffiliateAssetPaths(assetId, `affiliate-banners/${assetId}.png`);

    expect(paths.staging).toBe(path.join(uploadRoot, '.affiliate-banner-staging', `${assetId}.part`));
    expect(paths.final).toBe(path.join(uploadRoot, 'affiliate-banners', `${assetId}.png`));
  });

  it.each([
    `guides/${assetId}.png`,
    `affiliate-banners/${assetId}/x.png`,
    `affiliate-banners/../${assetId}.png`,
    `affiliate-banners/22222222-2222-4222-8222-222222222222.png`,
    `affiliate-banners/${assetId}.svg`,
  ])('rejects unsafe storage key %s', (storageKey) => {
    expect(() => getAffiliateAssetPaths(assetId, storageKey)).toThrow();
  });
});

describe('uploadAffiliateBannerImage', () => {
  it('stores uploaded bytes under a generated affiliate banner URL and marks the asset ready', async () => {
    const bytes = await readFile(new URL('../fixtures/affiliate-banner.png', import.meta.url));

    const result = await uploadAffiliateBannerImage(bytes);
    const paths = getAffiliateAssetPaths(assetId, `affiliate-banners/${assetId}.png`);

    expect(result).toEqual({
      imageAssetId: assetId,
      imageUrl: `/api/images/affiliate-banners/${assetId}.png`,
    });
    expect(await readFile(paths.final)).toEqual(bytes);
    expect(await listFiles(path.dirname(paths.staging))).toEqual([]);
    expect((await stat(paths.final)).mode & 0o777).toBe(0o600);
    expect(mockAssetCreate).toHaveBeenCalledWith({
      data: {
        id: assetId,
        storageKey: `affiliate-banners/${assetId}.png`,
        mimeType: 'image/png',
        byteSize: bytes.length,
        status: 'pending',
        unlinkedAt: expect.any(Date),
      },
    });
    expect(mockAssetUpdateMany).toHaveBeenCalledWith({
      where: { id: assetId, status: 'pending' },
      data: { status: 'ready', unlinkedAt: expect.any(Date) },
    });
  });

  it('rejects an empty service-level upload before image detection or DB work', async () => {
    await expect(uploadAffiliateBannerImage(Buffer.alloc(0))).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });

    expect(mockRandomUUID).not.toHaveBeenCalled();
    expect(mockAssetCreate).not.toHaveBeenCalled();
  });

  it('rejects a service-level upload larger than 2MiB before image detection or DB work', async () => {
    await expect(uploadAffiliateBannerImage(Buffer.alloc(2 * 1024 * 1024 + 1))).rejects.toMatchObject({
      statusCode: 413,
      code: 'PAYLOAD_TOO_LARGE',
    });

    expect(mockRandomUUID).not.toHaveBeenCalled();
    expect(mockAssetCreate).not.toHaveBeenCalled();
  });

  it('removes staging bytes when DB create fails before an asset row exists', async () => {
    const bytes = await readFile(new URL('../fixtures/affiliate-banner.jpg', import.meta.url));
    mockAssetCreate.mockRejectedValue(new Error('db unavailable'));

    await expect(uploadAffiliateBannerImage(bytes)).rejects.toThrow('이미지 저장에 실패했습니다');

    expect(await listFiles(path.join(uploadRoot, '.affiliate-banner-staging'))).toEqual([]);
    expect(await listFiles(path.join(uploadRoot, 'affiliate-banners'))).toEqual([]);
    expect(mockAssetDeleteMany).not.toHaveBeenCalled();
  });

  it('guard-deletes only a pending row after rename failure when staging cleanup succeeds', async () => {
    const bytes = await readFile(new URL('../fixtures/affiliate-banner.gif', import.meta.url));
    mockAssetCreate.mockImplementationOnce(async () => {
      await import('node:fs/promises').then(({ mkdir }) =>
        mkdir(path.join(uploadRoot, 'affiliate-banners', `${assetId}.gif`), { recursive: true })
      );
      return { id: assetId };
    });

    await expect(uploadAffiliateBannerImage(bytes)).rejects.toThrow('이미지 저장에 실패했습니다');

    expect(mockAssetDeleteMany).toHaveBeenCalledWith({ where: { id: assetId, status: 'pending' } });
  });

  it('preserves the final file and row when ready CAS count is zero because status is no longer pending', async () => {
    const bytes = await readFile(new URL('../fixtures/affiliate-banner.webp', import.meta.url));
    mockAssetUpdateMany.mockResolvedValue({ count: 0 });

    await expect(uploadAffiliateBannerImage(bytes)).rejects.toThrow('이미지 저장에 실패했습니다');

    const paths = getAffiliateAssetPaths(assetId, `affiliate-banners/${assetId}.webp`);
    expect(await readFile(paths.final)).toEqual(bytes);
    expect(mockAssetDeleteMany).not.toHaveBeenCalled();
  });

  it('preserves the final file and row when a cleanup claimant wins before ready CAS', async () => {
    const bytes = await readFile(new URL('../fixtures/affiliate-banner.webp', import.meta.url));
    mockAssetUpdateMany.mockResolvedValue({ count: 0 });

    await expect(uploadAffiliateBannerImage(bytes)).rejects.toThrow('이미지 저장에 실패했습니다');

    expect(await listFiles(path.join(uploadRoot, 'affiliate-banners'))).toEqual([`${assetId}.webp`]);
    expect(mockAssetDeleteMany).not.toHaveBeenCalled();
  });
});
