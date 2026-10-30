import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { KOREA_BOUNDS } from '../constants/index.js';
import { findNearbyStations } from '../services/subwayService.js';
import { findNearbyBusStops } from '../services/busStopService.js';

const router = Router();

const NearbyTransitSchema = z.object({
  lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN).max(KOREA_BOUNDS.LAT_MAX),
  lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN).max(KOREA_BOUNDS.LNG_MAX),
  radius: z.coerce.number().min(100).max(5000).default(1000),
  busRadius: z.coerce.number().min(100).max(2000).optional(),
});

// GET /api/transit/nearby?lat=&lng=&radius=
//
// SubwayStation DB를 단일 진실원으로 사용. Kakao API 의존 제거.
// 응답 shape: { success, data: { stations: [{ id, name, line, distance, type: 'subway' }] } }
// busRadius 가 있을 때만 data 에 busStops(이름 합친 상위 5)·busStopCount(합친 전체 수)·busCollectedAt 이 더해진다.
router.get(
  '/nearby',
  validate(NearbyTransitSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng, radius, busRadius } = req.query as unknown as z.infer<typeof NearbyTransitSchema>;
    if (busRadius === undefined) {
      const stations = await findNearbyStations(lat, lng, radius, 10);
      res.json({ success: true, data: { stations } });
      return;
    }
    const [stations, bus] = await Promise.all([
      findNearbyStations(lat, lng, radius, 10),
      findNearbyBusStops(lat, lng, busRadius),
    ]);
    res.json({
      success: true,
      data: {
        stations,
        busStops: bus.items,
        busStopCount: bus.count,
        busCollectedAt: bus.collectedAt,
      },
    });
  }),
);

export default router;
