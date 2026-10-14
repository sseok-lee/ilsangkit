import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMock = vi.hoisted(() => ({
  wastePublication: { findUnique: vi.fn() },
  wasteAreaEntry: { count: vi.fn(), findMany: vi.fn(), findFirst: vi.fn() },
  wasteScheduleCoverage: { findMany: vi.fn() },
  wasteScheduleRevision: { findMany: vi.fn(), count: vi.fn() },
  wasteAreaRelation: { findMany: vi.fn() },
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: prismaMock,
  default: prismaMock,
}));

import {
  decideWasteDistrictMode,
  getWasteArea,
  getWasteDistrictDisplay,
  hasPublishedWasteAreaDetailHistory,
  listIndexableWasteAreas,
  listWasteAreas,
  wasteDistrictDisplayFromCounts,
} from '../../src/services/wasteAreaService.js';

const generationId = 'generation-1';
const updatedAt = new Date('2026-09-28T01:02:03.000Z');

beforeEach(() => {
  vi.clearAllMocks();
  process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
  prismaMock.wastePublication.findUnique.mockResolvedValue({ activeGenerationId: generationId });
  prismaMock.wasteAreaRelation.findMany.mockResolvedValue([]);
  prismaMock.wasteScheduleRevision.findMany.mockResolvedValue([]);
  prismaMock.wasteScheduleRevision.count.mockResolvedValue(0);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('listWasteAreas', () => {
  it('fails closed without querying new publication tables when the backend flag is disabled', async () => {
    delete process.env.WASTE_AREA_DISCOVERY_ENABLED;

    await expect(listWasteAreas({ page: 1, limit: 20 })).rejects.toMatchObject({
      statusCode: 503,
      code: 'WASTE_AREA_DISABLED',
    });
    expect(prismaMock.wastePublication.findUnique).not.toHaveBeenCalled();
  });

  it('returns 503 when enabled but no publication pointer exists', async () => {
    prismaMock.wastePublication.findUnique.mockResolvedValue({ activeGenerationId: null });

    await expect(listWasteAreas({ page: 1, limit: 20 })).rejects.toMatchObject({
      statusCode: 503,
      code: 'WASTE_AREA_UNAVAILABLE',
    });
  });

  it('expands same-condition direct coverage to each covered dong before deduping per area', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      areaEntry(101, '역삼1동'),
      areaEntry(102, '역삼2동'),
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101, conditionText: '' }),
      coverage(1, { areaId: 102, conditionText: '' }),
    ]);

    const result = await listWasteAreas({ city: '서울', district: '강남구', page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => [item.areaId, item.scheduleCount, item.conditionalCount]))
      .toEqual([[101, 1, 1], [102, 1, 1]]);
  });

  it('dedupes direct and district overlap inside each area without dropping other dongs', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      areaEntry(101, '역삼1동'),
      areaEntry(102, '역삼2동'),
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101, conditionText: '' }),
      coverage(1, { districtCode: '11680', conditionText: '' }),
    ]);

    const result = await listWasteAreas({ city: '서울', district: '강남구', page: 1, limit: 20 });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => [item.areaId, item.scheduleCount, item.conditionalCount]))
      .toEqual([[101, 1, 1], [102, 1, 1]]);
  });

  it('returns distinct dong count rather than source count and shares candidates for rows and total', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      areaEntry(101, '역삼1동'),
      areaEntry(102, '역삼2동'),
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101, conditionText: '역삼1동 전체' }),
      coverage(1, { areaId: 102, conditionText: '역삼2동 전체' }),
    ]);

    const result = await listWasteAreas({ city: '서울', district: '강남구', page: 1, limit: 20 });

    expect(result.generationId).toBe(generationId);
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.areaId)).toEqual([101, 102]);
    expect(result.items.every((item) => item.scheduleCount === 1)).toBe(true);
    expect(result.items[0].href).toBe('/trash/areas/101');
  });

  it('excludes seed-covered dongs from public list counts', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101, sourceId: 'seed-waste-schedule-1' }),
    ]);

    const result = await listWasteAreas({ page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(result.items).toEqual([]);
    expect(prismaMock.wasteScheduleCoverage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revision: expect.objectContaining({
            state: 'active',
            sourceId: { not: { startsWith: 'seed-' } },
          }),
        }),
      })
    );
  });

  it('uses source dates for area summary dataDate instead of content backfill timestamps', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, {
        areaId: 101,
        sourceModifiedAt: new Date('2026-02-03T00:00:00.000Z'),
        contentUpdatedAt: new Date('2026-09-28T00:00:00.000Z'),
      }),
      coverage(2, {
        areaId: 101,
        details: { dataCreatedDate: '2026-03-04' },
        contentUpdatedAt: new Date('2026-10-01T00:00:00.000Z'),
      }),
    ]);

    const result = await listWasteAreas({ page: 1, limit: 20 });

    expect(result.items[0].dataDate).toBe('2026-03-04T00:00:00.000Z');
  });

  it('keeps different conditions while deduping duplicate direct/global coverage rows', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101, scope: 'conditional', conditionText: '월요일' }),
      coverage(1, { areaId: 101, scope: 'conditional', conditionText: '월요일' }),
      coverage(1, { areaId: 101, scope: 'conditional', conditionText: '목요일' }),
      coverage(1, { districtCode: '11680', scope: 'whole', conditionText: '강남구 공통' }),
    ]);

    const result = await listWasteAreas({ page: 1, limit: 20 });

    expect(result.items[0]).toMatchObject({
      scheduleCount: 1,
      conditionalCount: 3,
    });
  });

  it('treats wildcard characters as ordinary keyword text during matching', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      areaEntry(101, '문자%_동'),
      areaEntry(102, '문자테스트동'),
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101 }),
      coverage(2, { areaId: 102 }),
    ]);

    const result = await listWasteAreas({ keyword: '%_', page: 1, limit: 20 });

    expect(result.items.map((item) => item.areaId)).toEqual([101]);
  });

  it('does not match relation fromEntry names when the source entry is not effective', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '현재동')]);
    prismaMock.wasteAreaRelation.findMany.mockResolvedValue([
      {
        generationId,
        relationKey: 'valid-relation-expired-from',
        fromAreaId: 102,
        alias: null,
        toAreaId: 101,
        evidence: {},
        validFrom: new Date('2020-01-01T00:00:00Z'),
        validTo: null,
        fromEntry: { ...areaEntry(102, '옛동'), validTo: new Date('2020-01-01T00:00:00Z') },
      },
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([coverage(1, { areaId: 101 })]);

    const result = await listWasteAreas({ keyword: '옛동', page: 1, limit: 20 });

    expect(result.items).toEqual([]);
  });


  it('keeps entries effective through the whole date-only validTo day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      { ...areaEntry(101, '경계동'), validTo: new Date('2026-09-28T00:00:00.000Z') },
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([coverage(1, { areaId: 101 })]);

    const result = await listWasteAreas({ page: 1, limit: 20 });

    expect(result.items.map((item) => item.areaId)).toEqual([101]);
    expect(prismaMock.wasteAreaEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        validFrom: { lte: new Date('2026-09-28T00:00:00.000Z') },
        OR: [{ validTo: null }, { validTo: { gte: new Date('2026-09-28T00:00:00.000Z') } }],
      }),
    }));
  });

  it('filters expired entries and expired aliases using the pinned request date', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      areaEntry(101, '현재동'),
      { ...areaEntry(102, '만료동'), validTo: new Date('2020-01-01T00:00:00Z') },
    ]);
    prismaMock.wasteAreaRelation.findMany.mockResolvedValue([
      {
        generationId,
        relationKey: 'expired-alias',
        fromAreaId: null,
        alias: '옛별칭',
        toAreaId: 101,
        evidence: {},
        validFrom: new Date('2010-01-01T00:00:00Z'),
        validTo: new Date('2020-01-01T00:00:00Z'),
        fromEntry: null,
      },
    ]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101 }),
      coverage(2, { areaId: 102 }),
    ]);

    const expiredEntry = await listWasteAreas({ page: 1, limit: 20 });
    const expiredAlias = await listWasteAreas({ keyword: '옛별칭', page: 1, limit: 20 });

    expect(expiredEntry.items.map((item) => item.areaId)).toEqual([101]);
    expect(expiredAlias.items).toEqual([]);
  });
});

