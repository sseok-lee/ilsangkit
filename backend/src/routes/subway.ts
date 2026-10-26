import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate, validateMultiple } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import {
  findNearbyStations,
  getStationBySlug,
  listStations,
  listStationsGrouped,
  nearbyGroupedForStation,
  serializeStation,
} from '../services/subwayService.js';
import { KOREA_BOUNDS } from '../constants/index.js';

const router = Router();

const SlugSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(150)
    .regex(/^[a-z0-9-]+$/, 'slug must be ASCII lowercase'),
});

const ListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(5000).default(20),
  line: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  keyword: z.string().min(1).max(100).optional(),
  // grouped=true → 환승역 nameSlug 단위 1건. 응답 shape = SerializedStationGroup (lines: string[]).
  // 기본값 false → 기존 단수 line 응답 호환성 유지. 호출자가 명시 opt-in.
  grouped: z.coerce.boolean().default(false),
});

const NearbySchema = z.object({
  lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN).max(KOREA_BOUNDS.LAT_MAX),
  lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN).max(KOREA_BOUNDS.LNG_MAX),
  radius: z.coerce.number().int().min(100).max(50000).default(1000),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  excludeSlug: z.string().max(150).optional(),
});

// GET /api/subway/stations/nearby?lat=&lng=&radius=&limit=&excludeSlug=
// 주의: '/stations/:slug'보다 먼저 등록해야 'nearby'가 slug로 잡히지 않는다.
router.get(
  '/stations/nearby',
  validate(NearbySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof NearbySchema>;
    const items = await findNearbyStations(params.lat, params.lng, params.radius, params.limit + 5);
    const filtered = params.excludeSlug
      ? items.filter((s) => s.nameSlug !== params.excludeSlug)
      : items;
    res.json({ success: true, data: { items: filtered.slice(0, params.limit) } });
  }),
);

// 지하철역 상세 "주변 시설" 쿼리 — 그룹별 가까운 곳 수
const StationNearbyGroupedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(5),
});

// 지하철역 상세 "주변 시설" — 주변 역(역명 단위) + 관련 시설 카테고리별 개수·가까운 N곳 (반경 1km)
// GET /api/subway/stations/:slug/nearby-grouped?limit=5
// 응답은 시설 상세 /api/facilities/:category/:id/nearby-grouped 와 같은 { radius, groups } 형태.
// 옛 /stations/nearby + POST /api/facilities/search 조합은 구 프론트 호환용으로 남겨 둔다.
router.get(
  '/stations/:slug/nearby-grouped',
  validateMultiple({ params: SlugSchema, query: StationNearbyGroupedQuerySchema }),
  asyncHandler(async (_req: Request, res: Response) => {
    const { params, query } = res.locals.validated as {
      params: z.infer<typeof SlugSchema>;
      query: z.infer<typeof StationNearbyGroupedQuerySchema>;
    };
    const result = await nearbyGroupedForStation(params.slug, query.limit);
    if (!result) throw new NotFoundError('Station not found');
    res.json({ success: true, data: result });
  }),
);

// GET /api/subway/stations/:slug
router.get(
  '/stations/:slug',
  validate(SlugSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { slug } = req.params as unknown as z.infer<typeof SlugSchema>;
    const station = await getStationBySlug(slug);
    if (!station) throw new NotFoundError('Station not found');
    res.json({ success: true, data: serializeStation(station) });
  }),
);

// GET /api/subway/stations?page=&limit=&line=&city=&district=&keyword=&grouped=
router.get(
  '/stations',
  validate(ListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof ListSchema>;
    if (params.grouped) {
      const result = await listStationsGrouped({
        page: params.page,
        limit: params.limit,
        line: params.line,
        citySlug: params.city,
        district: params.district,
        keyword: params.keyword,
      });
      res.json({ success: true, data: result });
      return;
    }
    const result = await listStations(params);
    res.json({ success: true, data: result });
  }),
);

export default router;
