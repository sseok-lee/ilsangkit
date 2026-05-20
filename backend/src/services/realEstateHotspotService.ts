import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  HotspotRegion, HotspotBundle, WolseHotspotBundle, PropertyHotspots,
} from '../types/homeDashboard.js';
import type { RealEstatePropertyType } from '../schemas/realEstate.js';

const MAX_PER_SIGNAL = 5;

const SAMPLE_THRESHOLD: Record<RealEstatePropertyType, number> = {
  apt: 30,
  villa: 15,
  offitel: 15,
};

type RawPricedRow = {
  citySlug: string;
  city: string;
  districtSlug: string;
  district: string;
  pricePerPyeong: number | null;
  txnCount: bigint | number;
  changePct: number | null;
  volumeChangePct: number | null;
};

function normalizeRow(r: RawPricedRow): HotspotRegion {
  return {
    citySlug: r.citySlug,
    city: r.city,
    districtSlug: r.districtSlug,
    district: r.district,
    pricePerPyeong: r.pricePerPyeong,
    txnCount: Number(r.txnCount),
    changePct: r.changePct,
    volumeChangePct: r.volumeChangePct,
  };
}

type PricedSliceTable =
  | 'AptSaleTransaction' | 'VillaSaleTransaction' | 'OffitelSaleTransaction'
  | 'AptRentTransaction' | 'VillaRentTransaction' | 'OffitelRentTransaction';

interface PricedSliceOptions {
  sampleThreshold: number;
  rentTypeFilter?: '전세' | '월세';
}

/**
 * 매매/전세 슬라이스: 시·군·구 단위 평당가 + 변동률 + 거래량 변동률 산출 후 3시그널 묶음 반환.
 * 월세는 별도 getWolseHotspots 함수를 사용한다.
 */
export async function getPricedSliceHotspots(
  table: PricedSliceTable,
  opts: PricedSliceOptions,
): Promise<HotspotBundle> {
  const { sampleThreshold, rentTypeFilter } = opts;

  const rentTypeClause = rentTypeFilter
    ? Prisma.sql`AND t.rentType = ${rentTypeFilter}`
    : Prisma.empty;

  const priceExpr = table.includes('Sale')
    ? Prisma.sql`t.dealAmount`
    : Prisma.sql`t.deposit`;

  const tableRaw = Prisma.raw(table);

  const rows = await prisma.$queryRaw<RawPricedRow[]>`
    WITH recent AS (
      SELECT t.city, t.district,
             AVG(${priceExpr} / (t.exclusiveArea / 3.3058)) AS pricePerPyeong,
             COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ${rentTypeClause}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    ),
    prior AS (
      SELECT t.city, t.district,
             AVG(${priceExpr} / (t.exclusiveArea / 3.3058)) AS prevPrice,
             COUNT(*) AS prevTxnCount
      FROM ${tableRaw} t
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ${rentTypeClause}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    )
    SELECT
      reg.citySlug AS citySlug,
      r.city AS city,
      reg.districtSlug AS districtSlug,
      r.district AS district,
      r.pricePerPyeong AS pricePerPyeong,
      r.txnCount AS txnCount,
      CASE WHEN p.prevPrice IS NOT NULL AND p.prevTxnCount >= ${sampleThreshold}
           THEN (r.pricePerPyeong - p.prevPrice) / p.prevPrice * 100
           ELSE NULL END AS changePct,
      CASE WHEN p.prevTxnCount > 0
           THEN (CAST(r.txnCount AS DECIMAL) - p.prevTxnCount) / p.prevTxnCount * 100
           ELSE NULL END AS volumeChangePct
    FROM recent r
    LEFT JOIN prior p ON p.city = r.city AND p.district = r.district
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
  `;

  const all = rows.map(normalizeRow);

  return {
    rising: all
      .filter((r) => r.changePct !== null && r.changePct > 0)
      .sort((a, b) => (b.changePct as number) - (a.changePct as number))
      .slice(0, MAX_PER_SIGNAL),
    falling: all
      .filter((r) => r.changePct !== null && r.changePct < 0)
      .sort((a, b) => (a.changePct as number) - (b.changePct as number))
      .slice(0, MAX_PER_SIGNAL),
    active: all
      .filter((r) => r.volumeChangePct !== null && r.volumeChangePct > 0)
      .sort((a, b) => (b.volumeChangePct as number) - (a.volumeChangePct as number))
      .slice(0, MAX_PER_SIGNAL),
  };
}