describe('decideWasteDistrictMode', () => {
  it('확인된 동이 하나라도 있으면 areas', () => {
    expect(decideWasteDistrictMode(1, 0)).toBe('areas');
    expect(decideWasteDistrictMode(3, 348)).toBe('areas');
  });
  it('확인된 동이 없고 원본 일정이 있으면 source', () => {
    expect(decideWasteDistrictMode(0, 348)).toBe('source');
  });
  it('둘 다 없으면 empty', () => {
    expect(decideWasteDistrictMode(0, 0)).toBe('empty');
  });
});

describe('listWasteAreas mode', () => {
  it('시·군·구 지정 + 확인된 동 0 + 원본 348건이면 source', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleRevision.count.mockResolvedValue(348);

    const result = await listWasteAreas({ city: '경기도', district: '의왕시', page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(result.mode).toBe('source');
    expect(prismaMock.wasteScheduleRevision.count).toHaveBeenCalledWith({
      where: expect.objectContaining({
        generationId,
        state: 'active',
        sourceId: { not: { startsWith: 'seed-' } },
        city: { in: expect.arrayContaining(['경기도']) },
        district: { in: expect.arrayContaining(['의왕시']) },
      }),
    });
  });

  it('확인된 동이 있으면 areas', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([coverage(1, { areaId: 101 })]);
    prismaMock.wasteScheduleRevision.count.mockResolvedValue(5);

    const result = await listWasteAreas({ city: '서울', district: '강남구', page: 1, limit: 20 });

    expect(result.mode).toBe('areas');
  });

  it('키워드가 아무 동과도 맞지 않아도 모드는 시·군·구 기준 areas', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([coverage(1, { areaId: 101 })]);
    prismaMock.wasteScheduleRevision.count.mockResolvedValue(5);

    const result = await listWasteAreas({ city: '서울', district: '강남구', keyword: '없는동', page: 1, limit: 20 });

    expect(result.total).toBe(0);
    expect(result.mode).toBe('areas');
  });

  it('동도 원본도 없으면 empty', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([]);

    const result = await listWasteAreas({ city: '경상남도', district: '함안군', page: 1, limit: 20 });

    expect(result.mode).toBe('empty');
  });

  it('시·군·구가 지정되지 않으면 mode 를 내보내지 않고 원본 수도 세지 않는다', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([]);

    const result = await listWasteAreas({ city: '서울', page: 1, limit: 20 });

    expect(result).not.toHaveProperty('mode');
    expect(prismaMock.wasteScheduleRevision.count).not.toHaveBeenCalled();
  });
});

