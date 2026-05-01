import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { KOREA_BOUNDS } from '../constants/index.js';

const router = Router();

const NearbyTransitSchema = z.object({
  lat: z.coerce.number().min(KOREA_BOUNDS.LAT_MIN).max(KOREA_BOUNDS.LAT_MAX),
  lng: z.coerce.number().min(KOREA_BOUNDS.LNG_MIN).max(KOREA_BOUNDS.LNG_MAX),
  radius: z.coerce.number().min(100).max(5000).default(1000),
});

// "교통,수송 > 지하철,전철 > 수도권2호선" → "2호선"
function parseLineName(categoryName: string): string {
  const parts = categoryName.split(' > ');
  const last = parts[parts.length - 1] ?? '';
  return last.replace(/^수도권|^서울/, '').trim() || last;
}

// GET /api/transit/nearby?lat=&lng=&radius=
router.get(
  '/nearby',
  validate(NearbyTransitSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { lat, lng, radius } = req.query as unknown as z.infer<typeof NearbyTransitSchema>;

    const apiKey = process.env.KAKAO_REST_API_KEY;
    if (!apiKey) {
      res.json({ success: true, data: { stations: [] } });
      return;
    }

    const url = new URL('https://dapi.kakao.com/v2/local/search/category.json');
    url.searchParams.set('category_group_code', 'SW8');
    url.searchParams.set('x', String(lng));
    url.searchParams.set('y', String(lat));
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('sort', 'distance');
    url.searchParams.set('size', '10');

    interface KakaoLocalDocument {
      id: string;
      place_name: string;
      category_name: string;
      distance: string;
      address_name: string;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(url.toString(), {
        headers: { Authorization: `KakaoAK ${apiKey}` },
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!response.ok) {
        res.json({ success: true, data: { stations: [] } });
        return;
      }

      const json = (await response.json()) as { documents?: KakaoLocalDocument[] };
      const stations = (json.documents ?? []).map((doc: KakaoLocalDocument) => ({
        id: doc.id,
        name: doc.place_name,
        line: parseLineName(doc.category_name),
        distance: parseInt(doc.distance, 10),
        address: doc.address_name,
      }));

      res.json({ success: true, data: { stations } });
    } catch {
      clearTimeout(timeout);
      res.json({ success: true, data: { stations: [] } });
    }
  }),
);

export default router;
