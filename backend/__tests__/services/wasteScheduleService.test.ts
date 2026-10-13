import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  groupByMock,
  findManyMock,
  countMock,
  findFirstMock,
  publicationFindUniqueMock,
  revisionFindManyMock,
  revisionCountMock,
  revisionFindUniqueMock,
  revisionFindFirstMock,
  revisionGroupByMock,
  applicableAreasMock,
} = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  findFirstMock: vi.fn(),
  publicationFindUniqueMock: vi.fn(),
  revisionFindManyMock: vi.fn(),
  revisionCountMock: vi.fn(),
  revisionFindUniqueMock: vi.fn(),
  revisionFindFirstMock: vi.fn(),
  revisionGroupByMock: vi.fn(),
  applicableAreasMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const wasteSchedule = {
    groupBy: groupByMock,
    findMany: findManyMock,
    count: countMock,
    findFirst: findFirstMock,
  };
  const wastePublication = { findUnique: publicationFindUniqueMock };
  const wasteScheduleRevision = {
    findMany: revisionFindManyMock,
    count: revisionCountMock,
    findUnique: revisionFindUniqueMock,
    findFirst: revisionFindFirstMock,
    groupBy: revisionGroupByMock,
  };
  return {
    prisma: { wasteSchedule, wastePublication, wasteScheduleRevision },
    default: { wasteSchedule, wastePublication, wasteScheduleRevision },
  };
});


vi.mock('../../src/services/wasteAreaService.js', () => ({
  isWasteAreaDiscoveryEnabled: () => process.env.WASTE_AREA_DISCOVERY_ENABLED === 'true',
  getActiveWasteGeneration: async () => {
    const publication = await publicationFindUniqueMock({ where: { id: 1 }, select: { activeGenerationId: true } });
    return publication?.activeGenerationId ?? null;
  },
  getApplicableAreasForSchedules: applicableAreasMock,
}));

import {
  getByRegion,
  getDistricts,
  getWasteScheduleRegions,
  getRegions,
  getCities,
  getAllIds,
  getById,
} from '../../src/services/wasteScheduleService.js';

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
  applicableAreasMock.mockResolvedValue(new Map());
});

describe('getWasteScheduleRegions', () => {
  it('returns distinct (city, district) with max updatedAt', async () => {
    const t1 = new Date('2026-06-01T00:00:00Z');
    const t2 = new Date('2026-06-10T00:00:00Z');

    groupByMock.mockResolvedValue([
      { city: '경기도', district: '가평군', _max: { updatedAt: t1 } },
      { city: '서울특별시', district: '강남구', _max: { updatedAt: t2 } },
    ]);

    const result = await getWasteScheduleRegions();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ city: '경기도', district: '가평군', updatedAt: t1 });
    expect(result[1]).toEqual({ city: '서울특별시', district: '강남구', updatedAt: t2 });
  });

  it('calls groupBy with city and district keys and _max updatedAt', async () => {
    groupByMock.mockResolvedValue([]);

    await getWasteScheduleRegions();

    expect(groupByMock).toHaveBeenCalledOnce();
    const callArg = groupByMock.mock.calls[0][0];
    expect(callArg.by).toEqual(['city', 'district']);
    expect(callArg._max).toHaveProperty('updatedAt', true);
  });

  it('excludes records where _max.updatedAt is null', async () => {
    const t1 = new Date('2026-06-01T00:00:00Z');

    groupByMock.mockResolvedValue([
      { city: '경기도', district: '가평군', _max: { updatedAt: t1 } },
      { city: '서울특별시', district: '강남구', _max: { updatedAt: null } },
    ]);

    const result = await getWasteScheduleRegions();

    expect(result).toHaveLength(1);
    expect(result[0].city).toBe('경기도');
  });

  it('returns empty array when no waste schedule records exist', async () => {
    groupByMock.mockResolvedValue([]);

    const result = await getWasteScheduleRegions();

    expect(result).toEqual([]);
  });

  it('orders results by city asc then district asc', async () => {
    groupByMock.mockResolvedValue([]);

    await getWasteScheduleRegions();

    const callArg = groupByMock.mock.calls[0][0];
    expect(callArg.orderBy).toEqual([{ city: 'asc' }, { district: 'asc' }]);
  });
});

