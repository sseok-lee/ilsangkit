import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({ $queryRaw: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: db }));

import {
  selectRegisterRows,
  summarizeRegister,
  resolveBjdongCode,
  findBuildingRegister,
  type RegisterTitle,
  type RegisterUnit,
} from '../../src/services/buildingRegisterMatcher.js';

function t(overrides: Partial<RegisterTitle>): RegisterTitle {
  return {
    bldNm: '대원빌라3단지', dongNm: null, mainPurpsCdNm: '공동주택', etcPurps: '연립주택',
    hhldCnt: 0, hoCnt: 0, grndFlrCnt: 4, ugrndFlrCnt: 1, elevatorCnt: 0, parkingCnt: 0,
    useAprDay: '19941108', strctCdNm: '철근콘크리트구조', ...overrides,
  };
}

// 야탑동 177 (2026-10-29 API 실측): 주거 9개 동 216세대 + 경비실·지하주차장·근린상가동
const YATAP_177: RegisterTitle[] = [
  ...[['301동', 16], ['302동', 32], ['303동', 16], ['304동', 32], ['305동', 24], ['306동', 24], ['307동', 16], ['308동', 16], ['309동', 40]]
    .map(([dongNm, hhldCnt]) => t({ dongNm: dongNm as string, hhldCnt: hhldCnt as number })),
  t({ dongNm: null, etcPurps: '경비실', grndFlrCnt: 1, ugrndFlrCnt: 0 }),
  t({ dongNm: null, etcPurps: '지하주차장', grndFlrCnt: 0, ugrndFlrCnt: 1 }),
  t({ dongNm: '근린상가동', mainPurpsCdNm: '공동주택', etcPurps: '구매시설.생활시설.의료시설', grndFlrCnt: 1 }),
];

const offitel = (overrides: Partial<RegisterTitle> = {}): RegisterTitle => t({
  bldNm: '아크로텔 강남역', dongNm: null, mainPurpsCdNm: '업무시설', etcPurps: '업무시설(오피스텔)-471호,근린생활시설-69호',
  hhldCnt: 0, hoCnt: 540, grndFlrCnt: 20, ugrndFlrCnt: 6, elevatorCnt: 3, parkingCnt: 180, useAprDay: '20160729', ...overrides,
});
const ACROTEL_UNITS: RegisterUnit[] = [{ bldNm: '아크로텔 강남역', dongNm: '', offitelUnits: 471, totalUnits: 540 }];

describe('selectRegisterRows', () => {
  it('지번 이름이 한 종류면 국토부 이름과 달라도 주거 동을 모두 고른다 (야탑동 177)', () => {
    const picked = selectRegisterRows('residential', YATAP_177, [], '목련마을자영빌라');
    expect(picked?.titles.map((r) => r.dongNm)).toEqual(['301동', '302동', '303동', '304동', '305동', '306동', '307동', '308동', '309동']);
    expect(picked?.nameFiltered).toBe(false);
  });

  it('이름이 여러 종류면 상세 이름과 맞는 쪽만', () => {
    const rows = [
      ...['101동', '102동'].map((d) => t({ bldNm: '탑마을(경향)', dongNm: d, hhldCnt: 20 })),
      ...['201동'].map((d) => t({ bldNm: '탑마을(선경)', dongNm: d, hhldCnt: 30 })),
    ];
    const picked = selectRegisterRows('residential', rows, [], '탑마을(경향)');
    expect(picked?.titles.map((r) => r.dongNm)).toEqual(['101동', '102동']);
    expect(picked?.nameFiltered).toBe(true);
    expect(selectRegisterRows('residential', rows, [], '탑마을')).toBeNull();
    expect(selectRegisterRows('residential', rows, [], '야탑빌라')).toBeNull();
  });

  it('주거 행이 없으면(근생 건물) null', () => {
    expect(selectRegisterRows('residential', [t({ hhldCnt: 0, etcPurps: '근린생활시설' })], [], '어떤빌딩')).toBeNull();
  });

  it('아파트·빌라 상세에 오피스텔 행만 있으면 null', () => {
    expect(selectRegisterRows('residential', [offitel()], ACROTEL_UNITS, '아크로텔 강남역')).toBeNull();
  });

  it('빌라 상세에 세대 행과 오피스텔(주거용) 행이 섞이면 세대 행만', () => {
    const rows = [t({ bldNm: '방배노블루체서리풀', dongNm: 'A동', hhldCnt: 12 }), offitel({ bldNm: '방배노블루체서리풀', dongNm: 'B동' })];
    expect(selectRegisterRows('residential', rows, [], '방배노블루체서리풀')?.titles.map((r) => r.dongNm)).toEqual(['A동']);
  });

  it('오피스텔 상세는 오피스텔 행과 호수 집계를 고른다', () => {
    const picked = selectRegisterRows('offitel', [offitel(), t({ bldNm: '아크로텔 강남역', etcPurps: '근린생활시설', mainPurpsCdNm: '제1종근린생활시설' })], ACROTEL_UNITS, '아크로텔강남역');
    expect(picked?.titles).toHaveLength(1);
    expect(picked?.units).toEqual(ACROTEL_UNITS);
  });

  it('오피스텔 상세에 오피스텔 행이 없으면 null', () => {
    expect(selectRegisterRows('offitel', YATAP_177, [], '목련마을자영빌라')).toBeNull();
  });
});

