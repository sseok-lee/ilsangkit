import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { requireAdmin, requireSameOrigin } from '../middlewares/adminAuth.js';
import {
  affiliateBannerCreateSchema,
  affiliateBannerIdSchema,
  affiliateBannerPatchSchema,
  affiliateBannerQuerySchema,
  affiliateBannerStatusSchema,
} from '../schemas/affiliateBanner.js';
import {
  createAffiliateBanner,
  getAffiliateBanner,
  listAffiliateBanners,
  setAffiliateBannerStatus,
  updateAffiliateBanner,
} from '../services/adminAffiliateBannerService.js';
import type {
  AffiliateBannerDraft,
  AffiliateBannerPatch,
  AffiliateBannerQuery,
} from '../types/affiliateBanner.js';

const router = Router();

router.get(
  '/',
  requireAdmin,
  validate(affiliateBannerQuerySchema, 'query'),
  asyncHandler(async (req, res) => {
    const data = await listAffiliateBanners(req.query as unknown as AffiliateBannerQuery);
    res.json({ success: true, data });
  }),
);

router.get(
  '/:id',
  requireAdmin,
  validate(affiliateBannerIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const data = await getAffiliateBanner(id);
    res.json({ success: true, data });
  }),
);

router.post(
  '/',
  requireAdmin,
  requireSameOrigin,
  validate(affiliateBannerCreateSchema, 'body'),
  asyncHandler(async (req, res) => {
    const data = await createAffiliateBanner(req.body as AffiliateBannerDraft);
    res.status(201).json({ success: true, data });
  }),
);

router.patch(
  '/:id/status',
  requireAdmin,
  requireSameOrigin,
  validate(affiliateBannerIdSchema, 'params'),
  validate(affiliateBannerStatusSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const { isEnabled } = req.body as { isEnabled: boolean };
    const data = await setAffiliateBannerStatus(id, isEnabled);
    res.json({ success: true, data });
  }),
);

router.patch(
  '/:id',
  requireAdmin,
  requireSameOrigin,
  validate(affiliateBannerIdSchema, 'params'),
  validate(affiliateBannerPatchSchema, 'body'),
  asyncHandler(async (req, res) => {
    const { id } = req.params as unknown as { id: string };
    const data = await updateAffiliateBanner(id, req.body as AffiliateBannerPatch);
    res.json({ success: true, data });
  }),
);

export default router;
