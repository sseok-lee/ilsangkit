import { z } from 'zod';
import { ValidationError } from '../lib/errors.js';
import { normalizeExactArea } from '../services/realEstateExactFilter.js';
import type { RealEstateType } from '../services/realEstateService.js';

const SALE_TYPES = new Set<RealEstateType>(['apt-sale', 'villa-sale', 'offitel-sale']);

const DetailModeSchema = z.enum(['sale', 'jeonse', 'wolse']);

const IdentitySchema = z.object({
  buildingKey: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  bjdCode: z.string().regex(/^(\d{5}|\d{10})$/),
  buildingName: z.string().trim().min(1).max(100),
});

const months = z.preprocess((value) => {
  if (value === undefined) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && /^(0|6|12|36)$/.test(value)) return Number(value);
  return value;
}, z.union([z.literal(0), z.literal(6), z.literal(12), z.literal(36)])).default(0);

const deposit = z.union([
  z.number(),
  z.string().regex(/^\d+$/),
])
  .transform((value) => Number(value))
  .pipe(z.number().int().min(0).max(Number.MAX_SAFE_INTEGER))
  .optional();

const area = z.string()
  .regex(/^\d{1,8}(\.\d{1,2})?$/)
  .refine((value) => Number(value) > 0)
  .transform(normalizeExactArea)
  .optional();

export const DetailOverviewQuerySchema = IdentitySchema;

export const DetailQuerySchema = IdentitySchema.extend({
  mode: DetailModeSchema,
  months,
  area,
  deposit,
}).superRefine((query, ctx) => {
  if (query.mode !== 'wolse' && query.deposit !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['deposit'],
      message: 'deposit is only allowed for wolse mode',
    });
  }
});

export const DetailPageQuerySchema = IdentitySchema.extend({
  mode: DetailModeSchema,
  months,
  area: area.refine((value) => value !== undefined, { message: 'area is required' }),
  deposit,
  page: z.coerce.number().int().min(1).default(1),
}).superRefine((query, ctx) => {
  if (query.mode === 'wolse' && query.deposit === undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['deposit'],
      message: 'deposit is required for wolse detail-page',
    });
  }

  if (query.mode !== 'wolse' && query.deposit !== undefined) {
    ctx.addIssue({
      code: 'custom',
      path: ['deposit'],
      message: 'deposit is only allowed for wolse mode',
    });
  }
});

export function validateDetailTypeMode(type: RealEstateType, mode: z.infer<typeof DetailModeSchema>): void {
  if (SALE_TYPES.has(type) && mode !== 'sale') {
    throw new ValidationError(`${type} only supports sale mode`);
  }

  if (!SALE_TYPES.has(type) && mode === 'sale') {
    throw new ValidationError(`${type} only supports rent modes`);
  }
}

export type DetailQueryInput = z.infer<typeof DetailQuerySchema>;
export type DetailPageQueryInput = z.infer<typeof DetailPageQuerySchema>;
export type DetailOverviewQueryInput = z.infer<typeof DetailOverviewQuerySchema>;
