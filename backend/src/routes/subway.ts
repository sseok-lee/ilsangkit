import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import {
  getStationBySlug,
  listStations,
  serializeStation,
} from '../services/subwayService.js';

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
});

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

// GET /api/subway/stations?page=&limit=&line=&city=
router.get(
  '/stations',
  validate(ListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof ListSchema>;
    const result = await listStations(params);
    res.json({ success: true, data: result });
  }),
);

export default router;
