import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { listArticles, listRecentArticles, getArticleBySlug } from '../services/articleService.js';

const router = Router();

const ArticleListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  category: z.string().optional(),
  categories: z.string().optional().transform(v => v ? v.split(',').filter(Boolean) : undefined),
  articleType: z.string().optional(),
});

const ArticleRecentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(4),
});

const ArticleSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
});

// GET /api/articles — Published article list with pagination and category filter
router.get(
  '/',
  validate(ArticleListQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listArticles(req.query as unknown as z.infer<typeof ArticleListQuerySchema>);
    res.json({ success: true, data: result });
  })
);

// GET /api/articles/recent — Recent N published articles for homepage
router.get(
  '/recent',
  validate(ArticleRecentQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as unknown as z.infer<typeof ArticleRecentQuerySchema>;
    const items = await listRecentArticles(limit);
    res.json({ success: true, data: items });
  })
);

// GET /api/articles/:slug — Article detail
router.get(
  '/:slug',
  validate(ArticleSlugParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const article = await getArticleBySlug(slug);

    if (!article) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '오늘의 이슈를 찾을 수 없습니다' },
      });
      return;
    }

    res.json({ success: true, data: article });
  })
);

export default router;
