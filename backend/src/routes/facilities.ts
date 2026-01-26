// @TASK T1.1 - 시설 검색 API
// @SPEC docs/planning/02-trd.md#API-설계

import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middlewares/validate.js';
import { FacilitySearchSchema } from '../schemas/facility.js';
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

export default router;
