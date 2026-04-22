import { prisma } from '../lib/prisma.js';

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
    prisma.subscription.count({ where: { status: { in: ['ongoing', 'upcoming'] } } }),
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
