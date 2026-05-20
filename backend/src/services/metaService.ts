import { prisma } from '../lib/prisma.js';
import { dateBasedStatusFilter } from './subscriptionService.js';
import type { HomeDashboardResponse, RealEstateTrend, TrendingBuildingItem } from '../types/homeDashboard.js';

// Stats 인메모리 캐시 (5분 TTL) — 23개 병렬 COUNT 쿼리 부하 감소
let statsCache: { data: Record<string, unknown>; expiry: number } | null = null;
const STATS_CACHE_TTL = 5 * 60 * 1000;

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });
}

export async function getStats() {
  if (statsCache && Date.now() < statsCache.expiry) {
    return { cached: true as const, data: statsCache.data };
  }

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

/** N일 전 날짜를 'YYYY-MM-DD' 문자열로 반환. */
function ymdNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function calcChangePct(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

/** dealYear/dealMonth/dealDay 복합 비교가 필요해 raw SQL 사용. */
async function aggregateSaleRange(daysFrom: number, daysTo: number): Promise<{ avg: number | null; count: number }> {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[{ avg: number | null; cnt: bigint }]>`
    SELECT AVG(dealAmount) AS avg, COUNT(*) AS cnt
    FROM AptSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}`;
  const row = rows[0];
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: Number(row?.cnt ?? 0) };
}

async function aggregateRentJeonseRange(daysFrom: number, daysTo: number): Promise<{ avg: number | null; count: number }> {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[{ avg: number | null; cnt: bigint }]>`
    SELECT AVG(deposit) AS avg, COUNT(*) AS cnt
    FROM AptRentTransaction
    WHERE rentType = '전세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}`;
  const row = rows[0];
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: Number(row?.cnt ?? 0) };
}

async function aggregateOffitelSaleRange(daysFrom: number, daysTo: number): Promise<{ avg: number | null; count: number }> {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[{ avg: number | null; cnt: bigint }]>`
    SELECT AVG(dealAmount) AS avg, COUNT(*) AS cnt
    FROM OffitelSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}`;
  const row = rows[0];
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: Number(row?.cnt ?? 0) };
}

/**
 * 부동산 3슬롯 통계 — 최근 7일 vs 직전 7일(8~14일 전) 평균가 + 변동률.
 * dealYear/dealMonth/dealDay 복합 비교 때문에 raw SQL 사용.
 */
export async function getRealEstateTrends(): Promise<RealEstateTrend[]> {
  const [aptCurr, aptPrev, jeonseCurr, jeonsePrev, offCurr, offPrev] = await Promise.all([
    aggregateSaleRange(7, 0),
    aggregateSaleRange(14, 8),
    aggregateRentJeonseRange(7, 0),
    aggregateRentJeonseRange(14, 8),
    aggregateOffitelSaleRange(7, 0),
    aggregateOffitelSaleRange(14, 8),
  ]);

  return [
    {
      key: 'apt-sale',
      label: '아파트 매매',
      avgPrice: aptCurr.avg,
      txnCount: aptCurr.count,
      prevAvgPrice: aptPrev.avg,
      changePct: calcChangePct(aptCurr.avg, aptPrev.avg),
    },
    {
      key: 'apt-rent-jeonse',
      label: '아파트 전세',
      avgPrice: jeonseCurr.avg,
      txnCount: jeonseCurr.count,
      prevAvgPrice: jeonsePrev.avg,
      changePct: calcChangePct(jeonseCurr.avg, jeonsePrev.avg),
    },
    {
      key: 'offitel-sale',
      label: '오피스텔 매매',
      avgPrice: offCurr.avg,
      txnCount: offCurr.count,
      prevAvgPrice: offPrev.avg,
      changePct: calcChangePct(offCurr.avg, offPrev.avg),
    },
  ];
}

/**
 * 인기 단지 TOP 5 — 매매·전세·월세 3분할 (아파트 한정).
 * 최근 7일 거래 기준, GROUP BY buildingName/city/district.
 */
