// 쓰레기 배출 일정 API 라우터
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { validate, validateMultiple } from '../middlewares/validate.js';
import { WasteScheduleQuerySchema, WasteScheduleRegionsQuerySchema } from '../schemas/wasteSchedule.js';

const CityParamsSchema = z.object({
  city: z.string().min(1).max(50),
});
import * as wasteScheduleService from '../services/wasteScheduleService.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError, NotFoundError, ServiceUnavailableError } from '../lib/errors.js';

const router = Router();

router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

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
      query: { city?: string; district?: string; keyword?: string; page: number; limit: number };
    };
    const { city, district, keyword, page, limit, coverage } = query as typeof query & {
      coverage?: 'unresolved';
    };

    const result = await translateWasteScheduleRouteRead(res, () => wasteScheduleService.getByRegion(city, district, keyword, {
      page,
      limit,
      coverage,
    }));
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

    const result = await translateWasteScheduleRouteRead(res, () => wasteScheduleService.getRegions({ page, limit }));
    res.json({ success: true, data: result });
  })
);

/**
 * GET /api/waste-schedules/cities
 * 시/도 목록 조회
 */
router.get('/cities', asyncHandler(async (_req: Request, res: Response) => {
  const cities = await translateWasteScheduleRouteRead(res, () => wasteScheduleService.getCities());
  res.json({ success: true, data: { items: cities } });
}));

/**
 * GET /api/waste-schedules/districts/:city
 * 특정 시/도의 구/군 목록 조회
 */
router.get('/districts/:city', validate(CityParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const city = req.params.city as string;
  const districts = await translateWasteScheduleRouteRead(res, () => wasteScheduleService.getDistricts(city));
  res.json({ success: true, data: { items: districts } });
}));

/**
 * GET /api/waste-schedules/:id
 * 단건 조회 (상세 페이지용)
 */
router.get('/:id', asyncHandler(async (req: Request, res: Response) => {
  const rawId = String(req.params.id);
  if (!/^[1-9]\d*$/.test(rawId)) {
    throw new AppError(400, '잘못된 쓰레기 정보 ID입니다', 'INVALID_WASTE_ID');
  }
  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) {
    throw new AppError(400, '잘못된 쓰레기 정보 ID입니다', 'INVALID_WASTE_ID');
  }
  const item = await translateWasteScheduleRouteRead(res, () => wasteScheduleService.getById(id));
  if (!item) {
    throw new NotFoundError('배출 일정을 찾을 수 없습니다');
  }
  res.json({ success: true, data: item });
}));

async function translateWasteScheduleRouteRead<T>(res: Response, read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof AppError) {
      if (error.statusCode === 503) res.setHeader('Cache-Control', 'no-store');
      throw error;
    }
    res.setHeader('Cache-Control', 'no-store');
    throw new ServiceUnavailableError('쓰레기 배출 정보를 조회할 수 없습니다', 'WASTE_SOURCE_UNAVAILABLE');
  }
}

export default router;
