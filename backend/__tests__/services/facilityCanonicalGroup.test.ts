/**
 * 동일 레코드 통합 — 그룹 대표 id(canonicalId) 판정 회귀 가드.
 *
 * 배경(실측 2026-09-04, 로컬 DB): 같은 (name, roadAddress) 를 공유하는 AED 26,277행에
 * 실제 title 생성기를 돌리면 title 정리 이후에도 284그룹 662행이 여전히 같은 title 을 낸다.
 * 그중 상당수는 별개 장비가 아니라 원본이 여러 번 들어온 동일 레코드다.
 * 반대로 ㈜녹십자(1층~5층·임원식당)나 해양경찰교육원(설치장소 23종)은 진짜 별개 장비다.
 * 이 테스트는 "완전 동일은 합치고, 하나라도 다르면 절대 합치지 않는다"를 고정한다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Row = Record<string, unknown> & { id: string };

const { tables, findFirstSpy } = vi.hoisted(() => ({
  tables: new Map<string, Record<string, unknown>[]>(),
  findFirstSpy: vi.fn(),
}));

/**
 * Prisma findFirst 의 의미를 그대로 흉내 낸 가짜.
 * ★ where 값이 undefined 면 "그 필터는 없는 것"으로 처리한다 — 실제 Prisma 동작이고,
 *   구현이 null 대신 undefined 를 흘리면 그룹이 조용히 넓어지는 것을 여기서 잡기 위함이다.
 */
function makeModel(table: string) {
  return {
    findFirst: vi.fn(async (args: { where: Record<string, unknown>; orderBy?: unknown }) => {
      findFirstSpy(table, args);
      const rows = (tables.get(table) ?? []) as Row[];
      const { id: idFilter, ...keyFilters } = args.where as { id: { lt: string } };
      const matched = rows
        .filter((row) => row.id < idFilter.lt)
        .filter((row) =>
          Object.entries(keyFilters).every(([field, value]) => {
            if (value === undefined) return true; // Prisma: undefined = 필터 없음
            return (row[field] ?? null) === value;
          })
        )
        .sort((a, b) => (a.id < b.id ? -1 : 1));
      return matched[0] ? { id: matched[0].id } : null;
    }),
    findUnique: vi.fn(async (args: { where: { id: string } }) => {
      const rows = (tables.get(table) ?? []) as Row[];
      return rows.find((row) => row.id === args.where.id) ?? null;
    }),
    findMany: vi.fn(async () => []),
    count: vi.fn(async () => 0),
    update: vi.fn(async () => ({})),
  };
}

vi.mock('../../src/lib/prisma.js', () => {
  const client: Record<string, unknown> = {
    $queryRawUnsafe: vi.fn(async () => []),
    $executeRawUnsafe: vi.fn(async () => 1),
    $queryRaw: vi.fn(async () => []),
    region: { findFirst: vi.fn() },
  };
  for (const [key, table] of [
    ['toilet', 'Toilet'], ['wifi', 'Wifi'], ['clothes', 'Clothes'], ['parking', 'Parking'],
    ['aed', 'Aed'], ['library', 'Library'], ['hospital', 'Hospital'], ['pharmacy', 'Pharmacy'],
    ['park', 'Park'], ['school', 'School'], ['market', 'Market'], ['childcare', 'Childcare'],
    ['evCharger', 'EvCharger'], ['sports', 'Sports'], ['subwayStation', 'SubwayStation'],
  ]) {
    client[key] = makeModel(table);
  }
  return { default: client, prisma: client };
});

import { findCanonicalId, getDetail, flushViewCounts } from '../../src/services/facilityService.js';

/** 공통 필드가 채워진 AED 행 */
function aedRow(over: Partial<Row> & { id: string }): Row {
  return {
    name: '양구군보건소',
    address: '강원특별자치도 양구군 양구읍 관공서로 61',
    roadAddress: '강원특별자치도 양구군 양구읍 관공서로 61',
    city: '강원특별자치도',
    district: '양구군',
    buildPlace: '보건정책과 사무실',
    org: '양구군보건소',
    lat: 38.1, lng: 127.9, bjdCode: '51800',
    sourceId: `src-${over.id}`, sourceUrl: null, viewCount: 0,
    createdAt: new Date(), updatedAt: new Date(), syncedAt: new Date(),
    ...over,
  };
}

beforeEach(async () => {
  tables.clear();
  await flushViewCounts();
  vi.clearAllMocks();
});

