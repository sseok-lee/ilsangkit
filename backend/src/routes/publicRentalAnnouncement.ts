// /api/public-rental/announcements — 공공임대 입주자 모집공고 (마이홈)

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  PublicRentalAnnouncementListQuerySchema,
  PublicRentalAnnouncementParamsSchema,
} from '../schemas/publicRentalAnnouncement.js';
import {
  listAnnouncements,
  getAnnouncement,
} from '../services/publicRentalAnnouncementService.js';

const router = Router();

router.get(
  '/',
  validate(PublicRentalAnnouncementListQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof PublicRentalAnnouncementListQuerySchema>;
    const result = await listAnnouncements(params);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:pblancId',
  validateMultiple({ params: PublicRentalAnnouncementParamsSchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { pblancId } = res.locals.validated.params as z.infer<
      typeof PublicRentalAnnouncementParamsSchema
    >;
    const detail = await getAnnouncement(pblancId);
    res.json({ success: true, data: detail });
  }),
);

export default router;
