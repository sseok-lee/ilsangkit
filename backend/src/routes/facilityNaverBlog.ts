import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { FacilityNaverBlogParamsSchema } from '../schemas/naverBlog.js';
import { CATEGORY_REGISTRY, type FacilityCategory } from '../services/categoryRegistry.js';
import { getOrFetchNaverBlogForFacility } from '../services/naverBlogCacheService.js';

const router = Router();

router.get(
  '/:category/:id/naver-blog',
  validate(FacilityNaverBlogParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, id } = req.params as { category: FacilityCategory; id: string };
    const model = CATEGORY_REGISTRY[category].model();
    const facility = await model.findUnique({
      where: { id },
      select: { id: true, name: true, city: true, district: true },
    });
    if (!facility) throw new NotFoundError('Facility not found');

    const cacheOnly = req.query.ssr === '1';
    const posts = await getOrFetchNaverBlogForFacility(category, id, {
      name: facility.name, city: facility.city, district: facility.district,
    }, { cacheOnly });

    res.json({ success: true, data: { posts } });
  }),
);

export default router;
