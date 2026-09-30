import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRawUnsafeMock, executeRawUnsafeMock, transactionMock } = vi.hoisted(() => {
  const queryRawUnsafeMock = vi.fn();
  const executeRawUnsafeMock = vi.fn();
  return {
    queryRawUnsafeMock,
    executeRawUnsafeMock,
    transactionMock: vi.fn((run: (tx: unknown) => Promise<unknown>) =>
      run({
        $queryRawUnsafe: queryRawUnsafeMock,
        $executeRawUnsafe: executeRawUnsafeMock,
      })
    ),
  };
});

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
    $transaction: transactionMock,
    $disconnect: vi.fn(),
  },
  default: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
    $transaction: transactionMock,
    $disconnect: vi.fn(),
  },
}));

vi.mock('../../src/utils/realEstateWriteLock.js', () => ({
  withRealEstateWriteLock: vi.fn(async (_label: string, run: () => Promise<unknown>) => run()),
}));

import {
  parseRealEstateUrlArgs,
  runRealEstateUrlRegistryCli,
} from '../../src/scripts/realEstateUrls.js';

beforeEach(() => {
  vi.clearAllMocks();
  queryRawUnsafeMock.mockReset();
  executeRawUnsafeMock.mockReset();
  executeRawUnsafeMock.mockResolvedValue(1);
});

describe('parseRealEstateUrlArgs', () => {
  it('accepts only the explicit block/defer unresolved policy', () => {
    expect(parseRealEstateUrlArgs(['--dry-run']).unresolvedPolicy).toBe('block');
    expect(parseRealEstateUrlArgs(['--unresolved-policy=defer']).unresolvedPolicy).toBe('defer');
    expect(() => parseRealEstateUrlArgs(['--unresolved-policy=ignore'])).toThrow(
      /unresolved-policy/
    );
  });
  it('requires a baseline file for apply but permits no-baseline dry runs', () => {
    expect(parseRealEstateUrlArgs(['--dry-run'])).toEqual(
      expect.objectContaining({ apply: false, baselinePath: null })
    );
    expect(() => parseRealEstateUrlArgs(['--apply'])).toThrow(/--baseline/);
  });
  it('requires explicit baseline evidence before resolving deferred mappings', () => {
    expect(() => parseRealEstateUrlArgs(['--dry-run', '--resolve-deferred'])).toThrow(/--baseline/);
    expect(
      parseRealEstateUrlArgs(['--dry-run', '--resolve-deferred', '--baseline=x.json'])
    ).toEqual(expect.objectContaining({ resolveDeferred: true, baselinePath: 'x.json' }));
  });
});