describe('findCanonicalId — 완전 동일 레코드만 대표로 모은다', () => {
  it('그룹 최소 id 인 대표행은 null 을 받는다', async () => {
    const rows = [aedRow({ id: 'aed-001' }), aedRow({ id: 'aed-002' }), aedRow({ id: 'aed-003' })];
    tables.set('Aed', rows);

    expect(await findCanonicalId('aed', rows[0])).toBeNull();
  });

  it('비대표행은 그룹 내 가장 작은 형제 id 를 받는다', async () => {
    // 실측 사례: name·buildPlace·org·주소가 전부 같은 18행(양구군보건소 보건정책과 사무실)
    const rows = Array.from({ length: 18 }, (_, i) =>
      aedRow({ id: `aed-${String(i + 1).padStart(3, '0')}` })
    );
    tables.set('Aed', rows);

    expect(await findCanonicalId('aed', rows[17])).toBe('aed-001');
    expect(await findCanonicalId('aed', rows[5])).toBe('aed-001');
    expect(await findCanonicalId('aed', rows[0])).toBeNull();
  });

  // ★ 가장 중요한 규칙. 여기서 실수하면 서로 다른 페이지가 하나로 접힌다.
  it('㈜녹십자처럼 설치장소(buildPlace)가 다른 형제는 절대 묶이지 않는다', async () => {
    const floors = ['1층', '2층', '3층', '4층', '5층', '임원식당(4층)'];
    const rows = floors.map((buildPlace, i) =>
      aedRow({
        id: `aed-gc-${i}`,
        name: '㈜녹십자',
        org: '㈜녹십자',
        address: '경기도 용인시 기흥구 이현로30번길 107',
        roadAddress: '경기도 용인시 기흥구 이현로30번길 107',
        city: '경기도',
        district: '용인시 기흥구',
        buildPlace,
      })
    );
    tables.set('Aed', rows);

    for (const row of rows) {
      expect(await findCanonicalId('aed', row)).toBeNull();
    }
  });

  it('설치기관(org)만 달라도 묶이지 않는다 — org 도 제목·설명 입력이다', async () => {
    const rows = [
      aedRow({ id: 'aed-a', org: '양구군보건소' }),
      aedRow({ id: 'aed-b', org: '양구군청' }),
    ];
    tables.set('Aed', rows);

    expect(await findCanonicalId('aed', rows[1])).toBeNull();
  });

  // 값 없는 키 필드는 반드시 null 로 넘겨야 한다. undefined 는 Prisma 에서 "필터 없음"이라
  // 그룹이 조용히 넓어져 서로 다른 시설을 합쳐 버린다.
  it('NULL 인 키 필드는 NULL 인 형제하고만 매칭된다', async () => {
    const rows = [
      aedRow({ id: 'aed-x', buildPlace: '지하 1층' }),
      aedRow({ id: 'aed-y', buildPlace: null }),
      aedRow({ id: 'aed-z', buildPlace: null }),
    ];
    tables.set('Aed', rows);

    // buildPlace=null 인 두 행끼리는 묶인다
    expect(await findCanonicalId('aed', rows[2])).toBe('aed-y');
    // 값이 있는 행은 null 형제로 흡수되지 않는다
    expect(await findCanonicalId('aed', rows[0])).toBeNull();
  });

  it('parking 은 주차면수·요금·운영시간까지 같아야 묶인다', async () => {
    const base = {
      name: '시청 공영주차장', address: '서울특별시 중구 세종대로 110',
      roadAddress: '서울특별시 중구 세종대로 110', city: '서울특별시', district: '중구',
      managingOrg: '중구청', providerName: '중구', operatingHours: '09:00~18:00',
      baseFee: 1000, baseTime: 30,
    };
    const rows = [
      { ...base, id: 'parking-1', capacity: 100 },
      { ...base, id: 'parking-2', capacity: 250 },
      { ...base, id: 'parking-3', capacity: 100 },
    ];
    tables.set('Parking', rows);

    expect(await findCanonicalId('parking', rows[2])).toBe('parking-1');
    expect(await findCanonicalId('parking', rows[1])).toBeNull();
  });

  it('clothes 는 상세위치(detailLocation)가 다르면 묶이지 않는다', async () => {
    const base = {
      name: '의류수거함', address: '부산광역시 해운대구 우동 1', roadAddress: null,
      city: '부산광역시', district: '해운대구', providerName: '해운대구',
      managementAgency: '해운대구청',
    };
    const rows = [
      { ...base, id: 'clothes-1', detailLocation: '우동주민센터 앞' },
      { ...base, id: 'clothes-2', detailLocation: '우동주민센터 앞' },
      { ...base, id: 'clothes-3', detailLocation: '해운대구청 정문' },
    ];
    tables.set('Clothes', rows);

    expect(await findCanonicalId('clothes', rows[1])).toBe('clothes-1');
    expect(await findCanonicalId('clothes', rows[2])).toBeNull();
  });

  it('참여하지 않는 카테고리는 쿼리 자체를 하지 않는다 (정상 경로 비용 0)', async () => {
    tables.set('Toilet', [{ id: 'toilet-1', name: '공중화장실' }]);

    expect(await findCanonicalId('toilet', { id: 'toilet-1', name: '공중화장실' })).toBeNull();
    expect(findFirstSpy).not.toHaveBeenCalled();
  });

  it('중복이 없어도 조회는 findFirst 한 번뿐이다', async () => {
    const rows = [aedRow({ id: 'aed-solo' })];
    tables.set('Aed', rows);

    await findCanonicalId('aed', rows[0]);
    expect(findFirstSpy).toHaveBeenCalledTimes(1);
  });
});

describe('getDetail — canonicalId 를 상세에 실어 보낸다', () => {
  it('비대표 AED 상세에 대표 id 가 붙는다', async () => {
    tables.set('Aed', [aedRow({ id: 'aed-001' }), aedRow({ id: 'aed-002' })]);

    const detail = await getDetail('aed', 'aed-002');
    expect(detail?.canonicalId).toBe('aed-001');
  });

  it('대표 AED 상세는 canonicalId 가 null 이다', async () => {
    tables.set('Aed', [aedRow({ id: 'aed-001' }), aedRow({ id: 'aed-002' })]);

    const detail = await getDetail('aed', 'aed-001');
    expect(detail?.canonicalId).toBeNull();
  });

  it('참여하지 않는 카테고리 상세도 canonicalId 는 null 이다', async () => {
    tables.set('Toilet', [{
      id: 'toilet-1', name: '공중화장실', address: null, roadAddress: null,
      lat: 37.5, lng: 127, city: '서울특별시', district: '중구', bjdCode: null,
      sourceId: 's1', sourceUrl: null, viewCount: 0,
      createdAt: new Date(), updatedAt: new Date(), syncedAt: new Date(),
    }]);

    const detail = await getDetail('toilet', 'toilet-1');
    expect(detail?.canonicalId).toBeNull();
  });
});