describe('wasteDistrictDisplayFromCounts', () => {
  it('동이 있으면 areas 와 동 수', () => {
    expect(wasteDistrictDisplayFromCounts(22, 1)).toEqual({ mode: 'areas', count: 22 });
  });
  it('동이 없고 원본이 있으면 source 와 원본 수', () => {
    expect(wasteDistrictDisplayFromCounts(0, 339)).toEqual({ mode: 'source', count: 339 });
  });
  it('둘 다 없으면 empty 와 0', () => {
    expect(wasteDistrictDisplayFromCounts(0, 0)).toEqual({ mode: 'empty', count: 0 });
  });
});

describe('getWasteDistrictDisplay', () => {
  it('플래그 off 면 null 이고 DB 를 조회하지 않는다', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'false';
    await expect(getWasteDistrictDisplay('서울특별시', '강남구')).resolves.toBeNull();
    expect(prismaMock.wastePublication.findUnique).not.toHaveBeenCalled();
  });

  it('플래그 on 인데 활성 세대가 없으면 null', async () => {
    prismaMock.wastePublication.findUnique.mockResolvedValue({ activeGenerationId: null });
    await expect(getWasteDistrictDisplay('서울특별시', '강남구')).resolves.toBeNull();
  });

  it('확인된 동이 있으면 areas 와 동 수 (listWasteAreas 와 같은 mode)', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동'), areaEntry(102, '역삼2동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([
      coverage(1, { areaId: 101 }),
      coverage(1, { areaId: 102 }),
    ]);
    prismaMock.wasteScheduleRevision.count.mockResolvedValue(5);

    const list = await listWasteAreas({ city: '서울', district: '강남구', page: 1, limit: 20 });
    const display = await getWasteDistrictDisplay('서울', '강남구');

    expect(display).toEqual({ mode: list.mode, count: 2 });
    expect(display?.mode).toBe('areas');
  });

  it('동 0 + 원본 348건이면 source 와 원본 수', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleRevision.count.mockResolvedValue(348);

    const list = await listWasteAreas({ city: '경기도', district: '의왕시', page: 1, limit: 20 });
    const display = await getWasteDistrictDisplay('경기도', '의왕시');

    expect(display).toEqual({ mode: 'source', count: 348 });
    expect(display?.mode).toBe(list.mode);
  });

  it('동도 원본도 없으면 empty 와 0', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue([]);

    const list = await listWasteAreas({ city: '경상남도', district: '함안군', page: 1, limit: 20 });
    const display = await getWasteDistrictDisplay('경상남도', '함안군');

    expect(display).toEqual({ mode: 'empty', count: 0 });
    expect(display?.mode).toBe(list.mode);
  });
});

describe('getWasteArea', () => {
  it('returns every applicable schedule without the list page limit', async () => {
    prismaMock.wasteAreaEntry.findFirst.mockResolvedValue(areaEntry(101, '역삼1동'));
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([areaEntry(101, '역삼1동')]);
    prismaMock.wasteScheduleCoverage.findMany.mockResolvedValue(
      Array.from({ length: 21 }, (_, index) => coverage(index + 1, { areaId: 101 }))
    );

    const detail = await getWasteArea(101);

    expect(detail?.schedules).toHaveLength(21);
    expect(new Set(detail?.schedules.map((item) => item.schedule.id)).size).toBe(21);
  });
});


