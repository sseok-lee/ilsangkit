// @TASK Phase3-3 - 부동산 실거래가 API 라우트

import { Router, Request, Response } from 'express';
import {
  searchTransactions,
  getTransactionStats,
  getComplexList,
  getBuildingInfo,
  searchAll,
  getAreaGroups,
  getPriceAnalysis,
} from '../services/realEstateService.js';
import { getKaptInfo } from '../services/kaptService.js';
import { validate, validateMultiple } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { searchRateLimiter } from '../middlewares/rateLimit.js';
import { NotFoundError } from '../lib/errors.js';
import {
  RealEstateTypeSchema,
  RealEstateSearchSchema,
  RealEstateStatsSchema,
  RealEstateComplexSchema,
  RealEstateBuildingInfoSchema,
  RealEstateUnifiedSearchSchema,
  AreaGroupsQuerySchema,
  KaptQuerySchema,
  PriceAnalysisQuerySchema,
} from '../schemas/realEstate.js';
import { z } from 'zod';

const router = Router();

// 타입 파라미터 검증 스키마
const TypeParamsSchema = z.object({
  type: RealEstateTypeSchema,
});

// GET /api/real-estate/kapt - K-apt 단지정보
router.get(
  '/kapt',
  searchRateLimiter,
  validate(KaptQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { buildingName, city, district } = req.query as z.infer<typeof KaptQuerySchema>;
    const result = await getKaptInfo(buildingName, city, district);
    res.json({ success: true, data: result });
  })
);

// GET /api/real-estate/price-analysis - 가격 심화 분석
router.get(
  '/price-analysis',
  validate(PriceAnalysisQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { bjdCode, buildingName } = req.query as z.infer<typeof PriceAnalysisQuerySchema>;
    const result = await getPriceAnalysis(bjdCode, buildingName);
    res.json({ success: true, data: result });
  })
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
    const { city, district, buildingName, page, limit } =
      res.locals.validated.query as z.infer<typeof RealEstateComplexSchema>;
    const result = await getComplexList(type, city, district, buildingName, page, limit);
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

export default router;
