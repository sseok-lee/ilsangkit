// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 API
// @SPEC docs/planning/02-trd.md#API-설계

import { Router, Request, Response } from 'express';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  FacilitySearchSchema,
  FacilityDetailParamsSchema,
  RegionFacilitiesParamsSchema,
  RegionFacilitiesQuerySchema,
} from '../schemas/facility.js';
import * as facilityService from '../services/facilityService.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { searchRateLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// POST /api/facilities/search
router.post(
  '/search',
  searchRateLimiter, // Apply stricter rate limit for search endpoint
  validate(FacilitySearchSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await facilityService.search(req.body);
    res.json({ success: true, data: result });
  })
);

// @TASK T1.3 - 지역별 시설 조회 API
// GET /api/facilities/region/:city/:district/:category
router.get(
  '/region/:city/:district/:category',
  validateMultiple({
    params: RegionFacilitiesParamsSchema,
    query: RegionFacilitiesQuerySchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, query } = res.locals.validated as {
      params: { city: string; district: string; category: string };
      query: { page: number; limit: number };
    };
    const { city, district, category } = params;
    const { page, limit } = query;

    const result = await facilityService.getByRegion(city, district, category, { page, limit });
    res.json({ success: true, data: result });
  })
);

// @TASK T1.2 - 시설 상세 조회 API
// @SPEC docs/planning/02-trd.md#시설-상세-조회
// GET /api/facilities/:category/:id
router.get(
  '/:category/:id',
  validate(FacilityDetailParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const categoryParam = req.params.category;
    const idParam = req.params.id;

    // 배열인 경우 첫 번째 값 사용
    const category = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const facility = await facilityService.getDetail(category, id);

    if (!facility) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '시설을 찾을 수 없습니다' },
      });
      return;
    }

    res.json({ success: true, data: facility });
  })
);

export default router;
