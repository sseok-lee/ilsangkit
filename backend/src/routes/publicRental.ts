// /api/public-rental — LH myhome 매입/전세임대 단지 목록 + 상세 + 통계

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  PublicRentalListQuerySchema,
  PublicRentalIdParamsSchema,
} from '../schemas/publicRental.js';
import {
  getPublicRentalList,
  getPublicRentalDetail,
  getPublicRentalStats,
} from '../services/publicRentalService.js';

const router = Router();

router.get(
  '/stats',
  asyncHandler(async (_req: Request, res: Response) => {
    const stats = await getPublicRentalStats();
    res.json({ success: true, data: stats });
  })
);

router.get(
  '/',
  validate(PublicRentalListQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof PublicRentalListQuerySchema>;
    const result = await getPublicRentalList(params);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/:id',
  validateMultiple({ params: PublicRentalIdParamsSchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { id } = res.locals.validated.params as z.infer<typeof PublicRentalIdParamsSchema>;
    const detail = await getPublicRentalDetail(id);
    res.json({ success: true, data: detail });
  })
);

export default router;
