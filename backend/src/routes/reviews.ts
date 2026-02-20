import { Router, Request, Response } from 'express';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  DeleteReviewSchema,
  ReviewIdParamSchema,
  FacilityReviewsParamsSchema,
  ReviewPaginationSchema,
  RecentReviewsQuerySchema,
} from '../schemas/review.js';
import * as reviewService from '../services/reviewService.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { reviewWriteRateLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// POST /api/reviews - 리뷰 작성
router.post(
  '/',
  reviewWriteRateLimiter,
  validate(CreateReviewSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const review = await reviewService.createReview(req.body);
    res.status(201).json({ success: true, data: review });
  })
);

// GET /api/reviews/recent - 최근 리뷰 (홈페이지용)
router.get(
  '/recent',
  validate(RecentReviewsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as unknown as { limit: number };
    const reviews = await reviewService.getRecentReviews(limit);
    res.json({ success: true, data: reviews });
  })
);

// GET /api/reviews/facility/:category/:id - 시설별 리뷰 목록
router.get(
  '/facility/:category/:id',
  validateMultiple({
    params: FacilityReviewsParamsSchema,
    query: ReviewPaginationSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, query } = res.locals.validated as {
      params: { category: string; id: string };
      query: { page: number; limit: number };
    };
    const result = await reviewService.getReviewsByFacility(
      params.category,
      params.id,
      { page: query.page, limit: query.limit }
    );
    res.json({ success: true, data: result });
  })
);

// PUT /api/reviews/:id - 리뷰 수정
router.put(
  '/:id',
  reviewWriteRateLimiter,
  validateMultiple({
    params: ReviewIdParamSchema,
    body: UpdateReviewSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = res.locals.validated as {
      params: { id: number };
      body: { password: string; content?: string; nickname?: string };
    };
    const review = await reviewService.verifyPasswordAndUpdate(params.id, body);
    res.json({ success: true, data: review });
  })
);

// DELETE /api/reviews/:id - 리뷰 삭제
router.delete(
  '/:id',
  reviewWriteRateLimiter,
  validateMultiple({
    params: ReviewIdParamSchema,
    body: DeleteReviewSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, body } = res.locals.validated as {
      params: { id: number };
      body: { password: string };
    };
    await reviewService.verifyPasswordAndDelete(params.id, body.password);
    res.json({ success: true, data: { message: '리뷰가 삭제되었습니다' } });
  })
);

export default router;
