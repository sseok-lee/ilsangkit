import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { FacilityNaverBlogParamsSchema } from '../schemas/naverBlog.js';
import { CATEGORY_REGISTRY, type FacilityCategory } from '../services/categoryRegistry.js';
import { getOrFetchNaverBlogForFacility } from '../services/naverBlogCacheService.js';
import { isWifiGroupId } from '../services/wifiGroup.js';
import { getWifiGroupHeader } from '../services/wifiService.js';

const router = Router();

router.get(
  '/:category/:id/naver-blog',
  validate(FacilityNaverBlogParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, id } = req.params as { category: FacilityCategory; id: string };

    // wifi 장소 단위 그룹 id(wifi-g…)는 Wifi.id 가 아니라 Wifi.groupId 다.
    // findUnique({ id }) 로는 못 찾아 404 가 난다.
    const facility =
      category === 'wifi' && isWifiGroupId(id)
        ? await getWifiGroupHeader(id)
        : await CATEGORY_REGISTRY[category].model().findUnique({
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
