import { prisma } from '../lib/prisma.js';
import { dateBasedStatusFilter } from './subscriptionService.js';
import { getPropertyHotspots } from './realEstateHotspotService.js';
import type { HomeDashboardResponse, RealEstateTrend, TrendingBuildingItem } from '../types/homeDashboard.js';

export interface StatsData {
  toilet: number;
  wifi: number;
  clothes: number;
  trash: number;
  parking: number;
  aed: number;
  library: number;
  hospital: number;
  pharmacy: number;
  park: number;
  school: number;
  market: number;
  childcare: number;
  'ev-charger': number;
  sports: number;
  total: number;
  realEstate: {
    aptSale: number;
    aptRent: number;
    villaSale: number;
    villaRent: number;
    offitelSale: number;
    offitelRent: number;
  };
  realEstateBuildings: { apt: number; villa: number; offitel: number };
  buildingCount: number;
  regionCount: number;
  subscriptionActiveCount: number;
}

// Stats 인메모리 캐시 (5분 TTL) — 23개 병렬 COUNT 쿼리 부하 감소
let statsCache: { data: StatsData; expiry: number } | null = null;
const STATS_CACHE_TTL = 5 * 60 * 1000;

// Stats request coalescing — 캐시 만료 시점 동시 호출 시 fetch는 1번만 실행하고 결과 공유 (thundering herd 방지)
let inflightStats: Promise<{ cached: boolean; data: StatsData }> | null = null;

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getStats(): Promise<{ cached: boolean; data: StatsData }> {
  if (statsCache && Date.now() < statsCache.expiry) {
    return { cached: true as const, data: statsCache.data };
  }
  // 동시 호출이 들어오면 fetch 1번만 실행하고 결과 공유 (thundering herd 방지)
  if (inflightStats) return inflightStats;

  inflightStats = (async () => {
    try {
      return await fetchFreshStats();
    } catch (e) {
      // 풀 timeout 등 전체 실패 시 만료된 stale 캐시라도 반환 (사이트 500 방지)
      if (statsCache) {
        return { cached: true as const, data: statsCache.data };
      }
      throw e;
    } finally {
      inflightStats = null;
    }
  })();

  return inflightStats;
}

