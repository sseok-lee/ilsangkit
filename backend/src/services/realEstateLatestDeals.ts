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

export async function getLatestDeals(
  keys: readonly BuildingKey[],
  scope: DealScope,
): Promise<Map<string, LatestDeals>> {
  const result = new Map<string, LatestDeals>();
  for (const key of keys) {
    result.set(latestDealsKey(key), emptyLatestDeals());
  }
  if (keys.length === 0) return result;

  const today = kstCalendarToday().toISOString().slice(0, 10);
  const grouped = groupKeysByProperty(keys);
  for (const [propertyType, propertyKeys] of grouped) {
    if (scope === 'sale' || scope === 'all') {
      const rows = await prisma.$queryRaw<RawLatestDealRow[]>(
        latestSaleSql(propertyType, propertyKeys, today),
      );
      applyRows(result, propertyType, rows, 'sale');
    }
    if (scope === 'rent' || scope === 'all') {
      const rows = await prisma.$queryRaw<RawLatestDealRow[]>(
        latestRentSql(propertyType, propertyKeys, today),
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

function latestSaleSql(
  propertyType: PropertyType,
  keys: readonly BuildingKey[],
  today: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT buildingName, bjdCode, dongName, jibun, dealAmount, exclusiveArea, floor, dealYear, dealMonth, dealDay
    FROM (
      SELECT
        t.buildingName,
        t.bjdCode,
        t.dongName,
        t.jibun,
        t.dealAmount,
        t.exclusiveArea,
        t.floor,
        t.dealYear,
        t.dealMonth,
        t.dealDay,
        ROW_NUMBER() OVER (
        PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), '')
        ORDER BY t.dealYear DESC, t.dealMonth DESC,
                 t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
      ) AS rn
      FROM ${Prisma.raw(tables[propertyType].sale)} t
      WHERE (${candidateWhere(keys)})
        AND ${saleNotCanceled('t')}
        AND t.dealAmount IS NOT NULL
        AND ${overviewDateThrough(today, 't')}
    ) ranked WHERE rn = 1
  `;
}

function latestRentSql(
  propertyType: PropertyType,
  keys: readonly BuildingKey[],
  today: string,
): Prisma.Sql {
  return Prisma.sql`
    SELECT buildingName, bjdCode, dongName, jibun, rentType, deposit, monthlyRent, exclusiveArea, floor, dealYear, dealMonth, dealDay
    FROM (
      SELECT
        t.buildingName,
        t.bjdCode,
        t.dongName,
        t.jibun,
        t.rentType,
        t.deposit,
        t.monthlyRent,
        t.exclusiveArea,
        t.floor,
        t.dealYear,
        t.dealMonth,
        t.dealDay,
        ROW_NUMBER() OVER (
        PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), ''), t.rentType
        ORDER BY t.dealYear DESC, t.dealMonth DESC,
                 t.dealDay IS NULL ASC, t.dealDay DESC, t.id DESC
      ) AS rn
      FROM ${Prisma.raw(tables[propertyType].rent)} t
      WHERE (${candidateWhere(keys)})
        AND (
          (t.rentType = '전세' AND t.deposit IS NOT NULL)
          OR (t.rentType = '월세' AND t.deposit IS NOT NULL AND t.monthlyRent IS NOT NULL)
        )
        AND ${overviewDateThrough(today, 't')}
    ) ranked WHERE rn = 1
  `;
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
