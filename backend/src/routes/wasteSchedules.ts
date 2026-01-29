// 쓰레기 배출 일정 API 라우터
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import { Router, Request, Response, NextFunction } from 'express';
import { validateMultiple } from '../middlewares/validate.js';
import { WasteScheduleQuerySchema, WasteScheduleRegionsQuerySchema } from '../schemas/wasteSchedule.js';
import * as wasteScheduleService from '../services/wasteScheduleService.js';

const router = Router();

/**
 * GET /api/waste-schedules
 * 지역별 쓰레기 배출 일정 조회
 * Query: city (필수), district (선택), page, limit
 */
router.get(
  '/',
  validateMultiple({ query: WasteScheduleQuerySchema }),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = res.locals.validated as {
        query: { city: string; district?: string; page: number; limit: number };
      };
      const { city, district, page, limit } = query;

      const result = await wasteScheduleService.getByRegion(city, district, { page, limit });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/waste-schedules/regions
 * 배출 일정이 있는 지역 목록 조회
 * Query: page, limit
 */
router.get(
  '/regions',
  validateMultiple({ query: WasteScheduleRegionsQuerySchema }),
  async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = res.locals.validated as {
        query: { page: number; limit: number };
      };
      const { page, limit } = query;

      const result = await wasteScheduleService.getRegions({ page, limit });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/waste-schedules/cities
 * 시/도 목록 조회
 */
router.get('/cities', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cities = await wasteScheduleService.getCities();
    res.json({ success: true, data: { items: cities } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/waste-schedules/districts/:city
 * 특정 시/도의 구/군 목록 조회
 */
router.get('/districts/:city', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const cityParam = req.params.city;
    const city = Array.isArray(cityParam) ? cityParam[0] : cityParam;
    const districts = await wasteScheduleService.getDistricts(city);
    res.json({ success: true, data: { items: districts } });
  } catch (error) {
    next(error);
  }
});

export default router;
