import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { searchRateLimiter } from '../middlewares/rateLimit.js';
import { SuggestQuerySchema, SearchLogSchema, PopularSearchQuerySchema, type SearchLogInput } from '../schemas/search.js';
import { suggest } from '../services/search/searchSuggestService.js';
import { getPopular } from '../services/search/searchPopularService.js';
import { prisma } from '../lib/prisma.js';

const router = Router();

// GET /api/search/suggest?q=
router.get('/suggest', searchRateLimiter, validate(SuggestQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await suggest((req.query as unknown as { q: string }).q);
    res.json({ success: true, data: result });
  }));

// GET /api/search/popular?limit=&period=
router.get('/popular', validate(PopularSearchQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, period } = req.query as unknown as { limit: number; period: 'day' | 'week' | 'month' };
    const result = await getPopular({ limit, period });
    res.json({ success: true, data: result });
  }));

// POST /api/search/log (fire-and-forget)
router.post('/log', searchRateLimiter, validate(SearchLogSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as SearchLogInput;
    await prisma.searchLog.create({ data: body }).catch(() => undefined);
    res.json({ success: true });
  }));

export default router;
