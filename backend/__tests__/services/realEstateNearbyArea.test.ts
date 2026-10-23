// 인근 단지 "같은 면적 최근가" — targetArea·areaDeal·recentCount3y (DB 없이 prisma mock).
//
// 고정 불변식
// - targetArea 는 상세 overview 의 defaultAreaGroup 과 같은 규칙(같은 거래 집합 → 같은 key·라벨).
// - 같은 유형 탭: 목표 면적 최신 거래, 없으면 대표 면적 + isRepresentative=true. 다른 유형 탭: 항상 대표 면적.
// - 36개월 창·취소 제외·rentType 필터는 거래 테이블 SQL 에 걸리고, 쿼리는 summary 가 고른 단지 이름으로만 좁힌다.
import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRaw: mockQueryRaw, $queryRawUnsafe: mockQueryRawUnsafe };
  return { prisma, default: prisma };
});
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  attachRealEstateCanonicalPaths: async (rows: unknown[]) => rows,
  getDeferredRealEstateIdentity: vi.fn(),
  getRealEstateCanonicalPath: vi.fn(),
  isPreservedRealEstateUrlMode: () => false,
}));

import { getNearbyByBjd } from '../../src/services/realEstateService.js';
import { makeBuildingKey } from '../../src/lib/realEstateBuildingIdentity.js';
import {
  areaGroupKey,
  buildAreaGroups,
  chooseDefaultAreaGroup,
  type BasisDeal,
} from '../../src/lib/realEstatePriceBasis.js';

// KST 2026-10-23 → 36개월 창 (2023-10-23, 2026-10-23]
const NOW = new Date('2026-10-23T03:00:00Z');
const BJD = '11680';
const DONG = '역삼동';

type Sql = Prisma.Sql | TemplateStringsArray;
function sqlText(query: Sql): string {
  return Array.isArray(query) ? (query as TemplateStringsArray).join('?') : (query as Prisma.Sql).strings.join('?');
}
function sqlValues(query: Sql, rest: unknown[]): unknown[] {
  return Array.isArray(query) ? rest : (query as Prisma.Sql).values;
}

function summaryRow(buildingName: string, over: Record<string, unknown> = {}) {
  return {
    buildingName,
    buildingKey: null,
    jibun: null,
    bjdCode: BJD,
    city: '서울특별시',
    district: '강남구',
    dongName: DONG,
    buildYear: 2010,
    transactionCount: 10,
    latestPrice: 100000n,
    monthlyRent: null,
    latestDealYear: 2026,
    latestDealMonth: 9,
    latestDealDay: 1,
    lat: null,
    lng: null,
    ...over,
  };
}

interface DealSpec {
  buildingName: string;
  area: string;
  date: string;
  cnt: number;
  price?: number;
  floor?: number | null;
  monthlyRent?: number | null;
  id?: number;
  dongName?: string;
  jibun?: string;
}

function dealRow(spec: DealSpec) {
  const [y, m, d] = spec.date.split('-').map(Number);
  return {
    id: spec.id ?? 1,
    buildingName: spec.buildingName,
    dongName: spec.dongName ?? DONG,
    jibun: spec.jibun ?? '',
    area: spec.area,
    dealYear: y,
    dealMonth: m,
    dealDay: d,
    floor: spec.floor ?? 5,
    price: BigInt(spec.price ?? 100000),
    monthlyRent: spec.monthlyRent ?? null,
    cnt: BigInt(spec.cnt),
  };
}

/** overview 가 읽는 거래 목록 → nearby targetArea 쿼리의 면적별 집계 행(같은 데이터의 두 표현). */
function aggregateTargetRows(sale: BasisDeal[], jeonse: BasisDeal[], loadFrom: string) {
  const out: Array<Record<string, unknown>> = [];
  for (const [side, deals] of [['sale', sale], ['jeonse', jeonse]] as const) {
    const byArea = new Map<string, BasisDeal[]>();
    for (const d of deals) byArea.set(d.area, [...(byArea.get(d.area) ?? []), d]);
    for (const [area, list] of byArea) {
      const latest = list.map((d) => d.date).sort().at(-1) ?? loadFrom;
      out.push({
        side,
        area,
        total: BigInt(list.length),
        recent: new Prisma.Decimal(list.filter((d) => d.date > loadFrom).length),
        latestYmd: BigInt(latest.replaceAll('-', '')),
      });
    }
  }
  return out;
}

