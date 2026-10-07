import { stat } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBannerFindMany,
  mockDisclosureFindMany,
  mockStat,
} = vi.hoisted(() => ({
  mockBannerFindMany: vi.fn(),
  mockDisclosureFindMany: vi.fn(),
  mockStat: vi.fn(),
}));

vi.mock('node:fs/promises', async () => {
  const actual = await vi.importActual<typeof import('node:fs/promises')>('node:fs/promises');
  return { ...actual, stat: mockStat };
});

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    affiliateBanner: {
      findMany: mockBannerFindMany,
    },
    affiliateProviderDisclosure: {
      findMany: mockDisclosureFindMany,
    },
  },
}));

import { getRandomAffiliateBanner } from '../../src/services/publicAffiliateBannerService.js';

const baseDate = new Date('2026-10-06T01:02:03.000Z');

function bannerRow(overrides: Record<string, unknown> = {}) {
  return {
    id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
    provider: 'coupang',
    name: '관리용 이름',
    imageSourceType: 'url',
    imageAssetId: null,
    imageAsset: null,
    externalImageUrl: 'https://images.example.com/banner.png',
    targetUrl: 'https://example.com/go?a=%2B&a=2+b',
    altText: '여름 준비',
    disclosureOverride: null,
    isEnabled: true,
    createdAt: baseDate,
    updatedAt: baseDate,
    ...overrides,
  };
}

function uploadAsset(id = '11111111-1111-4111-8111-111111111111', overrides: Record<string, unknown> = {}) {
  return {
    id,
    storageKey: `affiliate-banners/${id}.png`,
    status: 'ready',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  mockDisclosureFindMany.mockResolvedValue([
    { provider: 'coupang', defaultDisclosureText: '쿠팡 기본 문구' },
    { provider: 'ali', defaultDisclosureText: '알리 기본 문구' },
  ]);
  mockStat.mockResolvedValue({ isFile: () => true });
});

describe('getRandomAffiliateBanner', () => {
  it('returns one enabled public DTO with a banner disclosure override and no admin fields', async () => {
    mockBannerFindMany.mockResolvedValue([
      bannerRow({
        provider: 'ali',
        disclosureOverride: '<b>개별 문구</b>\n둘째 줄',
        imageSourceType: 'upload',
        imageAssetId: '11111111-1111-4111-8111-111111111111',
        imageAsset: uploadAsset(),
        externalImageUrl: null,
      }),
    ]);

    const result = await getRandomAffiliateBanner();

    expect(mockBannerFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { isEnabled: true },
      include: { imageAsset: true },
    }));
    expect(stat).toHaveBeenCalled();
    expect(result).toEqual({
      id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
      provider: 'ali',
      imageUrl: '/api/images/affiliate-banners/11111111-1111-4111-8111-111111111111.png',
      targetUrl: 'https://example.com/go?a=%2B&a=2+b',
      altText: '여름 준비',
      disclosureText: '<b>개별 문구</b>\n둘째 줄',
    });
    expect(result).not.toHaveProperty('name');
    expect(result).not.toHaveProperty('imageAssetId');
    expect(result).not.toHaveProperty('isEnabled');
  });

  it('uses the provider default disclosure when the banner has no override', async () => {
    mockBannerFindMany.mockResolvedValue([
      bannerRow({ provider: 'coupang', disclosureOverride: null }),
    ]);

    await expect(getRandomAffiliateBanner()).resolves.toMatchObject({
      disclosureText: '쿠팡 기본 문구',
    });
  });

  it('filters unusable candidates before selecting a random banner', async () => {
    const valid = bannerRow({
      id: '88888888-8888-4888-8888-888888888888',
      disclosureOverride: '살아남은 문구',
      externalImageUrl: 'https://cdn.example.com/valid.webp',
      targetUrl: 'https://click.example.com/valid',
    });
    mockBannerFindMany.mockResolvedValue([
      bannerRow({ id: '10000000-0000-4000-8000-000000000001', provider: 'toss', disclosureOverride: null }),
      bannerRow({ id: '10000000-0000-4000-8000-000000000002', targetUrl: 'http://example.com/not-https' }),
      bannerRow({ id: '10000000-0000-4000-8000-000000000003', externalImageUrl: 'http://cdn.example.com/not-https.png' }),
      bannerRow({
        id: '10000000-0000-4000-8000-000000000004',
        imageSourceType: 'upload',
        imageAssetId: '22222222-2222-4222-8222-222222222222',
        imageAsset: uploadAsset('22222222-2222-4222-8222-222222222222', { status: 'pending' }),
        externalImageUrl: null,
      }),
      valid,
    ]);

    const result = await getRandomAffiliateBanner();

    expect(result?.id).toBe(valid.id);
    expect(result?.imageUrl).toBe('https://cdn.example.com/valid.webp');
    expect(result?.disclosureText).toBe('살아남은 문구');
  });

  it('returns null when every enabled banner is invalid or the upload file is missing', async () => {
    mockBannerFindMany.mockResolvedValue([
      bannerRow({ provider: 'toss', disclosureOverride: null }),
      bannerRow({
        imageSourceType: 'upload',
        imageAssetId: '33333333-3333-4333-8333-333333333333',
        imageAsset: uploadAsset('33333333-3333-4333-8333-333333333333'),
        externalImageUrl: null,
      }),
    ]);
    mockStat.mockRejectedValue(new Error('ENOENT'));

    await expect(getRandomAffiliateBanner()).resolves.toBeNull();
  });

  it('selects among valid candidates using Math.random', async () => {
    mockBannerFindMany.mockResolvedValue([
      bannerRow({ id: '10000000-0000-4000-8000-000000000001', disclosureOverride: '첫 문구' }),
      bannerRow({ id: '20000000-0000-4000-8000-000000000002', disclosureOverride: '둘째 문구' }),
    ]);
    vi.mocked(Math.random).mockReturnValue(0.99);

    const result = await getRandomAffiliateBanner();

    expect(result?.id).toBe('20000000-0000-4000-8000-000000000002');
  });
});
