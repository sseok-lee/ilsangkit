// /api/lh-announcement — LH 공고(분양/임대) 목록 + 상세

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  LhAnnouncementListQuerySchema,
  LhAnnouncementIdParamsSchema,
} from '../schemas/lhAnnouncement.js';
import {
  getLhAnnouncementList,
  getLhAnnouncementDetail,
} from '../services/lhAnnouncementService.js';

const router = Router();

router.get(
  '/',
  validate(LhAnnouncementListQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof LhAnnouncementListQuerySchema>;
    const result = await getLhAnnouncementList(params);
    res.json({ success: true, data: result });
  })
);

router.get(
  '/:id',
  validateMultiple({ params: LhAnnouncementIdParamsSchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { id } = res.locals.validated.params as z.infer<typeof LhAnnouncementIdParamsSchema>;
    const detail = await getLhAnnouncementDetail(id);
    res.json({ success: true, data: detail });
  })
);

export default router;
