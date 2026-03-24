// @TASK T1.4 - 메타 API
// @SPEC docs/planning/02-trd.md#메타-API

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getStatsByCity, getStatsByDistrict, getSyncStatus, SHORT_TO_SLUG } from '../services/facilityService.js';

const router = Router();

// GET /api/meta/categories - 활성화된 카테고리 목록
router.get('/categories', asyncHandler(async (_req: Request, res: Response) => {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  res.json({ success: true, data: categories });
}));

// GET /api/meta/stats - 카테고리별 시설 개수
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const [
    toiletCount, wifiCount, clothesCount, trashCount, parkingCount, aedCount, libraryCount, hospitalCount, pharmacyCount,
    parkCount, schoolCount, marketCount, childcareCount, evChargerCount, sportsCount,
    aptSaleCount, aptRentCount, villaSaleCount, villaRentCount, offitelSaleCount, offitelRentCount,
    buildingCountResult, regionCount,
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
    prisma.$queryRaw<[{ cnt: bigint }]>`
      SELECT COUNT(*) as cnt FROM (
        SELECT DISTINCT buildingName, bjdCode FROM AptSaleTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM AptRentTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM VillaSaleTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM VillaRentTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM OffitelSaleTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM OffitelRentTransaction
      ) t`,
    prisma.region.count(),
  ]);

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
    buildingCount: Number(buildingCountResult[0]?.cnt ?? 0),
    regionCount,
  };

  res.json({ success: true, data: stats });
}));

// GET /api/meta/region-facilities-summary - 한글 지역명으로 카테고리별 시설 인프라 요약 조회
router.get('/region-facilities-summary', asyncHandler(async (req: Request, res: Response) => {
  const city = req.query.city as string | undefined;
  const district = req.query.district as string | undefined;

  if (!city) {
    res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'city 파라미터가 필요합니다' } });
    return;
  }

  // city 한글명(short name) → citySlug 변환
  const citySlug = SHORT_TO_SLUG[city];

  if (!citySlug) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' } });
    return;
  }

  if (!district) {
    // city 통계
    const stats = await getStatsByCity(citySlug);
    if (!stats) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' } });
      return;
    }
    res.json({
      success: true,
      data: {
        city: stats.city,
        categories: stats.categories,
        total: stats.total,
        topCategories: stats.topCategories,
      },
    });
    return;
  }

  // district 한글명 → districtSlug 변환
  const districtRegion = await prisma.region.findFirst({
    where: { city, district },
    select: { slug: true },
  });

  if (!districtRegion) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' } });
    return;
  }

  // districtSlug: slug 전체 또는 하이픈 이후 부분 — getStatsByDistrict는 districtSlug (하이픈 이후) 기대
  // 실제 slug 형식 확인 필요: "gangnam" 또는 "seoul-gangnam"
  const districtSlug = districtRegion.slug.includes('-')
    ? districtRegion.slug.split('-').slice(1).join('-')
    : districtRegion.slug;

  const stats = await getStatsByDistrict(citySlug, districtSlug);
  if (!stats) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' } });
    return;
  }

  res.json({
    success: true,
    data: {
      city,
      district,
      categories: stats.categories,
      total: stats.total,
      topCategories: stats.topCategories,
    },
  });
}));

// GET /api/meta/stats/:citySlug - 시/도별 카테고리별 시설 통계
router.get('/stats/:citySlug', asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const stats = await getStatsByCity(citySlug);

  if (!stats) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' } });
    return;
  }

  res.json({ success: true, data: stats });
}));

// GET /api/meta/stats/:citySlug/:districtSlug - 구/군별 카테고리별 시설 통계
router.get('/stats/:citySlug/:districtSlug', asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const districtSlug = req.params.districtSlug as string;
  const stats = await getStatsByDistrict(citySlug, districtSlug);

  if (!stats) {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' } });
    return;
  }

  res.json({ success: true, data: stats });
}));

// GET /api/meta/sync-status - 카테고리별 최근 동기화 날짜
router.get('/sync-status', asyncHandler(async (_req: Request, res: Response) => {
  const syncStatus = await getSyncStatus();
  res.json({ success: true, data: syncStatus });
}));

// GET /api/meta/regions - 지역 목록
router.get('/regions', asyncHandler(async (req: Request, res: Response) => {
  const { city } = req.query;

  const regions = await prisma.region.findMany({
    where: city ? { city: city as string } : undefined,
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

  res.json({
    success: true,
    data: regions.map((r) => ({
      ...r,
      lat: Number(r.lat),
      lng: Number(r.lng),
    })),
  });
}));

export default router;
