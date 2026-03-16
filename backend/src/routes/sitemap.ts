// 사이트맵용 ID 조회 API
import { Router, Request, Response } from 'express';
import * as facilityService from '../services/facilityService.js';
import * as wasteScheduleService from '../services/wasteScheduleService.js';
import type { FacilityCategory } from '../services/facilityService.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import prisma from '../lib/prisma.js';

const router = Router();

const VALID_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market'];

/**
 * GET /api/sitemap/facilities/:category
 * 시설 카테고리별 전체 ID + updatedAt 조회
 */
router.get(
  '/facilities/:category',
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.params.category as FacilityCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: '유효하지 않은 카테고리입니다',
        },
      });
      return;
    }

    const data = await facilityService.getAllIds(category);
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/waste-schedules
 * 쓰레기 배출 일정 전체 ID + updatedAt 조회
 */
router.get(
  '/waste-schedules',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await wasteScheduleService.getAllIds();
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/region-categories
 * 실제 데이터가 있는 지역-카테고리 조합 조회 (사이트맵용)
 */
router.get(
  '/region-categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await facilityService.getRegionCategoryCombinations();
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/real-estate-buildings
 * 부동산 건물 목록 (사이트맵용) - propertyType + buildingName + bjdCode
 */
router.get(
  '/real-estate-buildings',
  asyncHandler(async (_req: Request, res: Response) => {
    const buildings = await prisma.$queryRaw<
      Array<{ propertyType: string; buildingName: string; bjdCode: string }>
    >`
      SELECT 'apt' AS propertyType, buildingName, bjdCode FROM (
        SELECT DISTINCT buildingName, bjdCode FROM AptSaleTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM AptRentTransaction
      ) apt WHERE buildingName IS NOT NULL AND buildingName != ''
      UNION ALL
      SELECT 'villa' AS propertyType, buildingName, bjdCode FROM (
        SELECT DISTINCT buildingName, bjdCode FROM VillaSaleTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM VillaRentTransaction
      ) villa WHERE buildingName IS NOT NULL AND buildingName != ''
      UNION ALL
      SELECT 'offitel' AS propertyType, buildingName, bjdCode FROM (
        SELECT DISTINCT buildingName, bjdCode FROM OffitelSaleTransaction
        UNION SELECT DISTINCT buildingName, bjdCode FROM OffitelRentTransaction
      ) offitel WHERE buildingName IS NOT NULL AND buildingName != ''
    `;

    res.json({ success: true, data: buildings });
  })
);

export default router;
