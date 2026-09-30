import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError, ServiceUnavailableError } from '../lib/errors.js';
import { validate } from '../middlewares/validate.js';
import { ResolveRealEstateUrlQuery, RealEstateCanonicalUrlQuery } from '../schemas/realEstatePublicUrl.js';
import {
  isPreservedRealEstateUrlMode,
  resolveRealEstatePublicPath,
  getRealEstateCanonicalPath,
} from '../services/realEstateUrlRegistry.js';
import type { z } from 'zod';

const router = Router();

router.get('/resolve-url', validate(ResolveRealEstateUrlQuery, 'query'), asyncHandler(async (req, res) => {
  if (!isPreservedRealEstateUrlMode()) {
    res.json({ success: true, data: { mode: 'keyed' } });
    return;
  }
  const { path } = req.query as z.infer<typeof ResolveRealEstateUrlQuery>;
  const resolved = await resolveRealEstatePublicPath(path).catch(() => {
    throw new ServiceUnavailableError('부동산 주소를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  });
  if (!resolved) throw new NotFoundError('등록된 부동산 주소가 없습니다.');
  res.json({ success: true, data: { mode: 'preserved', ...resolved } });
}));

router.get('/canonical-url', validate(RealEstateCanonicalUrlQuery, 'query'), asyncHandler(async (req, res) => {
  if (!isPreservedRealEstateUrlMode()) {
    res.json({ success: true, data: { mode: 'keyed', canonicalPath: null } });
    return;
  }
  const { type, buildingKey } = req.query as z.infer<typeof RealEstateCanonicalUrlQuery>;
  const canonicalPath = await getRealEstateCanonicalPath(type, buildingKey).catch(() => {
    throw new ServiceUnavailableError('부동산 주소를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.');
  });
  res.json({ success: true, data: { mode: 'preserved', canonicalPath } });
}));

export default router;
