import { Prisma } from '@prisma/client';
import { kstCalendarToday } from '../lib/kstDate.js';
import { overviewDateThrough, saleNotCanceled } from '../lib/realEstateDealSql.js';
import { prisma } from '../lib/prisma.js';
import type {
  BuildingKey,
  DealKind,
  DealScope,
  DealSnapshot,
  LatestDeals,
  PropertyType,
} from '../types/realEstateExploration.js';

const tables = {
  apt: { sale: 'AptSaleTransaction', rent: 'AptRentTransaction' },
  villa: { sale: 'VillaSaleTransaction', rent: 'VillaRentTransaction' },
  offitel: { sale: 'OffitelSaleTransaction', rent: 'OffitelRentTransaction' },
} as const;

type SourceTableKind = 'sale' | 'rent';
type TransactionTable = (typeof tables)[PropertyType][SourceTableKind];
type RawLatestDealRow = {
  buildingName: string;
  bjdCode: string;
  dongName: string;
  jibun: string | null;
  rentType?: string | null;
  dealAmount?: number | bigint | null;
  deposit?: number | bigint | null;
  monthlyRent?: number | null;
  exclusiveArea?: number | string | Prisma.Decimal | null;
  floor: number | null;
  dealYear: number;
  dealMonth: number;
  dealDay: number | null;
};

export function latestDealsKey(key: BuildingKey): string {
  const hasAddress = hasAddressComponents(key);
  return JSON.stringify([
    key.propertyType,
    key.buildingName,
    key.bjdCode,
    hasAddress ? 'address' : 'legacy',
    hasAddress ? key.dongName?.trim() ?? '' : '',
    hasAddress ? key.jibun?.trim() ?? '' : '',
  ]);
}

function hasAddressComponents(key: BuildingKey): boolean {
  return Object.prototype.hasOwnProperty.call(key, 'dongName')
    || Object.prototype.hasOwnProperty.call(key, 'jibun');
}

/** 전용면적(㎡) 범위 — 하한 초과 ~ 상한 이하, null 은 열린 끝. */
export interface AreaRange {
  min: number | null;
  max: number | null;
}

export interface LatestDealsOptions {
  /** 백필 재개 시 최초 실행의 기준일을 유지한다. */
  dateThrough?: string;
  /**
   * 주면 "그 면적 구간 안에서의" 최근 거래를 고른다(지도 면적 필터). 없으면 기존과 같은 SQL 이다.
   * 갈래마다 같은 인덱스 역방향 스캔에 면적 조건만 더해, 조건에 맞는 첫 행에서 멈춘다.
   */
  area?: AreaRange | null;
}

export async function getLatestDeals(
  keys: readonly BuildingKey[],
  scope: DealScope,
  options: LatestDealsOptions = {},
): Promise<Map<string, LatestDeals>> {
  const result = new Map<string, LatestDeals>();
  for (const key of keys) {
    result.set(latestDealsKey(key), emptyLatestDeals());
  }
  if (keys.length === 0) return result;

  const today = options.dateThrough ?? kstCalendarToday().toISOString().slice(0, 10);
  const grouped = groupKeysByProperty(keys);
  for (const [propertyType, propertyKeys] of grouped) {
    if (scope === 'sale' || scope === 'all') {
      const rows = await prisma.$queryRaw<RawLatestDealRow[]>(
        latestSaleSql(propertyType, propertyKeys, today, options.area ?? null),
      );
      applyRows(result, propertyType, rows, 'sale');
    }
    if (scope === 'rent' || scope === 'all') {
      const rows = await prisma.$queryRaw<RawLatestDealRow[]>(
        latestRentSql(propertyType, propertyKeys, today, options.area ?? null),
      );
      applyRows(result, propertyType, rows, 'rent');
    }
  }

  return result;
}

function emptyLatestDeals(): LatestDeals {
  return { sale: null, jeonse: null, wolse: null };
}

function groupKeysByProperty(keys: readonly BuildingKey[]): Map<PropertyType, BuildingKey[]> {
  const grouped = new Map<PropertyType, BuildingKey[]>();
  const seen = new Set<string>();
  for (const key of keys) {
    const dedupeKey = latestDealsKey(key);
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    const propertyKeys = grouped.get(key.propertyType) ?? [];
    propertyKeys.push(key);
    grouped.set(key.propertyType, propertyKeys);
  }
  return grouped;
}