async function fetchFreshStats(): Promise<{ cached: boolean; data: StatsData }> {
  const [
    toiletCount, wifiCount, clothesCount, trashCount, parkingCount, aedCount, libraryCount, hospitalCount, pharmacyCount,
    parkCount, schoolCount, marketCount, childcareCount, evChargerCount, sportsCount,
    aptSaleCount, aptRentCount, villaSaleCount, villaRentCount, offitelSaleCount, offitelRentCount,
    buildingCountResult, regionCount, subscriptionActiveCount,
  ] = await Promise.all([
    prisma.toilet.count(),
    prisma.wifi.count(),
    prisma.clothes.count(),
    prisma.wasteSchedule.count(),
    prisma.parking.count(),
    prisma.aed.count(),
    prisma.library.count(),
    prisma.hospital.count(),
    prisma.pharmacy.count(),
    prisma.park.count(),
    prisma.school.count(),
    prisma.market.count(),
    prisma.childcare.count(),
    prisma.$queryRaw<[{ cnt: bigint }]>`SELECT COUNT(DISTINCT statId) as cnt FROM EvCharger WHERE statId IS NOT NULL`,
    prisma.sports.count(),
    prisma.aptSaleTransaction.count(),
    prisma.aptRentTransaction.count(),
    prisma.villaSaleTransaction.count(),
    prisma.villaRentTransaction.count(),
    prisma.offitelSaleTransaction.count(),
    prisma.offitelRentTransaction.count(),
    prisma.$queryRaw<[{ apt: bigint; villa: bigint; offitel: bigint }]>`
      SELECT
        COUNT(DISTINCT CASE WHEN type IN ('apt-sale','apt-rent') THEN CONCAT(buildingName,'|',bjdCode) END) AS apt,
        COUNT(DISTINCT CASE WHEN type IN ('villa-sale','villa-rent') THEN CONCAT(buildingName,'|',bjdCode) END) AS villa,
        COUNT(DISTINCT CASE WHEN type IN ('offitel-sale','offitel-rent') THEN CONCAT(buildingName,'|',bjdCode) END) AS offitel
      FROM RealEstateBuildingSummary`,
    prisma.region.count(),
    prisma.subscription.count({
      where: {
        OR: [dateBasedStatusFilter('ongoing'), dateBasedStatusFilter('upcoming')],
      },
    }),
  ]);

  const aptBuildings = Number(buildingCountResult[0]?.apt ?? 0);
  const villaBuildings = Number(buildingCountResult[0]?.villa ?? 0);
  const offitelBuildings = Number(buildingCountResult[0]?.offitel ?? 0);

  const stats = {
    toilet: toiletCount,
    wifi: wifiCount,
    clothes: clothesCount,
    trash: trashCount,
    parking: parkingCount,
    aed: aedCount,
    library: libraryCount,
    hospital: hospitalCount,
    pharmacy: pharmacyCount,
    park: parkCount,
    school: schoolCount,
    market: marketCount,
    childcare: childcareCount,
    'ev-charger': Number(evChargerCount[0]?.cnt ?? 0),
    sports: sportsCount,
    total: toiletCount + wifiCount + clothesCount + trashCount + parkingCount + aedCount + libraryCount + hospitalCount + pharmacyCount + parkCount + schoolCount + marketCount + childcareCount + Number(evChargerCount[0]?.cnt ?? 0) + sportsCount,
    realEstate: {
      aptSale: aptSaleCount,
      aptRent: aptRentCount,
      villaSale: villaSaleCount,
      villaRent: villaRentCount,
      offitelSale: offitelSaleCount,
      offitelRent: offitelRentCount,
    },
    realEstateBuildings: {
      apt: aptBuildings,
      villa: villaBuildings,
      offitel: offitelBuildings,
    },
    buildingCount: aptBuildings + villaBuildings + offitelBuildings,
    regionCount,
    subscriptionActiveCount,
  };

  statsCache = { data: stats, expiry: Date.now() + STATS_CACHE_TTL };
  return { cached: false as const, data: stats };
}

export async function getRegionByDistrictName(city: string, district: string) {
  return prisma.region.findFirst({
    where: { city, district },
    select: { slug: true },
  });
}

/**
 * bjdCode(5자리 lawd 또는 10자리 full) → {city, district}.
 * 전달된 bjdCode가 5자리면 그대로, 10자리면 앞 5자리로 매칭한다.
 * real-estate-redirect 미들웨어에서 레거시 URL → 새 URL 변환 시 사용.
 */
export async function getRegionByBjdCode(bjdCode: string) {
  if (!bjdCode) return null;
  const lawdCode = bjdCode.length >= 5 ? bjdCode.slice(0, 5) : bjdCode;
  return prisma.region.findFirst({
    where: { bjdCode: lawdCode },
    select: { city: true, district: true, bjdCode: true },
  });
}