type WolseTable = 'AptRentTransaction' | 'VillaRentTransaction' | 'OffitelRentTransaction';

type RawWolseRow = {
  citySlug: string;
  city: string;
  districtSlug: string;
  district: string;
  txnCount: bigint | number;
  volumeChangePct: number | null;
};

/**
 * 월세 슬라이스: 평당가 산정 안 함 — 거래 급증(volumeChangePct DESC)만 반환.
 * pricePerPyeong / changePct 는 모든 행에서 null.
 */
export async function getWolseHotspots(
  table: WolseTable,
  opts: { sampleThreshold: number },
): Promise<WolseHotspotBundle> {
  const { sampleThreshold } = opts;
  const tableRaw = Prisma.raw(table);

  const rows = await prisma.$queryRaw<RawWolseRow[]>`
    WITH recent AS (
      SELECT t.city, t.district, COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    ),
    prior AS (
      SELECT t.city, t.district, COUNT(*) AS prevTxnCount
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    )
    SELECT
      reg.citySlug AS citySlug,
      r.city AS city,
      reg.districtSlug AS districtSlug,
      r.district AS district,
      r.txnCount AS txnCount,
      CASE WHEN p.prevTxnCount > 0
           THEN (CAST(r.txnCount AS DECIMAL) - p.prevTxnCount) / p.prevTxnCount * 100
           ELSE NULL END AS volumeChangePct
    FROM recent r
    LEFT JOIN prior p ON p.city = r.city AND p.district = r.district
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
  `;

  const active: HotspotRegion[] = rows
    .filter((r) => r.volumeChangePct !== null && r.volumeChangePct > 0)
    .map((r) => ({
      citySlug: r.citySlug,
      city: r.city,
      districtSlug: r.districtSlug,
      district: r.district,
      pricePerPyeong: null,
      txnCount: Number(r.txnCount),
      changePct: null,
      volumeChangePct: r.volumeChangePct,
    }))
    .sort((a, b) => (b.volumeChangePct as number) - (a.volumeChangePct as number))
    .slice(0, MAX_PER_SIGNAL);

  return { active };
}

// Re-exported types for Tasks 4-5 to import from this module
export type { WolseHotspotBundle, PropertyHotspots };

const CACHE_TTL_MS = 60 * 60 * 1000;

const PRICED_TABLES: Record<RealEstatePropertyType, { sale: PricedSliceTable; rent: PricedSliceTable }> = {
  apt:     { sale: 'AptSaleTransaction',     rent: 'AptRentTransaction' },
  villa:   { sale: 'VillaSaleTransaction',   rent: 'VillaRentTransaction' },
  offitel: { sale: 'OffitelSaleTransaction', rent: 'OffitelRentTransaction' },
};

export const _hotspotCache = new Map<RealEstatePropertyType, { data: PropertyHotspots; expiry: number }>();

export async function getPropertyHotspots(propertyType: RealEstatePropertyType): Promise<PropertyHotspots> {
  const cached = _hotspotCache.get(propertyType);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const threshold = SAMPLE_THRESHOLD[propertyType];
  const { sale, rent } = PRICED_TABLES[propertyType];

  const [saleBundle, jeonseBundle, wolseBundle] = await Promise.all([
    getPricedSliceHotspots(sale, { sampleThreshold: threshold }),
    getPricedSliceHotspots(rent, { sampleThreshold: threshold, rentTypeFilter: '전세' }),
    getWolseHotspots(rent as WolseTable, { sampleThreshold: threshold }),
  ]);

  const data: PropertyHotspots = { sale: saleBundle, jeonse: jeonseBundle, wolse: wolseBundle };
  _hotspotCache.set(propertyType, { data, expiry: Date.now() + CACHE_TTL_MS });
  return data;
}