// ── 단지별 최근 거래 1건 ─────────────────────────────────────────────
// 옛 구현은 후보 단지들의 전 기간 거래를 모두 읽어
//   ROW_NUMBER() OVER (PARTITION BY buildingName, bjdCode, TRIM(dongName), COALESCE(TRIM(jibun), '') [, rentType]
//                      ORDER BY dealYear DESC, dealMonth DESC, dealDay IS NULL ASC, dealDay DESC, id DESC)
// 로 정렬했다(운영 1.7~3.2s, 매번 디스크 임시 테이블 → 2026-10-25 MySQL tmpdir 가득 참).
// 지금은 같은 파티션마다 (SELECT … ORDER BY … LIMIT 1) 를 UNION ALL 로 묶어 왕복 1회로 읽는다.
//
// 결과가 옛 구현과 같은 근거:
// 1) 파티션 ↔ 키: 주소형 키(dongName·jibun 속성 보유)의 조건은 파티션 식 네 개 전부에 대한 등호다.
//    등호와 PARTITION BY 는 같은 컬럼 콜레이션으로 비교하므로, 이 조건을 만족하는 행은 정확히
//    파티션 하나를 이룬다(다른 키 조건으로 들어온 행이 그 파티션에 섞여도 그 행 역시 이 조건을 만족).
//    → 주소형 키 하나 = 파티션 하나 = LIMIT 1 한 갈래. 옛 형식 키(bjdCode·buildingName 만)는 한 키에
//    동·지번이 다른 여러 파티션이 걸리므로 그 키들만 옛 창 함수 갈래를 그대로 쓴다(현재 호출처는 모두
//    주소형 키를 넘겨 이 갈래는 운영에서 타지 않는다).
// 2) 갈래 안 정렬: MySQL 은 DESC 정렬에서 NULL 을 맨 뒤에 둔다. 그래서
//    `dealDay DESC` 는 옛 `dealDay IS NULL ASC, dealDay DESC` 와 같은 순서다. id 는 PK 라 전순서가 되어
//    두 방식이 고르는 행이 하나로 같다. [buildingName, bjdCode, dealYear, dealMonth, dealDay] 인덱스는
//    끝에 PK(id)가 붙어 있어 역방향 범위 스캔이 이 순서를 그대로 내고 첫 유효 행에서 멈춘다.
//    id DESC 는 그 자연 순서에 기대지 않도록 명시한다.
// 3) 필터: 취소 제외·금액·기준일(그리고 전월세 종류별 조건)은 갈래마다 옛 WHERE 와 같은 식을 쓴다.
//    전월세는 옛 파티션에 rentType 이 들어 있으므로 전세·월세 갈래를 따로 둔다.
// 4) 행 순서: applyRows 는 같은 단지 묶음에 여러 행이 오면 마지막 행이 이긴다(옛 형식 키 등).
//    옛 쿼리는 창 함수 정렬(파티션 식 오름차순) 순서로 행을 냈으므로 바깥 ORDER BY 로 그 순서를 재현한다.
//    같은 파티션이 두 갈래에서 나오면(대소문자만 다른 키, 옛 형식+주소형 키 겹침) 같은 행이 인접해
//    두 번 적용될 뿐이라 결과는 같다.

const LATEST_DEAL_ORDER = Prisma.sql`ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC, t.id DESC`;

// [buildingName, bjdCode, dealYear, dealMonth, dealDay] 인덱스(Prisma 생성 이름, 64자 잘림 포함).
// 옵티마이저는 큰 단지(예: 거래 1천 건)에서도 [bjdCode, buildingName] + filesort 를 고르곤 해
// 단지 거래를 전부 읽는다(로컬 헬리오시티 매매 991행·7~70ms → 힌트 시 역방향 1행·1ms).
// 옵티마이저 힌트는 FORCE INDEX 와 달리 이름이 없으면 경고만 내고 무시되므로, 환경마다 인덱스
// 이름이 달라도 쿼리가 깨지지 않고 결과도 같다(속도만 힌트 이전으로 돌아간다).
export const LATEST_DEAL_INDEX: Record<TransactionTable, string> = {
  AptSaleTransaction: 'AptSaleTransaction_buildingName_bjdCode_dealYear_dealMonth_d_idx',
  AptRentTransaction: 'AptRentTransaction_buildingName_bjdCode_dealYear_dealMonth_d_idx',
  VillaSaleTransaction: 'VillaSaleTransaction_buildingName_bjdCode_dealYear_dealMonth_idx',
  VillaRentTransaction: 'VillaRentTransaction_buildingName_bjdCode_dealYear_dealMonth_idx',
  OffitelSaleTransaction: 'OffitelSaleTransaction_buildingName_bjdCode_dealYear_dealMon_idx',
  OffitelRentTransaction: 'OffitelRentTransaction_buildingName_bjdCode_dealYear_dealMon_idx',
};