function basis(id: number, area: string, date: string): BasisDeal {
  return { id, date, amount: 1, area, floor: null, direct: false };
}

interface Fixture {
  summary?: Partial<Record<string, ReturnType<typeof summaryRow>[]>>;
  target?: Array<Record<string, unknown>>;
  deals?: Partial<Record<string, ReturnType<typeof dealRow>[]>>;
  rawRent?: Array<Record<string, unknown>>;
}

let calls: Array<{ text: string; values: unknown[] }> = [];

function install(fx: Fixture) {
  calls = [];
  mockQueryRawUnsafe.mockImplementation(async (_sql: string, type: string) => fx.summary?.[type] ?? []);
  mockQueryRaw.mockImplementation(async (query: Sql, ...rest: unknown[]) => {
    const text = sqlText(query);
    calls.push({ text, values: sqlValues(query, rest) });
    if (text.includes('UNION ALL')) return fx.target ?? [];
    if (text.includes('AS cnt')) {
      const table = Object.keys(fx.deals ?? {}).find((name) => text.includes(name));
      return table ? fx.deals?.[table] ?? [] : [];
    }
    if (text.includes('ROW_NUMBER')) return fx.rawRent ?? [];
    return [];
  });
}

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockQueryRawUnsafe.mockReset();
});

