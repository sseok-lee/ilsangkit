import { Router, Request, Response } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma.js';
import { asyncHandler } from '../lib/asyncHandler.js';

const router = Router();

const GuideListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  category: z.string().optional(),
});

const GuideRecentQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(20).default(4),
});

// GET /api/guides — Guide list with pagination and category filter
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = GuideListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
      return;
    }

    const { page, limit, category } = parsed.data;
    const skip = (page - 1) * limit;

    const where = {
      published: true,
      ...(category ? { category } : {}),
    };

    const [total, items] = await Promise.all([
      prisma.guide.count({ where }),
      prisma.guide.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          title: true,
          slug: true,
          summary: true,
          category: true,
          thumbnailUrl: true,
          keywords: true,
          viewCount: true,
          createdAt: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    res.json({
      success: true,
      data: { items, total, page, totalPages },
    });
  })
);

// GET /api/guides/recent — Recent N guides for homepage
router.get(
  '/recent',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = GuideRecentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.message },
      });
      return;
    }

    const { limit } = parsed.data;

    const items = await prisma.guide.findMany({
      where: { published: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        summary: true,
        category: true,
        thumbnailUrl: true,
        keywords: true,
        viewCount: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: items });
  })
);

// GET /api/guides/:slug — Guide detail
router.get(
  '/:slug',
  asyncHandler(async (req: Request, res: Response) => {
    const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : req.params.slug;

    const guide = await prisma.guide.findUnique({ where: { slug } });

    if (!guide || !guide.published) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '가이드를 찾을 수 없습니다' },
      });
      return;
    }

    await prisma.guide.update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    });

    res.json({ success: true, data: { ...guide, viewCount: guide.viewCount + 1 } });
  })
);

export default router;
