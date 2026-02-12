// 사이트맵용 ID 조회 API
import { Router, Request, Response } from 'express';
import * as facilityService from '../services/facilityService.js';
import * as wasteScheduleService from '../services/wasteScheduleService.js';
import type { FacilityCategory } from '../services/facilityService.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const VALID_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library'];

/**
 * GET /api/sitemap/facilities/:category
 * 시설 카테고리별 전체 ID + updatedAt 조회
 */
router.get(
  '/facilities/:category',
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.params.category as FacilityCategory;
    if (!VALID_CATEGORIES.includes(category)) {
      res.status(400).json({ success: false, error: 'Invalid category' });
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

export default router;
