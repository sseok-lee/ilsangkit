import { Prisma } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRaw: mockQueryRaw };
  return { prisma, default: prisma };
});

import {
  findKaptComplex,
  sumRawCounts,
  formatApprovalDate,
  parseParcel,
  splitDongName,
  dongMatches,
  normalizeComplexName,
  nameNumbers,
  isNameMatch,
  roadKey,
} from '../../src/services/kaptComplexMatcher.js';

describe('parseParcel', () => {
  it('본번·부번·산 지번을 파싱한다', () => {
    expect(parseParcel('649')).toEqual({ isMountain: false, mainNo: 649, subNo: 0 });
    expect(parseParcel('649-1')).toEqual({ isMountain: false, mainNo: 649, subNo: 1 });
    expect(parseParcel('산12-3')).toEqual({ isMountain: true, mainNo: 12, subNo: 3 });
    expect(parseParcel(' 0649-0001 ')).toEqual({ isMountain: false, mainNo: 649, subNo: 1 });
  });

  it('블록·가지번·빈 값은 null', () => {
    expect(parseParcel('가-240')).toBeNull();
    expect(parseParcel('BL')).toBeNull();
    expect(parseParcel('')).toBeNull();
    expect(parseParcel(null)).toBeNull();
    expect(parseParcel(undefined)).toBeNull();
    expect(parseParcel('0')).toBeNull();
  });
});

describe('splitDongName / dongMatches', () => {
  it('읍 리 두 토큰을 나눈다', () => {
    expect(splitDongName('오송읍 서평리')).toEqual({ eupmyeon: '오송읍', dongri: '서평리' });
    expect(splitDongName('개포동')).toEqual({ eupmyeon: null, dongri: '개포동' });
  });

  it('dongri 가 같으면 연결, 읍면이 다르면 불연결', () => {
    expect(dongMatches(splitDongName('개포동'), { eupmyeon: null, dongri: '개포동' })).toBe(true);
    expect(dongMatches(splitDongName('오송읍 서평리'), { eupmyeon: '오송읍', dongri: '서평리' })).toBe(true);
    expect(dongMatches(splitDongName('강내면 서평리'), { eupmyeon: '오송읍', dongri: '서평리' })).toBe(false);
    expect(dongMatches(splitDongName('구로동'), { eupmyeon: null, dongri: '개봉동' })).toBe(false);
  });

  it('K-apt dongri 가 비면 eupmyeon 과 비교한다', () => {
    expect(dongMatches(splitDongName('오송읍'), { eupmyeon: '오송읍', dongri: null })).toBe(true);
    expect(dongMatches(splitDongName('오송읍'), { eupmyeon: '오송읍', dongri: '' })).toBe(true);
  });
});

describe('normalizeComplexName / nameNumbers', () => {
  it('표기를 통일한다', () => {
    expect(normalizeComplexName('천안두정엘에이치2단지')).toBe(normalizeComplexName('천안두정 LH2단지'));
    expect(normalizeComplexName('테헤란아이파크')).toBe(normalizeComplexName('테헤란 IPARK'));
    expect(normalizeComplexName("테헤란 I'PARK")).toBe(normalizeComplexName('테헤란아이파크'));
    expect(normalizeComplexName('e편한세상 수지')).toBe(normalizeComplexName('이-편한세상수지'));
    expect(normalizeComplexName('래미안 플래티넘')).toBe(normalizeComplexName('래미안플레티넘'));
    expect(normalizeComplexName('에스케이뷰')).toBe(normalizeComplexName('SK뷰'));
    expect(normalizeComplexName('개포경남아파트')).toBe('개포경남');
    expect(normalizeComplexName('고척아이파크(주상복합)')).toBe('고척ipark');
  });

  it('숫자 열을 뽑고 로마 숫자를 환산한다', () => {
    expect(nameNumbers('크라운빌Ⅱ')).toEqual(['2']);
    expect(nameNumbers('해운대자이2단지')).toEqual(['2']);
    expect(nameNumbers('해운대자이')).toEqual([]);
    expect(nameNumbers('수서1-1단지(임대)')).toEqual(['1', '1']);
  });
});

