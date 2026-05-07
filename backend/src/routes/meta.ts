// @TASK T1.4 - 메타 API
// @SPEC docs/planning/02-trd.md#메타-API

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { getStatsByCity, getStatsByDistrict, getSyncStatus, SHORT_TO_SLUG } from '../services/facilityService.js';
import { getCategories, getStats, getRegionByDistrictName, getRegionByBjdCode, getRegions } from '../services/metaService.js';
import { prisma } from '../lib/prisma.js';

const SlugParamsSchema = z.object({
  citySlug: z.string().regex(/^[a-z-]+$/).max(30),
});

const SlugDistrictParamsSchema = z.object({
  citySlug: z.string().regex(/^[a-z-]+$/).max(30),
  districtSlug: z.string().regex(/^[a-z-]+$/).max(30),
});

const RegionFacilitiesSummaryQuerySchema = z.object({
  city: z.string().min(1).max(20),
  district: z.string().min(1).max(20).optional(),
});

const RegionsQuerySchema = z.object({
  city: z.string().min(1).max(20).optional(),
});

const RegionByBjdCodeQuerySchema = z.object({
  bjdCode: z.string().regex(/^\d{5,10}$/),
});

const router = Router();

// GET /api/meta/categories - 활성화된 카테고리 목록
router.get('/categories', asyncHandler(async (_req: Request, res: Response) => {
  const categories = await getCategories();
  res.json({ success: true, data: categories });
}));

// GET /api/meta/stats - 카테고리별 시설 개수 (5분 인메모리 캐시)
router.get('/stats', asyncHandler(async (_req: Request, res: Response) => {
  const result = await getStats();
  res.json({ success: true, data: result.data });
}));

// GET /api/meta/region-facilities-summary - 한글 지역명으로 카테고리별 시설 인프라 요약 조회
router.get('/region-facilities-summary', validate(RegionFacilitiesSummaryQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const city = req.query.city as string;
  const district = req.query.district as string | undefined;

  // city 한글명(short name) → citySlug 변환
  const citySlug = SHORT_TO_SLUG[city];

  if (!citySlug) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  if (!district) {
    // city 통계
    const stats = await getStatsByCity(citySlug);
    if (!stats) {
      throw new NotFoundError('해당 지역을 찾을 수 없습니다');
    }
    res.json({
      success: true,
      data: {
        city: stats.city,
        categories: stats.categories,
        total: stats.total,
        topCategories: stats.topCategories,
      },
    });
    return;
  }

  // district 한글명 → districtSlug 변환
  const districtRegion = await getRegionByDistrictName(city, district);

  if (!districtRegion) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  // districtSlug: slug 전체 또는 하이픈 이후 부분 — getStatsByDistrict는 districtSlug (하이픈 이후) 기대
  const districtSlug = districtRegion.slug.includes('-')
    ? districtRegion.slug.split('-').slice(1).join('-')
    : districtRegion.slug;

  const stats = await getStatsByDistrict(citySlug, districtSlug);
  if (!stats) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  res.json({
    success: true,
    data: {
      city,
      district,
      categories: stats.categories,
      total: stats.total,
      topCategories: stats.topCategories,
    },
  });
}));

// GET /api/meta/stats/:citySlug - 시/도별 카테고리별 시설 통계
router.get('/stats/:citySlug', validate(SlugParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const stats = await getStatsByCity(citySlug);

  if (!stats) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  res.json({ success: true, data: stats });
}));

// GET /api/meta/stats/:citySlug/:districtSlug - 구/군별 카테고리별 시설 통계
router.get('/stats/:citySlug/:districtSlug', validate(SlugDistrictParamsSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const districtSlug = req.params.districtSlug as string;
  const stats = await getStatsByDistrict(citySlug, districtSlug);

  if (!stats) {
    throw new NotFoundError('해당 지역을 찾을 수 없습니다');
  }

  res.json({ success: true, data: stats });
}));

// GET /api/meta/sync-status - 카테고리별 최근 동기화 날짜
router.get('/sync-status', asyncHandler(async (_req: Request, res: Response) => {
  const syncStatus = await getSyncStatus();
  res.json({ success: true, data: syncStatus });
}));

// GET /api/meta/region-by-bjd - bjdCode 역조회 (legacy URL redirect 용)
router.get('/region-by-bjd', validate(RegionByBjdCodeQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const bjdCode = req.query.bjdCode as string;
  const region = await getRegionByBjdCode(bjdCode);
  if (!region) {
    throw new NotFoundError('해당 bjdCode의 지역을 찾을 수 없습니다');
  }
  res.json({ success: true, data: { city: region.city, district: region.district, bjdCode: region.bjdCode } });
}));

// GET /api/meta/regions - 지역 목록
router.get('/regions', validate(RegionsQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { city } = req.query;
  const regions = await getRegions(city as string | undefined);
  res.json({ success: true, data: regions });
}));

// GET /api/meta/hospital-departments — 병원 진료과목 목록 (보유 병원 수 내림차순)
// 1시간 인메모리 캐시
let hospitalDeptsCache: { items: { name: string; count: number }[]; expires: number } | null = null;
router.get('/hospital-departments', asyncHandler(async (_req: Request, res: Response) => {
  if (hospitalDeptsCache && Date.now() < hospitalDeptsCache.expires) {
    res.json({ success: true, data: hospitalDeptsCache.items });
    return;
  }
  const grouped = await prisma.hospitalDepartment.groupBy({
    by: ['dgsbjtCdNm'],
    _count: { dgsbjtCdNm: true },
    orderBy: { _count: { dgsbjtCdNm: 'desc' } },
  });
  const items = grouped.map((g) => ({ name: g.dgsbjtCdNm, count: g._count.dgsbjtCdNm }));
  hospitalDeptsCache = { items, expires: Date.now() + 60 * 60 * 1000 };
  res.json({ success: true, data: items });
}));

export default router;
