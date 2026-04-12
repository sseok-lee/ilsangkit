import { Router, Request, Response } from 'express';
import { validate, validateMultiple } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  getSubscriptionList,
  getSubscriptionDetail,
  getUpcomingSubscriptions,
} from '../services/subscriptionService.js';
import {
  SubscriptionListSchema,
  SubscriptionIdSchema,
} from '../schemas/subscription.js';
import type { z } from 'zod';

const router = Router();

// GET /api/subscription - 목록
router.get(
  '/',
  validate(SubscriptionListSchema, 'query'),
  asyncHandler(async (_req: Request, res: Response) => {
    const params = res.locals.validated as z.infer<typeof SubscriptionListSchema>;
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

// GET /api/subscription/:id - 상세
router.get(
  '/:id',
  validateMultiple({ params: SubscriptionIdSchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { id } = res.locals.validated.params as z.infer<typeof SubscriptionIdSchema>;
    const result = await getSubscriptionDetail(id);
    res.json({ success: true, data: result });
  })
);

export default router;