describe('targetArea — 현재 단지 비교 면적', () => {
  it('36개월 거래 수 최다 그룹을 고른다(라벨은 정수 버림)', async () => {
    install({
      target: [
        { side: 'sale', area: '84.97', total: 5n, recent: 5n, latestYmd: 20260101n },
        { side: 'sale', area: '59.99', total: 3n, recent: 3n, latestYmd: 20260901n },
      ],
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', dongName: DONG, now: NOW });
    expect(result.targetArea).toEqual({ key: '85', label: '84' });
  });

  it('동률이면 최근 거래가 있는 그룹, 그래도 같으면 작은 key', async () => {
    install({
      target: [
        { side: 'sale', area: '84.97', total: 3n, recent: 3n, latestYmd: 20260101n },
        { side: 'sale', area: '59.99', total: 3n, recent: 3n, latestYmd: 20260901n },
      ],
    });
    const recent = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(recent.targetArea?.key).toBe('60');

    install({
      target: [
        { side: 'sale', area: '84.97', total: 3n, recent: 3n, latestYmd: 20260901n },
        { side: 'sale', area: '59.99', total: 3n, recent: 3n, latestYmd: 20260901n },
      ],
    });
    const smaller = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(smaller.targetArea?.key).toBe('60');
  });

  it('전월세 URL 은 전세 거래를 우선한다', async () => {
    install({
      target: [
        { side: 'sale', area: '84.97', total: 9n, recent: 9n, latestYmd: 20260901n },
        { side: 'jeonse', area: '59.99', total: 2n, recent: 2n, latestYmd: 20260101n },
      ],
    });
    const result = await getNearbyByBjd(BJD, 'rent', { rentType: 'jeonse', type: 'apt-rent', excludeBuildingName: '현재', now: NOW });
    expect(result.targetArea?.key).toBe('60');
  });

  it('areaKey 를 주면 그 값을 쓴다(라벨은 현재 단지 그룹 라벨)', async () => {
    install({
      target: [
        { side: 'sale', area: '84.97', total: 1n, recent: 1n, latestYmd: 20260101n },
        { side: 'sale', area: '59.99', total: 9n, recent: 9n, latestYmd: 20260901n },
      ],
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', areaKey: '85', now: NOW });
    expect(result.targetArea).toEqual({ key: '85', label: '84' });
  });

  it('type 이 없으면 targetArea 는 null 이고 targetArea 쿼리를 하지 않는다', async () => {
    install({});
    const result = await getNearbyByBjd(BJD, 'sale', { excludeBuildingName: '현재', now: NOW });
    expect(result.targetArea).toBeNull();
    expect(calls.some((c) => c.text.includes('UNION ALL'))).toBe(false);
  });

  it('같은 거래 집합이면 overview defaultAreaGroup 과 같은 key·라벨이다', async () => {
    const loadFrom = '2023-10-23';
    const sale = [
      basis(1, '84.97', '2026-01-02'), basis(2, '84.97', '2025-05-02'), basis(3, '84.40', '2024-03-02'),
      basis(4, '59.99', '2026-09-02'), basis(5, '59.99', '2026-08-02'), basis(6, '59.99', '2025-08-02'),
      basis(7, '114.80', loadFrom), basis(8, '114.80', loadFrom), basis(9, '114.80', loadFrom), basis(10, '114.80', loadFrom),
    ];
    const jeonse = [basis(11, '84.97', '2026-02-02'), basis(12, '84.97', '2026-02-03')];
    for (const [type, prefer, mode] of [['apt-sale', 'sale', 'sale'], ['apt-rent', 'jeonse', 'rent']] as const) {
      const groups = buildAreaGroups(sale, jeonse, '2026-10-23');
      const expectedKey = chooseDefaultAreaGroup(groups, sale, jeonse, prefer, '2026-10-23');
      install({ target: aggregateTargetRows(sale, jeonse, loadFrom) });
      const result = await getNearbyByBjd(BJD, mode, { type, excludeBuildingName: '현재', now: NOW });
      expect(result.targetArea?.key).toBe(expectedKey);
      expect(result.targetArea?.label).toBe(groups.find((g) => g.key === expectedKey)?.label);
    }
    // 84.40(key 84)과 84.97(key 85)의 정수 라벨이 겹치면 overview 처럼 소수 첫째 자리로 구분한다
    expect(buildAreaGroups(sale, jeonse, '2026-10-23').find((g) => g.key === areaGroupKey('84.97'))?.label).toBe('84.9');
  });

  it('SQL: 현재 단지 이름·bjdCode·동으로 좁히고 overview 와 같은 로드 창·취소 제외·전세만', async () => {
    install({});
    await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', dongName: DONG, now: NOW });
    const target = calls.find((c) => c.text.includes('UNION ALL'));
    expect(target?.text).toContain('AptSaleTransaction');
    expect(target?.text).toContain('AptRentTransaction');
    expect(target?.text).toContain('cancelDealDay');
    expect(target?.text).toContain("t.rentType = '전세'");
    expect(target?.text).not.toMatch(/WHERE[^]*STR_TO_DATE\(CONCAT\(t\.dealYear[^]*\)\s*>=/);
    expect(target?.values).toEqual(expect.arrayContaining([BJD, '현재', DONG, '2023-10-23', '2026-10-23']));
  });
});

describe('areaDeal — 인근 단지 같은 면적 최근가', () => {
  const targetRows = [{ side: 'sale', area: '84.97', total: 4n, recent: 4n, latestYmd: 20260901n }];

  it('같은 유형: 목표 면적 최신 거래 1건(isRepresentative=false)·recentCount3y 는 모든 면적 합', async () => {
    install({
      summary: { 'apt-sale': [summaryRow('이웃A')] },
      target: targetRows,
      deals: {
        AptSaleTransaction: [
          dealRow({ buildingName: '이웃A', area: '84.94', date: '2026-09-12', cnt: 3, price: 49800, floor: 1, id: 7 }),
          dealRow({ buildingName: '이웃A', area: '84.99', date: '2026-07-01', cnt: 1, price: 47000, id: 8 }),
          dealRow({ buildingName: '이웃A', area: '59.90', date: '2026-10-01', cnt: 9, price: 30000, id: 9 }),
        ],
      },
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', dongName: DONG, now: NOW });
    expect(result.apt[0].recentCount3y).toBe(13);
    expect(result.apt[0].areaDeal).toEqual({
      areaKey: '85',
      areaLabel: '84',
      isRepresentative: false,
      date: '2026-09-12',
      floor: 1,
      price: 49800,
      monthlyRent: null,
      exclusiveArea: 84.94,
    });
  });

  it('같은 유형인데 목표 면적이 없으면 대표 면적(최다) + isRepresentative=true', async () => {
    install({
      summary: { 'apt-sale': [summaryRow('이웃B')] },
      target: targetRows,
      deals: {
        AptSaleTransaction: [
          dealRow({ buildingName: '이웃B', area: '59.90', date: '2026-09-12', cnt: 2, price: 30000, id: 1 }),
          dealRow({ buildingName: '이웃B', area: '101.00', date: '2026-10-01', cnt: 1, price: 60000, id: 2 }),
        ],
      },
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(result.apt[0].areaDeal).toMatchObject({ areaKey: '60', areaLabel: '59', isRepresentative: true, price: 30000 });
  });

  it('대표 면적 동률이면 최근 거래 → 작은 key', async () => {
    install({
      summary: { 'apt-sale': [summaryRow('이웃C')] },
      target: targetRows,
      deals: {
        AptSaleTransaction: [
          dealRow({ buildingName: '이웃C', area: '59.90', date: '2026-01-12', cnt: 2, id: 1 }),
          dealRow({ buildingName: '이웃C', area: '101.00', date: '2026-10-01', cnt: 2, id: 2 }),
        ],
      },
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(result.apt[0].areaDeal?.areaKey).toBe('101');
  });

  it('다른 유형 탭은 목표 면적이 있어도 대표 면적, isRepresentative=false', async () => {
    install({
      summary: { 'villa-sale': [summaryRow('이웃빌라')] },
      target: targetRows,
      deals: {
        VillaSaleTransaction: [
          dealRow({ buildingName: '이웃빌라', area: '84.90', date: '2026-10-01', cnt: 1, id: 1 }),
          dealRow({ buildingName: '이웃빌라', area: '40.10', date: '2026-05-01', cnt: 4, price: 21000, id: 2 }),
        ],
      },
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(result.villa[0].areaDeal).toMatchObject({ areaKey: '40', isRepresentative: false, price: 21000 });
  });

  it('36개월 거래가 없으면 areaDeal=null·recentCount3y=0 (창 밖 행은 버린다)', async () => {
    install({
      summary: { 'apt-sale': [summaryRow('이웃D'), summaryRow('이웃E')] },
      target: targetRows,
      deals: {
        AptSaleTransaction: [dealRow({ buildingName: '이웃E', area: '84.90', date: '2023-10-23', cnt: 1 })],
      },
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(result.apt.map((item) => [item.recentCount3y, item.areaDeal])).toEqual([[0, null], [0, null]]);
  });

  it('SQL: summary 단지 이름 IN·bjdCode·36개월 창(2023-10-24~)·취소 제외로 거래 테이블 1회', async () => {
    install({ summary: { 'apt-sale': [summaryRow('이웃A'), summaryRow('이웃B')] }, target: targetRows });
    await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    const deals = calls.filter((c) => c.text.includes('AS cnt'));
    expect(deals).toHaveLength(1);
    expect(deals[0].text).toContain('AptSaleTransaction');
    expect(deals[0].text).toContain('buildingName IN');
    expect(deals[0].text).toContain('cancelDealDay');
    expect(deals[0].values).toEqual(expect.arrayContaining([BJD, '이웃A', '이웃B', '2023-10-24', '2026-10-23']));
  });

  it('summary 결과가 없는 유형은 거래 테이블을 읽지 않는다', async () => {
    install({ summary: { 'apt-sale': [summaryRow('이웃A')] }, target: targetRows });
    await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    const deals = calls.filter((c) => c.text.includes('AS cnt'));
    expect(deals.map((c) => c.text.includes('AptSaleTransaction'))).toEqual([true]);
  });

  it('V2 summary(buildingKey)는 같은 이름이라도 지번이 다른 거래를 섞지 않는다', async () => {
    const key = makeBuildingKey({ propertyType: 'apt', bjdCode: BJD, buildingName: '동명', dongName: DONG, jibun: '1-1' });
    install({
      summary: { 'apt-sale': [summaryRow('동명', { buildingKey: key, jibun: '1-1' })] },
      target: targetRows,
      deals: {
        AptSaleTransaction: [
          dealRow({ buildingName: '동명', area: '84.90', date: '2026-10-01', cnt: 5, jibun: '9-9', id: 1 }),
          dealRow({ buildingName: '동명', area: '84.90', date: '2026-02-01', cnt: 2, jibun: '1-1', price: 50000, id: 2 }),
        ],
      },
    });
    const result = await getNearbyByBjd(BJD, 'sale', { type: 'apt-sale', excludeBuildingName: '현재', now: NOW });
    expect(result.apt[0].recentCount3y).toBe(2);
    expect(result.apt[0].areaDeal).toMatchObject({ date: '2026-02-01', price: 50000 });
  });
});

describe('areaDeal — 전월세 rentType 반영', () => {
  const targetRows = [{ side: 'jeonse', area: '84.97', total: 4n, recent: 4n, latestYmd: 20260901n }];
  const rawRentRow = {
    buildingName: '이웃R', bjdCode: BJD, city: '서울특별시', district: '강남구', dongName: DONG, jibun: '',
    buildYear: 2015n, transactionCount: 3n, latestPrice: 50000n, monthlyRent: 0n, latestDealYear: 2026n, latestDealMonth: 9n,
  };

  it.each([
    ['jeonse', "t.rentType = '전세'"],
    ['wolse', "t.rentType = '월세'"],
  ] as const)('rentType=%s 는 거래 SQL 에 %s 를 건다', async (rentType, clause) => {
    install({ rawRent: [rawRentRow], target: targetRows });
    await getNearbyByBjd(BJD, 'rent', { rentType, type: 'apt-rent', excludeBuildingName: '현재', now: NOW });
    const deals = calls.filter((c) => c.text.includes('AS cnt'));
    expect(deals.length).toBeGreaterThan(0);
    for (const call of deals) expect(call.text).toContain(clause);
  });

  it('rentType=all 은 전세·월세 모두(rentType 조건 없음)', async () => {
    install({ summary: { 'apt-rent': [summaryRow('이웃R')] }, target: targetRows });
    await getNearbyByBjd(BJD, 'rent', { rentType: 'all', type: 'apt-rent', excludeBuildingName: '현재', now: NOW });
    const deals = calls.filter((c) => c.text.includes('AS cnt'));
    expect(deals).toHaveLength(1);
    expect(deals[0].text).not.toContain('t.rentType =');
    expect(deals[0].text).not.toContain('cancelDealDay');
  });

  it('월세 거래는 보증금·월세를 싣는다', async () => {
    install({
      rawRent: [rawRentRow],
      target: targetRows,
      deals: {
        AptRentTransaction: [
          dealRow({ buildingName: '이웃R', area: '84.90', date: '2026-08-03', cnt: 2, price: 10000, monthlyRent: 120, id: 3 }),
        ],
      },
    });
    const result = await getNearbyByBjd(BJD, 'rent', { rentType: 'wolse', type: 'apt-rent', excludeBuildingName: '현재', now: NOW });
    expect(result.apt[0].areaDeal).toMatchObject({ areaKey: '85', price: 10000, monthlyRent: 120, isRepresentative: false });
    expect(result.apt[0].recentCount3y).toBe(2);
  });
});
