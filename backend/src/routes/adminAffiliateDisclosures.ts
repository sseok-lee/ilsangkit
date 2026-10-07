import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { requireAdmin, requireSameOrigin } from '../middlewares/adminAuth.js';
import { validate } from '../middlewares/validate.js';
import {
  affiliateDisclosureProviderParamsSchema,
  affiliateDisclosureSaveSchema,
} from '../schemas/affiliateDisclosure.js';
import {
  listAffiliateProviderDisclosures,
  saveAffiliateProviderDisclosure,
} from '../services/adminAffiliateDisclosureService.js';
import type { AffiliateProvider } from '../types/affiliateBanner.js';

const router = Router();

router.get(
  '/',
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: await listAffiliateProviderDisclosures() });
  }),
);

router.put(
  '/:provider',
  requireAdmin,
  requireSameOrigin,
  validate(affiliateDisclosureProviderParamsSchema, 'params'),
  validate(affiliateDisclosureSaveSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { provider } = req.params as unknown as { provider: AffiliateProvider };
    const data = await saveAffiliateProviderDisclosure(provider, req.body);
    res.json({ success: true, data });
  }),
);

export default router;
