import { z } from 'zod';

export const WasteAreaListQuerySchema = z.object({
  city: z.string().trim().max(50).optional(),
  district: z.string().trim().max(50).optional(),
  keyword: z.string().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).superRefine((query, ctx) => {
  if (query.district && !query.city) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['city'],
      message: 'city is required when district is provided',
    });
  }
});

export const WasteAreaIdParamsSchema = z.object({
  areaId: z.string().regex(/^[1-9]\d*$/).transform((value, ctx) => {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'areaId must be a safe integer',
      });
      return z.NEVER;
    }
    return parsed;
  }),
});

export type WasteAreaListQuery = z.infer<typeof WasteAreaListQuerySchema>;
