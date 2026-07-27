import { describe, it, expect, vi, beforeEach } from 'vitest';

// These must be declared with vi.hoisted so they're available inside vi.mock factory
const { mockFindMany, mockCount, mockFindUnique, mockUpdate, mockFindFirst, mockQueryRaw, mockExecuteRawUnsafe } = vi.hoisted(() => ({
  mockExecuteRawUnsafe: vi.fn().mockResolvedValue(1),
  mockFindMany: vi.fn(),
  mockCount: vi.fn(),
  mockFindUnique: vi.fn(),
  mockUpdate: vi.fn().mockResolvedValue({}),
  mockFindFirst: vi.fn(),
  mockQueryRaw: vi.fn(),
}));

const { mockFtIds, mockFtCount } = vi.hoisted(() => ({
  mockFtIds: vi.fn(), mockFtCount: vi.fn(),
}));

vi.mock('../../src/services/search/fulltextKeyword.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/fulltextKeyword.js');
  return { ...actual, fulltextIds: mockFtIds, fulltextCount: mockFtCount };
});

vi.mock('../../src/lib/prisma.js', () => {
  const model = {
    findMany: mockFindMany,
    count: mockCount,
    findUnique: mockFindUnique,
    update: mockUpdate,
  };
  const prismaClient = {
    toilet: model,
    wifi: model,
    clothes: model,
    parking: model,
    aed: model,
    library: model,
    hospital: model,
    pharmacy: model,
    park: model,
    school: model,
    market: model,
    childcare: model,
    evCharger: model,
    sports: model,
    wasteSchedule: model,
    region: { findFirst: mockFindFirst },
    $queryRawUnsafe: mockQueryRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
  };
  return {
    default: prismaClient,
    prisma: prismaClient,
  };
});

import { search, getDetail, getAllIds, getByRegion, getNearbyFacilities, CATEGORY_REGISTRY, flushViewCounts } from '../../src/services/facilityService.js';

const sampleRecord = {
  id: 'test-1',
  name: 'Test Facility',
  address: '서울시 강남구',
  roadAddress: '서울시 강남구 테헤란로',
  lat: 37.5,
  lng: 127.0,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '1168000000',
  sourceId: 'src-1',
  sourceUrl: null,
  viewCount: 5,
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
  operatingHours: '24시간',
  maleToilets: 3,
  maleUrinals: 5,
  femaleToilets: 4,
  hasDisabledToilet: true,
  openTime: '00:00',
  managingOrg: '강남구청',
};

beforeEach(async () => {
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
  mockExecuteRawUnsafe.mockResolvedValue(1);
  // 이전 테스트에서 남은 viewCount 버퍼 비우기
  await flushViewCounts();
  vi.clearAllMocks();
  mockUpdate.mockResolvedValue({});
  mockExecuteRawUnsafe.mockResolvedValue(1);
  // fulltext 헬퍼 기본값
  mockFtIds.mockResolvedValue([]);
  mockFtCount.mockResolvedValue(0);
  // 한글 우선 정렬 raw SQL 기본값 (id 없음)
  mockQueryRaw.mockResolvedValue([]);
});

