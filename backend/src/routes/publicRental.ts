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
  getPublicRentalSiblings,
  getPublicRentalNearby,
} from '../services/publicRentalService.js';
import announcementRouter from './publicRentalAnnouncement.js';

const router = Router();

// 더 구체적인 prefix 라우터를 /:id 보다 먼저 마운트.
router.use('/announcements', announcementRouter);

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

router.get(
  '/:id/siblings',
  validateMultiple({ params: PublicRentalIdParamsSchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { id } = res.locals.validated.params as z.infer<typeof PublicRentalIdParamsSchema>;
    const siblings = await getPublicRentalSiblings(id);
    res.json({ success: true, data: siblings });
  })
);

router.get(
  '/:id/nearby',
  validateMultiple({ params: PublicRentalIdParamsSchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { id } = res.locals.validated.params as z.infer<typeof PublicRentalIdParamsSchema>;
    const nearby = await getPublicRentalNearby(id);
    res.json({ success: true, data: nearby });
  })
);

export default router;