describe('isNameMatch (스펙 §4.3 실제 사례)', () => {
  const cases: Array<[string, number, string, string, boolean]> = [
    ['동일센타시아', 2024, '남구로역 동일센타시아', '20240115', true],
    ['천안두정엘에이치2단지', 2022, '천안두정 LH2단지', '20220301', true],
    ['테헤란아이파크', 2014, '테헤란 IPARK', '20140520', true],
    ['크라운빌Ⅱ', 2021, '크라운빌', '20150101', false],
    ['해운대자이2단지', 2013, '해운대자이', '20130101', false],
    ['센텀리슈빌2단지', 2019, '센텀리슈빌', '20170101', false],
  ];
  it.each(cases)('%s(%i) ↔ %s → %s', (localName, buildYear, kaptName, approval, expected) => {
    expect(isNameMatch({ name: localName, buildYear }, { name: kaptName, useApprovalDate: approval })).toBe(expected);
  });

  it('연식이 한쪽이라도 없으면 불연결', () => {
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: null }, { name: '테헤란 IPARK', useApprovalDate: '20140520' })).toBe(false);
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: 2014 }, { name: '테헤란 IPARK', useApprovalDate: null })).toBe(false);
  });

  it('연식 차이 1년은 허용, 2년은 불연결', () => {
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: 2015 }, { name: '테헤란 IPARK', useApprovalDate: '20140520' })).toBe(true);
    expect(isNameMatch({ name: '테헤란아이파크', buildYear: 2016 }, { name: '테헤란 IPARK', useApprovalDate: '20140520' })).toBe(false);
  });

  it('정규화 이름 2자 이하는 포함 매칭을 허용하지 않는다', () => {
    expect(isNameMatch({ name: '삼익', buildYear: 1990 }, { name: '서초삼익', useApprovalDate: '19900101' })).toBe(false);
    expect(isNameMatch({ name: '삼익', buildYear: 1990 }, { name: '삼익아파트', useApprovalDate: '19900101' })).toBe(true);
  });
});

const sqlText = (query: unknown) => (query as Prisma.Sql).strings.join('?');

const GAEPO_ROW = {
  kaptCode: 'A13580602', name: '개포경남아파트', householdCount: 678, dongCount: 9, topFloor: 15, basementFloors: 0,
  useApprovalDate: '19840308', totalParking: 747, groundParking: 747, undergroundParking: 0,
  heatingType: '지역난방', corridorType: '계단식', builder: '경남건설', developer: '경남건설',
  managementType: '위탁관리', saleType: '분양', cctvCount: 102,
  raw: {
    '승강기(승객용)': '26', '승강기(화물용)': '0', '승강기(승객+화물)': '0', '승강기(장애인)': '0',
    '승강기(비상용)': '0', '승강기(기타)': '0',
    '전기차 충전시설 설치대수(지상)': '9', '전기차 충전시설 설치대수(지하)': '0',
  },
};

/** SQL 종류로 응답을 고른다: 필지 주소·이름 후보·단지·면적·기준일 */
function routeQueries(routes: { address?: unknown[][]; name?: unknown[]; complex?: unknown[] }) {
  const addressQueue = [...(routes.address ?? [])];
  mockQueryRaw.mockImplementation(async (query: unknown) => {
    const sql = sqlText(query);
    if (sql.includes('p.mainNo')) return addressQueue.shift() ?? [];
    if (sql.includes('FROM KaptComplexParcel')) return routes.name ?? [];
    if (sql.includes('FROM KaptComplexArea')) return [{ exclusiveArea: new Prisma.Decimal('96.98'), householdCount: 166 }];
    if (sql.includes('FROM KaptSourceFile')) return [{ fileDate: '2026-10-26' }];
    if (sql.includes('FROM KaptComplex')) return routes.complex ?? [{ ...GAEPO_ROW, kaptCode: (query as Prisma.Sql).values[0] }];
    return [];
  });
}

const BASE_INPUT = {
  sggCode: '11680',
  primaryAddress: { dongName: '개포동', jibun: '649' },
  addresses: [{ dongName: '개포동', jibun: '649' }],
  buildingName: '개포경남',
  buildYear: 1984,
};

const candidate = (kaptCode: string, name = '개포경남아파트', dongri = '개포동', useApprovalDate = '19840308', roadAddress: string | null = null) => ({
  kaptCode, name, eupmyeon: null, dongri, useApprovalDate, roadAddress,
});