describe('CATEGORY_REGISTRY', () => {
  it('should NOT contain kiosk key', () => {
    expect(CATEGORY_REGISTRY).not.toHaveProperty('kiosk');
    expect(Object.keys(CATEGORY_REGISTRY)).not.toContain('kiosk');
  });

  it('should return null for kiosk category search', async () => {
    const result = await getDetail('kiosk', 'test-1');
    expect(result).toBeNull();
  });

  it('should contain park key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('park');
  });

  it('should have park listFields defined', () => {
    expect(CATEGORY_REGISTRY.park.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.park.listFields)).toBe(true);
  });

  it('should have park detailFields defined', () => {
    expect(CATEGORY_REGISTRY.park.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.park.detailFields)).toBe(true);
  });

  it('should contain school key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('school');
  });

  it('should have school listFields defined', () => {
    expect(CATEGORY_REGISTRY.school.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.school.listFields)).toBe(true);
  });

  it('should have school detailFields defined', () => {
    expect(CATEGORY_REGISTRY.school.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.school.detailFields)).toBe(true);
  });

  it('should contain market key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('market');
  });

  it('should have market listFields defined', () => {
    expect(CATEGORY_REGISTRY.market.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.market.listFields)).toBe(true);
  });

  it('should have market detailFields defined', () => {
    expect(CATEGORY_REGISTRY.market.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.market.detailFields)).toBe(true);
  });

  it('should contain childcare key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('childcare');
  });

  it('should have childcare listFields defined', () => {
    expect(CATEGORY_REGISTRY.childcare.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.childcare.listFields)).toBe(true);
  });

  it('should have childcare detailFields defined', () => {
    expect(CATEGORY_REGISTRY.childcare.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.childcare.detailFields)).toBe(true);
  });

  it('should contain ev-charger key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('ev-charger');
  });

  it('should have ev-charger listFields defined', () => {
    expect(CATEGORY_REGISTRY['ev-charger'].listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY['ev-charger'].listFields)).toBe(true);
  });

  it('should have ev-charger detailFields defined', () => {
    expect(CATEGORY_REGISTRY['ev-charger'].detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY['ev-charger'].detailFields)).toBe(true);
  });

  it('should have ev-charger listFields including chgerType and output', () => {
    expect(CATEGORY_REGISTRY['ev-charger'].listFields).toContain('chgerType');
    expect(CATEGORY_REGISTRY['ev-charger'].listFields).toContain('output');
  });

  it('should have ev-charger detailFields including all key fields', () => {
    const detailFields = CATEGORY_REGISTRY['ev-charger'].detailFields;
    expect(detailFields).toContain('statId');
    expect(detailFields).toContain('chgerId');
    expect(detailFields).toContain('busiNm');
    expect(detailFields).toContain('output');
    expect(detailFields).toContain('maker');
  });

  it('should contain sports key', () => {
    expect(CATEGORY_REGISTRY).toHaveProperty('sports');
  });

  it('should have sports listFields defined', () => {
    expect(CATEGORY_REGISTRY.sports.listFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.sports.listFields)).toBe(true);
  });

  it('should have sports detailFields defined', () => {
    expect(CATEGORY_REGISTRY.sports.detailFields).toBeDefined();
    expect(Array.isArray(CATEGORY_REGISTRY.sports.detailFields)).toBe(true);
  });

  it('should have sports listFields including ftypeNm and fcobNm', () => {
    expect(CATEGORY_REGISTRY.sports.listFields).toContain('ftypeNm');
    expect(CATEGORY_REGISTRY.sports.listFields).toContain('fcobNm');
  });

  it('should have sports detailFields including all key fields', () => {
    const detailFields = CATEGORY_REGISTRY.sports.detailFields;
    expect(detailFields).toContain('faciGbNm');
    expect(detailFields).toContain('fcobNm');
    expect(detailFields).toContain('ftypeNm');
    expect(detailFields).toContain('faciHomepage');
    expect(detailFields).toContain('standCptPsnCnt');
  });
});

