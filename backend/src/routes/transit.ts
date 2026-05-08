import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { KOREA_BOUNDS } from '../constants/index.js';
import { findNearbyStations } from '../services/subwayService.js';

const router = Router();

const NearbyTransitSchema = z.object({
  lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN).max(KOREA_BOUNDS.LAT_MAX),
  lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN).max(KOREA_BOUNDS.LNG_MAX),
  radius: z.coerce.number().min(100).max(5000).default(1000),
});

// GET /api/transit/nearby?lat=&lng=&radius=
//
// SubwayStation DB를 단일 진실원으로 사용. Kakao API 의존 제거.
// 응답 shape: { success, data: { stations: [{ id, name, line, distance, type: 'subway' }] } }
router.get(
  '/nearby',
  validate(NearbyTransitSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng, radius } = req.query as unknown as z.infer<typeof NearbyTransitSchema>;
    const stations = await findNearbyStations(lat, lng, radius, 10);
    res.json({ success: true, data: { stations } });
  }),
);

export default router;
