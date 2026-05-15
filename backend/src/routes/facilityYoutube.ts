import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { FacilityYoutubeParamsSchema } from '../schemas/youtube.js';
import { CATEGORY_REGISTRY, type FacilityCategory } from '../services/categoryRegistry.js';
import { getOrFetchYoutubeVideos } from '../services/youtubeCacheService.js';

const router = Router();

router.get(
  '/:category/:id/youtube',
  validate(FacilityYoutubeParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, id } = req.params as { category: FacilityCategory; id: string };

    const model = CATEGORY_REGISTRY[category].model();
    const facility = await model.findUnique({
      where: { id },
      select: { id: true, name: true, city: true, district: true },
    });
    if (!facility) {
      throw new NotFoundError('Facility not found');
    }

    const videos = await getOrFetchYoutubeVideos(category, id, {
      name: facility.name,
      city: facility.city,
      district: facility.district,
    });

    res.json({ success: true, data: { videos } });
  }),
);

export default router;