function latestDealIndexHint(table: TransactionTable): Prisma.Sql {
  return Prisma.raw(`/*+ INDEX(t ${LATEST_DEAL_INDEX[table]}) */`);
}

/** 면적 조건. 범위가 없으면 빈 SQL — 필터 없는 호출의 SQL 이 예전과 글자까지 같게 둔다. */
function areaFilter(area: AreaRange | null): Prisma.Sql {
  if (!area) return Prisma.empty;
  const lower = area.min == null ? Prisma.empty : Prisma.sql` AND t.exclusiveArea > ${area.min}`;
  const upper = area.max == null ? Prisma.empty : Prisma.sql` AND t.exclusiveArea <= ${area.max}`;
  return Prisma.sql`${lower}${upper}`;
}

function latestSaleSql(
  propertyType: PropertyType,
  keys: readonly BuildingKey[],
  today: string,
  area: AreaRange | null,
): Prisma.Sql {
  const table = Prisma.raw(tables[propertyType].sale);
  const hint = latestDealIndexHint(tables[propertyType].sale);
  const columns = Prisma.sql`t.buildingName, t.bjdCode, t.dongName, t.jibun, t.dealAmount, t.exclusiveArea, t.floor,
        t.dealYear, t.dealMonth, t.dealDay`;
  const filters = Prisma.sql`${saleNotCanceled('t')}
        AND t.dealAmount IS NOT NULL
        AND ${overviewDateThrough(today, 't')}${areaFilter(area)}`;
  const { addressKeys, legacyKeys } = splitKeys(keys);
  const branches = addressKeys.map((key) => Prisma.sql`(
      SELECT ${hint} ${columns}
      FROM ${table} t
      WHERE ${candidateTerm(key)}
        AND ${filters}
      ${LATEST_DEAL_ORDER}
      LIMIT 1)`);
  if (legacyKeys.length > 0) {
    branches.push(Prisma.sql`(
      SELECT buildingName, bjdCode, dongName, jibun, dealAmount, exclusiveArea, floor, dealYear, dealMonth, dealDay
      FROM (
        SELECT
          ${columns},
          ROW_NUMBER() OVER (
          PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), '')
          ORDER BY t.dealYear DESC, t.dealMonth DESC,
                   t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
        ) AS rn
        FROM ${table} t
        WHERE (${candidateWhere(legacyKeys)})
          AND ${filters}
      ) ranked WHERE rn = 1)`);
  }
  return Prisma.sql`
    SELECT buildingName, bjdCode, dongName, jibun, dealAmount, exclusiveArea, floor, dealYear, dealMonth, dealDay
    FROM (${Prisma.join(branches, ' UNION ALL ')}) latest
    ORDER BY latest.buildingName, latest.bjdCode, TRIM(latest.dongName), COALESCE(TRIM(latest.jibun), '')
  `;
}

