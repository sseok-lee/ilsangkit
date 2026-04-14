import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { listGuides, listRecentGuides, getGuideBySlug } from '../services/guideService.js';

const router = Router();

const GuideListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  category: z.string().optional(),
  categories: z.string().optional().transform(v => v ? v.split(',').filter(Boolean) : undefined),
  articleType: z.enum(['news', 'howto', 'listicle', 'guide']).optional(),
});

const GuideRecentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(4),
});

const GuideSlugParamsSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
});

// GET /api/guides — Guide list with pagination and category filter
router.get(
  '/',
  validate(GuideListQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listGuides(req.query as unknown as z.infer<typeof GuideListQuerySchema>);
    res.json({ success: true, data: result });
  })
);

// GET /api/guides/recent — Recent N guides for homepage
router.get(
  '/recent',
  validate(GuideRecentQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = req.query as unknown as z.infer<typeof GuideRecentQuerySchema>;
    const items = await listRecentGuides(limit);
    res.json({ success: true, data: items });
  })
);

// GET /api/guides/:slug — Guide detail
router.get(
  '/:slug',
  validate(GuideSlugParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;
    const guide = await getGuideBySlug(slug);

    if (!guide) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '가이드를 찾을 수 없습니다' },
      });
      return;
    }

    res.json({ success: true, data: guide });
  })
);

export default router;
