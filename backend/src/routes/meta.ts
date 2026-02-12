// @TASK T1.4 - 메타 API
// @SPEC docs/planning/02-trd.md#메타-API

import { Router, Request, Response } from 'express';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

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
  const [toiletCount, wifiCount, clothesCount, kioskCount, trashCount, parkingCount, aedCount, libraryCount] = await Promise.all([
    prisma.toilet.count(),
    prisma.wifi.count(),
    prisma.clothes.count(),
    prisma.kiosk.count(),
    prisma.wasteSchedule.count(),
    prisma.parking.count(),
    prisma.aed.count(),
    prisma.library.count(),
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
    total: toiletCount + wifiCount + clothesCount + kioskCount + trashCount + parkingCount + aedCount + libraryCount,
  };

  res.json({ success: true, data: stats });
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
