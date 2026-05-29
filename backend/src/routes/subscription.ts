import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  getSubscriptionList,
  getSubscriptionDetail,
  getUpcomingSubscriptions,
  getRentalPriceStats,
  getCompetitionRanking,
} from '../services/subscriptionService.js';
import {
  SubscriptionListSchema,
  SubscriptionIdSchema,
  RentalPriceStatsSchema,
  SubscriptionCompetitionRankSchema,
} from '../schemas/subscription.js';
import type { z } from 'zod';

const router = Router();

// GET /api/subscription - 목록
router.get(
  '/',
  validate(SubscriptionListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof SubscriptionListSchema>;
    const result = await getSubscriptionList(params);
    res.json({ success: true, data: result });
  })
);

// GET /api/subscription/upcoming - 다가오는 청약 (/:id 앞에 선언)
router.get(
  '/upcoming',
  asyncHandler(async (_req: Request, res: Response) => {
    const items = await getUpcomingSubscriptions(5);
    res.json({ success: true, data: items });
  })
);

// GET /api/subscription/competition - 경쟁률·가점 랭킹 (/:id 앞에 선언)
router.get(
  '/competition',
  validate(SubscriptionCompetitionRankSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof SubscriptionCompetitionRankSchema>;
    const result = await getCompetitionRanking(params);
    res.json({ success: true, data: result });
  })
);

// GET /api/subscription/:id/rental-price-stats - 임대 시세
router.get(
  '/:id/rental-price-stats',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = SubscriptionIdSchema.parse(req.params);
    const subscription = await getSubscriptionDetail(id);

    const stats = await getRentalPriceStats(subscription.regionName);
    const validated = RentalPriceStatsSchema.parse(stats);
    res.json({ success: true, data: validated });
  })
);

// GET /api/subscription/:id - 상세
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = SubscriptionIdSchema.parse(req.params);
    const result = await getSubscriptionDetail(id);
    res.json({ success: true, data: result });
  })
);

export default router;
