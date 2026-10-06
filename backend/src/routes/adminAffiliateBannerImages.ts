import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { ValidationError } from '../lib/errors.js';
import { requireAdmin, requireSameOrigin } from '../middlewares/adminAuth.js';
import { adminRawImageUpload } from '../middlewares/adminRawImageUpload.js';
import { uploadAffiliateBannerImage } from '../services/affiliateBannerAssetService.js';

const router = Router();

router.post(
  '/',
  requireAdmin,
  requireSameOrigin,
  adminRawImageUpload,
  asyncHandler(async (req, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      throw new ValidationError('이미지를 선택하세요');
    }
    const data = await uploadAffiliateBannerImage(req.body);
    res.status(201).json({ success: true, data });
  })
);

export default router;
