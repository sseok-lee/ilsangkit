// @TASK T1.4 - 메타 API
// @SPEC docs/planning/02-trd.md#메타-API

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getStatsByCity, getStatsByDistrict, getSyncStatus } from '../services/facilityService.js';

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
  const [toiletCount, wifiCount, clothesCount, kioskCount, trashCount, parkingCount, aedCount, libraryCount, hospitalCount, pharmacyCount] = await Promise.all([
    prisma.toilet.count(),
    prisma.wifi.count(),
    prisma.clothes.count(),
    prisma.kiosk.count(),
    prisma.wasteSchedule.count(),
    prisma.parking.count(),
    prisma.aed.count(),
    prisma.library.count(),
    prisma.hospital.count(),
    prisma.pharmacy.count(),
  ]);

  const stats = {
    toilet: toiletCount,
    wifi: wifiCount,
    clothes: clothesCount,
    kiosk: kioskCount,
    trash: trashCount,
    parking: parkingCount,
    aed: aedCount,
    library: libraryCount,
    hospital: hospitalCount,
    pharmacy: pharmacyCount,
    total: toiletCount + wifiCount + clothesCount + kioskCount + trashCount + parkingCount + aedCount + libraryCount + hospitalCount + pharmacyCount,
  };

  res.json({ success: true, data: stats });
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
  const { citySlug, districtSlug } = req.params;
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
