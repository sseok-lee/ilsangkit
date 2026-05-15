import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import {
  buildNaverBlogQuery,
  fetchFromNaver,
  filterNaverBlogPosts,
  NAVER_BLOG_MIN_RESULTS,
  type FacilityQueryInput,
  type RawNaverBlogPost,
} from './naverBlogService.js';
import { naverBlogQuotaCounter } from './naverBlogQuotaService.js';

const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const facilityInFlight = new Map<string, Promise<RawNaverBlogPost[]>>();

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
