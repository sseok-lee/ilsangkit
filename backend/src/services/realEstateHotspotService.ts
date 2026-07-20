import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  HotspotRegion, HotspotBundle, WolseHotspotBundle, PropertyHotspots,
} from '../types/homeDashboard.js';
import type { RealEstatePropertyType } from '../schemas/realEstate.js';
import { resolveCitySlug } from './cityMapping.js';
import { dealDateRangeFilter } from './realEstateDateFilter.js';

const MAX_PER_SIGNAL = 5;

const SAMPLE_THRESHOLD: Record<RealEstatePropertyType, number> = {
  apt: 30,
  villa: 15,
  offitel: 15,
};

// Prisma raw query에서 Decimal 컬럼은 string으로 직렬화될 수 있어 명시적 변환 필요
type RawPricedRow = {
  city: string;
  bjdCode: string;
  districtSlug: string;
  district: string;
  pricePerPyeong: number | string | null;
  txnCount: bigint | number | string;
  changePct: number | string | null;
  volumeChangePct: number | string | null;
};

function toNumberOrNull(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * URL 생성 가능 여부: citySlug가 있고 districtSlug가 ASCII(로마자)인지.
 * 2026 행정개편 등으로 미매핑 도시(citySlug='')·미로마자 구(한글 slug)는 404 URL이 되므로 제외.
 */
function isRoutable(citySlug: string, districtSlug: string): boolean {
  // 유효 slug는 소문자 영숫자+하이픈. 한글 원문 slug(로마자화 안 됨)는 여기서 배제된다.
  return !!citySlug && /^[a-z0-9-]+$/.test(districtSlug || '');
}

/**
 * 매매/전세 행 정규화 + 방어 가드.
 * bjdCode로 통합시(전남광주통합특별시·코드12)를 기존 gwangju/jeonnam slug·라벨로 되돌린다.
 * 라우팅 불가 행(미매핑 도시·한글 구 slug)은 404 방지를 위해 제외하고 로그를 남긴다.
 */
export function normalizeAndGuard(rows: RawPricedRow[]): HotspotRegion[] {
  const out: HotspotRegion[] = [];
  for (const r of rows) {
    const { citySlug, cityLabel } = resolveCitySlug(r.bjdCode, r.city);
    if (!isRoutable(citySlug, r.districtSlug)) {
      console.warn(`[hotspot] skip unroutable region: ${r.city} ${r.district} (${r.bjdCode})`);
      continue;
    }
    out.push({
      citySlug,
      city: cityLabel,
      districtSlug: r.districtSlug,
      district: r.district,
      pricePerPyeong: toNumberOrNull(r.pricePerPyeong),
      txnCount: Number(r.txnCount),
      changePct: toNumberOrNull(r.changePct),
      volumeChangePct: toNumberOrNull(r.volumeChangePct),
    });
  }
  return out;
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

  // 국토부 실거래가는 30일 reporting lag이 있어 NOW() 기준 윈도우는 거의 비어있다.
  // 데이터의 최신 거래일(anchor)을 인덱스로 뽑아 "최근 7일 vs 직전 7일" 의미를 보존한다.
  // MAX(STR_TO_DATE(...)) 는 풀스캔이므로 ORDER BY ... LIMIT 1 (인덱스 후미 읽기)로 대체.
  const anchorRows = await prisma.$queryRaw<{ dealYear: number; dealMonth: number; dealDay: number | null }[]>`
    SELECT t.dealYear, t.dealMonth, t.dealDay
    FROM ${tableRaw} t
    WHERE 1=1 ${rentTypeClause}
    ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC
    LIMIT 1`;

  if (anchorRows.length === 0) {
    return { rising: [], falling: [], active: [] };
  }

  const a = anchorRows[0];
  const latest = new Date(Date.UTC(a.dealYear, a.dealMonth - 1, a.dealDay ?? 1));
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const minusDays = (n: number) => { const x = new Date(latest); x.setUTCDate(x.getUTCDate() - n); return ymd(x); };

  // recent: [latest-7, latest],  prior: [latest-14, latest-8] (= < latest-7)
  const recentFrom = minusDays(7); const recentTo = minusDays(0);
  const priorFrom = minusDays(14); const priorTo = minusDays(8);

  const rows = await prisma.$queryRaw<RawPricedRow[]>`
    WITH recent AS (
      SELECT t.city, t.district,
             AVG(${priceExpr} / (t.exclusiveArea / 3.3058)) AS pricePerPyeong,
             COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND ${dealDateRangeFilter(recentFrom, recentTo, 't')}
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
        AND ${dealDateRangeFilter(priorFrom, priorTo, 't')}
        ${rentTypeClause}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    )
    SELECT
      r.city AS city,
      reg.bjdCode AS bjdCode,
      reg.slug AS districtSlug,
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

  const all = normalizeAndGuard(rows);

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
  city: string;
  bjdCode: string;
  districtSlug: string;
  district: string;
  txnCount: bigint | number | string;
  volumeChangePct: number | string | null;
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

  // 윈도우는 MAX(dealDate) anchor 기준 (NOW() 기준은 reporting lag으로 데이터가 거의 없음)
  const rows = await prisma.$queryRaw<RawWolseRow[]>`
    WITH anchor AS (
      SELECT MAX(STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')) AS latest
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
    ),
    recent AS (
      SELECT t.city, t.district, COUNT(*) AS txnCount
      FROM ${tableRaw} t, anchor a
      WHERE t.rentType = '월세'
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 7 DAY)
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    ),
    prior AS (
      SELECT t.city, t.district, COUNT(*) AS prevTxnCount
      FROM ${tableRaw} t, anchor a
      WHERE t.rentType = '월세'
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 14 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(a.latest, INTERVAL 7 DAY)
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    )
    SELECT
      r.city AS city,
      reg.bjdCode AS bjdCode,
      reg.slug AS districtSlug,
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
    .map((r): HotspotRegion | null => {
      const { citySlug, cityLabel } = resolveCitySlug(r.bjdCode, r.city);
      if (!isRoutable(citySlug, r.districtSlug)) {
        console.warn(`[hotspot] skip unroutable region: ${r.city} ${r.district} (${r.bjdCode})`);
        return null;
      }
      return {
        citySlug,
        city: cityLabel,
        districtSlug: r.districtSlug,
        district: r.district,
        pricePerPyeong: null,
        txnCount: Number(r.txnCount),
        changePct: null,
        volumeChangePct: toNumberOrNull(r.volumeChangePct),
      };
    })
    .filter((r): r is HotspotRegion => r !== null && r.volumeChangePct !== null && r.volumeChangePct > 0)
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