describe('runRealEstateUrlRegistryCli', () => {
  it('permits an initially missing registry for dry-run', async () => {
    queryRawUnsafeMock.mockImplementation(async (sql: string) => {
      if (sql.includes('FROM RealEstatePublicUrl')) {
        throw new Error("Table 'RealEstatePublicUrl' doesn't exist");
      }
      return [];
    });
    const report = await runRealEstateUrlRegistryCli(['--dry-run']);
    expect(report).toMatchObject({ existing: 0, candidates: 0, mappings: 0, toCreate: 0 });
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('fails closed if the registry disappears after a successful page', async () => {
    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor: number) => {
      if (!sql.includes('FROM RealEstatePublicUrl')) return [];
      if (cursor === 0) {
        return [
          {
            id: 7,
            type: 'apt-sale',
            buildingKey: 'key-0',
            bjdCode: '1168010100',
            buildingName: '단지',
            canonicalPath: '/real-estate/apt-sale/seoul/gangnam/existing',
          },
        ];
      }
      throw new Error("Table 'RealEstatePublicUrl' doesn't exist");
    });
    await expect(runRealEstateUrlRegistryCli(['--dry-run'])).rejects.toThrow("doesn't exist");
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('preserves every existing URL across bounded reads with sparse IDs', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'real-estate-urls-pages-'));
    const planPath = join(dir, 'plan.jsonl');
    const candidates = [7, 90001].map((id, index) => ({
      id,
      type: 'apt-sale',
      buildingKey: `key-${index}`,
      bjdCode: '1168010100',
      city: '서울특별시',
      district: '강남구',
      buildingName: `단지${index}`,
      dongName: '역삼동',
      jibun: String(index + 1),
    }));
    const existing = candidates.map((row, index) => ({
      ...row,
      basePath: `/real-estate/apt-sale/seoul/gangnam/preserved-${index}`,
      canonicalPath: `/real-estate/apt-sale/seoul/gangnam/preserved-${index}`,
      evidence: { source: 'legacy-base' },
    }));
    const cursors: unknown[] = [];
    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor: number, limit: number) => {
      if (sql.includes('FROM RealEstatePublicUrl')) {
        if (!sql.includes('WHERE id > ?') || !sql.includes('LIMIT ?') || limit > 10_000) {
          throw new Error('Existing URL read exceeds the bounded query budget');
        }
        cursors.push(cursor);
        if (cursors.length > 3) throw new Error('Cursor did not advance');
        return existing.filter((row) => row.id > cursor).slice(0, 1);
      }
      if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
        return candidates.filter((row) => row.id > cursor);
      }
      throw new Error('Unexpected query');
    });
    const report = await runRealEstateUrlRegistryCli(['--dry-run', '--plan-out', planPath]);
    expect(report).toMatchObject({
      existing: 2,
      candidates: 2,
      mappings: 2,
      toCreate: 0,
      blockers: [],
    });
    expect(cursors).toEqual([0, 7, 90001]);
    const rows = (await readFile(planPath, 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(rows.map((row) => row.canonicalPath)).toEqual([
      '/real-estate/apt-sale/seoul/gangnam/preserved-0',
      '/real-estate/apt-sale/seoul/gangnam/preserved-1',
    ]);
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });
  it('reports deferred grouped URLs separately from hard blockers', async () => {
    queryRawUnsafeMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce(
        ['a', 'b'].map((key, index) => ({
          id: index + 1,
          type: 'apt-sale',
          buildingKey: key.repeat(64),
          bjdCode: '11680',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '역삼동',
          jibun: String(index + 1),
        }))
      )
      .mockResolvedValueOnce([]);
    const report = await runRealEstateUrlRegistryCli(['--dry-run', '--unresolved-policy=defer']);
    expect(report.blockers).toEqual([]);
    expect(report.deferred).toHaveLength(1);
    expect(report.deferredMappings).toBe(2);
    expect(report.mappings).toBe(2);
    expect(report.unresolvedPolicy).toBe('defer');
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });
  it('dry-runs without baseline provenance and reports unresolved collisions without writing', async () => {
    queryRawUnsafeMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ])
      .mockResolvedValueOnce([]);

    const report = await runRealEstateUrlRegistryCli(['--dry-run']);

    expect(report.applied).toBe(false);
    expect(report.planFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(report.baselineProvenance).toBeNull();
    expect(report.blockers).toHaveLength(1);
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('applies an idempotent plan only when fingerprint and explicit baseline provenance match', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'real-estate-urls-'));
    const baselinePath = join(dir, 'baseline.json');
    await writeFile(
      baselinePath,
      JSON.stringify({
        provenance: 'production-detail-snapshot-2026-09-29',
        entries: [
          {
            type: 'apt-sale',
            basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`,
            dongName: '역삼동',
            jibun: '1',
            provenance: 'old-production-render',
          },
        ],
      })
    );

    queryRawUnsafeMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ])
      .mockResolvedValueOnce([]);

    const dryRun = await runRealEstateUrlRegistryCli(['--dry-run', '--baseline', baselinePath]);
    const reportPath = join(dir, 'report.json');
    const planPath = join(dir, 'plan.jsonl');

    queryRawUnsafeMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010200',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt-sale',
          buildingKey: 'a',
          basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`,
          canonicalPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`,
        },
        {
          type: 'apt-sale',
          buildingKey: 'b',
          basePath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`,
          canonicalPath: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}/${encodeURIComponent('삼성동-2')}`,
        },
      ])
      .mockResolvedValueOnce([]);

    const applied = await runRealEstateUrlRegistryCli([
      '--apply',
      '--baseline',
      baselinePath,
      '--expected-fingerprint',
      dryRun.sourceFingerprint,
      '--expected-plan-fingerprint',
      dryRun.planFingerprint,
      '--report-out',
      reportPath,
      '--plan-out',
      planPath,
    ]);

    expect(applied.applied).toBe(true);
    expect(applied.toCreate).toBe(2);
    expect(
      executeRawUnsafeMock.mock.calls.some((call) =>
        String(call[0]).includes('INSERT INTO `RealEstatePublicUrl`')
      )
    ).toBe(true);
    expect(await readFile(reportPath, 'utf8')).toContain('"applied": true');
    expect(await readFile(planPath, 'utf8')).toContain('"canonicalPath"');
  });

  it('dry-runs deferred resolution without writing and reports pending updates', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'real-estate-urls-resolve-dry-'));
    const baselinePath = join(dir, 'baseline.json');
    const basePath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`;
    await writeFile(
      baselinePath,
      JSON.stringify({
        provenance: 'production-detail-snapshot-2026-09-29',
        entries: [
          {
            type: 'apt-sale',
            basePath,
            dongName: '역삼동',
            jibun: '1',
            provenance: 'old-production-render',
          },
        ],
      })
    );

    const existingDeferred = [
      {
        id: 10,
        type: 'apt-sale',
        buildingKey: 'a',
        bjdCode: '1168010100',
        buildingName: '같은아파트',
        basePath,
        basePathHash: 'old-base-hash',
        canonicalPath: basePath,
        dongName: '역삼동',
        jibun: '1',
        evidence: { source: 'legacy-deferred', reasons: ['missing-legacy-owner'] },
      },
      {
        id: 11,
        type: 'apt-sale',
        buildingKey: 'b',
        bjdCode: '1168010100',
        buildingName: '같은아파트',
        basePath,
        basePathHash: 'old-base-hash',
        canonicalPath: basePath,
        dongName: '삼성동',
        jibun: '2',
        evidence: { source: 'legacy-deferred', reasons: ['missing-legacy-owner'] },
      },
    ];
    const currentCandidates = [
      {
        id: 20,
        type: 'apt-sale',
        buildingKey: 'a',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은아파트',
        dongName: '역삼동',
        jibun: '1',
      },
      {
        id: 21,
        type: 'apt-sale',
        buildingKey: 'b',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은아파트',
        dongName: '삼성동',
        jibun: '2',
      },
    ];
    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor = 0) => {
      if (sql.includes('FROM RealEstatePublicUrl')) {
        return cursor === 0 ? existingDeferred : [];
      }
      if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
        return cursor === 0 ? currentCandidates : [];
      }
      throw new Error('Unexpected query');
    });

    const report = await runRealEstateUrlRegistryCli([
      '--dry-run',
      '--resolve-deferred',
      '--baseline',
      baselinePath,
    ]);

    expect(report).toMatchObject({
      applied: false,
      existing: 2,
      candidates: 2,
      toCreate: 0,
      toUpdate: 2,
      blockers: [],
      deferredMappings: 0,
    });
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });

  it('applies deferred resolution atomically before marking the registry ready', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'real-estate-urls-resolve-apply-'));
    const baselinePath = join(dir, 'baseline.json');
    const basePath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`;
    const suffixPath = `${basePath}/${encodeURIComponent('삼성동-2')}`;
    await writeFile(
      baselinePath,
      JSON.stringify({
        provenance: 'production-detail-snapshot-2026-09-29',
        entries: [
          {
            type: 'apt-sale',
            basePath,
            dongName: '역삼동',
            jibun: '1',
            provenance: 'old-production-render',
          },
        ],
      })
    );

    const existingDeferred = [
      {
        id: 10,
        type: 'apt-sale',
        buildingKey: 'a',
        bjdCode: '1168010100',
        buildingName: '같은아파트',
        basePath,
        basePathHash: 'old-base-hash',
        canonicalPath: basePath,
        dongName: '역삼동',
        jibun: '1',
        evidence: { source: 'legacy-deferred', reasons: ['missing-legacy-owner'] },
      },
      {
        id: 11,
        type: 'apt-sale',
        buildingKey: 'b',
        bjdCode: '1168010100',
        buildingName: '같은아파트',
        basePath,
        basePathHash: 'old-base-hash',
        canonicalPath: basePath,
        dongName: '삼성동',
        jibun: '2',
        evidence: { source: 'legacy-deferred', reasons: ['missing-legacy-owner'] },
      },
    ];
    const currentCandidates = [
      {
        id: 20,
        type: 'apt-sale',
        buildingKey: 'a',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은아파트',
        dongName: '역삼동',
        jibun: '1',
      },
      {
        id: 21,
        type: 'apt-sale',
        buildingKey: 'b',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은아파트',
        dongName: '삼성동',
        jibun: '2',
      },
    ];
    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor = 0) => {
      if (sql.includes('FROM RealEstatePublicUrl')) {
        return cursor === 0 ? existingDeferred : [];
      }
      if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
        return cursor === 0 ? currentCandidates : [];
      }
      throw new Error('Unexpected query');
    });
    const dryRun = await runRealEstateUrlRegistryCli([
      '--dry-run',
      '--resolve-deferred',
      '--baseline',
      baselinePath,
    ]);

    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor = 0) => {
      if (sql.includes('FOR UPDATE')) return existingDeferred;
      if (sql.includes('WHERE (type = ?')) {
        return [
          {
            type: 'apt-sale',
            buildingKey: 'a',
            canonicalPath: basePath,
            basePath,
            evidence: { source: 'legacy-exact-address' },
          },
          {
            type: 'apt-sale',
            buildingKey: 'b',
            canonicalPath: suffixPath,
            basePath,
            evidence: { source: 'readable-address-suffix' },
          },
        ];
      }
      if (sql.includes('FROM RealEstatePublicUrl')) {
        return cursor === 0 ? existingDeferred : [];
      }
      if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
        return cursor === 0 ? currentCandidates : [];
      }
      throw new Error('Unexpected query');
    });

    const applied = await runRealEstateUrlRegistryCli([
      '--apply',
      '--resolve-deferred',
      '--baseline',
      baselinePath,
      '--expected-fingerprint',
      dryRun.sourceFingerprint,
      '--expected-plan-fingerprint',
      dryRun.planFingerprint,
    ]);

    expect(applied.toUpdate).toBe(2);
    const writes = executeRawUnsafeMock.mock.calls.map((call) => String(call[0]));
    const statuses = executeRawUnsafeMock.mock.calls.map((call) => call[1]);
    expect(writes[0]).toContain(
      'status, sourceFingerprint, baselineProvenance, report, validatedAt'
    );
    expect(statuses[0]).toBe('preparing');
    expect(writes.filter((sql) => sql.includes('UPDATE `RealEstatePublicUrl`'))).toHaveLength(2);
    expect(statuses.at(-1)).toBe('ready');
  });

  it('refuses stale deferred groups and does not mark ready after preparing', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'real-estate-urls-resolve-stale-'));
    const baselinePath = join(dir, 'baseline.json');
    const basePath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`;
    await writeFile(
      baselinePath,
      JSON.stringify({
        provenance: 'production-detail-snapshot-2026-09-29',
        entries: [
          {
            type: 'apt-sale',
            basePath,
            dongName: '역삼동',
            jibun: '1',
            provenance: 'old-production-render',
          },
        ],
      })
    );

    const existingDeferred = [
      {
        id: 10,
        type: 'apt-sale',
        buildingKey: 'a',
        bjdCode: '1168010100',
        buildingName: '같은아파트',
        basePath,
        basePathHash: 'old-base-hash',
        canonicalPath: basePath,
        dongName: '역삼동',
        jibun: '1',
        evidence: { source: 'legacy-deferred', reasons: ['missing-legacy-owner'] },
      },
      {
        id: 11,
        type: 'apt-sale',
        buildingKey: 'b',
        bjdCode: '1168010100',
        buildingName: '같은아파트',
        basePath,
        basePathHash: 'old-base-hash',
        canonicalPath: basePath,
        dongName: '삼성동',
        jibun: '2',
        evidence: { source: 'legacy-deferred', reasons: ['missing-legacy-owner'] },
      },
    ];
    const candidates = [
      {
        id: 20,
        type: 'apt-sale',
        buildingKey: 'a',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은아파트',
        dongName: '역삼동',
        jibun: '1',
      },
      {
        id: 21,
        type: 'apt-sale',
        buildingKey: 'b',
        bjdCode: '1168010100',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은아파트',
        dongName: '삼성동',
        jibun: '2',
      },
    ];
    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor = 0) => {
      if (sql.includes('FROM RealEstatePublicUrl')) {
        return cursor === 0 ? existingDeferred : [];
      }
      if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
        return cursor === 0 ? candidates : [];
      }
      throw new Error('Unexpected query');
    });

    const dryRun = await runRealEstateUrlRegistryCli([
      '--dry-run',
      '--resolve-deferred',
      '--baseline',
      baselinePath,
    ]);
    queryRawUnsafeMock.mockReset();
    executeRawUnsafeMock.mockReset();
    queryRawUnsafeMock.mockImplementation(async (sql: string, cursor = 0) => {
      if (sql.includes('FOR UPDATE')) {
        return [
          { ...existingDeferred[0] },
          {
            ...existingDeferred[1],
            canonicalPath: `${basePath}/${encodeURIComponent('삼성동-2')}`,
            evidence: { source: 'readable-address-suffix' },
          },
        ];
      }
      if (sql.includes('FROM RealEstatePublicUrl')) {
        return cursor === 0 ? existingDeferred : [];
      }
      if (sql.includes('FROM RealEstateBuildingSummaryV2')) {
        return cursor === 0 ? candidates : [];
      }
      throw new Error('Unexpected query');
    });

    await expect(
      runRealEstateUrlRegistryCli([
        '--apply',
        '--resolve-deferred',
        '--baseline',
        baselinePath,
        '--expected-fingerprint',
        dryRun.sourceFingerprint,
        '--expected-plan-fingerprint',
        dryRun.planFingerprint,
      ])
    ).rejects.toThrow(/changed before deferred resolution/);

    const writes = executeRawUnsafeMock.mock.calls.map((call) => String(call[0]));
    const statuses = executeRawUnsafeMock.mock.calls.map((call) => call[1]);
    expect(statuses).toContain('preparing');
    expect(statuses).not.toContain('ready');
  });

  it('treats already resolved deferred groups as idempotent existing mappings', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'real-estate-urls-resolve-idempotent-'));
    const baselinePath = join(dir, 'baseline.json');
    const basePath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은아파트')}`;
    const suffixPath = `${basePath}/${encodeURIComponent('삼성동-2')}`;
    await writeFile(
      baselinePath,
      JSON.stringify({
        provenance: 'production-detail-snapshot-2026-09-29',
        entries: [
          {
            type: 'apt-sale',
            basePath,
            dongName: '역삼동',
            jibun: '1',
            provenance: 'old-production-render',
          },
        ],
      })
    );

    queryRawUnsafeMock
      .mockResolvedValueOnce([
        {
          id: 10,
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          buildingName: '같은아파트',
          basePath,
          canonicalPath: basePath,
          dongName: '역삼동',
          jibun: '1',
          evidence: { source: 'legacy-exact-address' },
        },
        {
          id: 11,
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010100',
          buildingName: '같은아파트',
          basePath,
          canonicalPath: suffixPath,
          dongName: '삼성동',
          jibun: '2',
          evidence: { source: 'readable-address-suffix' },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 20,
          type: 'apt-sale',
          buildingKey: 'a',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '역삼동',
          jibun: '1',
        },
        {
          id: 21,
          type: 'apt-sale',
          buildingKey: 'b',
          bjdCode: '1168010100',
          city: '서울특별시',
          district: '강남구',
          buildingName: '같은아파트',
          dongName: '삼성동',
          jibun: '2',
        },
      ])
      .mockResolvedValueOnce([]);

    const report = await runRealEstateUrlRegistryCli([
      '--dry-run',
      '--resolve-deferred',
      '--baseline',
      baselinePath,
    ]);

    expect(report.toUpdate).toBe(0);
    expect(report.toCreate).toBe(0);
    expect(report.blockers).toEqual([]);
    expect(executeRawUnsafeMock).not.toHaveBeenCalled();
  });
});