describe('findKaptComplex', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('주소로 1곳이면 address 매칭과 변환된 필드를 돌려준다', async () => {
    routeQueries({ address: [[candidate('A13580602')]] });
    const info = await findKaptComplex(BASE_INPUT);
    expect(info).toMatchObject({
      matchType: 'address', kaptCode: 'A13580602', householdCount: 678, useApprovalDate: '1984-03-08',
      elevatorCount: 26, evChargerCount: 9, cctvCount: 102, sourceDate: '2026-10-26',
      areas: [{ exclusiveArea: 96.98, householdCount: 166 }],
    });
    const addressSql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(addressSql).toContain('k.active = true');
  });

  it('같은 필지에 단지 2곳이고 도로명이 없으면 null 이고 이름으로 넘어가지 않는다', async () => {
    routeQueries({
      address: [[candidate('A1', '수서1-1단지(임대)', '수서동'), candidate('A2', '수서', '수서동')]],
      name: [candidate('A2', '수서', '수서동', '19920101')],
    });
    const info = await findKaptComplex({ ...BASE_INPUT, buildingName: '수서', buildYear: 1992, primaryAddress: { dongName: '수서동', jibun: '700' }, addresses: [] });
    expect(info).toBeNull();
  });

  it('법정동이 다른 필지 후보는 버린다', async () => {
    routeQueries({ address: [[candidate('A1', '개포경남아파트', '일원동')], []] });
    expect(await findKaptComplex(BASE_INPUT)).toBeNull();
  });

  it('주소 0곳이고 이름으로 1곳이면 name 매칭', async () => {
    routeQueries({
      address: [[], []],
      name: [candidate('A13580602'), candidate('A9', '개포우성', '개포동', '19870101')],
    });
    const info = await findKaptComplex(BASE_INPUT);
    expect(info?.matchType).toBe('name');
    expect(info?.kaptCode).toBe('A13580602');
  });

  it('지번이 블록이면 주소 조회 없이 이름 매칭만 한다', async () => {
    routeQueries({ name: [candidate('A13580602')] });
    const info = await findKaptComplex({ ...BASE_INPUT, primaryAddress: { dongName: '개포동', jibun: 'BL' }, addresses: [{ dongName: '개포동', jibun: '가-240' }] });
    expect(info?.matchType).toBe('name');
    expect(mockQueryRaw.mock.calls.some(([q]) => sqlText(q).includes('p.mainNo'))).toBe(false);
  });

  it('1순위 주소가 0곳이면 개요 주소 후보들이 같은 단지를 가리킬 때만 채택', async () => {
    routeQueries({ address: [[], [candidate('A1')], [candidate('A2')]] });
    const info = await findKaptComplex({ ...BASE_INPUT, addresses: [{ dongName: '개포동', jibun: '650' }, { dongName: '개포동', jibun: '651' }] });
    expect(info).toBeNull();
  });

  it('시군구 코드가 5자리가 아니면 조회하지 않는다', async () => {
    expect(await findKaptComplex({ ...BASE_INPUT, sggCode: '' })).toBeNull();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});

describe('sumRawCounts / formatApprovalDate', () => {
  it('빈 칸만 있으면 null, 문자열 JSON 도 읽는다', () => {
    expect(sumRawCounts({ a: '', b: null }, ['a', 'b'])).toBeNull();
    expect(sumRawCounts('{"a":"3","b":"2"}', ['a', 'b'])).toBe(5);
    expect(sumRawCounts({ a: '0' }, ['a'])).toBe(0);
  });
  it('YYYYMMDD 만 변환한다', () => {
    expect(formatApprovalDate('19840308')).toBe('1984-03-08');
    expect(formatApprovalDate('1984')).toBeNull();
    expect(formatApprovalDate(null)).toBeNull();
  });
});

describe('roadKey', () => {
  it('도로명+건물번호만 남긴다', () => {
    expect(roadKey('서울특별시 강남구 개포로109길 9')).toBe('개포로109길 9')
    expect(roadKey('개포로109길 9')).toBe('개포로109길 9')
    expect(roadKey('서울특별시 강남구 개포로 264 (개포동)')).toBe('개포로 264')
    expect(roadKey('세종특별자치시 한누리대로 0350-01')).toBe('한누리대로 350-1')
    expect(roadKey('')).toBeNull()
    expect(roadKey(null)).toBeNull()
  });
});

describe('findKaptComplex 도로명 단계 (개포동 12 실제 사례)', () => {
  const GAEPO12 = [
    candidate('A13524009', '개포대치2단지', '개포동', '19921014', '서울특별시 강남구 개포로109길 9'),
    candidate('A13593908', 'SH공사대치1단지', '개포동', '19911120', '서울특별시 강남구 개포로109길 5'),
    candidate('A13594007', '대청', '개포동', '19921014', '서울특별시 강남구 개포로109길 21'),
  ];
  const input = (roadName: string | null) => ({
    ...BASE_INPUT,
    buildingName: '성원대치2단지아파트',
    buildYear: 1992,
    primaryAddress: { dongName: '개포동', jibun: '12', roadName: null },
    addresses: [{ dongName: '개포동', jibun: '12', roadName }],
  });
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('같은 필지 여러 단지는 도로명 건물번호로 고른다', async () => {
    routeQueries({ address: [GAEPO12, GAEPO12], name: GAEPO12 });
    const info = await findKaptComplex(input('개포로109길 9'));
    expect(info?.matchType).toBe('road');
    expect(info?.kaptCode).toBe('A13524009');
  });

  it('도로명이 필지 후보 밖 단지를 가리키면 null', async () => {
    const other = candidate('A9', '다른단지', '개포동', '19921014', '서울특별시 강남구 개포로109길 9');
    routeQueries({ address: [GAEPO12.slice(1), GAEPO12.slice(1)], name: [...GAEPO12.slice(1), other] });
    expect(await findKaptComplex(input('개포로109길 9'))).toBeNull();
  });

  it('지번 1곳과 도로명 1곳이 서로 다르면 null', async () => {
    routeQueries({ address: [[GAEPO12[2]]], name: GAEPO12 });
    expect(await findKaptComplex(input('개포로109길 9'))).toBeNull();
  });

  it('지번 1곳과 도로명이 같거나 도로명 후보가 없으면 address', async () => {
    routeQueries({ address: [[GAEPO12[0]]], name: GAEPO12 });
    expect((await findKaptComplex(input('개포로109길 9')))?.matchType).toBe('address');
    routeQueries({ address: [[GAEPO12[0]]], name: GAEPO12 });
    expect((await findKaptComplex(input('없는로 1')))?.matchType).toBe('address');
  });

  it('지번 후보 0곳이면 도로명 1곳으로 연결한다', async () => {
    routeQueries({ address: [[], []], name: GAEPO12 });
    const info = await findKaptComplex({ ...input('개포로109길 21'), buildingName: '삼익대청아파트' });
    expect(info?.matchType).toBe('road');
    expect(info?.kaptCode).toBe('A13594007');
  });

  it('도로명이 단지 여러 곳을 가리키면 이름으로 넘기지 않고 null', async () => {
    const twin = candidate('A8', '개포대치2단지', '개포동', '19921014', '서울특별시 강남구 개포로109길 9');
    routeQueries({ address: [[], []], name: [...GAEPO12, twin] });
    expect(await findKaptComplex({ ...input('개포로109길 9'), buildingName: '개포대치2단지' })).toBeNull();
  });
});

describe('findKaptComplex 도로명 보조 규칙', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });
  const FIRST_WORLD = [
    candidate('A10020509', '더샵일산퍼스트월드1단지', '풍동', '20100601', '경기도 고양시 일산동구 고풍로 161'),
    candidate('A10020501', '더샵일산퍼스트월드2단지', '풍동', '20100601', '경기도 고양시 일산동구 고풍로 109'),
  ];

  it('도로명과 이름이 서로 다른 단지를 가리키면 null', async () => {
    routeQueries({ name: FIRST_WORLD });
    const info = await findKaptComplex({
      sggCode: '41285', primaryAddress: { dongName: '풍동', jibun: '가-', roadName: null },
      addresses: [{ dongName: '풍동', jibun: '가-', roadName: '고풍로 161' }],
      buildingName: '더샵일산퍼스트월드2단지', buildYear: 2010,
    });
    expect(info).toBeNull();
  });

  it('합치기 전 도로명(roadNames)도 쓴다', async () => {
    const kangchon = candidate('A14003106', '이촌강촌아파트', '이촌동', '19980101', '서울특별시 용산구 이촌로87길 14');
    routeQueries({ address: [[], []], name: [kangchon] });
    const info = await findKaptComplex({
      sggCode: '11170', primaryAddress: { dongName: '이촌동', jibun: '402', roadName: null },
      addresses: [{ dongName: '이촌동', jibun: '402', roadName: '이촌로87길 13' }],
      roadNames: ['이촌로87길 13', '이촌로87길 14'],
      buildingName: '강촌', buildYear: 1998,
    });
    expect(info?.matchType).toBe('road');
    expect(info?.kaptCode).toBe('A14003106');
  });
});
