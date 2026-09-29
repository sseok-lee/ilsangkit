import { describe, expect, it, vi } from 'vitest';
import referenceFixture from '../fixtures/waste-area-reference.json' with { type: 'json' };
import {
  auditWasteAreas,
  isCliEntrypoint,
  parseCliOptions,
  readAuditRows,
  validateReferenceBundle,
} from '../../src/scripts/auditWasteAreas.js';
import { buildWasteSourceScope } from '../../src/utils/wasteSourceScope.js';
import type { ReferenceBundle, SourceRegionInput } from '../../src/types/wasteArea.js';

describe('buildWasteSourceScope', () => {
  it('keeps duplicate sourceId values distinct by provider, city, and district', () => {
    expect(buildWasteSourceScope({
      city: ' 서울특별시 ',
      district: '강남구',
      sourceId: 'duplicate-id',
    })).toBe('["household_waste_info","서울특별시","강남구","duplicate-id"]');

    expect(buildWasteSourceScope({
      city: '인천광역시',
      district: '남동구',
      sourceId: 'duplicate-id',
    })).toBe('["household_waste_info","인천광역시","남동구","duplicate-id"]');
  });
});

describe('readAuditRows', () => {
  it('reads existing schedules without creating SyncHistory', async () => {
    const reader = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 11,
          city: '서울특별시',
          district: '강남구',
          targetRegion: '역삼1동+역삼2동',
          sourceId: 'fixture-a',
        },
      ]),
    };

    const rows = await readAuditRows(reader);

    expect(rows).toEqual([
      {
        scheduleId: 11,
        sourceScope: '["household_waste_info","서울특별시","강남구","fixture-a"]',
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동+역삼2동',
      },
    ]);
    expect(reader.findMany).toHaveBeenCalledOnce();
    expect(reader.findMany).toHaveBeenCalledWith({
      where: { sourceId: { not: { startsWith: 'seed-waste-schedule-' } } },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        city: true,
        district: true,
        targetRegion: true,
        sourceId: true,
      },
    });
  });

  it('does not collapse the same sourceId across different districts', async () => {
    const reader = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 30,
          city: '서울특별시',
          district: '강남구',
          targetRegion: '논현1동',
          sourceId: 'same-id',
        },
        {
          id: 31,
          city: '인천광역시',
          district: '남동구',
          targetRegion: '논현1동',
          sourceId: 'same-id',
        },
      ]),
    };

    const rows = await readAuditRows(reader);

    expect(rows.map((row) => row.sourceScope)).toEqual([
      '["household_waste_info","서울특별시","강남구","same-id"]',
      '["household_waste_info","인천광역시","남동구","same-id"]',
    ]);
  });
});

describe('auditWasteAreas', () => {
  it('keeps source rows distinct from parsed area candidates in W1', () => {
    const references = referenceFixture as ReferenceBundle;
    const rows: SourceRegionInput[] = [
      {
        scheduleId: 11,
        sourceScope: 'fixture:administrative',
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동+역삼2동',
      },
      {
        scheduleId: 12,
        sourceScope: 'fixture:administrative',
        city: '경기도',
        district: '가평군',
        targetRegion: '가평읍, 설악면',
      },
    ];

    const report = auditWasteAreas(rows, references, '2026-09-28');

    expect(report).toMatchObject({
      asOf: '2026-09-28',
      sourceCount: 2,
      candidateCount: 4,
      verifiedAreaCount: 4,
      unresolvedCount: 0,
      conflictCount: 0,
      referenceVersion: 'fixture-reference-w2',
    });
    expect(report.cases).toEqual([
      {
        scheduleId: 11,
        classification: 'verified',
        reason: 'exact administrative dong match',
      },
      {
        scheduleId: 11,
        classification: 'verified',
        reason: 'exact administrative dong match',
      },
      {
        scheduleId: 12,
        classification: 'verified',
        reason: 'exact administrative dong match',
      },
      {
        scheduleId: 12,
        classification: 'verified',
        reason: 'exact administrative dong match',
      },
    ]);
  });

  it('classifies whole-district and conditional source scopes without inventing verified areas', () => {
    const references = referenceFixture as ReferenceBundle;
    const rows: SourceRegionInput[] = [
      {
        scheduleId: 20,
        sourceScope: 'fixture:administrative',
        city: '부산광역시',
        district: '중구',
        targetRegion: '중구 전역',
      },
      {
        scheduleId: 21,
        sourceScope: 'fixture:administrative',
        city: '서울특별시',
        district: '강남구',
        targetRegion: '공동주택 및 일부 거점수거 지역',
      },
    ];

    const report = auditWasteAreas(rows, references, '2026-09-28');

    expect(report.asOf).toBe('2026-09-28');
    expect(report.sourceCount).toBe(2);
    expect(report.candidateCount).toBe(3);
    expect(report.verifiedAreaCount).toBe(0);
    expect(report.unresolvedCount).toBe(3);
    expect(report.cases.map((item) => item.reason)).toEqual([
      'whole district scope has no verified district code',
      'no current exact administrative dong match',
      'no current exact administrative dong match',
    ]);
  });
});

describe('audit as-of', () => {
  it('uses the supplied as-of date for evidence activity and reports it', () => {
    const references = referenceFixture as ReferenceBundle;
    const rows: SourceRegionInput[] = [
      {
        scheduleId: 40,
        sourceScope: 'fixture:administrative',
        city: '서울특별시',
        district: '강남구',
        targetRegion: '경계동',
      },
    ];

    const oldReport = auditWasteAreas(rows, references, '2025-12-31');
    const newReport = auditWasteAreas(rows, references, '2026-09-28');

    expect(oldReport).toMatchObject({
      asOf: '2025-12-31',
      verifiedAreaCount: 1,
      unresolvedCount: 0,
    });
    expect(newReport).toMatchObject({
      asOf: '2026-09-28',
      verifiedAreaCount: 1,
      unresolvedCount: 0,
    });
  });
});

describe('validateReferenceBundle', () => {
  it('rejects relations that have both fromKey and alias', () => {
    const invalid: ReferenceBundle = {
      ...(referenceFixture as ReferenceBundle),
      relations: [
        {
          fromKey: 'legal:1168010100',
          alias: '역삼동',
          toKey: 'administrative:1168064000',
          evidence: {
            url: 'fixture://bad-relation',
            version: 'fixture',
            effectiveFrom: '2026-01-01',
            effectiveTo: null,
            note: 'Invalid fixture relation.',
          },
        },
      ],
    };

    expect(() => validateReferenceBundle(invalid)).toThrow(
      'SearchRelation must have exactly one of fromKey or alias'
    );
  });
});

describe('isCliEntrypoint', () => {
  it('does not treat an imported module as the CLI entrypoint', () => {
    expect(isCliEntrypoint('file:///repo/backend/src/scripts/auditWasteAreas.ts', '/repo/backend/src/server.ts')).toBe(false);
  });
});

describe('parseCliOptions', () => {
  it('accepts an explicit audit as-of date from the CLI', () => {
    expect(parseCliOptions([
      '--references',
      '../refs.json',
      '--out',
      '../audit.json',
      '--as-of',
      '2025-12-31',
    ])).toEqual({
      referencePath: '../refs.json',
      out: '../audit.json',
      asOf: '2025-12-31',
    });
  });
});
