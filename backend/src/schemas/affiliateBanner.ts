import { z } from 'zod';
import { PAGINATION } from '../constants/index.js';

export const affiliateBannerProviderSchema = z.enum(['coupang', 'ali', 'toss']);
export const affiliateBannerImageSourceTypeSchema = z.enum(['upload', 'url']);

export const affiliateBannerIdSchema = z.object({
  id: z.uuid(),
}).strict();

export const affiliateBannerStatusSchema = z.object({
  isEnabled: z.boolean(),
}).strict();

const hasUnsafeUrlCharacter = (value: string): boolean => {
  for (const char of value) {
    const code = char.charCodeAt(0);
    if (code <= 32 || code === 127 || char === '\\') {
      return true;
    }
  }

  return false;
};

const httpsUrl = z.string().trim().min(1).max(4096).refine((value) => {
  if (!/^https:\/\//i.test(value) || hasUnsafeUrlCharacter(value)) {
    return false;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'https:' && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}, '인증 정보가 없는 HTTPS URL을 입력하세요');

const affiliateBannerDraftShape = {
  provider: affiliateBannerProviderSchema,
  name: z.string().trim().min(1).max(100),
  imageSourceType: affiliateBannerImageSourceTypeSchema,
  imageAssetId: z.uuid().nullable(),
  externalImageUrl: httpsUrl.nullable(),
  targetUrl: httpsUrl,
  altText: z.string().trim().min(1).max(200),
};

export const affiliateBannerCreateSchema = z.object(affiliateBannerDraftShape).strict().refine((value) => {
  if (value.imageSourceType === 'upload') {
    return value.imageAssetId !== null && value.externalImageUrl === null;
  }

  return value.imageAssetId === null && value.externalImageUrl !== null;
}, '이미지는 업로드 자산 또는 외부 URL 중 하나만 지정하세요');

export const affiliateBannerPatchSchema = z.object(affiliateBannerDraftShape).partial().strict().refine(
  (value) => Object.keys(value).length > 0,
  '수정할 필드를 하나 이상 입력하세요',
);

export const affiliateBannerQuerySchema = z.object({
  page: z.coerce.number().int().min(PAGINATION.DEFAULT_PAGE).default(PAGINATION.DEFAULT_PAGE),
  limit: z.coerce.number().int().min(PAGINATION.DEFAULT_PAGE).max(PAGINATION.MAX_LIMIT).default(PAGINATION.DEFAULT_LIMIT),
  provider: affiliateBannerProviderSchema.optional(),
  isEnabled: z.enum(['true', 'false']).transform((value) => value === 'true').optional(),
}).strict();

export type AffiliateBannerCreateInput = z.infer<typeof affiliateBannerCreateSchema>;
export type AffiliateBannerPatchInput = z.infer<typeof affiliateBannerPatchSchema>;
export type AffiliateBannerQueryInput = z.infer<typeof affiliateBannerQuerySchema>;
export type AffiliateBannerStatusInput = z.infer<typeof affiliateBannerStatusSchema>;
