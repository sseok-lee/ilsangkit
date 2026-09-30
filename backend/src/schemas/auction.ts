import { z } from 'zod';

const optionalKeyword = z.preprocess((value) => typeof value === 'string' ? value.trim() || undefined : value, z.string().max(100).optional());

export const AuctionItemsSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  usage: z.enum(['residential', 'land', 'commercial', 'industrial', 'complex', 'etc']).optional(),
  status: z.enum(['ongoing', 'scheduled', 'negotiable', 'closed', 'sold', 'failed', 'cancelled']).optional(),
  statusMode: z.enum(['legacy', 'exact']).default('legacy'),
  keyword: optionalKeyword,
  sort: z.enum(['deadline', 'apsl', 'bidRate']).default('deadline'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export const AuctionRegionsSchema = z.object({
  city: z.string().max(50).optional(),
  onlyIndexable: z.coerce.boolean().optional(),
});
export const AuctionRegionSchema = z.object({ bjdCode: z.string().min(1).max(5) });
export const AuctionCitySchema = z.object({ city: z.string().min(1).max(50) });
export const AuctionItemDetailSchema = z.object({ cltrMngNo: z.string().min(1).max(50) });
export const AuctionRankingSchema = z.object({
  keyword: optionalKeyword,
  usage: z.enum(['residential', 'land', 'commercial', 'industrial', 'complex', 'etc']).optional(),
  order: z.enum(['high', 'low', 'count']).default('high'),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