export async function getRegions(city?: string) {
  const regions = await prisma.region.findMany({
    where: city ? { city } : undefined,
    orderBy: [{ city: 'asc' }, { district: 'asc' }],
    select: {
      id: true,
      bjdCode: true,
      city: true,
      district: true,
      slug: true,
      lat: true,
      lng: true,
    },
  });

  return regions.map((r) => ({
    ...r,
    lat: Number(r.lat),
    lng: Number(r.lng),
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Home Dashboard helpers
// ─────────────────────────────────────────────────────────────────────────────

/** KST(UTC+9) 기준 오늘 00:00 의 UTC Date 객체. */
export function startOfTodayKst(): Date {
  const now = new Date();
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setUTCHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - 9 * 60 * 60 * 1000);
}

/**
 * 오늘 00:00 KST 이후 createdAt 인 실거래 row 수 합산.
 * "오늘 새로 등록된 거래" 라이브 뱃지에 사용.
 */
export async function getNewlyListedToday(): Promise<number> {
  const todayKstStart = startOfTodayKst();
  const [a, b, c, d, e, f] = await Promise.all([
    prisma.aptSaleTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.aptRentTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.villaSaleTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.villaRentTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.offitelSaleTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.offitelRentTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
  ]);
  return a + b + c + d + e + f;
}

/** N일 전 날짜를 'YYYY-MM-DD' 문자열로 반환. dealYear/dealMonth/dealDay 컬럼이 KST 기준이므로 KST wall-clock 사용. */
function ymdNDaysAgo(n: number): string {
  const kstNow = new Date(Date.now() + 9 * 60 * 60 * 1000);
  kstNow.setUTCDate(kstNow.getUTCDate() - n);
  return kstNow.toISOString().slice(0, 10);
}

function calcChangePct(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

// 1평 = 3.3058㎡. (sum(price)/sum(area))[만원/㎡] × 3.3058 = 평당가[만원/평].
const M2_PER_PYEONG = 3.3058;

type RawSumRow = { sumPrice: number | null; sumArea: number | null; cnt: bigint };

function rowToPricePerPyeong(row: RawSumRow | undefined): { pricePerPyeong: number | null; count: number } {
  const count = Number(row?.cnt ?? 0);
  if (!row || row.sumPrice === null || row.sumArea === null || Number(row.sumArea) <= 0) {
    return { pricePerPyeong: null, count };
  }
  return { pricePerPyeong: (Number(row.sumPrice) / Number(row.sumArea)) * M2_PER_PYEONG, count };
}

/**
 * dealYear/dealMonth/dealDay 복합 비교가 필요해 raw SQL 사용.
 * 평당가 = SUM(가격) / SUM(전용면적) × 3.3058 (면적 가중). exclusiveArea NULL/0 거래 제외.
 */
async function aggregateSaleRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(dealAmount) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM AptSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateRentJeonseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(deposit) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM AptRentTransaction
    WHERE rentType = '전세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateRentWolseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(monthlyRent) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM AptRentTransaction
    WHERE rentType = '월세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateVillaSaleRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(dealAmount) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM VillaSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateVillaRentJeonseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(deposit) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM VillaRentTransaction
    WHERE rentType = '전세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateVillaRentWolseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(monthlyRent) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM VillaRentTransaction
    WHERE rentType = '월세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateOffitelSaleRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(dealAmount) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM OffitelSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateOffitelRentJeonseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(deposit) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM OffitelRentTransaction
    WHERE rentType = '전세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

async function aggregateOffitelRentWolseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(monthlyRent) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM OffitelRentTransaction
    WHERE rentType = '월세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
  return rowToPricePerPyeong(rows[0]);
}

/**
 * 부동산 9슬롯 통계 — 최근 7일 vs 직전 7일(8~14일 전) 평균가 + 변동률.
 * 3 property type × 3 txn type (매매/전세/월세).
 * dealYear/dealMonth/dealDay 복합 비교 때문에 raw SQL 사용.
 */
export async function getRealEstateTrends(): Promise<RealEstateTrend[]> {
  const [
    aptCurr, aptPrev,
    aptJeonseCurr, aptJeonsePrev,
    aptWolseCurr, aptWolsePrev,
    villaCurr, villaPrev,
    villaJeonseCurr, villaJeonsePrev,
    villaWolseCurr, villaWolsePrev,
    offCurr, offPrev,
    offJeonseCurr, offJeonsePrev,
    offWolseCurr, offWolsePrev,
  ] = await Promise.all([
    aggregateSaleRange(7, 0),
    aggregateSaleRange(14, 8),
    aggregateRentJeonseRange(7, 0),
    aggregateRentJeonseRange(14, 8),
    aggregateRentWolseRange(7, 0),
    aggregateRentWolseRange(14, 8),
    aggregateVillaSaleRange(7, 0),
    aggregateVillaSaleRange(14, 8),
    aggregateVillaRentJeonseRange(7, 0),
    aggregateVillaRentJeonseRange(14, 8),
    aggregateVillaRentWolseRange(7, 0),
    aggregateVillaRentWolseRange(14, 8),
    aggregateOffitelSaleRange(7, 0),
    aggregateOffitelSaleRange(14, 8),
    aggregateOffitelRentJeonseRange(7, 0),
    aggregateOffitelRentJeonseRange(14, 8),
    aggregateOffitelRentWolseRange(7, 0),
    aggregateOffitelRentWolseRange(14, 8),
  ]);

  const toTrend = (
    key: RealEstateTrend['key'],
    label: string,
    curr: { pricePerPyeong: number | null; count: number },
    prev: { pricePerPyeong: number | null; count: number },
  ): RealEstateTrend => ({
    key,
    label,
    pricePerPyeong: curr.pricePerPyeong,
    txnCount: curr.count,
    prevPricePerPyeong: prev.pricePerPyeong,
    changePct: calcChangePct(curr.pricePerPyeong, prev.pricePerPyeong),
  });

  return [
    toTrend('apt-sale', '아파트 매매', aptCurr, aptPrev),
    toTrend('apt-rent-jeonse', '아파트 전세', aptJeonseCurr, aptJeonsePrev),
    toTrend('apt-rent-wolse', '아파트 월세', aptWolseCurr, aptWolsePrev),
    toTrend('villa-sale', '빌라 매매', villaCurr, villaPrev),
    toTrend('villa-rent-jeonse', '빌라 전세', villaJeonseCurr, villaJeonsePrev),
    toTrend('villa-rent-wolse', '빌라 월세', villaWolseCurr, villaWolsePrev),
    toTrend('offitel-sale', '오피스텔 매매', offCurr, offPrev),
    toTrend('offitel-rent-jeonse', '오피스텔 전세', offJeonseCurr, offJeonsePrev),
    toTrend('offitel-rent-wolse', '오피스텔 월세', offWolseCurr, offWolsePrev),
  ];
}

/**
 * 인기 단지 TOP 5 — 매매·전세·월세 3분할 (아파트 한정).
 * 최근 7일 거래 기준, 단지별 거래수 TOP 5.
 *
 * 가격 표시 정책:
 *   - 단지 내 5㎡ 버킷(ROUND(area/5)*5)으로 평형 그룹화
 *   - 거래수 최다 버킷을 "주력 평형"으로 채택 (동률 시 면적 작은 쪽)
 *   - 그 평형의 거래 가격 중앙값을 노출
 *   - exclusiveArea NULL/0 거래는 버킷팅 + 중앙값에서 제외
 * 단지 전체 거래수(txnCount)는 NULL 면적 포함한 raw count.
 */
type TrendingTxnRow = {
  buildingName: string;
  city: string;
  district: string;
  txnCount: bigint;
  representativeArea: number | null;
  price: number | null;
  monthlyRent: number | null;
};

function median(values: number[]): number | null {
  const cleaned = values.filter((v) => v !== null && v !== undefined && !Number.isNaN(v));
  if (cleaned.length === 0) return null;
  const sorted = [...cleaned].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function rowsToTrendingItems(rows: TrendingTxnRow[]): TrendingBuildingItem[] {
  // Preserve building order (DB returns sorted by txnCount DESC, buildingName ASC)
  const groups = new Map<string, TrendingTxnRow[]>();
  const order: string[] = [];
  for (const r of rows) {
    const key = `${r.buildingName}|${r.city}|${r.district}`;
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(r);
  }
  return order.map((key) => {
    const group = groups.get(key)!;
    const first = group[0];
    const prices = group.map((r) => (r.price === null ? null : Number(r.price))).filter((v): v is number => v !== null);
    const monthlies = group.map((r) => (r.monthlyRent === null ? null : Number(r.monthlyRent))).filter((v): v is number => v !== null);
    return {
      buildingName: first.buildingName,
      slug: encodeURIComponent(first.buildingName),
      city: first.city,
      district: first.district,
      txnCount: Number(first.txnCount),
      representativeArea: first.representativeArea === null ? null : Number(first.representativeArea),
      medianPrice: median(prices),
      medianMonthlyRent: monthlies.length > 0 ? median(monthlies) : null,
    };
  });
}

export async function getTrendingBuildings(): Promise<{ sale: TrendingBuildingItem[]; jeonse: TrendingBuildingItem[]; wolse: TrendingBuildingItem[] }> {
  const from = ymdNDaysAgo(7);
  const to = ymdNDaysAgo(0);

  // 공통 패턴: bucketed → top_buildings(거래수 TOP 5) → primary_buckets(주력 평형) → 주력 평형 거래 raw rows.
  // ORDER BY tb.txnCount DESC, b.buildingName ASC 로 결정성 부여.
  const [saleRows, jeonseRows, wolseRows] = await Promise.all([
    prisma.$queryRaw<TrendingTxnRow[]>`
      WITH bucketed AS (
        SELECT buildingName, city, district,
               ROUND(exclusiveArea / 5) * 5 AS areaBucket,
               dealAmount AS price
        FROM AptSaleTransaction
        WHERE STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
      ),
      top_buildings AS (
        SELECT buildingName, city, district, COUNT(*) AS txnCount
        FROM bucketed
        GROUP BY buildingName, city, district
        ORDER BY txnCount DESC, buildingName ASC
        LIMIT 5
      ),
      primary_buckets AS (
        SELECT b.buildingName, b.city, b.district, b.areaBucket,
               ROW_NUMBER() OVER (
                 PARTITION BY b.buildingName, b.city, b.district
                 ORDER BY COUNT(*) DESC, b.areaBucket ASC
               ) AS rn
        FROM bucketed b
        JOIN top_buildings tb USING (buildingName, city, district)
        GROUP BY b.buildingName, b.city, b.district, b.areaBucket
      )
      SELECT b.buildingName, b.city, b.district,
             tb.txnCount AS txnCount,
             b.areaBucket AS representativeArea,
             b.price AS price,
             NULL AS monthlyRent
      FROM bucketed b
      JOIN top_buildings tb USING (buildingName, city, district)
      JOIN primary_buckets pb
        ON pb.buildingName = b.buildingName
       AND pb.city = b.city
       AND pb.district = b.district
       AND pb.areaBucket = b.areaBucket
       AND pb.rn = 1
      ORDER BY tb.txnCount DESC, b.buildingName ASC`,
    prisma.$queryRaw<TrendingTxnRow[]>`
      WITH bucketed AS (
        SELECT buildingName, city, district,
               ROUND(exclusiveArea / 5) * 5 AS areaBucket,
               deposit AS price
        FROM AptRentTransaction
        WHERE rentType = '전세'
          AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
      ),
      top_buildings AS (
        SELECT buildingName, city, district, COUNT(*) AS txnCount
        FROM bucketed
        GROUP BY buildingName, city, district
        ORDER BY txnCount DESC, buildingName ASC
        LIMIT 5
      ),
      primary_buckets AS (
        SELECT b.buildingName, b.city, b.district, b.areaBucket,
               ROW_NUMBER() OVER (
                 PARTITION BY b.buildingName, b.city, b.district
                 ORDER BY COUNT(*) DESC, b.areaBucket ASC
               ) AS rn
        FROM bucketed b
        JOIN top_buildings tb USING (buildingName, city, district)
        GROUP BY b.buildingName, b.city, b.district, b.areaBucket
      )
      SELECT b.buildingName, b.city, b.district,
             tb.txnCount AS txnCount,
             b.areaBucket AS representativeArea,
             b.price AS price,
             NULL AS monthlyRent
      FROM bucketed b
      JOIN top_buildings tb USING (buildingName, city, district)
      JOIN primary_buckets pb
        ON pb.buildingName = b.buildingName
       AND pb.city = b.city
       AND pb.district = b.district
       AND pb.areaBucket = b.areaBucket
       AND pb.rn = 1
      ORDER BY tb.txnCount DESC, b.buildingName ASC`,
    prisma.$queryRaw<TrendingTxnRow[]>`
      WITH bucketed AS (
        SELECT buildingName, city, district,
               ROUND(exclusiveArea / 5) * 5 AS areaBucket,
               deposit AS price,
               monthlyRent AS monthlyRent
        FROM AptRentTransaction
        WHERE rentType = '월세'
          AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
      ),
      top_buildings AS (
        SELECT buildingName, city, district, COUNT(*) AS txnCount
        FROM bucketed
        GROUP BY buildingName, city, district
        ORDER BY txnCount DESC, buildingName ASC
        LIMIT 5
      ),
      primary_buckets AS (
        SELECT b.buildingName, b.city, b.district, b.areaBucket,
               ROW_NUMBER() OVER (
                 PARTITION BY b.buildingName, b.city, b.district
                 ORDER BY COUNT(*) DESC, b.areaBucket ASC
               ) AS rn
        FROM bucketed b
        JOIN top_buildings tb USING (buildingName, city, district)
        GROUP BY b.buildingName, b.city, b.district, b.areaBucket
      )
      SELECT b.buildingName, b.city, b.district,
             tb.txnCount AS txnCount,
             b.areaBucket AS representativeArea,
             b.price AS price,
             b.monthlyRent AS monthlyRent
      FROM bucketed b
      JOIN top_buildings tb USING (buildingName, city, district)
      JOIN primary_buckets pb
        ON pb.buildingName = b.buildingName
       AND pb.city = b.city
       AND pb.district = b.district
       AND pb.areaBucket = b.areaBucket
       AND pb.rn = 1
      ORDER BY tb.txnCount DESC, b.buildingName ASC`,
  ]);

  return {
    sale: rowsToTrendingItems(saleRows).map((it) => ({ ...it, medianMonthlyRent: null })),
    jeonse: rowsToTrendingItems(jeonseRows).map((it) => ({ ...it, medianMonthlyRent: null })),
    wolse: rowsToTrendingItems(wolseRows),
  };
}

/**
 * 청약 요약 — 이번 주 마감, 다음 주 예정, 활성 공고 평균 분양가, D-3 임박 목록.
 * avgSupplyPrice: SubscriptionUnitType.topAmount 평균 (단위: 만원, Int 필드).
 * topAmount 가 없거나 활성 청약이 없으면 null.
 */
export async function getSubscriptionSummary() {
  const now = new Date();
  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };

  const [closingThisWeek, upcomingNextWeek, agg, imminentRows] = await Promise.all([
    prisma.subscription.count({
      where: { receptionEndDate: { gte: now, lte: inDays(7) } },
    }),
    prisma.subscription.count({
      where: { receptionStartDate: { gte: inDays(1), lte: inDays(14) } },
    }),
    // avgSupplyPrice: SubscriptionUnitType.topAmount 평균 (만원 단위 Int)
    prisma.subscriptionUnitType.aggregate({
      _avg: { topAmount: true },
      where: {
        subscription: {
          OR: [
            dateBasedStatusFilter('ongoing'),
            dateBasedStatusFilter('upcoming'),
          ],
        },
      },
    }),
    prisma.subscription.findMany({
      where: { receptionEndDate: { gte: now, lte: inDays(3) } },
      select: { id: true, houseName: true, regionName: true, receptionEndDate: true },
      orderBy: { receptionEndDate: 'asc' },
      take: 5,
    }),
  ]);

  return {
    closingThisWeek,
    upcomingNextWeek,
    avgSupplyPrice: agg._avg.topAmount !== null && agg._avg.topAmount !== undefined ? Number(agg._avg.topAmount) : null,
    imminent: imminentRows.map((r) => ({
      id: r.id,
      houseName: r.houseName,
      regionName: r.regionName,
      endDate: r.receptionEndDate ? r.receptionEndDate.toISOString().slice(0, 10) : '',
    })),
  };
}

// Home Dashboard 인메모리 캐시 (1시간 TTL)
let homeDashboardCache: { data: HomeDashboardResponse; expiry: number } | null = null;
const HOME_DASHBOARD_CACHE_TTL = 60 * 60 * 1000; // 1시간

// Home Dashboard request coalescing — 동시 호출이 같은 fetch를 공유 (thundering herd 방지)
let inflightHomeDashboard: Promise<HomeDashboardResponse> | null = null;

const emptyTrending = (): HomeDashboardResponse['trendingBuildings'] => ({ sale: [], jeonse: [], wolse: [] });
const emptySubscriptionSummary = (): HomeDashboardResponse['subscriptionSummary'] => ({
  closingThisWeek: 0,
  upcomingNextWeek: 0,
  avgSupplyPrice: null,
  imminent: [],
});
const emptyAptHotspots = (): NonNullable<HomeDashboardResponse['realEstateHotspots']>['apt'] => ({
  sale: { rising: [], falling: [], active: [] },
  jeonse: { rising: [], falling: [], active: [] },
  wolse: { active: [] },
});

export function clearStatsCache(): void {
  statsCache = null;
}

export function clearHomeDashboardCache(): void {
  homeDashboardCache = null;
  clearStatsCache(); // home-dashboard가 getStats()에 의존하므로 같이 flush
}

/**
 * 홈 페이지 대시보드 통합 endpoint용 데이터.
 *
 * 안전 가드:
 *  - Promise.allSettled — 6개 helper 중 일부 실패해도 부분 응답 (Promise.all fail-fast 회피)
 *  - 실패한 필드는 last cache → empty default 순으로 fallback
 *  - request coalescing — 동시 호출이 들어와도 fetch 1번만 실행, thundering herd 방지
 *  - 적어도 1개 helper 성공 시 캐시 갱신; 전부 실패 + 캐시 없음일 때만 throw
 */
export async function getHomeDashboard(): Promise<HomeDashboardResponse> {
  if (homeDashboardCache && Date.now() < homeDashboardCache.expiry) {
    return homeDashboardCache.data;
  }
  if (inflightHomeDashboard) return inflightHomeDashboard;

  inflightHomeDashboard = (async () => {
    try {
      return await fetchFreshHomeDashboard();
    } finally {
      inflightHomeDashboard = null;
    }
  })();

  return inflightHomeDashboard;
}

async function fetchFreshHomeDashboard(): Promise<HomeDashboardResponse> {
  const settled = await Promise.allSettled([
    getStats(),
    getNewlyListedToday(),
    getRealEstateTrends(),
    getTrendingBuildings(),
    getSubscriptionSummary(),
    getPropertyHotspots('apt'),
  ]);
  const [statsR, newlyR, trendsR, trendingR, subR, hotspotR] = settled;

  const lastCache = homeDashboardCache?.data;
  const successCount = settled.filter((r) => r.status === 'fulfilled').length;

  // 모두 실패 + 캐시도 없음 → 진짜 fail (500). 한 번이라도 성공한 적 있으면 stale 반환.
  if (successCount === 0) {
    if (lastCache) return lastCache;
    // Re-throw the first error to preserve diagnostics
    throw (statsR as PromiseRejectedResult).reason;
  }

  const statsValue = statsR.status === 'fulfilled' ? statsR.value.data : null;

  const payload: HomeDashboardResponse = {
    total: statsValue?.total ?? lastCache?.total ?? 0,
    buildingCount: statsValue?.buildingCount ?? lastCache?.buildingCount ?? 0,
    realEstateBuildings: statsValue?.realEstateBuildings
      ?? lastCache?.realEstateBuildings
      ?? { apt: 0, villa: 0, offitel: 0 },
    subscriptionActiveCount: statsValue?.subscriptionActiveCount ?? lastCache?.subscriptionActiveCount ?? 0,
    newlyListedToday: newlyR.status === 'fulfilled'
      ? newlyR.value
      : (lastCache?.newlyListedToday ?? 0),
    realEstateTrends: trendsR.status === 'fulfilled'
      ? trendsR.value
      : (lastCache?.realEstateTrends ?? []),
    trendingBuildings: trendingR.status === 'fulfilled'
      ? trendingR.value
      : (lastCache?.trendingBuildings ?? emptyTrending()),
    subscriptionSummary: subR.status === 'fulfilled'
      ? subR.value
      : (lastCache?.subscriptionSummary ?? emptySubscriptionSummary()),
    realEstateHotspots: {
      apt: hotspotR.status === 'fulfilled'
        ? hotspotR.value
        : (lastCache?.realEstateHotspots?.apt ?? emptyAptHotspots()),
    },
  };

  homeDashboardCache = { data: payload, expiry: Date.now() + HOME_DASHBOARD_CACHE_TTL };
  return payload;
}
