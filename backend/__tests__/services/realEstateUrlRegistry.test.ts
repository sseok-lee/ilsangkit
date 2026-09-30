import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRawUnsafeMock } = vi.hoisted(() => ({
  queryRawUnsafeMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: queryRawUnsafeMock },
  default: { $queryRawUnsafe: queryRawUnsafeMock },
}));

import {
  appendRealEstateUrlsForSummaryBatch,
  assertRealEstateUrlsReady,
  attachRealEstateCanonicalPaths,
  getDeferredRealEstateIdentity,
  getRealEstateCanonicalPath,
  isPreservedRealEstateUrlMode,
  resolveRealEstatePublicPath,
} from '../../src/services/realEstateUrlRegistry.js';

beforeEach(() => {
  vi.resetAllMocks();
  delete process.env.REAL_ESTATE_URL_MODE;
  delete process.env.REAL_ESTATE_SUMMARY_MODE;
});

describe('realEstateUrlRegistry mode', () => {
  it('defaults to keyed mode until preserved mode is explicitly enabled', async () => {
    expect(isPreservedRealEstateUrlMode()).toBe(false);
    await expect(
      attachRealEstateCanonicalPaths([{ type: 'apt-sale', buildingKey: 'a' }])
    ).resolves.toEqual([{ type: 'apt-sale', buildingKey: 'a' }]);
    await expect(assertRealEstateUrlsReady()).resolves.toBeUndefined();
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('rejects unknown REAL_ESTATE_URL_MODE values', () => {
    process.env.REAL_ESTATE_URL_MODE = 'legacy';
    expect(() => isPreservedRealEstateUrlMode()).toThrow(/REAL_ESTATE_URL_MODE/);
  });
});

describe('attachRealEstateCanonicalPaths', () => {
  it('batch attaches canonical paths in preserved mode', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        type: 'apt-sale',
        buildingKey: 'a'.repeat(64),
        canonicalPath: '/real-estate/apt-sale/seoul/gangnam/A',
      },
      {
        type: 'apt-sale',
        buildingKey: 'b'.repeat(64),
        canonicalPath: '/real-estate/apt-sale/seoul/gangnam/B',
      },
    ]);

    const rows = await attachRealEstateCanonicalPaths([
      { type: 'apt-sale', buildingKey: 'a'.repeat(64), label: 'A' },
      { type: 'apt-sale', buildingKey: 'b'.repeat(64), label: 'B' },
    ]);

    expect(rows).toEqual([
      expect.objectContaining({ label: 'A', canonicalPath: '/real-estate/apt-sale/seoul/gangnam/A' }),
      expect.objectContaining({ label: 'B', canonicalPath: '/real-estate/apt-sale/seoul/gangnam/B' }),
    ]);
    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(1);
    expect(String(queryRawUnsafeMock.mock.calls[0][0])).toContain('RealEstatePublicUrl');
  });

  it('throws in preserved mode when a keyed row has no durable mapping', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    queryRawUnsafeMock.mockResolvedValueOnce([]);

    await expect(
      attachRealEstateCanonicalPaths([{ type: 'villa-sale', buildingKey: 'c'.repeat(64) }])
    ).rejects.toThrow(/Missing RealEstatePublicUrl mapping/);
  });

  it('throws in preserved address mode when a row has no key', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';

    await expect(
      attachRealEstateCanonicalPaths([{ type: 'apt-sale', buildingKey: null }])
    ).rejects.toThrow(/requires buildingKey/);
  });

  it('allows keyless legacy list rows only in compatibility mode so callers keep the base URL fallback', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';

    await expect(
      attachRealEstateCanonicalPaths([
        {
          type: 'apt-sale',
          buildingKey: null,
          buildingName: '래미안',
          city: '서울특별시',
          district: '강남구',
        },
      ])
    ).resolves.toEqual([
      {
        type: 'apt-sale',
        buildingKey: null,
        buildingName: '래미안',
        city: '서울특별시',
        district: '강남구',
      },
    ]);
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('allows keyless compatibility rows when callers provide the scoped type separately', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';

    await expect(
      attachRealEstateCanonicalPaths([
        {
          buildingKey: undefined,
          buildingName: '잠실엘스',
          city: '서울특별시',
          district: '송파구',
        },
      ], 'apt-rent')
    ).resolves.toEqual([
      {
        buildingKey: undefined,
        buildingName: '잠실엘스',
        city: '서울특별시',
        district: '송파구',
      },
    ]);
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('still requires a type for keyless compatibility rows', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';

    await expect(
      attachRealEstateCanonicalPaths([{ buildingKey: null }])
    ).rejects.toThrow(/requires type/);
  });
});

