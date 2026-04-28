// 사이트맵용 ID 조회 API
import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import type { FacilityCategory } from '../services/facilityService.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import {
  isValidCategory,
  getFacilityIds,
  getWasteScheduleIds,
  getRegionCategoryCombinations,
  getRealEstateBuildings,
  getRealEstateCityDistrictHubs,
  getSubscriptionIds,
  getSitemapPageCounts,
} from '../services/sitemapService.js';

const SitemapFacilitiesQuerySchema = z.object({
  limit: z.coerce.number().int().positive().optional(),
});

const router = Router();

/**
 * GET /api/sitemap/facilities/:category
 * 시설 카테고리별 전체 ID + updatedAt 조회
 */
router.get(
  '/facilities/:category',
  validate(SitemapFacilitiesQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const category = req.params.category as string;
    if (!isValidCategory(category)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: '유효하지 않은 카테고리입니다',
        },
      });
      return;
    }

    const limit = (req.query as unknown as { limit?: number }).limit;
    const data = await getFacilityIds(category as FacilityCategory, limit);
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/waste-schedules
 * 쓰레기 배출 일정 전체 ID + updatedAt 조회
 */
router.get(
  '/waste-schedules',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getWasteScheduleIds();
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/region-categories
 * 실제 데이터가 있는 지역-카테고리 조합 조회 (사이트맵용)
 */
router.get(
  '/region-categories',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getRegionCategoryCombinations();
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/real-estate-buildings
 * 부동산 건물 목록 (사이트맵용) - propertyType + buildingName + bjdCode
 */
router.get(
  '/real-estate-buildings',
  asyncHandler(async (_req: Request, res: Response) => {
    const buildings = await getRealEstateBuildings();
    res.json({ success: true, data: buildings });
  })
);

/**
 * GET /api/sitemap/real-estate-hubs
 * 부동산 city/district 허브 목록 (사이트맵용) - realEstateType + city + district
 */
router.get(
  '/real-estate-hubs',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getRealEstateCityDistrictHubs();
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/subscriptions
 * 청약 공고 전체 ID + updatedAt 조회
 */
router.get(
  '/subscriptions',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getSubscriptionIds();
    res.json({ success: true, data });
  })
);

/**
 * GET /api/sitemap/page-counts
 * 사이트맵 인덱스 생성에 필요한 카테고리별 항목 수 + 최신 updatedAt 반환.
 * 전체 데이터를 fetch하지 않고 COUNT/MAX 집계만 수행해 응답 속도를 최소화.
 */
router.get(
  '/page-counts',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getSitemapPageCounts();
    res.json({ success: true, data });
  })
);

export default router;
