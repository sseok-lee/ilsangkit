import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockDisclosureFindMany,
  mockDisclosureUpsert,
} = vi.hoisted(() => ({
  mockDisclosureFindMany: vi.fn(),
  mockDisclosureUpsert: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    affiliateProviderDisclosure: {
      findMany: mockDisclosureFindMany,
      upsert: mockDisclosureUpsert,
    },
  },
}));

import {
  listAffiliateProviderDisclosures,
  loadAffiliateDisclosureDefaults,
  saveAffiliateProviderDisclosure,
} from '../../src/services/adminAffiliateDisclosureService.js';

describe('admin affiliate disclosure service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists all providers in contract order and fills missing rows with nulls', async () => {
    mockDisclosureFindMany.mockResolvedValue([
      {
        provider: 'toss',
        defaultDisclosureText: '토스 기본 문구',
        updatedAt: new Date('2026-10-07T03:00:00.000Z'),
      },
      {
        provider: 'coupang',
        defaultDisclosureText: '쿠팡 기본 문구',
        updatedAt: new Date('2026-10-07T01:00:00.000Z'),
      },
    ]);

    const result = await listAffiliateProviderDisclosures();

    expect(result).toEqual([
      {
        provider: 'coupang',
        defaultDisclosureText: '쿠팡 기본 문구',
        updatedAt: '2026-10-07T01:00:00.000Z',
      },
      {
        provider: 'ali',
        defaultDisclosureText: null,
        updatedAt: null,
      },
      {
        provider: 'toss',
        defaultDisclosureText: '토스 기본 문구',
        updatedAt: '2026-10-07T03:00:00.000Z',
      },
    ]);
    expect(mockDisclosureFindMany).toHaveBeenCalledWith({
      where: { provider: { in: ['coupang', 'ali', 'toss'] } },
      select: {
        provider: true,
        defaultDisclosureText: true,
        updatedAt: true,
      },
    });
  });

  it('upserts only the selected provider with normalized disclosure text', async () => {
    mockDisclosureUpsert.mockResolvedValue({
      provider: 'ali',
      defaultDisclosureText: '알리\n기본 문구',
      updatedAt: new Date('2026-10-07T04:05:06.000Z'),
    });

    const result = await saveAffiliateProviderDisclosure('ali', {
      defaultDisclosureText: '  알리\r\n기본 문구  ',
    });

    expect(result).toEqual({
      provider: 'ali',
      defaultDisclosureText: '알리\n기본 문구',
      updatedAt: '2026-10-07T04:05:06.000Z',
    });
    expect(mockDisclosureUpsert).toHaveBeenCalledWith({
      where: { provider: 'ali' },
      create: {
        provider: 'ali',
        defaultDisclosureText: '알리\n기본 문구',
      },
      update: {
        defaultDisclosureText: '알리\n기본 문구',
      },
    });
  });

  it.each([
    ['empty text after normalization', { defaultDisclosureText: ' \r\n ' }],
    ['null text', { defaultDisclosureText: null }],
    ['extra keys', { defaultDisclosureText: '문구', unexpected: true }],
  ])('rejects %s before writing', async (_name, input) => {
    await expect(saveAffiliateProviderDisclosure('coupang', input as never)).rejects.toMatchObject({
      statusCode: 422,
      code: 'VALIDATION_ERROR',
    });

    expect(mockDisclosureUpsert).not.toHaveBeenCalled();
  });

  it('loads defaults for unique requested providers without adding seed values', async () => {
    mockDisclosureFindMany.mockResolvedValue([
      { provider: 'toss', defaultDisclosureText: '토스 기본 문구' },
      { provider: 'coupang', defaultDisclosureText: '쿠팡 기본 문구' },
    ]);

    const defaults = await loadAffiliateDisclosureDefaults(['toss', 'coupang', 'toss']);

    expect(defaults).toEqual(new Map([
      ['toss', '토스 기본 문구'],
      ['coupang', '쿠팡 기본 문구'],
    ]));
    expect(defaults.has('ali')).toBe(false);
    expect(mockDisclosureFindMany).toHaveBeenCalledWith({
      where: { provider: { in: ['toss', 'coupang'] } },
      select: {
        provider: true,
        defaultDisclosureText: true,
      },
    });
  });

  it('does not query the database when loading defaults for no providers', async () => {
    const defaults = await loadAffiliateDisclosureDefaults([]);

    expect(defaults).toEqual(new Map());
    expect(mockDisclosureFindMany).not.toHaveBeenCalled();
  });

  it('works with transaction-client compatible disclosure delegates', async () => {
    const transactionDb = {
      affiliateProviderDisclosure: {
        findMany: vi.fn().mockResolvedValue([
          { provider: 'ali', defaultDisclosureText: '트랜잭션 기본 문구' },
        ]),
      },
    };

    const defaults = await loadAffiliateDisclosureDefaults(['ali'], transactionDb);

    expect(defaults).toEqual(new Map([['ali', '트랜잭션 기본 문구']]));
    expect(transactionDb.affiliateProviderDisclosure.findMany).toHaveBeenCalledWith({
      where: { provider: { in: ['ali'] } },
      select: {
        provider: true,
        defaultDisclosureText: true,
      },
    });
    expect(mockDisclosureFindMany).not.toHaveBeenCalled();
  });
});