describe('getByRegion — city variant matching', () => {
  beforeEach(() => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it('축약명(서울)으로 조회해도 정식명(서울특별시) 행을 매칭한다', async () => {
    await getByRegion('서울');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울', '서울특별시']) });
  });

  it('정식명(서울특별시)으로 조회해도 축약명(서울)을 함께 매칭한다', async () => {
    await getByRegion('서울특별시');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울특별시', '서울']) });
  });

  it('city 가 없으면 city 조건 없이 전국을 조회한다', async () => {
    await getByRegion();

    const where = findManyMock.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('city');
  });

  it('district 는 접미사 유무 양쪽으로 매칭한다', async () => {
    // WasteSchedule 만 원본 공공데이터 표기를 그대로 담아, 경기 남양주·동두천 두 곳이
    // 접미사 없이('남양주') 저장돼 있다. 허브는 slug 를 Region 정식명('남양주시')으로
    // 되돌려 보내므로 정확 일치로는 0건이 되고, 허브가 "등록된 배출 일정이 없습니다" 인 채
    // 200 + noindex 로 나갔다(실측 2026-09-04 프로덕션).
    await getByRegion('서울', '강남구');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.district).toEqual({ in: ['강남구', '강남'] });
  });

  it('접미사 없는 구·군은 그대로 정확 일치로 조회한다', async () => {
    await getByRegion('세종특별자치시', '없음');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.district).toBe('없음');
  });

  it('keyword 는 city variant 필터와 공존하되 DB 와일드카드 조건으로 넘기지 않는다', async () => {
    findManyMock.mockResolvedValue([
      {
        id: 1,
        city: '서울특별시',
        district: '강남구',
        targetRegion: '문자 %_\\ 역삼',
        emissionPlace: '집 앞',
        sourceUrl: null,
        govCode: null,
        details: null,
      },
      {
        id: 2,
        city: '서울특별시',
        district: '강남구',
        targetRegion: '문자 AAA 역삼',
        emissionPlace: '집 앞',
        sourceUrl: null,
        govCode: null,
        details: null,
      },
    ]);
    await getByRegion('서울', undefined, '역삼');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울특별시']) });
    expect(where).not.toHaveProperty('targetRegion');
  });

  it('findMany 와 count 가 동일한 where 를 사용한다', async () => {
    await getByRegion('서울', '강남구', '역삼');

    expect(findManyMock.mock.calls[0][0].where).toEqual(countMock.mock.calls[0][0].where);
  });

  it('slug 매칭에 실패한 city 는 정확 일치로 넘긴다', async () => {
    await getByRegion('없는도시');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toBe('없는도시');
  });

  it('통합명(전남광주통합특별시)은 variant 확장 없이 그대로 매칭한다', async () => {
    await getByRegion('전남광주통합특별시');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toBe('전남광주통합특별시');
  });
});

describe('getDistricts — city variant matching', () => {
  it('축약명(서울)으로도 정식명(서울특별시) 행의 구/군을 매칭한다', async () => {
    groupByMock.mockResolvedValue([{ district: '강남구' }, { district: '강동구' }]);

    const result = await getDistricts('서울');

    const where = groupByMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울', '서울특별시']) });
    expect(result).toEqual(['강남구', '강동구']);
  });

  it('정식명(서울특별시)으로 조회해도 축약명을 함께 매칭한다', async () => {
    groupByMock.mockResolvedValue([]);

    await getDistricts('서울특별시');

    const where = groupByMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울특별시', '서울']) });
  });
});

// 운영 DB 에 seed 5건(sourceId `seed-waste-schedule-1`~`5`, id 15345~15349)이 남아
// 종로 등의 공개 목록에 검증되지 않은 예시 일정으로 섞여 나갔다(RESEARCH/naver-decline-2026-09-08).
// 구형 `emissionDays`/`emissionTime` 구조라 상세 모달도 요일·시간을 읽지 못한다.
// 원본은 보존하고 공개 조회 경로에서만 제외한다.
const SEED_EXCLUDED = { not: { startsWith: 'seed-' } };