export async function getTrendingBuildings(): Promise<{ sale: TrendingBuildingItem[]; jeonse: TrendingBuildingItem[]; wolse: TrendingBuildingItem[] }> {
  const from = ymdNDaysAgo(7);
  const to = ymdNDaysAgo(0);

  const [sale, jeonse, wolse] = await Promise.all([
    prisma.$queryRaw<Array<{ buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null; avgMonthlyRent: number | null }>>`
      SELECT buildingName, city, district, COUNT(*) AS txnCount, AVG(dealAmount) AS avgPrice, NULL AS avgMonthlyRent
      FROM AptSaleTransaction
      WHERE STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
      GROUP BY buildingName, city, district
      ORDER BY txnCount DESC
      LIMIT 5`,
    prisma.$queryRaw<Array<{ buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null; avgMonthlyRent: number | null }>>`
      SELECT buildingName, city, district, COUNT(*) AS txnCount, AVG(deposit) AS avgPrice, NULL AS avgMonthlyRent
      FROM AptRentTransaction
      WHERE rentType = '전세'
        AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
      GROUP BY buildingName, city, district
      ORDER BY txnCount DESC
      LIMIT 5`,
    prisma.$queryRaw<Array<{ buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null; avgMonthlyRent: number | null }>>`
      SELECT buildingName, city, district, COUNT(*) AS txnCount, AVG(deposit) AS avgPrice, AVG(monthlyRent) AS avgMonthlyRent
      FROM AptRentTransaction
      WHERE rentType = '월세'
        AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
      GROUP BY buildingName, city, district
      ORDER BY txnCount DESC
      LIMIT 5`,
  ]);

  const toItem = (r: { buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null; avgMonthlyRent: number | null }): TrendingBuildingItem => ({
    buildingName: r.buildingName,
    city: r.city,
    district: r.district,
    txnCount: Number(r.txnCount),
    avgPrice: r.avgPrice === null || r.avgPrice === undefined ? null : Number(r.avgPrice),
    avgMonthlyRent: r.avgMonthlyRent === null || r.avgMonthlyRent === undefined ? null : Number(r.avgMonthlyRent),
  });

  return {
    sale: sale.map((r) => ({ ...toItem(r), avgMonthlyRent: null })),
    jeonse: jeonse.map((r) => ({ ...toItem(r), avgMonthlyRent: null })),
    wolse: wolse.map(toItem),
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

export function clearHomeDashboardCache(): void {
  homeDashboardCache = null;
}

/**
 * 홈 페이지 대시보드 통합 endpoint용 데이터.
 * getStats() + 4개 헬퍼를 Promise.all 병렬 호출 후 합성.
 * 결과는 1시간 in-memory 캐시.
 */
export async function getHomeDashboard(): Promise<HomeDashboardResponse> {
  if (homeDashboardCache && Date.now() < homeDashboardCache.expiry) {
    return homeDashboardCache.data;
  }

  const [statsResult, newlyListedToday, realEstateTrends, trendingBuildings, subscriptionSummary] = await Promise.all([
    getStats(),
    getNewlyListedToday(),
    getRealEstateTrends(),
    getTrendingBuildings(),
    getSubscriptionSummary(),
  ]);

  const stats = statsResult.data as {
    total: number;
    buildingCount: number;
    realEstateBuildings: { apt: number; villa: number; offitel: number };
    subscriptionActiveCount: number;
  };

  const payload: HomeDashboardResponse = {
    total: stats.total,
    buildingCount: stats.buildingCount,
    realEstateBuildings: stats.realEstateBuildings,
    subscriptionActiveCount: stats.subscriptionActiveCount,
    newlyListedToday,
    realEstateTrends,
    trendingBuildings,
    subscriptionSummary,
  };

  homeDashboardCache = { data: payload, expiry: Date.now() + HOME_DASHBOARD_CACHE_TTL };
  return payload;
}
