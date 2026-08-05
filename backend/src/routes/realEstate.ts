// @TASK Phase3-3 - 부동산 실거래가 API 라우트

import { Router, Request, Response } from 'express';
import {
  searchTransactions,
  getTransactionStats,
  getComplexList,
  searchComplexesByKeyword,
  getBuildingInfo,
  searchAll,
  getAreaGroups,
  getApartmentPriceAnalysis,
  getNearbyByBjd,
} from '../services/realEstateService.js';
import { getHubSummary } from '../services/realEstateHubSummaryService.js';
import { fetchRegions, fetchBuildings } from '../services/realEstateMapService.js';
import { validate, validateMultiple } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import {
  RealEstateTypeSchema,
  RealEstateSearchSchema,
  RealEstateStatsSchema,
  RealEstateComplexSchema,
  RealEstateBuildingInfoSchema,
  RealEstateUnifiedSearchSchema,
  AreaGroupsQuerySchema,
  PriceAnalysisQuerySchema,
  NearbyQuerySchema,
} from '../schemas/realEstate.js';
import { MapQuerySchema, resolveGranularity, type MapQueryInput } from '../schemas/realEstateMap.js';
import { z } from 'zod';

const router = Router();

// 타입 파라미터 검증 스키마
const TypeParamsSchema = z.object({
  type: RealEstateTypeSchema,
});

// GET /api/real-estate/price-analysis - 가격 심화 분석
router.get(
  '/price-analysis',
  validate(PriceAnalysisQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { bjdCode, buildingName } = req.query as z.infer<typeof PriceAnalysisQuerySchema>;
    const result = await getApartmentPriceAnalysis(bjdCode, buildingName);
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/nearby - 같은 (구 + 동) 내 인근 단지 (cross-property)
router.get(
  '/nearby',
  validate(NearbyQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { bjdCode, mode, rentType, dongName, excludeBuildingName, limitPerType } =
      req.query as unknown as z.infer<typeof NearbyQuerySchema>;
    const data = await getNearbyByBjd(bjdCode, mode, {
      rentType, dongName, excludeBuildingName, limitPerType,
    });
    res.json({ success: true, data });
  })
);

// GET /api/real-estate/hub-summary - hub 페이지용 6개 타입 30일 거래 건수 (must be before /:type routes)
router.get(
  '/hub-summary',
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await getHubSummary();
    res.json({ success: true, data: summary.data, generatedAt: summary.generatedAt });
  }),
);

// GET /api/real-estate/search - 통합 검색 (must be before /:type routes)
router.get(
  '/search',
  validate(RealEstateUnifiedSearchSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { keyword, city, district } = req.query as unknown as z.infer<typeof RealEstateUnifiedSearchSchema>;
    const result = await searchAll(keyword, city, district);
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/:type/search - 거래 검색
router.get(
  '/:type/search',
  validateMultiple({
    params: TypeParamsSchema,
    query: RealEstateSearchSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { type } = res.locals.validated.params as z.infer<typeof TypeParamsSchema>;
    const { city, district, bjdCode, buildingName, dealYear, dealMonth, exclusiveArea, rentType, months, page, limit } =
      res.locals.validated.query as z.infer<typeof RealEstateSearchSchema>;
    const result = await searchTransactions(type, {
      city, district, bjdCode, buildingName, dealYear, dealMonth, exclusiveArea, rentType, months,
      page: page ?? 1,
      limit: limit ?? 20,
    });
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/:type/stats - 시세 시계열
router.get(
  '/:type/stats',
  validateMultiple({
    params: TypeParamsSchema,
    query: RealEstateStatsSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { type } = res.locals.validated.params as z.infer<typeof TypeParamsSchema>;
    const { bjdCode, buildingName, months, exclusiveArea, rentType } =
      res.locals.validated.query as z.infer<typeof RealEstateStatsSchema>;
    const result = await getTransactionStats(type, bjdCode, buildingName, months, exclusiveArea, rentType);
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/:type/complexes - 건물 목록
router.get(
  '/:type/complexes',
  validateMultiple({
    params: TypeParamsSchema,
    query: RealEstateComplexSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { type } = res.locals.validated.params as z.infer<typeof TypeParamsSchema>;
    const { city, district, buildingName, keyword, page, limit } =
      res.locals.validated.query as z.infer<typeof RealEstateComplexSchema>;
    // keyword가 있으면 /search 드릴다운 — 키워드를 지역/이름으로 해석(미리보기와 일관).
    // 없으면 기존 지역 허브 경로(city/district/buildingName) 그대로.
    const result = keyword
      ? await searchComplexesByKeyword(type, keyword, page, limit)
      : await getComplexList(type, city, district, buildingName, page, limit);
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/:type/building-info - 건물 정보
router.get(
  '/:type/building-info',
  validateMultiple({
    params: TypeParamsSchema,
    query: RealEstateBuildingInfoSchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { type } = res.locals.validated.params as z.infer<typeof TypeParamsSchema>;
    const { bjdCode, buildingName } =
      res.locals.validated.query as z.infer<typeof RealEstateBuildingInfoSchema>;
    const result = await getBuildingInfo(type, bjdCode, buildingName);
    if (!result) {
      throw new NotFoundError('건물 정보를 찾을 수 없습니다.');
    }
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/:type/area-groups - 면적 그룹 목록
router.get(
  '/:type/area-groups',
  validateMultiple({
    params: TypeParamsSchema,
    query: AreaGroupsQuerySchema,
  }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { type } = res.locals.validated.params as z.infer<typeof TypeParamsSchema>;
    const { bjdCode, buildingName } =
      res.locals.validated.query as z.infer<typeof AreaGroupsQuerySchema>;
    const result = await getAreaGroups(type, bjdCode, buildingName);
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/:type/map - 지도 뷰포트 조회
//
// granularity 는 줌 레벨이 정한다. 줌 아웃이면 지역 집계(캐시), 줌 인이면 bbox 건물 목록.
// rentType 파라미터는 여전히 두지 않는다 — 단 이유는 예전과 다르다. summary 는 이제
// 건물당 전세·월세 최신 거래를 jeonseDeposit/wolseDeposit/wolseMonthlyRent 등 분리
// 컬럼에 각각 보유한다(전세로 필터하면 건물이 사라지던 문제는 해소됨). 프론트가 한 건물
// 행에서 두 컬럼을 동시에 렌더하므로, 서버가 rentType 으로 걸러 한쪽만 내려줄 필요가 없다.
router.get(
  '/:type/map',
  validate(TypeParamsSchema, 'params'),
  validate(MapQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params as { type: string };
    const { level, swLat, swLng, neLat, neLng, prev } = req.query as unknown as MapQueryInput;

    const granularity = resolveGranularity(level, prev);

    if (granularity === 'building') {
      const { items, total, exact } = await fetchBuildings(type, { swLat, swLng, neLat, neLng });
      res.json({ success: true, data: { granularity, items, total, exact } });
      return;
    }

    const items = await fetchRegions(type, granularity, { swLat, swLng, neLat, neLng });
    res.json({
      success: true,
      data: { granularity, items, total: items.length, exact: true },
    });
  }),
);

export default router;
