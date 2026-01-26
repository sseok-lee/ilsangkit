// @TASK T1.1, T1.2 - 시설 검색 및 상세 조회 API
// @SPEC docs/planning/02-trd.md#API-설계

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middlewares/validate.js';
import { FacilitySearchSchema, FacilityDetailParamsSchema } from '../schemas/facility.js';
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

// @TASK T1.2 - 시설 상세 조회 API
// @SPEC docs/planning/02-trd.md#시설-상세-조회
// GET /api/facilities/:category/:id
router.get(
  '/:category/:id',
  validate(FacilityDetailParamsSchema, 'params'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { category, id } = req.params;
      const facility = await facilityService.getDetail(category, id);

      if (!facility) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: '시설을 찾을 수 없습니다' },
        });
      }

      res.json({ success: true, data: facility });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
