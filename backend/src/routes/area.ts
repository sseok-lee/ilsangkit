import { Router, Request, Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getStatsByDistrict, getDistrictStatsByCity, CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from '../services/facilityService.js';
import prisma from '../lib/prisma.js';

const router = Router();

// 인메모리 캐시 (TTL 기반)
const areaCache = new Map<string, { data: unknown; expiresAt: number }>();
const CACHE_TTL_MS = 10 * 60 * 1000; // 10분

function getCached<T>(key: string): T | null {
  const entry = areaCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    areaCache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache(key: string, data: unknown): void {
  areaCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * 부동산 6개 모델 집계 헬퍼
 * bjdCodes: startsWith 매칭할 bjdCode 배열 (OR 조건)
 */
async function aggregateRealEstate(bjdCodes: string[]) {
  if (bjdCodes.length === 0) {
    return {
      apt: { sale: { avg: 0, count: 0 }, rent: { avg: 0, count: 0 } },
      villa: { sale: { avg: 0, count: 0 }, rent: { avg: 0, count: 0 } },
      offitel: { sale: { avg: 0, count: 0 }, rent: { avg: 0, count: 0 } },
    };
  }

  const bjdWhere = bjdCodes.length === 1
    ? { bjdCode: { startsWith: bjdCodes[0] } }
    : { OR: bjdCodes.map(code => ({ bjdCode: { startsWith: code } })) };

  const [aptSale, aptRent, villaSale, villaRent, offitelSale, offitelRent] = await Promise.all([
    prisma.aptSaleTransaction.aggregate({ where: bjdWhere, _avg: { dealAmount: true }, _count: true }),
    prisma.aptRentTransaction.aggregate({ where: bjdWhere, _avg: { deposit: true }, _count: true }),
    prisma.villaSaleTransaction.aggregate({ where: bjdWhere, _avg: { dealAmount: true }, _count: true }),
    prisma.villaRentTransaction.aggregate({ where: bjdWhere, _avg: { deposit: true }, _count: true }),
    prisma.offitelSaleTransaction.aggregate({ where: bjdWhere, _avg: { dealAmount: true }, _count: true }),
    prisma.offitelRentTransaction.aggregate({ where: bjdWhere, _avg: { deposit: true }, _count: true }),
  ]);

  return {
    apt: {
      sale: { avg: Math.round(Number(aptSale._avg.dealAmount ?? 0)), count: aptSale._count },
      rent: { avg: Math.round(Number(aptRent._avg.deposit ?? 0)), count: aptRent._count },
    },
    villa: {
      sale: { avg: Math.round(Number(villaSale._avg.dealAmount ?? 0)), count: villaSale._count },
      rent: { avg: Math.round(Number(villaRent._avg.deposit ?? 0)), count: villaRent._count },
    },
    offitel: {
      sale: { avg: Math.round(Number(offitelSale._avg.dealAmount ?? 0)), count: offitelSale._count },
      rent: { avg: Math.round(Number(offitelRent._avg.deposit ?? 0)), count: offitelRent._count },
    },
  };
}

// GET /api/area/:citySlug — 시 단위 리포트 데이터
router.get('/:citySlug', asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const fullName = CITY_SLUG_TO_FULL[citySlug];

  if (!fullName) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' },
    });
    return;
  }

  // 인메모리 캐시 확인
  const cacheKey = `city-${citySlug}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, data: cached });
    return;
  }

  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  const cityVariants = [fullName, shortName].filter(Boolean) as string[];

  // ★ 병렬 실행: regions + 시설 통계를 동시에 조회
  const [regions, statsByDistrict] = await Promise.all([
    prisma.region.findMany({
      where: { city: { in: cityVariants } },
      select: { district: true, slug: true, bjdCode: true },
      orderBy: { district: 'asc' },
    }),
    getDistrictStatsByCity(citySlug),
  ]);

  if (regions.length === 0) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '해당 지역의 구/군 정보가 없습니다' },
    });
    return;
  }

  const districtResults = regions.map((region) => {
    const stats = statsByDistrict.get(region.district);
    const facilityTotal = stats?.total ?? 0;
    const infraScore = Math.min(100, Math.round((facilityTotal / 500) * 100));
    return {
      slug: region.slug,
      name: region.district,
      facilityTotal,
      topCategories: stats?.topCategories ?? [],
      infraScore,
    };
  });

  // 부동산 집계 (regions 결과 필요)
  const bjdCodes = regions.map(r => r.bjdCode).filter(Boolean) as string[];
  const realEstate = await aggregateRealEstate(bjdCodes);

  // 시 전체 인프라 점수 (구/군 평균)
  const totalFacilities = districtResults.reduce((sum, d) => sum + d.facilityTotal, 0);
  const cityInfraScore = Math.min(100, Math.round((totalFacilities / (regions.length * 500)) * 100));

  const responseData = {
    cityName: fullName,
    districts: districtResults,
    realEstate,
    cityInfraScore,
  };

  // 캐시 저장
  setCache(cacheKey, responseData);

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ success: true, data: responseData });
}));

// GET /api/area/:citySlug/:districtSlug — 지역 리포트 데이터
router.get('/:citySlug/:districtSlug', asyncHandler(async (req: Request, res: Response) => {
  const citySlug = req.params.citySlug as string;
  const districtSlug = req.params.districtSlug as string;

  // 인메모리 캐시 확인
  const cacheKey = `district-${citySlug}-${districtSlug}`;
  const cached = getCached<object>(cacheKey);
  if (cached) {
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, data: cached });
    return;
  }

  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  const cityVariants = [fullName, shortName].filter(Boolean) as string[];

  // ★ 병렬 실행: 시설 통계 + region 조회
  const [facilityStats, region] = await Promise.all([
    getStatsByDistrict(citySlug, districtSlug),
    prisma.region.findFirst({
      where: { city: { in: cityVariants }, slug: districtSlug },
      select: { bjdCode: true },
    }),
  ]);

  if (!facilityStats) {
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: '해당 지역을 찾을 수 없습니다' },
    });
    return;
  }

  // 부동산 집계 (bjdCode 5자리로 10자리 코드 prefix 매칭)
  const realEstateData = region?.bjdCode
    ? await aggregateRealEstate([region.bjdCode])
    : null;

  // 인프라 점수: 시설 total 기반 정규화 (500개 이상 만점)
  const infraScore = Math.min(100, Math.round((facilityStats.total / 500) * 100));

  const responseData = {
    facilities: facilityStats,
    realEstate: realEstateData,
    infraScore,
  };

  setCache(cacheKey, responseData);

  res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
  res.json({ success: true, data: responseData });
}));

export default router;
