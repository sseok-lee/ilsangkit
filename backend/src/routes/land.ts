// 토지 실거래가 API 라우트

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getRegionList, getRegionDetail, getHubSummary, getSitemapEntries } from '../services/landService.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { LandRegionListSchema, LandRegionDetailSchema } from '../schemas/land.js';

const router = Router();

// GET /api/real-estate/land/hub-summary
router.get(
  '/hub-summary',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getHubSummary();
    res.json({ success: true, data });
  })
);

// GET /api/real-estate/land/regions — 동 목록
router.get(
  '/regions',
  validate(LandRegionListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof LandRegionListSchema>;
    const data = await getRegionList(params);
    res.json({ success: true, data });
  })
);

// GET /api/real-estate/land/region — 동 상세
router.get(
  '/region',
  validate(LandRegionDetailSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof LandRegionDetailSchema>;
    const data = await getRegionDetail(params);
    res.json({ success: true, data });
  })
);

// GET /api/real-estate/land/sitemap
router.get(
  '/sitemap',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getSitemapEntries();
    res.json({ success: true, data });
  })
);

export default router;
