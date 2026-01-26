// @TASK T1.1, T1.3 - 시설 검색/지역별 조회 API
// @SPEC docs/planning/02-trd.md#API-설계

import { Router, Request, Response, NextFunction } from 'express';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  FacilitySearchSchema,
  RegionFacilitiesParamsSchema,
  RegionFacilitiesQuerySchema,
} from '../schemas/facility.js';
import * as facilityService from '../services/facilityService.js';

const router = Router();

// POST /api/facilities/search
router.post(
  '/search',
  validate(FacilitySearchSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await facilityService.search(req.body);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

// @TASK T1.3 - 지역별 시설 조회 API
// GET /api/facilities/region/:city/:district/:category
router.get(
  '/region/:city/:district/:category',
  validateMultiple({
    params: RegionFacilitiesParamsSchema,
    query: RegionFacilitiesQuerySchema,
  }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { params, query } = res.locals.validated as {
        params: { city: string; district: string; category: string };
        query: { page: number; limit: number };
      };
      const { city, district, category } = params;
      const { page, limit } = query;

      const result = await facilityService.getByRegion(city, district, category, { page, limit });
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