describe('seed 데이터 공개 노출 제외', () => {
  beforeEach(() => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    groupByMock.mockResolvedValue([]);
    findFirstMock.mockResolvedValue(null);
  });

  it('getByRegion 목록에서 seed sourceId 를 제외한다', async () => {
    await getByRegion('서울', '종로구');

    expect(findManyMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getByRegion 의 total 카운트도 같은 제외 조건을 쓴다', async () => {
    await getByRegion('서울', '종로구');

    expect(countMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getRegions 지역 집계에서 seed 를 제외한다', async () => {
    await getRegions();

    expect(groupByMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getCities 시/도 목록에서 seed 를 제외한다', async () => {
    await getCities();

    expect(groupByMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getDistricts 구/군 목록에서 seed 를 제외한다', async () => {
    await getDistricts('서울');

    expect(groupByMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getAllIds 사이트맵 ID 에서 seed 를 제외한다', async () => {
    await getAllIds();

    expect(findManyMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getWasteScheduleRegions 사이트맵 지역에서 seed 를 제외한다', async () => {
    await getWasteScheduleRegions();

    expect(groupByMock.mock.calls[0][0].where.sourceId).toEqual(SEED_EXCLUDED);
  });

  it('getById 는 seed 행을 조회 대상에서 빼고 null 을 반환한다', async () => {
    const result = await getById(15346);

    expect(findFirstMock.mock.calls[0][0].where).toEqual({
      id: 15346,
      sourceId: SEED_EXCLUDED,
      stagedMarker: null,
    });
    expect(result).toBeNull();
  });

  it('getById 는 정상 행을 그대로 반환한다', async () => {
    findFirstMock.mockResolvedValue({
      id: 13198,
      city: '서울특별시',
      district: '종로구',
      targetRegion: '청운효자동',
      emissionPlace: '문전배출',
      sourceUrl: 'https://example.test/source',
      govCode: '3220000',
      details: { livingWaste: { dayOfWeek: '일+월+화+수+목+금' } },
    });

    const result = await getById(13198);

    expect(result?.id).toBe(13198);
    expect(result?.details?.livingWaste?.dayOfWeek).toBe('일+월+화+수+목+금');
  });
});

describe('waste area discovery source compatibility', () => {
  it('keeps disabled legacy readers away from publication tables', async () => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await getByRegion('서울', '강남구');

    expect(publicationFindUniqueMock).not.toHaveBeenCalled();
    expect(findManyMock.mock.calls[0][0].where.stagedMarker).toBeNull();
  });

  it('excludes staged rows from every legacy reader even when discovery is disabled', async () => {
    groupByMock.mockResolvedValue([]);
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
    findFirstMock.mockResolvedValue(null);

    await getByRegion('서울', '강남구');
    expect(findManyMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();
    expect(countMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();

    await getRegions();
    expect(groupByMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();

    await getCities();
    expect(groupByMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();

    await getDistricts('서울');
    expect(groupByMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();

    await getAllIds();
    expect(findManyMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();

    await getWasteScheduleRegions();
    expect(groupByMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();

    await getById(15346);
    expect(findFirstMock.mock.calls.at(-1)?.[0].where.stagedMarker).toBeNull();
  });

  it('falls back to unmarked legacy rows only when enabled and no pointer exists', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    publicationFindUniqueMock.mockResolvedValue({ activeGenerationId: null });
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);

    await getByRegion('서울', '강남구');

    expect(publicationFindUniqueMock).toHaveBeenCalledOnce();
    expect(findManyMock.mock.calls[0][0].where.stagedMarker).toBeNull();
    expect(countMock.mock.calls[0][0].where).toEqual(findManyMock.mock.calls[0][0].where);
  });

  it('preserves seed exclusion across published list, regions, cities, districts, IDs, sitemap regions, and detail', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    publicationFindUniqueMock.mockResolvedValue({ activeGenerationId: 'generation-1' });
    revisionFindManyMock.mockResolvedValue([]);
    revisionCountMock.mockResolvedValue(0);
    revisionGroupByMock.mockResolvedValue([]);
    revisionFindFirstMock.mockResolvedValue(null);

    await getByRegion('서울', '강남구');
    expect(revisionFindManyMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);
    expect(revisionCountMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);

    await getRegions();
    expect(revisionGroupByMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);

    await getCities();
    expect(revisionGroupByMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);

    await getDistricts('서울');
    expect(revisionGroupByMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);

    await getAllIds();
    expect(revisionFindManyMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);

    await getWasteScheduleRegions();
    expect(revisionGroupByMock.mock.calls.at(-1)?.[0].where.sourceId).toEqual(SEED_EXCLUDED);

    const detail = await getById(15346);
    expect(revisionFindFirstMock.mock.calls.at(-1)?.[0].where).toMatchObject({
      generationId: 'generation-1',
      scheduleId: 15346,
      sourceId: SEED_EXCLUDED,
    });
    expect(detail).toBeNull();
  });

  it('uses published revisions when a pointer exists and never queries legacy schedules', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    publicationFindUniqueMock.mockResolvedValue({ activeGenerationId: 'generation-1' });
    revisionFindManyMock.mockResolvedValue([revision(7, 'active')]);
    revisionCountMock.mockResolvedValue(1);
    applicableAreasMock.mockResolvedValue(new Map([[7, [{
      areaId: 101,
      name: '역삼1동',
      href: '/trash/areas/101',
      scope: 'whole',
      conditionText: '전체',
    }]]]));

    const result = await getByRegion('서울', '강남구', undefined, { coverage: 'unresolved' });

    expect(findManyMock).not.toHaveBeenCalled();
    expect(revisionFindManyMock.mock.calls[0][0].where).toMatchObject({
      generationId: 'generation-1',
      state: 'active',
      coverages: { some: { state: 'unresolved' } },
    });
    expect(applicableAreasMock).toHaveBeenCalledWith('generation-1', [7]);
    expect(result.items[0]).toMatchObject({
      id: 7,
      sourceStatus: 'active',
      applicableAreas: [{ areaId: 101, href: '/trash/areas/101' }],
      appliesTo: [expect.objectContaining({ state: 'unresolved' })],
    });
  });

  it('returns an empty applicableAreas array for old published responses without verified detail areas', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    publicationFindUniqueMock.mockResolvedValue({ activeGenerationId: 'generation-1' });
    revisionFindFirstMock.mockResolvedValue(revision(8, 'active'));
    applicableAreasMock.mockResolvedValue(new Map());

    const detail = await getById(8);

    expect(applicableAreasMock).toHaveBeenCalledWith('generation-1', [8]);
    expect(detail?.applicableAreas).toEqual([]);
    expect(detail?.appliesTo).toEqual([expect.objectContaining({ state: 'unresolved' })]);
  });

  it('turns inactive published source detail into 410 Gone', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    publicationFindUniqueMock.mockResolvedValue({ activeGenerationId: 'generation-1' });
    revisionFindFirstMock.mockResolvedValue(revision(7, 'inactive'));

    await expect(getById(7)).rejects.toMatchObject({ statusCode: 410 });
  });
});

function revision(scheduleId: number, state: 'active' | 'inactive') {
  return {
    generationId: 'generation-1',
    scheduleId,
    city: '서울특별시',
    district: '강남구',
    sourceId: `source-${scheduleId}`,
    targetRegion: '역삼1동',
    emissionPlace: '집 앞',
    details: { livingWaste: { dayOfWeek: '월' } },
    sourceUrl: 'https://example.test/source',
    govCode: '3220000',
    rawPayload: null,
    provenance: 'legacy',
    contentHash: 'a'.repeat(64),
    sourceModifiedAt: null,
    observedAt: new Date('2026-09-28T00:00:00Z'),
    contentUpdatedAt: new Date('2026-09-28T00:00:00Z'),
    state,
    missingCompleteRuns: state === 'inactive' ? 2 : 0,
    terminationEvidence: state === 'inactive' ? { reason: 'fixture' } : null,
    coverages: [
      {
        generationId: 'generation-1',
        scheduleId,
        coverageKey: `coverage-${scheduleId}`,
        areaId: state === 'active' ? 101 : null,
        districtCode: null,
        scope: 'whole',
        conditionText: '전체',
        state: 'unresolved',
        reason: 'fixture',
        evidence: [],
      },
    ],
  };
}
