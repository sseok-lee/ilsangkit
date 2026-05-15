import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import {
  buildYoutubeQuery,
  fetchFromYoutube,
  filterVideos,
  YOUTUBE_MIN_RESULTS,
  type FacilityQueryInput,
  type RawYoutubeVideo,
} from './youtubeService.js';
import { youtubeQuotaCounter } from './youtubeQuotaService.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export const inFlight = new Map<string, Promise<RawYoutubeVideo[]>>();

function cacheKey(category: string, facilityId: string): string {
  return `${category}:${facilityId}`;
}

export async function getOrFetchYoutubeVideos(
  category: FacilityCategory,
  facilityId: string,
  facility: FacilityQueryInput,
): Promise<RawYoutubeVideo[]> {
  const hit = await prisma.facilityYoutubeCache.findUnique({
    where: { category_facilityId: { category, facilityId } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.videos as unknown as RawYoutubeVideo[]) ?? [];
  }

  const key = cacheKey(category, facilityId);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<RawYoutubeVideo[]> => {
    try {
      if (!youtubeQuotaCounter.tryConsume()) {
        return [];
      }
      const query = buildYoutubeQuery(facility, category);
      const apiKey = process.env.YOUTUBE_API_KEY ?? '';
      const raw = await fetchFromYoutube(query, apiKey);
      const filtered = filterVideos(raw);
      const isUseful = filtered.length >= YOUTUBE_MIN_RESULTS;
      const videos: RawYoutubeVideo[] = isUseful ? filtered : [];
      const itemCount = videos.length;
      const expiresAt = new Date(Date.now() + TTL_MS);

      await prisma.facilityYoutubeCache.upsert({
        where: { category_facilityId: { category, facilityId } },
        create: { category, facilityId, query, videos: videos as unknown as object, itemCount, expiresAt },
        update: { query, videos: videos as unknown as object, itemCount, expiresAt, fetchedAt: new Date() },
      });

      return videos;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, job);
  return job;
}
