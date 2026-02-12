// 쓰레기 배출 일정 API 라우터
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import { Router, Request, Response } from 'express';
import { validateMultiple } from '../middlewares/validate.js';
import { WasteScheduleQuerySchema, WasteScheduleRegionsQuerySchema } from '../schemas/wasteSchedule.js';
import * as wasteScheduleService from '../services/wasteScheduleService.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

/**
 * GET /api/waste-schedules
 * 지역별 쓰레기 배출 일정 조회
 * Query: city (필수), district (선택), page, limit
 */
router.get(
  '/',
  validateMultiple({ query: WasteScheduleQuerySchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { query } = res.locals.validated as {
      query: { city: string; district?: string; keyword?: string; page: number; limit: number };
    };
    const { city, district, keyword, page, limit } = query;

    const result = await wasteScheduleService.getByRegion(city, district, keyword, { page, limit });
    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/waste-schedules/regions
 * 배출 일정이 있는 지역 목록 조회
 * Query: page, limit
 */
router.get(
  '/regions',
  validateMultiple({ query: WasteScheduleRegionsQuerySchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { query } = res.locals.validated as {
      query: { page: number; limit: number };
    };
    const { page, limit } = query;

    const result = await wasteScheduleService.getRegions({ page, limit });
    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/waste-schedules/cities
 * 시/도 목록 조회
 */
router.get('/cities', asyncHandler(async (_req: Request, res: Response) => {
  const cities = await wasteScheduleService.getCities();
  res.json({ success: true, data: { items: cities } });
}));

/**
 * GET /api/waste-schedules/districts/:city
 * 특정 시/도의 구/군 목록 조회
 */
router.get('/districts/:city', asyncHandler(async (req: Request, res: Response) => {
  const cityParam = req.params.city;
  const city = Array.isArray(cityParam) ? cityParam[0] : cityParam;
  const districts = await wasteScheduleService.getDistricts(city);
  res.json({ success: true, data: { items: districts } });
}));

/**
 * GET /api/waste-schedules/:id
 * 단건 조회 (상세 페이지용)
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const idParam = req.params.id as string;
  const id = parseInt(idParam, 10);
  if (isNaN(id)) {
    res.status(400).json({
      success: false,
      error: {
        code: 'BAD_REQUEST',
        message: '유효하지 않은 ID입니다',
      },
    });
    return;
  }
  const item = await wasteScheduleService.getById(id);
  if (!item) {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: '배출 일정을 찾을 수 없습니다',
      },
    });
    return;
  }
  res.json({ success: true, data: item });
}));

export default router;