describe('resolveRealEstatePublicPath', () => {
  it('resolves exact canonical paths without redirect', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const suffix = encodeURIComponent('역삼동-10-1');
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        type: 'villa-sale',
        buildingKey: 'k1',
        bjdCode: '1168010100',
        buildingName: '스톤빌리지',
        canonicalPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}/${suffix}`,
      },
    ]);

    await expect(
      resolveRealEstatePublicPath(`/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}/${suffix}`)
    ).resolves.toEqual({
      type: 'villa-sale',
      buildingKey: 'k1',
      bjdCode: '1168010100',
      buildingName: '스톤빌리지',
      canonicalPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}/${suffix}`,
      redirect: false,
    });
  });

  it('rejects unpublished 64hex public suffixes instead of treating them as aliases', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const key = 'a'.repeat(64);

    await expect(
      resolveRealEstatePublicPath(`/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안')}/${key}`)
    ).resolves.toBeNull();
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('does not expose stale registry rows whose canonical path still contains a 64hex suffix', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const key = 'a'.repeat(64);

    await expect(
      resolveRealEstatePublicPath(`/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('래미안')}/${key}`)
    ).resolves.toBeNull();
    expect(queryRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('normalizes NFD building path segments before hash lookup', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const nfdName = '래미안'.normalize('NFD');
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        type: 'apt-rent',
        buildingKey: 'nfc-key',
        bjdCode: '1168010100',
        buildingName: '래미안',
        canonicalPath: `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('래미안')}`,
      },
    ]);

    const result = await resolveRealEstatePublicPath(
      `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent(nfdName)}`
    );

    expect(result).toEqual(expect.objectContaining({ buildingKey: 'nfc-key', redirect: true }));
  });

  it('resolves an explicitly deferred base path as the legacy grouped detail', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const basePath = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
    queryRawUnsafeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        type: 'villa-sale',
        buildingKey: 'a'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '같은빌라',
        canonicalPath: basePath,
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred', reasons: ['missing-legacy-owner'] }),
      },
      {
        type: 'villa-sale',
        buildingKey: 'b'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '같은빌라',
        canonicalPath: basePath,
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred', reasons: ['missing-legacy-owner'] }),
      },
    ]);

    await expect(resolveRealEstatePublicPath(basePath)).resolves.toEqual({
      type: 'villa-sale',
      bjdCode: '1168010100',
      buildingName: '같은빌라',
      canonicalPath: basePath,
      redirect: false,
      legacyGrouped: true,
    });
  });

  it('returns a singleton explicitly deferred exact base path as grouped identity without leaking its key', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const basePath = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        type: 'villa-sale',
        buildingKey: 'a'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '같은빌라',
        canonicalPath: basePath,
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred', reasons: ['missing-readable-address'] }),
      },
    ]);

    await expect(resolveRealEstatePublicPath(basePath)).resolves.toEqual({
      type: 'villa-sale',
      bjdCode: '1168010100',
      buildingName: '같은빌라',
      canonicalPath: basePath,
      redirect: false,
      legacyGrouped: true,
    });
  });

  it('does not group a base path unless every row is explicitly deferred and unambiguous', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const basePath = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
    queryRawUnsafeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        type: 'villa-sale',
        buildingKey: 'a'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '같은빌라',
        canonicalPath: basePath,
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred' }),
      },
      {
        type: 'villa-sale',
        buildingKey: 'b'.repeat(64),
        bjdCode: '1168010200',
        buildingName: '같은빌라',
        canonicalPath: basePath,
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred' }),
      },
    ]);

    await expect(resolveRealEstatePublicPath(basePath)).resolves.toBeNull();
  });
});

describe('getDeferredRealEstateIdentity', () => {
  it('returns the held legacy identity only for an explicitly deferred same-name group', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const basePath = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
    queryRawUnsafeMock.mockResolvedValueOnce([
      {
        type: 'villa-sale',
        buildingKey: 'a'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '같은빌라',
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred' }),
      },
      {
        type: 'villa-sale',
        buildingKey: 'b'.repeat(64),
        bjdCode: '1168010100',
        buildingName: '같은빌라',
        basePath,
        evidence: JSON.stringify({ source: 'legacy-deferred' }),
      },
    ]);

    await expect(getDeferredRealEstateIdentity('villa-sale', '1168010100', '같은빌라')).resolves.toEqual({
      type: 'villa-sale',
      bjdCode: '1168010100',
      buildingName: '같은빌라',
      canonicalPath: basePath,
      legacyGrouped: true,
    });
  });
});

