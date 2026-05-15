import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { RealEstateNaverBlogParamsSchema } from '../schemas/naverBlog.js';
import { getOrFetchNaverBlogForRealEstate } from '../services/naverBlogCacheService.js';
import type { RealEstateType } from '../services/naverBlogService.js';
import { getBuildingInfo } from '../services/realEstateService.js';

const router = Router();

function makeBuildingKey(city: string, district: string, buildingName: string): string {
  return `${city.trim()}|${district.trim()}|${buildingName.trim()}`;
}

router.get(
  '/:type/:city/:district/:buildingName/naver-blog',
  validate(RealEstateNaverBlogParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { type, city, district, buildingName } = req.params as {
      type: RealEstateType; city: string; district: string; buildingName: string;
    };

    const info = await getBuildingInfo(type, '', buildingName);
    if (!info) throw new NotFoundError('Building not found');

    const cacheOnly = req.query.ssr === '1';
    const buildingKey = makeBuildingKey(city, district, buildingName);
    const posts = await getOrFetchNaverBlogForRealEstate(type, buildingKey, {
      buildingName, city, district,
    }, { cacheOnly });

    res.json({ success: true, data: { posts } });
  }),
);

export default router;