describe('summarizeRegister', () => {
  it('야탑동 177', () => {
    const picked = selectRegisterRows('residential', YATAP_177, [], '목련마을자영빌라')!;
    expect(summarizeRegister('residential', picked, null, '2026-09', null)).toEqual({
      kind: 'residential', householdCount: 216, offitelUnitCount: null, dongCount: 9, topFloor: 4, basementFloors: 1,
      useApprovalDate: '1994-11-08', totalParking: null, elevatorCount: 0, purposes: ['연립주택'],
      structure: '철근콘크리트구조', sourceMonth: '2026-09', unitSourceMonth: null,
    });
  });

  it('동 이름이 비어 있는 1동 건물은 동수 1', () => {
    const picked = selectRegisterRows('residential', [t({ bldNm: '서초동아아파트', etcPurps: '아파트', hhldCnt: 12, grndFlrCnt: 7 })], [], '서초동아')!;
    expect(summarizeRegister('residential', picked, null, '2026-09', null)).toMatchObject({ householdCount: 12, dongCount: 1, topFloor: 7, purposes: ['아파트'] });
  });

  it('총괄이 1개이고 이름 필터가 없으면 세대수·주차는 총괄 값', () => {
    const picked = selectRegisterRows('residential', YATAP_177, [], '목련마을자영빌라')!;
    expect(summarizeRegister('residential', picked, { hhldCnt: 216, totPkngCnt: 206, useAprDay: '19941108' }, '2026-09', null))
      .toMatchObject({ householdCount: 216, totalParking: 206 });
  });

  it('이름 필터가 걸리면 총괄은 쓰지 않는다', () => {
    const rows = [t({ bldNm: '탑마을(경향)', dongNm: '101동', hhldCnt: 20, parkingCnt: 15 }), t({ bldNm: '탑마을(선경)', dongNm: '201동', hhldCnt: 30 })];
    const picked = selectRegisterRows('residential', rows, [], '탑마을(경향)')!;
    expect(summarizeRegister('residential', picked, { hhldCnt: 50, totPkngCnt: 99, useAprDay: null }, '2026-09', null))
      .toMatchObject({ householdCount: 20, totalParking: 15 });
  });

  it('오피스텔 호수는 호실 집계, 없으면 null 이고 다른 값은 그대로', () => {
    const picked = selectRegisterRows('offitel', [offitel()], ACROTEL_UNITS, '아크로텔 강남역')!;
    expect(summarizeRegister('offitel', picked, null, '2026-09', '2026-09')).toMatchObject({
      kind: 'offitel', householdCount: null, offitelUnitCount: 471, topFloor: 20, elevatorCount: 3, totalParking: 180,
      purposes: ['오피스텔'], unitSourceMonth: '2026-09',
    });
    const noUnits = selectRegisterRows('offitel', [offitel()], [], '아크로텔 강남역')!;
    expect(summarizeRegister('offitel', noUnits, null, '2026-09', '2026-09')).toMatchObject({
      offitelUnitCount: null, unitSourceMonth: null, topFloor: 20, useApprovalDate: '2016-07-29',
    });
  });

  it('보여 줄 값이 하나도 없으면 null', () => {
    const picked = { titles: [t({ hhldCnt: 0, grndFlrCnt: null, useAprDay: null })], units: [], nameFiltered: false };
    expect(summarizeRegister('residential', picked, null, '2026-09', null)).toBeNull();
  });
});

