// 사이트맵용 ID 조회 API
import { Router, Request, Response, NextFunction } from 'express';
import * as facilityService from '../services/facilityService.js';
import * as wasteScheduleService from '../services/wasteScheduleService.js';
import type { FacilityCategory } from '../services/facilityService.js';

const router = Router();

const VALID_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'kiosk'];

/**
 * GET /api/sitemap/facilities/:category
 * 시설 카테고리별 전체 ID + updatedAt 조회
 */
router.get(
  '/facilities/:category',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const category = req.params.category as FacilityCategory;
      if (!VALID_CATEGORIES.includes(category)) {
        res.status(400).json({ success: false, error: 'Invalid category' });
        return;
      }

      const data = await facilityService.getAllIds(category);
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/sitemap/waste-schedules
 * 쓰레기 배출 일정 전체 ID + updatedAt 조회
 */
router.get(
  '/waste-schedules',
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await wasteScheduleService.getAllIds();
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