function latestRentSql(
  propertyType: PropertyType,
  keys: readonly BuildingKey[],
  today: string,
  area: AreaRange | null,
): Prisma.Sql {
  const table = Prisma.raw(tables[propertyType].rent);
  const hint = latestDealIndexHint(tables[propertyType].rent);
  const columns = Prisma.sql`t.buildingName, t.bjdCode, t.dongName, t.jibun, t.rentType, t.deposit, t.monthlyRent,
        t.exclusiveArea, t.floor, t.dealYear, t.dealMonth, t.dealDay`;
  const dateFilter = Prisma.sql`${overviewDateThrough(today, 't')}${areaFilter(area)}`;
  const rentFilters = [
    Prisma.sql`t.rentType = '전세' AND t.deposit IS NOT NULL`,
    Prisma.sql`t.rentType = '월세' AND t.deposit IS NOT NULL AND t.monthlyRent IS NOT NULL`,
  ];
  const { addressKeys, legacyKeys } = splitKeys(keys);
  const branches = addressKeys.flatMap((key) => rentFilters.map((rentFilter) => Prisma.sql`(
      SELECT ${hint} ${columns}
      FROM ${table} t
      WHERE ${candidateTerm(key)}
        AND ${rentFilter}
        AND ${dateFilter}
      ${LATEST_DEAL_ORDER}
      LIMIT 1)`));
  if (legacyKeys.length > 0) {
    branches.push(Prisma.sql`(
      SELECT buildingName, bjdCode, dongName, jibun, rentType, deposit, monthlyRent, exclusiveArea, floor, dealYear, dealMonth, dealDay
      FROM (
        SELECT
          ${columns},
          ROW_NUMBER() OVER (
          PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), ''), t.rentType
          ORDER BY t.dealYear DESC, t.dealMonth DESC,
                   t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
        ) AS rn
        FROM ${table} t
        WHERE (${candidateWhere(legacyKeys)})
          AND ((${rentFilters[0]}) OR (${rentFilters[1]}))
          AND ${dateFilter}
      ) ranked WHERE rn = 1)`);
  }
  return Prisma.sql`
    SELECT buildingName, bjdCode, dongName, jibun, rentType, deposit, monthlyRent, exclusiveArea, floor, dealYear, dealMonth, dealDay
    FROM (${Prisma.join(branches, ' UNION ALL ')}) latest
    ORDER BY latest.buildingName, latest.bjdCode, TRIM(latest.dongName), COALESCE(TRIM(latest.jibun), ''), latest.rentType
  `;
}

function splitKeys(keys: readonly BuildingKey[]): { addressKeys: BuildingKey[]; legacyKeys: BuildingKey[] } {
  const addressKeys: BuildingKey[] = [];
  const legacyKeys: BuildingKey[] = [];
  for (const key of keys) (hasAddressComponents(key) ? addressKeys : legacyKeys).push(key);
  return { addressKeys, legacyKeys };
}

function candidateWhere(keys: readonly BuildingKey[]): Prisma.Sql {
  return keys.slice(1).reduce(
    (sql, key) => Prisma.sql`${sql} OR ${candidateTerm(key)}`,
    candidateTerm(keys[0]),
  );
}

function candidateTerm(key: BuildingKey): Prisma.Sql {
  const normalizedJibun = key.jibun?.trim() ?? '';
  const addressFilter = hasAddressComponents(key)
    ? Prisma.sql`AND TRIM(t.dongName) = ${key.dongName?.trim() ?? ''} AND COALESCE(TRIM(t.jibun), '') = ${normalizedJibun}`
    : Prisma.empty;
  return Prisma.sql`(t.bjdCode = ${key.bjdCode} AND t.buildingName = ${key.buildingName} ${addressFilter})`;
}

function applyRows(
  result: Map<string, LatestDeals>,
  propertyType: PropertyType,
  rows: readonly RawLatestDealRow[],
  source: SourceTableKind,
): void {
  for (const row of rows) {
    const key = latestDealsKey({
      propertyType,
      buildingName: row.buildingName,
      bjdCode: row.bjdCode,
      dongName: row.dongName,
      jibun: row.jibun,
    });
    const legacyKey = latestDealsKey({ propertyType, buildingName: row.buildingName, bjdCode: row.bjdCode });
    const bundle = result.get(key) ?? result.get(legacyKey);
    if (!bundle) continue;

    if (source === 'sale') {
      bundle.sale = serializeDeal(row, 'sale');
      continue;
    }

    const kind = kindForRentType(row.rentType);
    if (kind) bundle[kind] = serializeDeal(row, kind);
  }
}

function kindForRentType(rentType: string | null | undefined): Exclude<DealKind, 'sale'> | null {
  if (rentType === '전세') return 'jeonse';
  if (rentType === '월세') return 'wolse';
  return null;
}

function serializeDeal(row: RawLatestDealRow, kind: DealKind): DealSnapshot {
  return {
    kind,
    amount: toNullableNumber(row.dealAmount),
    deposit: toNullableNumber(row.deposit),
    monthlyRent: toNullableNumber(row.monthlyRent),
    exclusiveArea: toNullableNumber(row.exclusiveArea),
    floor: row.floor,
    dealYear: row.dealYear,
    dealMonth: row.dealMonth,
    dealDay: row.dealDay,
  };
}

function toNullableNumber(value: number | bigint | string | Prisma.Decimal | null | undefined): number | null {
  return value == null ? null : Number(value);
}
