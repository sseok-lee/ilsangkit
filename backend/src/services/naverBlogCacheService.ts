import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import {
  buildNaverBlogQuery,
  buildNaverBlogQueryForRealEstate,
  fetchFromNaver,
  filterNaverBlogPosts,
  NAVER_BLOG_MIN_RESULTS,
  type FacilityQueryInput,
  type RealEstateQueryInput,
  type RealEstateType,
  type RawNaverBlogPost,
} from './naverBlogService.js';
import { naverBlogQuotaCounter } from './naverBlogQuotaService.js';

const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const facilityInFlight = new Map<string, Promise<RawNaverBlogPost[]>>();
export const realEstateInFlight = new Map<string, Promise<RawNaverBlogPost[]>>();

interface GetOptions { cacheOnly?: boolean }

export async function getOrFetchNaverBlogForFacility(
  category: FacilityCategory,
  facilityId: string,
  facility: FacilityQueryInput,
  options: GetOptions = {},
): Promise<RawNaverBlogPost[]> {
  const hit = await prisma.facilityNaverBlogCache.findUnique({
    where: { category_facilityId: { category, facilityId } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.posts as unknown as RawNaverBlogPost[]) ?? [];
  }
  if (options.cacheOnly) return [];

  const key = `${category}:${facilityId}`;
  const existing = facilityInFlight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<RawNaverBlogPost[]> => {
    try {
      if (!naverBlogQuotaCounter.tryConsume()) return [];
      const query = buildNaverBlogQuery(facility, category);
      const cid = process.env.NAVER_CLIENT_ID ?? '';
      const sec = process.env.NAVER_CLIENT_SECRET ?? '';
      const raw = await fetchFromNaver(query, cid, sec);
      const filtered = filterNaverBlogPosts(raw);
      const useful = filtered.length >= NAVER_BLOG_MIN_RESULTS;
      const posts: RawNaverBlogPost[] = useful ? filtered : [];
      const itemCount = posts.length;
      const expiresAt = new Date(Date.now() + TTL_MS);
      await prisma.facilityNaverBlogCache.upsert({
        where: { category_facilityId: { category, facilityId } },
        create: { category, facilityId, query, posts: posts as unknown as object, itemCount, expiresAt },
        update: { query, posts: posts as unknown as object, itemCount, expiresAt, fetchedAt: new Date() },
      });
      return posts;
    } finally {
      facilityInFlight.delete(key);
    }
  })();

  facilityInFlight.set(key, job);
  return job;
}

export async function getOrFetchNaverBlogForRealEstate(
  type: RealEstateType,
  buildingKey: string,
  building: RealEstateQueryInput,
  options: GetOptions = {},
): Promise<RawNaverBlogPost[]> {
  const hit = await prisma.realEstateNaverBlogCache.findUnique({
    where: { realEstateType_buildingKey: { realEstateType: type, buildingKey } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.posts as unknown as RawNaverBlogPost[]) ?? [];
  }
  if (options.cacheOnly) return [];

  const key = `${type}:${buildingKey}`;
  const existing = realEstateInFlight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<RawNaverBlogPost[]> => {
    try {
      if (!naverBlogQuotaCounter.tryConsume()) return [];
      const query = buildNaverBlogQueryForRealEstate(building, type);
      const cid = process.env.NAVER_CLIENT_ID ?? '';
      const sec = process.env.NAVER_CLIENT_SECRET ?? '';
      const raw = await fetchFromNaver(query, cid, sec);
      const filtered = filterNaverBlogPosts(raw);
      const useful = filtered.length >= NAVER_BLOG_MIN_RESULTS;
      const posts: RawNaverBlogPost[] = useful ? filtered : [];
      const expiresAt = new Date(Date.now() + TTL_MS);
      await prisma.realEstateNaverBlogCache.upsert({
        where: { realEstateType_buildingKey: { realEstateType: type, buildingKey } },
        create: { realEstateType: type, buildingKey, query, posts: posts as unknown as object, itemCount: posts.length, expiresAt },
        update: { query, posts: posts as unknown as object, itemCount: posts.length, expiresAt, fetchedAt: new Date() },
      });
      return posts;
    } finally {
      realEstateInFlight.delete(key);
    }
  })();

  realEstateInFlight.set(key, job);
  return job;
}
