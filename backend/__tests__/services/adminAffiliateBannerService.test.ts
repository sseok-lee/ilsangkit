import { stat } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

const {
  mockTransaction,
  mockQueryRaw,
  mockBannerCount,
  mockBannerFindMany,
  mockBannerFindUnique,
  mockBannerCreate,
  mockBannerUpdate,
  mockAssetFindUnique,
  mockAssetUpdateMany,
  mockStat,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockBannerCount: vi.fn(),
  mockBannerFindMany: vi.fn(),
  mockBannerFindUnique: vi.fn(),
  mockBannerCreate: vi.fn(),
  mockBannerUpdate: vi.fn(),
  mockAssetFindUnique: vi.fn(),
  mockAssetUpdateMany: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, stat: mockStat };
});

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    $transaction: mockTransaction,
    affiliateBanner: {
      count: mockBannerCount,
      findMany: mockBannerFindMany,
      findUnique: mockBannerFindUnique,
    },
  },
}));

import {
  createAffiliateBanner,
  getAffiliateBanner,
  listAffiliateBanners,
  lockAffiliateAssets,
  setAffiliateBannerStatus,
  updateAffiliateBanner,
} from '../../src/services/adminAffiliateBannerService.js';

const externalDraft = {
  provider: 'coupang' as const,
  name: '여름 준비',
  imageSourceType: 'url' as const,
  imageAssetId: null,
  externalImageUrl: 'https://images.example.com/banner.png',
  targetUrl: 'https://example.com/go?a=%2B&a=2+b',
  altText: '여름 준비',
};

const uploadDraft = {
  provider: 'ali' as const,
  name: '겨울 준비',
  imageSourceType: 'upload' as const,
  imageAssetId: '11111111-1111-4111-8111-111111111111',
  externalImageUrl: null,
  targetUrl: 'https://example.com/go?x=%2B&x=2+b',
  altText: '겨울 준비',
};

const baseDate = new Date('2026-10-06T01:02:03.000Z');

function bannerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
    provider: 'coupang',
    name: '여름 준비',
    imageSourceType: 'url',
    imageAssetId: null,
    externalImageUrl: 'https://images.example.com/banner.png',
    targetUrl: 'https://example.com/go?a=%2B&a=2+b',
    altText: '여름 준비',
    isEnabled: false,
    createdAt: baseDate,
    updatedAt: baseDate,
    imageAsset: null,
    ...overrides,
  };
}

function readyAsset(overrides: Record<string, unknown> = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    storageKey: 'affiliate-banners/11111111-1111-4111-8111-111111111111.png',
    status: 'ready',
    banner: null,
    ...overrides,
  };
}

function tx() {
  return {
    $queryRaw: mockQueryRaw,
    affiliateBanner: {
      create: mockBannerCreate,
      update: mockBannerUpdate,
      findUnique: mockBannerFindUnique,
    },
    affiliateBannerAsset: {
      findUnique: mockAssetFindUnique,
      updateMany: mockAssetUpdateMany,
    },
  };
}

beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  mockTransaction.mockImplementation(async (fn) => fn(tx()));
  mockStat.mockResolvedValue({ isFile: () => true });
  vi.stubGlobal('fetch', vi.fn());
});

