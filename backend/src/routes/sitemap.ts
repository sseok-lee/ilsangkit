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
  getWasteScheduleRegions,
  getRegionCategoryCombinations,
  getRealEstateBuildings,
  getRealEstateBuildingCount,
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
 * GET /api/sitemap/waste-schedule-regions
 * 쓰레기 배출 일정 지역(구·군) 집계 목록 조회 (사이트맵용)
 * 개별 /trash/[id] 대신 구·군 집계 URL 사이트맵 생성에 사용
 */
router.get(
  '/waste-schedule-regions',
  asyncHandler(async (_req: Request, res: Response) => {
    const regions = await getWasteScheduleRegions();
    res.json({ success: true, data: { regions } });
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
const RealEstateBuildingsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(50000).default(10000),
});

router.get(
  '/real-estate-buildings',
  validate(RealEstateBuildingsQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    // 전량 반환(356,461행 / 50.8MB)은 백엔드 메모리를 +275MB 밀어올려 PM2 재시작을 유발했다.
    // 청크 단위로만 반환한다. total 은 프론트가 청크 수를 계산하는 데 필요하다.
    const { page, limit } = req.query as unknown as z.infer<typeof RealEstateBuildingsQuerySchema>;
    const [data, total] = await Promise.all([
      getRealEstateBuildings({ page, limit }),
      getRealEstateBuildingCount(),
    ]);
    res.json({ success: true, data, total });
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