describe('resolveBjdongCode', () => {
  beforeEach(() => vi.clearAllMocks());

  it('전체 이름이 맞으면 그 코드', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ bjdongCode: '10600' }]);
    expect(await resolveBjdongCode('27260', '수성동4가')).toBe('10600');
  });

  it('전체 이름이 없으면 마지막 토큰', async () => {
    db.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ bjdongCode: '25021' }]);
    expect(await resolveBjdongCode('43113', '오송읍 서평리')).toBe('25021');
    expect(db.$queryRaw.mock.calls[1][0].values).toEqual(['43113', '서평리']);
  });

  it('코드가 둘이면 null', async () => {
    db.$queryRaw.mockResolvedValueOnce([{ bjdongCode: '1' }, { bjdongCode: '2' }]);
    expect(await resolveBjdongCode('11650', '서초동')).toBeNull();
  });
});

describe('findBuildingRegister', () => {
  beforeEach(() => vi.clearAllMocks());

  /** SQL 문으로 응답을 고른다 */
  function mockDb(byParcel: Record<string, RegisterTitle[]>) {
    db.$queryRaw.mockImplementation((query: { strings: string[]; values: unknown[] }) => {
      const sql = query.strings.join('?');
      if (sql.includes('BuildingRegisterSourceFile')) return Promise.resolve([{ taskCode: '0303', sourceMonth: '2026-09' }, { taskCode: '0306', sourceMonth: '2026-09' }]);
      if (sql.includes('BuildingRegisterDong')) return Promise.resolve([{ bjdongCode: '10700' }]);
      if (sql.includes('BuildingRegisterTitle')) return Promise.resolve(byParcel[`${query.values[3]}-${query.values[4]}`] ?? []);
      return Promise.resolve([]);
    });
  }

  const base = { kind: 'residential' as const, sggCode: '41135', buildingName: '목련마을자영빌라', addresses: [] };

  it('지번 파싱이 안 되면 null', async () => {
    mockDb({});
    expect(await findBuildingRegister({ ...base, primaryAddress: { dongName: '야탑동', jibun: '가-240' } })).toBeNull();
  });

  it('주 주소로 찾는다', async () => {
    mockDb({ '0177-0000': YATAP_177 });
    expect(await findBuildingRegister({ ...base, primaryAddress: { dongName: '야탑동', jibun: '177' } }))
      .toMatchObject({ householdCount: 216, dongCount: 9, sourceMonth: '2026-09' });
  });

  it('주 주소가 비면 주소 후보, 후보 둘이 다른 지번을 가리키면 null', async () => {
    mockDb({ '0177-0000': YATAP_177, '0178-0000': YATAP_177 });
    expect(await findBuildingRegister({
      ...base, primaryAddress: null,
      addresses: [{ dongName: '야탑동', jibun: '177' }, { dongName: '야탑동', jibun: '178' }],
    })).toBeNull();
    expect(await findBuildingRegister({ ...base, primaryAddress: null, addresses: [{ dongName: '야탑동', jibun: '177' }] }))
      .toMatchObject({ householdCount: 216 });
  });
});