describe('admin affiliate banner service', () => {
  it('create always stores disabled and preserves its target URL', async () => {
    mockBannerCreate.mockResolvedValue(bannerRow());

    const result = await createAffiliateBanner(externalDraft);

    expect(mockBannerCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ isEnabled: false, targetUrl: externalDraft.targetUrl }),
      include: { imageAsset: true },
    }));
    expect(result.isEnabled).toBe(false);
    expect(result.targetUrl).toBe(externalDraft.targetUrl);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('empty result has totalPages zero', async () => {
    mockBannerCount.mockResolvedValue(0);
    mockBannerFindMany.mockResolvedValue([]);

    const result = await listAffiliateBanners({ page: 3, limit: 20 });

    expect(result).toEqual({ items: [], total: 0, page: 3, totalPages: 0 });
    expect(mockBannerFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {},
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: 40,
      take: 20,
      include: { imageAsset: true },
    }));
  });

  it('preserves tracking URL on read', async () => {
    mockBannerFindUnique.mockResolvedValue(bannerRow());

    const result = await getAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e');

    expect(result.targetUrl).toBe('https://example.com/go?a=%2B&a=2+b');
  });

  it('locks affiliate assets once in sorted order', async () => {
    await lockAffiliateAssets(tx() as never, [
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    ]);

    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(String(mockQueryRaw.mock.calls[0][0][0])).toContain('SELECT id FROM AffiliateBannerAsset WHERE id = ');
    expect(mockQueryRaw.mock.calls[0][1]).toBe('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
    expect(mockQueryRaw.mock.calls[1][1]).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('rejects deleting or already linked assets', async () => {
    mockAssetFindUnique.mockResolvedValue(readyAsset({
      status: 'deleting',
      banner: null,
    }));

    await expect(createAffiliateBanner(uploadDraft)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });

    mockAssetFindUnique.mockResolvedValue(readyAsset({
      status: 'ready',
      banner: { id: 'existing-banner' },
    }));

    await expect(createAffiliateBanner(uploadDraft)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('failed replacement does not detach old asset', async () => {
    mockBannerFindUnique.mockResolvedValue(bannerRow({
      imageSourceType: 'upload',
      imageAssetId: '22222222-2222-4222-8222-222222222222',
      externalImageUrl: null,
      imageAsset: readyAsset({
        id: '22222222-2222-4222-8222-222222222222',
        storageKey: 'affiliate-banners/22222222-2222-4222-8222-222222222222.png',
      }),
    }));
    mockAssetFindUnique.mockResolvedValue(readyAsset());
    mockStat.mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));

    await expect(updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageSourceType: 'upload',
      imageAssetId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toMatchObject({ statusCode: 409 });

    expect(mockBannerUpdate).not.toHaveBeenCalled();
    expect(mockAssetUpdateMany).not.toHaveBeenCalled();
  });

  it('retries bounded P2034 transaction conflicts', async () => {
    mockBannerCreate.mockResolvedValue(bannerRow());
    mockTransaction
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: '6.19.2',
      }))
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('write conflict', {
        code: 'P2034',
        clientVersion: '6.19.2',
      }))
      .mockImplementationOnce(async (fn) => fn(tx()));

    const result = await createAffiliateBanner(externalDraft);

    expect(result.id).toBe('6ea02ad2-d1be-4d01-946d-d08005f01d4e');
    expect(mockTransaction).toHaveBeenCalledTimes(3);
    expect(mockTransaction.mock.calls[2][1]).toEqual({
      isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted,
      maxWait: 5000,
      timeout: 5000,
    });
  });

  it('disable succeeds without upload file stat or external fetch', async () => {
    mockBannerFindUnique.mockResolvedValue(bannerRow({
      isEnabled: true,
      imageSourceType: 'upload',
      imageAssetId: '11111111-1111-4111-8111-111111111111',
      externalImageUrl: null,
      imageAsset: readyAsset(),
    }));
    mockBannerUpdate.mockResolvedValue(bannerRow({ isEnabled: false }));

    const result = await setAffiliateBannerStatus('6ea02ad2-d1be-4d01-946d-d08005f01d4e', false);

    expect(result.isEnabled).toBe(false);
    expect(mockStat).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('updates upload banners to URL after saving the row and then detaches the old asset', async () => {
    const detachedAt = new Date('2026-10-06T04:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(detachedAt);
    const operations: string[] = [];
    mockBannerFindUnique.mockResolvedValue(bannerRow({
      imageSourceType: 'upload',
      imageAssetId: '22222222-2222-4222-8222-222222222222',
      externalImageUrl: null,
      imageAsset: readyAsset({
        id: '22222222-2222-4222-8222-222222222222',
        storageKey: 'affiliate-banners/22222222-2222-4222-8222-222222222222.png',
      }),
    }));
    mockBannerUpdate.mockImplementation(async (args) => {
      operations.push('banner.update');
      return bannerRow({ ...args.data, imageAsset: null });
    });
    mockAssetUpdateMany.mockImplementation(async () => {
      operations.push('asset.updateMany');
      return { count: 1 };
    });

    const result = await updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageSourceType: 'url',
      externalImageUrl: 'https://images.example.com/replacement.png',
    });

    expect(result.imageSourceType).toBe('url');
    expect(result.imageAssetId).toBeNull();
    expect(result.externalImageUrl).toBe('https://images.example.com/replacement.png');
    expect(operations).toEqual(['banner.update', 'asset.updateMany']);
    expect(mockBannerUpdate.mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        imageSourceType: 'url',
        imageAssetId: null,
        externalImageUrl: 'https://images.example.com/replacement.png',
      }),
    });
    expect(mockAssetUpdateMany).toHaveBeenCalledWith({
      where: { id: '22222222-2222-4222-8222-222222222222' },
      data: { unlinkedAt: detachedAt },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('updates URL banners to upload after saving the row and then marks the new asset linked', async () => {
    const operations: string[] = [];
    mockBannerFindUnique.mockResolvedValue(bannerRow());
    mockAssetFindUnique.mockResolvedValue(readyAsset());
    mockBannerUpdate.mockImplementation(async (args) => {
      operations.push('banner.update');
      return bannerRow({
        ...args.data,
        imageAsset: readyAsset(),
      });
    });
    mockAssetUpdateMany.mockImplementation(async () => {
      operations.push('asset.updateMany');
      return { count: 1 };
    });

    const result = await updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageSourceType: 'upload',
      imageAssetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(result.imageSourceType).toBe('upload');
    expect(result.externalImageUrl).toBeNull();
    expect(result.imageUrl).toBe('/api/images/affiliate-banners/11111111-1111-4111-8111-111111111111.png');
    expect(operations).toEqual(['banner.update', 'asset.updateMany']);
    expect(mockBannerUpdate.mock.calls[0][0]).toMatchObject({
      data: expect.objectContaining({
        imageSourceType: 'upload',
        imageAssetId: '11111111-1111-4111-8111-111111111111',
        externalImageUrl: null,
      }),
    });
    expect(mockAssetUpdateMany).toHaveBeenCalledWith({
      where: { id: '11111111-1111-4111-8111-111111111111', status: 'ready' },
      data: { unlinkedAt: null },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('updates upload banners to another upload after saving the row and then relinks assets in order', async () => {
    const detachedAt = new Date('2026-10-06T05:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(detachedAt);
    const operations: string[] = [];
    mockBannerFindUnique.mockResolvedValue(bannerRow({
      imageSourceType: 'upload',
      imageAssetId: '22222222-2222-4222-8222-222222222222',
      externalImageUrl: null,
      imageAsset: readyAsset({
        id: '22222222-2222-4222-8222-222222222222',
        storageKey: 'affiliate-banners/22222222-2222-4222-8222-222222222222.png',
      }),
    }));
    mockAssetFindUnique.mockResolvedValue(readyAsset());
    mockBannerUpdate.mockImplementation(async (args) => {
      operations.push('banner.update');
      return bannerRow({
        ...args.data,
        imageAsset: readyAsset(),
      });
    });
    mockAssetUpdateMany.mockImplementation(async () => {
      operations.push('asset.updateMany');
      return { count: 1 };
    });

    await updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageAssetId: '11111111-1111-4111-8111-111111111111',
    });

    expect(operations).toEqual(['banner.update', 'asset.updateMany', 'asset.updateMany']);
    expect(mockAssetUpdateMany.mock.calls[0][0]).toEqual({
      where: { id: '11111111-1111-4111-8111-111111111111', status: 'ready' },
      data: { unlinkedAt: null },
    });
    expect(mockAssetUpdateMany.mock.calls[1][0]).toEqual({
      where: { id: '22222222-2222-4222-8222-222222222222' },
      data: { unlinkedAt: detachedAt },
    });
  });

  it('does not detach the old upload asset when row update fails after new asset validation', async () => {
    mockBannerFindUnique.mockResolvedValue(bannerRow({
      imageSourceType: 'upload',
      imageAssetId: '22222222-2222-4222-8222-222222222222',
      externalImageUrl: null,
      imageAsset: readyAsset({
        id: '22222222-2222-4222-8222-222222222222',
        storageKey: 'affiliate-banners/22222222-2222-4222-8222-222222222222.png',
      }),
    }));
    mockAssetFindUnique.mockResolvedValue(readyAsset());
    mockBannerUpdate.mockRejectedValue(new Error('write failed'));

    await expect(updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageAssetId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toThrow('write failed');

    expect(mockStat).toHaveBeenCalledTimes(1);
    expect(mockAssetUpdateMany).not.toHaveBeenCalled();
  });

  it('allows reusing the same current asset but rejects another banner asset', async () => {
    mockBannerFindUnique.mockResolvedValue(bannerRow({
      imageSourceType: 'upload',
      imageAssetId: '11111111-1111-4111-8111-111111111111',
      externalImageUrl: null,
      imageAsset: readyAsset({ banner: { id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e' } }),
    }));
    mockAssetFindUnique.mockResolvedValue(readyAsset({ banner: { id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e' } }));
    mockBannerUpdate.mockResolvedValue(bannerRow({
      imageSourceType: 'upload',
      imageAssetId: '11111111-1111-4111-8111-111111111111',
      externalImageUrl: null,
      imageAsset: readyAsset(),
    }));

    await expect(updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageAssetId: '11111111-1111-4111-8111-111111111111',
    })).resolves.toMatchObject({ imageAssetId: '11111111-1111-4111-8111-111111111111' });

    mockAssetFindUnique.mockResolvedValue(readyAsset({ banner: { id: 'other-banner' } }));

    await expect(updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      imageAssetId: '11111111-1111-4111-8111-111111111111',
    })).rejects.toMatchObject({ statusCode: 409, code: 'CONFLICT' });
  });

  it.each(['P2002', 'P2003'])('maps Prisma %s write failures to 409', async (code) => {
    mockBannerCreate.mockRejectedValue(new Prisma.PrismaClientKnownRequestError('constraint failed', {
      code,
      clientVersion: '6.19.2',
    }));

    await expect(createAffiliateBanner(externalDraft)).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
    });
  });

  it('returns not found for get, update, and status when the banner row is missing', async () => {
    mockBannerFindUnique.mockResolvedValue(null);

    await expect(getAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e')).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    await expect(updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', { name: '없음' })).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
    await expect(setAffiliateBannerStatus('6ea02ad2-d1be-4d01-946d-d08005f01d4e', true)).rejects.toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
    });
  });

  it('does not fetch remote images across URL create, update, and status enable', async () => {
    mockBannerCreate.mockResolvedValue(bannerRow());
    mockBannerFindUnique.mockResolvedValue(bannerRow());
    mockBannerUpdate
      .mockResolvedValueOnce(bannerRow({ externalImageUrl: 'https://images.example.com/updated.png' }))
      .mockResolvedValueOnce(bannerRow({ isEnabled: true }));

    await createAffiliateBanner(externalDraft);
    await updateAffiliateBanner('6ea02ad2-d1be-4d01-946d-d08005f01d4e', {
      externalImageUrl: 'https://images.example.com/updated.png',
    });
    await setAffiliateBannerStatus('6ea02ad2-d1be-4d01-946d-d08005f01d4e', true);

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
