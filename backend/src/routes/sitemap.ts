// 사이트맵용 ID 조회 API
import { Router, Request, Response } from 'express';
import * as facilityService from '../services/facilityService.js';
import * as wasteScheduleService from '../services/wasteScheduleService.js';
import type { FacilityCategory } from '../services/facilityService.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const VALID_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library', 'hospital', 'pharmacy'];

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

export default router;
