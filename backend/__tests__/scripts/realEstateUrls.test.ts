import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRawUnsafeMock, executeRawUnsafeMock } = vi.hoisted(() => ({
  queryRawUnsafeMock: vi.fn(),
  executeRawUnsafeMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
    $disconnect: vi.fn(),
  },
  default: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $executeRawUnsafe: executeRawUnsafeMock,
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
});

describe('runRealEstateUrlRegistryCli', () => {
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
});
