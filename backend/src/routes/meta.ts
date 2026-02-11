// @TASK T1.4 - 메타 API
// @SPEC docs/planning/02-trd.md#메타-API

import { Router, Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/meta/categories - 활성화된 카테고리 목록
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    res.json({ success: true, data: categories });
  } catch (error) {
    next(error);
  }
});

// GET /api/meta/stats - 카테고리별 시설 개수
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [toiletCount, wifiCount, clothesCount, kioskCount, trashCount, parkingCount] = await Promise.all([
      prisma.toilet.count(),
      prisma.wifi.count(),
      prisma.clothes.count(),
      prisma.kiosk.count(),
      prisma.wasteSchedule.count(),
      prisma.parking.count(),
    ]);

    const stats = {
      toilet: toiletCount,
      wifi: wifiCount,
      clothes: clothesCount,
      kiosk: kioskCount,
      trash: trashCount,
      parking: parkingCount,
      total: toiletCount + wifiCount + clothesCount + kioskCount + trashCount + parkingCount,
    };

    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

// GET /api/meta/regions - 지역 목록
router.get('/regions', async (req: Request, res: Response, next: NextFunction) => {
  try {
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
  } catch (error) {
    next(error);
  }
});

export default router;
