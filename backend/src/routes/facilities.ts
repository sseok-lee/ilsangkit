// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 API
// @SPEC docs/planning/02-trd.md#API-설계

import { Router, Request, Response } from 'express';
import { validate, validateMultiple } from '../middlewares/validate.js';
import {
  FacilitySearchSchema,
  FacilityDetailParamsSchema,
  RegionFacilitiesParamsSchema,
  RegionAllFacilitiesParamsSchema,
  RegionFacilitiesQuerySchema,
  NearbyCountsSchema,
  NearbyCountCategorySchema,
  type NearbyCountsInput,
} from '../schemas/facility.js';
import * as facilityService from '../services/facilityService.js';
import type { FacilityCategory } from '../services/categoryRegistry.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { searchRateLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// POST /api/facilities/search
router.post(
  '/search',
  searchRateLimiter, // Apply stricter rate limit for search endpoint
  validate(FacilitySearchSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    if (req.body.grouped) {
      const result = await facilityService.searchGrouped(req.body);
      res.json({ success: true, data: result });
      return;
    }
    const result = await facilityService.search(req.body);
    res.json({ success: true, data: result });
  })
);

// 주변 시설 개수 요약 API
// GET /api/facilities/nearby-counts?lat=&lng=&radius=&categories=school,hospital
//
// 목록이 아니라 카테고리별 개수만 돌려준다. 개수만 필요한 호출자(부동산 상세 SSR 의
// "주변 병원 N곳" 요약 등)가 POST /search 를 쓰면 목록 생성 비용을 다 치르고도
// 페이지에 담긴 20건에서 세게 돼 실제 개수와 어긋난다.
//
// :category/:id 계열보다 위에 둔다 — 단일 세그먼트라 현재는 충돌하지 않지만,
// 나중에 '/:category' 라우트가 생겨도 여기서 먼저 잡히도록.
router.get(
  '/nearby-counts',
  validate(NearbyCountsSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    // validate(…, 'query') 는 검증 결과로 req.query 를 교체한다(res.locals 가 아니다 —
    // res.locals.validated 는 validateMultiple 쪽 규약).
    const { lat, lng, radius, categories } = req.query as unknown as NearbyCountsInput;
    const counts = await facilityService.countNearby({
      lat,
      lng,
      radius,
      categories: (categories ?? NearbyCountCategorySchema.options) as FacilityCategory[],
    });
    res.set('Cache-Control', 'public, max-age=600, stale-while-revalidate=1800');
    res.json({ success: true, data: { radius, counts } });
  })
);

// 지역별 전체 카테고리 시설 조회 API
// GET /api/facilities/region/:city/:district
router.get(
  '/region/:city/:district',
  validateMultiple({
    params: RegionAllFacilitiesParamsSchema,
    query: RegionFacilitiesQuerySchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, query } = res.locals.validated as {
      params: { city: string; district: string };
      query: { page: number; limit: number };
    };
    const { city, district } = params;
    const { page, limit } = query;

    const result = await facilityService.getByRegionAll(city, district, { page, limit });
    res.json({ success: true, data: result });
  })
);

// @TASK T1.3 - 지역별 시설 조회 API
// GET /api/facilities/region/:city/:district/:category
router.get(
  '/region/:city/:district/:category',
  validateMultiple({
    params: RegionFacilitiesParamsSchema,
    query: RegionFacilitiesQuerySchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, query } = res.locals.validated as {
      params: { city: string; district: string; category: string };
      query: { page: number; limit: number; departments?: string[] };
    };
    const { city, district, category } = params;
    const { page, limit, departments } = query;

    const result = await facilityService.getByRegion(city, district, category, { page, limit, departments });
    res.json({ success: true, data: result });
  })
);

// 전기차 충전소 실시간 상태 조회 API
// GET /api/facilities/ev-charger/:statId/status
router.get(
  '/ev-charger/:statId/status',
  asyncHandler(async (req: Request, res: Response) => {
    const statId = Array.isArray(req.params.statId) ? req.params.statId[0] : req.params.statId;
    const { fetchChargerStatus } = await import('../services/evChargerService.js');
    const data = await fetchChargerStatus(statId);

    res.set('Cache-Control', 'public, max-age=10, stale-while-revalidate=20');
    res.json({ success: true, data });
  })
);

// 크로스 카테고리 주변 시설 조회 API
// GET /api/facilities/:category/:id/nearby
router.get(
  '/:category/:id/nearby',
  validate(FacilityDetailParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const category = Array.isArray(req.params.category) ? req.params.category[0] : req.params.category;
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    const facility = await facilityService.getDetail(category, id);
    if (!facility) {
      throw new NotFoundError('시설을 찾을 수 없습니다');
    }

    const items = await facilityService.getNearbyFacilities(
      category as Parameters<typeof facilityService.getNearbyFacilities>[0],
      facility.lat,
      facility.lng
    );
    res.json({ success: true, data: { items } });
  })
);

// @TASK T1.2 - 시설 상세 조회 API
// @SPEC docs/planning/02-trd.md#시설-상세-조회
// GET /api/facilities/:category/:id
router.get(
  '/:category/:id',
  validate(FacilityDetailParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const categoryParam = req.params.category;
    const idParam = req.params.id;

    // 배열인 경우 첫 번째 값 사용
    const category = Array.isArray(categoryParam) ? categoryParam[0] : categoryParam;
    const id = Array.isArray(idParam) ? idParam[0] : idParam;
    const facility = await facilityService.getDetail(category, id);

    if (!facility) {
      throw new NotFoundError('시설을 찾을 수 없습니다');
    }

    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, data: facility });
  })
);

export default router;
