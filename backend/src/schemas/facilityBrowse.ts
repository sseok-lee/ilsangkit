import { z } from 'zod';
import { RegionCategorySchema } from './facility.js';

export const BrowseCategorySchema = z.union([RegionCategorySchema, z.literal('subway')]);

export const FacilityBrowseSchema = z.object({
  city: z.string().trim().min(1).max(50),
  district: z.string().trim().min(1).max(50),
  category: BrowseCategorySchema.optional(),
  keyword: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(20).default(20),
  departments: z
    .string()
    .max(500)
    .optional()
    .transform((v) => (v ? [...new Set(v.split(',').map((x) => x.trim()).filter(Boolean))] : undefined)),
});

export type FacilityBrowseInput = z.infer<typeof FacilityBrowseSchema>;
export type BrowseCategory = z.infer<typeof BrowseCategorySchema>;

export interface BrowseItem {
  id: string;
  category: BrowseCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number | null;
  lng: number | null;
  extras: Record<string, unknown>;
  destination?: { kind: 'waste-area'; href: string };
}

export interface BrowseGroup {
  category: BrowseCategory;
  label: string;
  unit: '시설' | '충전소' | '장소' | '역' | '일정' | '지역';
  count: number;
  items: BrowseItem[];
}

export type BrowseResult =
  | { mode: 'grouped'; groups: BrowseGroup[] }
  | {
      mode: 'list';
      category: BrowseCategory;
      unit: BrowseGroup['unit'];
      items: BrowseItem[];
      total: number;
      page: number;
      totalPages: number;
    };
