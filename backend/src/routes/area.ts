import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { CITY_SLUG_TO_FULL } from '../services/facilityService.js';
import { getCityAreaData, getDistrictAreaData } from '../services/areaService.js';

const SlugSchema = z.string().regex(/^[a-z-]+$/).max(30);

const CitySlugParamsSchema = z.object({
  citySlug: SlugSchema,
});

const CityDistrictSlugParamsSchema = z.object({
  citySlug: SlugSchema,
  districtSlug: SlugSchema,
});

const router = Router();

// GET /api/area/:citySlug — 시 단위 리포트 데이터
router.get('/:citySlug', validate(CitySlugParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;

  if (!CITY_SLUG_TO_FULL[citySlug]) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  const result = await getCityAreaData(citySlug);

  if (!result) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  if (result.cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, data: result.data });
    return;
  }

  if (!result.data) {
    throw new NotFoundError('해당 지역의 구/군 정보가 없습니다');
  }

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ success: true, data: result.data });
}));

// GET /api/area/:citySlug/:districtSlug — 지역 리포트 데이터
router.get('/:citySlug/:districtSlug', validate(CityDistrictSlugParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const districtSlug = req.params.districtSlug as string;

  const result = await getDistrictAreaData(citySlug, districtSlug);

  if (result.cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, data: result.data });
    return;
  }

  if (!result.data) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ success: true, data: result.data });
}));

export default router;
