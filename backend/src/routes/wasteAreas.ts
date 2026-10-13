import { Router, Request, Response, NextFunction } from 'express';
import { AppError, GoneError, NotFoundError, ServiceUnavailableError } from '../lib/errors.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { WasteAreaListQuerySchema, WasteAreaIdParamsSchema } from '../schemas/wasteArea.js';
import {
  getWasteArea,
  hasPublishedWasteAreaDetailHistory,
  listWasteAreas,
} from '../services/wasteAreaService.js';

const router = Router();

router.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    if (req.query.district && !req.query.city) {
      throw new AppError(400, 'city 없이 district만 조회할 수 없습니다', 'INVALID_WASTE_AREA_QUERY');
    }
    const parsed = WasteAreaListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new AppError(422, '입력값이 올바르지 않습니다', 'VALIDATION_ERROR');
    }
    const result = await translateAreaRouteRead(() => listWasteAreas(parsed.data as {
      city?: string;
      district?: string;
      keyword?: string;
      page: number;
      limit: number;
    }));
    res.json({ success: true, data: result });
  })
);

router.get('/:areaId', asyncHandler(async (req: Request, res: Response) => {
  const parsed = WasteAreaIdParamsSchema.safeParse(req.params);
  if (!parsed.success) {
    throw new AppError(400, '잘못된 쓰레기 정보 ID입니다', 'INVALID_WASTE_ID');
  }

  const detail = await translateAreaRouteRead(() => getWasteArea(parsed.data.areaId));
  if (!detail) {
    if (await translateAreaRouteRead(() => hasPublishedWasteAreaDetailHistory(parsed.data.areaId))) {
      throw new GoneError('종료된 쓰레기 배출 지역입니다');
    }
    throw new NotFoundError('쓰레기 배출 지역을 찾을 수 없습니다');
  }

  res.json({ success: true, data: detail });
}));

async function translateAreaRouteRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new ServiceUnavailableError('동별 쓰레기 배출 안내를 조회할 수 없습니다', 'WASTE_AREA_UNAVAILABLE');
  }
}

export default router;