describe('hasPublishedWasteAreaDetailHistory', () => {
  it('returns true only for historical published administrative dong detail entries', async () => {
    prismaMock.wasteAreaEntry.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await expect(hasPublishedWasteAreaDetailHistory(101)).resolves.toBe(true);
    await expect(hasPublishedWasteAreaDetailHistory(202)).resolves.toBe(false);

    expect(prismaMock.wasteAreaEntry.count).toHaveBeenCalledWith({
      where: {
        areaId: 101,
        level: 'dong',
        validFrom: { lte: expect.any(Date) },
        area: { kind: 'administrative' },
        generation: {
          status: 'published',
          publishedAt: { not: null },
        },
      },
    });
  });

  it('does not classify future-only published public detail rows as gone history', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-28T12:00:00.000Z'));
    prismaMock.wasteAreaEntry.count.mockResolvedValue(0);

    await expect(hasPublishedWasteAreaDetailHistory(303)).resolves.toBe(false);

    expect(prismaMock.wasteAreaEntry.count).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        areaId: 303,
        validFrom: { lte: new Date('2026-09-28T00:00:00.000Z') },
      }),
    }));
  });

});

describe('listIndexableWasteAreas', () => {
  it('returns only W9 eligible active dong entries with content lastmod', async () => {
    prismaMock.wasteAreaEntry.findMany.mockResolvedValue([
      { areaId: 101, contentUpdatedAt: new Date('2026-09-20T00:00:00.000Z') },
      { areaId: 103, contentUpdatedAt: new Date('2026-09-22T00:00:00.000Z') },
    ]);

    const result = await listIndexableWasteAreas(generationId);

    expect(result).toEqual([
      { areaId: 101, contentUpdatedAt: '2026-09-20T00:00:00.000Z' },
      { areaId: 103, contentUpdatedAt: '2026-09-22T00:00:00.000Z' },
    ]);
    expect(prismaMock.wasteAreaEntry.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        generationId,
        level: 'dong',
        indexEligible: true,
        area: { kind: 'administrative' },
        coverages: expect.objectContaining({
          some: expect.objectContaining({
            state: 'verified',
            revision: expect.objectContaining({
              state: 'active',
              sourceId: { not: { startsWith: 'seed-' } },
            }),
          }),
        }),
      }),
      select: { areaId: true, contentUpdatedAt: true },
      orderBy: [{ areaId: 'asc' }],
    }));
  });
});

function areaEntry(areaId: number, name: string) {
  return {
    generationId,
    areaId,
    level: 'dong',
    city: '서울특별시',
    district: '강남구',
    districtCode: '11680',
    name,
    indexEligible: false,
    indexReason: 'pending W9 public indexing policy',
    contentUpdatedAt: updatedAt,
    validFrom: new Date('2020-01-01T00:00:00Z'),
    validTo: null,
    area: { id: areaId, kind: 'administrative', code: String(areaId) },
  };
}

function coverage(
  scheduleId: number,
  overrides: Partial<{
    areaId: number | null;
    districtCode: string | null;
    scope: string;
    conditionText: string;
    sourceId: string;
    details: Record<string, unknown> | null;
    sourceModifiedAt: Date | null;
    contentUpdatedAt: Date;
  }> = {}
) {
  return {
    generationId,
    scheduleId,
    coverageKey: `coverage-${scheduleId}-${overrides.conditionText ?? 'whole'}-${overrides.areaId ?? overrides.districtCode ?? 'x'}`,
    areaId: overrides.areaId ?? null,
    districtCode: overrides.districtCode ?? null,
    scope: overrides.scope ?? 'whole',
    conditionText: overrides.conditionText ?? '전체',
    state: 'verified',
    reason: 'fixture',
    evidence: [{ url: 'https://example.test/ref', version: 'v1' }],
    revision: {
      generationId,
      scheduleId,
      city: '서울특별시',
      district: '강남구',
      sourceId: overrides.sourceId ?? `source-${scheduleId}`,
      targetRegion: '역삼1동',
      emissionPlace: '집 앞',
      details: overrides.details ?? { livingWaste: { dayOfWeek: '월' } },
      sourceUrl: 'https://example.test/source',
      govCode: '3220000',
      rawPayload: null,
      provenance: 'legacy',
      contentHash: 'a'.repeat(64),
      sourceModifiedAt: overrides.sourceModifiedAt ?? null,
      observedAt: updatedAt,
      contentUpdatedAt: overrides.contentUpdatedAt ?? updatedAt,
      state: 'active',
      missingCompleteRuns: 0,
      terminationEvidence: null,
    },
  };
}