describe('readiness', () => {
  it('requires a ready bootstrap with explicit baseline provenance and no missing V2 rows', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    queryRawUnsafeMock
      .mockResolvedValueOnce([
        {
          status: 'ready',
          sourceFingerprint: 'f'.repeat(64),
          baselineProvenance: 'production-sitemap-2026-09-29',
          validatedAt: new Date('2026-09-29T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ cnt: 0n }]);

    await expect(assertRealEstateUrlsReady()).resolves.toBeUndefined();
  });

  it('allows preserved compatibility mode when the URL registry is ready and all V2 rows are mapped', async () => {
    queryRawUnsafeMock
      .mockResolvedValueOnce([
        {
          status: 'ready',
          sourceFingerprint: 'f'.repeat(64),
          baselineProvenance: 'production-sitemap-2026-09-29',
          validatedAt: new Date('2026-09-29T00:00:00.000Z'),
        },
      ])
      .mockResolvedValueOnce([{ cnt: 0n }]);

    await expect(
      assertRealEstateUrlsReady({
        REAL_ESTATE_URL_MODE: 'preserved',
        REAL_ESTATE_SUMMARY_MODE: 'compatibility',
      } as NodeJS.ProcessEnv)
    ).resolves.toBeUndefined();
    expect(queryRawUnsafeMock).toHaveBeenCalledTimes(2);
  });

  it('fails readiness when bootstrap provenance is missing even if mappings exist', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    queryRawUnsafeMock.mockResolvedValueOnce([
      { status: 'ready', sourceFingerprint: 'f'.repeat(64), baselineProvenance: null, validatedAt: new Date() },
    ]);

    await expect(assertRealEstateUrlsReady()).rejects.toThrow(/baseline provenance/);
  });
});

describe('getRealEstateCanonicalPath', () => {
  it('returns null for an unmapped key', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await expect(getRealEstateCanonicalPath('apt-sale', 'missing')).resolves.toBeNull();
  });
});

describe('appendRealEstateUrlsForSummaryBatch', () => {
  it('does not widen an explicitly empty scope to the entire city', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const tx = { $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn() };
    await expect(appendRealEstateUrlsForSummaryBatch(tx, 'apt-sale', '서울', process.env, { bjdCodes: [] }))
      .resolves.toEqual({ scanned: 0, inserted: 0, blockers: [] });
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });

  it('no-ops outside preserved mode', async () => {
    const tx = { $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn() };
    await appendRealEstateUrlsForSummaryBatch(tx, 'apt-sale', '서울특별시');
    expect(tx.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  it('appends unmapped single-candidate bases inside the provided transaction', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const tx = {
      $queryRawUnsafe: vi.fn()
        .mockResolvedValueOnce([
          { status: 'ready', sourceFingerprint: 'f'.repeat(64), baselineProvenance: 'production-snapshot', validatedAt: new Date() },
        ])
        .mockResolvedValueOnce([
          {
            type: 'apt-sale',
            buildingKey: 'new-key',
            bjdCode: '1168010100',
            city: '서울특별시',
            district: '강남구',
            buildingName: '새아파트',
            dongName: '역삼동',
            jibun: '1',
          },
        ])
        .mockResolvedValueOnce([]),
      $executeRawUnsafe: vi.fn().mockResolvedValue(1),
    };

    const result = await appendRealEstateUrlsForSummaryBatch(tx, 'apt-sale', '서울특별시');

    expect(result).toEqual({ scanned: 1, inserted: 1, blockers: [] });
    const [sql, ...params] = tx.$executeRawUnsafe.mock.calls[0];
    expect(sql).toContain('INSERT INTO `RealEstatePublicUrl`');
    expect(params).toHaveLength(14);
    expect(params.slice(0, 4)).toEqual(['apt-sale', 'new-key', '1168010100', '새아파트']);
  });


  it('limits URL append scan to provided bjdCode scope for bounded summary refresh batches', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const tx = {
      $queryRawUnsafe: vi.fn()
        .mockResolvedValueOnce([
          { status: 'ready', sourceFingerprint: 'f'.repeat(64), baselineProvenance: 'production-snapshot', validatedAt: new Date() },
        ])
        .mockResolvedValueOnce([]),
      $executeRawUnsafe: vi.fn(),
    };

    await appendRealEstateUrlsForSummaryBatch(tx, 'apt-sale', '서울특별시', process.env, {
      bjdCodes: ['1168010100', '1168010200'],
    });

    const [sql, ...params] = tx.$queryRawUnsafe.mock.calls[1];
    expect(String(sql)).toContain('s.bjdCode IN (?, ?)');
    expect(params).toEqual(['apt-sale', '서울특별시', '1168010100', '1168010200']);
  });

  it('throws for a new ambiguous base so the summary city transaction can roll back', async () => {
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    const tx = {
      $queryRawUnsafe: vi.fn()
        .mockResolvedValueOnce([
          { status: 'ready', sourceFingerprint: 'f'.repeat(64), baselineProvenance: 'production-snapshot', validatedAt: new Date() },
        ])
        .mockResolvedValueOnce([
          {
            type: 'villa-sale',
            buildingKey: 'a',
            bjdCode: '1168010100',
            city: '서울특별시',
            district: '강남구',
            buildingName: '새빌라',
            dongName: '역삼동',
            jibun: '1',
          },
          {
            type: 'villa-sale',
            buildingKey: 'b',
            bjdCode: '1168010200',
            city: '서울특별시',
            district: '강남구',
            buildingName: '새빌라',
            dongName: '삼성동',
            jibun: '2',
          },
        ])
        .mockResolvedValueOnce([]),
      $executeRawUnsafe: vi.fn(),
    };

    await expect(
      appendRealEstateUrlsForSummaryBatch(tx, 'villa-sale', '서울특별시')
    ).rejects.toThrow(/unresolved URL blockers/);
    expect(tx.$executeRawUnsafe).not.toHaveBeenCalled();
  });
});
