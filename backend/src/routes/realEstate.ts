// @TASK Phase3-3 - 부동산 실거래가 API 라우트

import { Router, Request, Response, NextFunction } from 'express';
import {
  searchTransactions,
  getTransactionStats,
  getComplexList,
  getBuildingInfo,
  searchAll,
} from '../services/realEstateService.js';
import {
  RealEstateTypeSchema,
  RealEstateSearchSchema,
  RealEstateStatsSchema,
  RealEstateComplexSchema,
  RealEstateBuildingInfoSchema,
  RealEstateUnifiedSearchSchema,
} from '../schemas/realEstate.js';
import { searchRateLimiter } from '../middlewares/rateLimit.js';

const router = Router();

// 부동산 검색 전용 rate limiter 적용
router.use(searchRateLimiter);

// 타입 파라미터 검증 미들웨어
function validateType(req: Request, res: Response, next: NextFunction): void {
  const result = RealEstateTypeSchema.safeParse(req.params.type);
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_TYPE', message: `유효하지 않은 부동산 유형입니다: ${req.params.type}` },
    });
    return;
  }
  next();
}

// GET /api/real-estate/search - 통합 검색 (must be before /:type routes)
router.get('/search', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RealEstateUnifiedSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값 오류' },
      });
      return;
    }

    const { keyword, city, district } = parsed.data;
    const result = await searchAll(keyword, city, district);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/real-estate/:type/search - 거래 검색
router.get('/:type/search', validateType, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RealEstateSearchSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값 오류' },
      });
      return;
    }

    const { city, district, bjdCode, buildingName, dealYear, dealMonth, page, limit } = parsed.data;
    const result = await searchTransactions(req.params.type as string, {
      city, district, bjdCode, buildingName, dealYear, dealMonth,
      page: page ?? 1,
      limit: limit ?? 20,
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/real-estate/:type/stats - 시세 시계열
router.get('/:type/stats', validateType, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RealEstateStatsSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값 오류' },
      });
      return;
    }

    const { bjdCode, buildingName, months } = parsed.data;
    const result = await getTransactionStats(req.params.type as string, bjdCode, buildingName, months ?? 12);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/real-estate/:type/complexes - 건물 목록
router.get('/:type/complexes', validateType, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RealEstateComplexSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값 오류' },
      });
      return;
    }

    const { city, district, buildingName, page, limit } = parsed.data;
    const result = await getComplexList(req.params.type as string, city, district, buildingName, page, limit);

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// GET /api/real-estate/:type/building-info - 건물 정보
router.get('/:type/building-info', validateType, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const parsed = RealEstateBuildingInfoSchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || '입력값 오류' },
      });
      return;
    }

    const { bjdCode, buildingName } = parsed.data;
    const result = await getBuildingInfo(req.params.type as string, bjdCode, buildingName);

    if (!result) {
      res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: '건물 정보를 찾을 수 없습니다.' },
      });
      return;
    }

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
