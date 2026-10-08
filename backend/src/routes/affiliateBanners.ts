import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { getRandomAffiliateBanner } from '../services/publicAffiliateBannerService.js';

const router = Router();

router.get(
  '/random',
  asyncHandler(async (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const selection = await getRandomAffiliateBanner();
    res.json({ success: true, ...selection });
  }),
);

export default router;