describe('search', () => {
  it('searches single category with DB pagination (한글 우선 raw 정렬)', async () => {
    // 키워드 없는 기본 목록 → 한글 우선 raw SQL 경로
    mockQueryRaw.mockResolvedValue([{ id: 'test-1' }]);
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await search({ category: 'toilet', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('toilet');
    expect(result.items[0].id).toBe('test-1');
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
    // raw 정렬 id를 findMany id-in으로 재수화
    expect(mockQueryRaw).toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['test-1'] } } })
    );
    // total은 model.count 재사용
    expect(mockCount).toHaveBeenCalled();
  });

  it('searches all categories and aggregates counts', async () => {
    mockCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([sampleRecord]);

    const result = await search({ page: 1, limit: 20 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.items.length).toBeGreaterThanOrEqual(1);
  });

  it('searches with keyword filter', async () => {
    mockFtIds.mockResolvedValue(['t1', 't2']);
    mockFtCount.mockResolvedValue(2);
    mockFindMany.mockResolvedValue([]);

    await search({ category: 'toilet', keyword: '강남', page: 1, limit: 20 });

    // 2자 이상 키워드는 fulltext 경로 사용
    expect(mockFtIds).toHaveBeenCalled();
    expect(mockFtCount).toHaveBeenCalled();
    // findMany는 id in 형태로 호출됨
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['t1', 't2'] },
        }),
      })
    );
  });

  it('1자 키워드는 LIKE 경로를 유지한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await search({ category: 'toilet', keyword: '갸', page: 1, limit: 20 });

    expect(mockFtIds).not.toHaveBeenCalled();
    expect(mockFtCount).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: '갸' } },
            { address: { contains: '갸' } },
            { roadAddress: { contains: '갸' } },
          ],
        }),
      })
    );
  });

  it('searches with city/district filter (지역값은 raw SQL ? 바인딩)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await search({ category: 'wifi', city: '서울특별시', district: '강남구', page: 1, limit: 20 });

    // 한글 우선 raw SQL: 테이블명만 보간, 지역값은 ? 파라미터 바인딩 인자로 전달
    const rawCall = mockQueryRaw.mock.calls[0];
    const sql = rawCall[0] as string;
    expect(sql).toContain('`Wifi`');
    expect(sql).toContain('city IN (?');
    expect(sql).toContain('district = ?');
    expect(sql).not.toContain('서울특별시'); // 지역은 SQL 문자열에 직접 보간되지 않음
    // 지역값이 바인딩 인자로 전달됨
    expect(rawCall).toContain('서울특별시');
    expect(rawCall).toContain('서울');
    expect(rawCall).toContain('강남구');
    // findMany는 id-in 재수화 형태로 호출
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } } })
    );
    // count는 기존 where(지역 필터)로 재사용
    expect(mockCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          city: { in: expect.arrayContaining(['서울특별시', '서울']) },
          district: '강남구',
        }),
      })
    );
  });

  it('searches hospital category', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'test-1' }]);
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await search({ category: 'hospital', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('hospital');
  });

  it('searches pharmacy category', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'test-1' }]);
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await search({ category: 'pharmacy', page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].category).toBe('pharmacy');
  });

  it('전국 시설 목록은 한글 우선 정렬 raw SQL을 사용한다', async () => {
    mockQueryRaw.mockResolvedValue([{ id: 'k1' }, { id: 'k2' }]);
    mockCount.mockResolvedValue(2);
    // findMany(id in)은 순서 비보장 → 역순 반환으로 재정렬 검증
    mockFindMany.mockResolvedValue([
      { ...sampleRecord, id: 'k2', name: '하늘약국' },
      { ...sampleRecord, id: 'k1', name: '가나약국' },
    ]);

    const result = await search({ category: 'pharmacy', page: 1, limit: 20 });

    // 한글 우선 + name ASC ORDER BY (테이블명은 고정맵 보간)
    const sql = mockQueryRaw.mock.calls[0][0] as string;
    expect(sql).toContain("(name REGEXP '^[가-힣]') DESC");
    expect(sql).toContain('name ASC');
    expect(sql).toContain('`Pharmacy`');
    expect(sql).toContain('LIMIT ? OFFSET ?');
    // limit/offset도 ? 바인딩
    const rawCall = mockQueryRaw.mock.calls[0];
    expect(rawCall).toContain(20); // limit
    expect(rawCall).toContain(0); // offset
    // findMany id-in 재수화
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['k1', 'k2'] } } })
    );
    // raw id 순서(k1, k2) 보존
    expect(result.items.map((i) => i.id)).toEqual(['k1', 'k2']);
    expect(result.total).toBe(2);
  });

  it('키워드 있으면 한글 우선 raw 정렬을 쓰지 않는다 (fulltext 유지)', async () => {
    mockFtIds.mockResolvedValue(['t1']);
    mockFtCount.mockResolvedValue(1);
    mockFindMany.mockResolvedValue([]);

    await search({ category: 'pharmacy', keyword: '종로', page: 1, limit: 20 });

    // fulltext 경로 사용, 한글 우선 raw SQL 미호출
    expect(mockFtIds).toHaveBeenCalled();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('latest 정렬은 한글 우선 raw 정렬을 쓰지 않는다', async () => {
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    await search({ category: 'toilet', sort: 'latest', page: 1, limit: 20 });

    // 비기본 정렬 → 기존 orderBy 경로(skip/take), raw SQL 미호출
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { updatedAt: 'desc' }, skip: 0, take: 20 })
    );
  });

  it('hospital 진료과목 필터는 한글 우선 raw 정렬을 쓰지 않는다', async () => {
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    await search({ category: 'hospital', departments: ['내과'], page: 1, limit: 20 });

    // departments 필터 → 기존 orderBy 경로, raw SQL 미호출
    expect(mockQueryRaw).not.toHaveBeenCalled();
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 })
    );
  });
});

describe('주변 시설 name+좌표 dedup', () => {
  // 동일 시설이 서로 다른 id로 중복 유입되는 상황 (예: 온천초등학교 353m 2회)
  const twinA = { ...sampleRecord, id: 'twin-a', name: '온천초등학교', lat: 37.5, lng: 127.0 };
  const twinB = { ...sampleRecord, id: 'twin-b', name: '온천초등학교', lat: 37.5, lng: 127.0 };

  it('getNearbyFacilities()는 동일 name+좌표(다른 id) 2건을 1건으로 병합한다', async () => {
    // toilet → CROSS_CATEGORY_MAP: [park, wifi]. 첫 카테고리에만 쌍둥이 2건, 나머지는 빈 배열.
    mockFindMany.mockResolvedValueOnce([twinA, twinB]).mockResolvedValue([]);

    const result = await getNearbyFacilities('toilet', 37.5, 127.0, 1000);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('온천초등학교');
  });

  it('getNearbyFacilities()는 동명이지만 좌표가 다른 시설은 2건 유지한다 (과다 dedup 방지)', async () => {
    const near = { ...sampleRecord, id: 'near', name: '온천초등학교', lat: 37.5, lng: 127.0 };
    const far = { ...sampleRecord, id: 'far', name: '온천초등학교', lat: 37.501, lng: 127.001 };
    mockFindMany.mockResolvedValueOnce([near, far]).mockResolvedValue([]);

    const result = await getNearbyFacilities('toilet', 37.5, 127.0, 5000);

    expect(result).toHaveLength(2);
  });

  it('search() 좌표 경로는 items와 total을 dedup한다 (total/totalPages 재계산)', async () => {
    mockFindMany.mockResolvedValue([twinA, twinB]);

    const result = await search({ category: 'toilet', lat: 37.5, lng: 127.0, radius: 1000, page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('search() 좌표 경로는 동명이지만 좌표가 다른 시설은 2건 유지한다', async () => {
    const near = { ...sampleRecord, id: 'near', name: '온천초등학교', lat: 37.5, lng: 127.0 };
    const far = { ...sampleRecord, id: 'far', name: '온천초등학교', lat: 37.501, lng: 127.001 };
    mockFindMany.mockResolvedValue([near, far]);

    const result = await search({ category: 'toilet', lat: 37.5, lng: 127.0, radius: 5000, page: 1, limit: 20 });

    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(2);
  });
});

describe('getDetail', () => {
  it('returns facility details', async () => {
    mockFindUnique.mockResolvedValue(sampleRecord);

    const result = await getDetail('toilet', 'test-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('test-1');
    expect(result!.category).toBe('toilet');
    expect(result!.details).toHaveProperty('operatingHours');
    expect(result!.details).toHaveProperty('maleToilets');
  });

  it('returns null for non-existent ID', async () => {
    mockFindUnique.mockResolvedValue(null);

    const result = await getDetail('toilet', 'nonexistent');
    expect(result).toBeNull();
  });

  it('returns null for invalid category', async () => {
    const result = await getDetail('invalid', 'test-1');
    expect(result).toBeNull();
  });

  it('increments viewCount via batch flush', async () => {
    mockFindUnique.mockResolvedValue(sampleRecord);

    await getDetail('toilet', 'test-1');

    // viewCount는 버퍼에 누적 → flush 시 일괄 반영.
    // 반영은 model.update() 가 아니라 raw UPDATE 로 한다 — update() 는 @updatedAt 을 함께
    // 갱신해 조회가 사이트맵 lastmod 를 오염시키기 때문이다.
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
    await flushViewCounts();
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);
    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('`Toilet`');
    expect(sql).not.toContain('updatedAt');
    expect(params).toEqual([1, 'test-1']);
  });

  it('returns hospital details with detailFields', async () => {
    const hospitalRecord = {
      ...sampleRecord,
      phone: '02-1234-5678',
      clCdNm: '의원',
      drTotCnt: 5,
      homepage: 'https://example.com',
      estbDd: '2020-01-01',
    };
    mockFindUnique.mockResolvedValue(hospitalRecord);

    const result = await getDetail('hospital', 'test-1');

    expect(result).not.toBeNull();
    expect(result!.category).toBe('hospital');
    expect(result!.details).toHaveProperty('phone', '02-1234-5678');
    expect(result!.details).toHaveProperty('clCdNm', '의원');
    expect(result!.details).toHaveProperty('drTotCnt', 5);
  });

  it('returns pharmacy details with detailFields', async () => {
    const pharmacyRecord = {
      ...sampleRecord,
      phone: '02-9876-5432',
      dutyTime1s: '0900',
      dutyTime1c: '1800',
      hpid: 'PHARM-001',
    };
    mockFindUnique.mockResolvedValue(pharmacyRecord);

    const result = await getDetail('pharmacy', 'test-1');

    expect(result).not.toBeNull();
    expect(result!.category).toBe('pharmacy');
    expect(result!.details).toHaveProperty('phone', '02-9876-5432');
    expect(result!.details).toHaveProperty('dutyTime1s', '0900');
    expect(result!.details).toHaveProperty('dutyTime1c', '1800');
  });
});

describe('getAllIds', () => {
  it('returns id and updatedAt for a category', async () => {
    const ids = [
      { id: '1', updatedAt: new Date() },
      { id: '2', updatedAt: new Date() },
    ];
    mockFindMany.mockResolvedValue(ids);

    const result = await getAllIds('toilet');

    expect(result).toEqual(ids);
    expect(mockFindMany).toHaveBeenCalledWith({
      select: { id: true, updatedAt: true },
    });
  });
});

describe('getByRegion', () => {
  it('returns paginated results for a region (한글 우선 raw 정렬)', async () => {
    mockFindFirst.mockResolvedValue({
      city: '서울특별시',
      district: '강남구',
      bjdCode: '1168000000',
    });
    mockQueryRaw.mockResolvedValue([{ id: 'test-1' }]);
    mockFindMany.mockResolvedValue([sampleRecord]);
    mockCount.mockResolvedValue(1);

    const result = await getByRegion('서울특별시', '강남구', 'toilet', { page: 1, limit: 20 });

    expect(result.region.city).toBe('서울특별시');
    expect(result.region.district).toBe('강남구');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    // 한글 우선 raw SQL 사용 + 지역은 ? 바인딩
    const sql = mockQueryRaw.mock.calls[0][0] as string;
    expect(sql).toContain("(name REGEXP '^[가-힣]') DESC");
    expect(sql).toContain('`Toilet`');
    expect(mockQueryRaw.mock.calls[0]).toContain('강남구');
    // findMany는 id-in 재수화
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ['test-1'] } } })
    );
  });

  it('returns empty items for invalid category', async () => {
    mockFindFirst.mockResolvedValue(null);

    const result = await getByRegion('서울특별시', '강남구', 'invalid');

    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
