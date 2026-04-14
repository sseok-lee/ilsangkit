#!/usr/bin/env tsx
// Geocoding script for subscription locations using Kakao Map API

import { PrismaClient } from '@prisma/client';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface KakaoResponse {
  documents: Array<{
    x: string;
    y: string;
    place_name?: string;
    address_name?: string;
  }>;
}

/** Retry threshold for failed geocoding attempts (days) */
const GEOCODE_RETRY_DAYS = 30;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseCoords(response: KakaoResponse): Coordinates | null {
  if (!response.documents || response.documents.length === 0) return null;
  const doc = response.documents[0];
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

const apiKey = process.env.KAKAO_REST_API_KEY;

/**
 * Kakao address search API (address → coordinates)
 */
export async function searchByAddress(query: string): Promise<Coordinates | null> {
  if (!apiKey) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

/**
 * Kakao keyword search API (location name → coordinates)
 */
export async function searchByKeyword(query: string): Promise<Coordinates | null> {
  if (!apiKey) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

/**
 * Clean location name: remove common problematic patterns
 */
function cleanLocationName(name: string): string {
  let cleaned = name;
  cleaned = cleaned.replace(/\s*\(.*\)\s*/g, '');
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
}

/**
 * 3-step geocoding strategy for subscription locations
 * 1) Address API: supplyLocation (most accurate)
 * 2) Keyword API: supplyLocation + houseName
 * 3) Keyword API: cleaned supplyLocation
 */
async function geocodeSubscription(
  supplyLocation: string,
  houseName: string | null
): Promise<Coordinates | null> {
  // 1) Address API: supplyLocation
  const coords1 = await searchByAddress(supplyLocation);
  if (coords1) return coords1;
  await sleep(100);

  // 2) Keyword API: "supplyLocation houseName"
  if (houseName && houseName.trim()) {
    const keywordQuery = `${supplyLocation} ${houseName}`;
    const coords2 = await searchByKeyword(keywordQuery);
    if (coords2) return coords2;
    await sleep(100);
  }

  // 3) Keyword API: cleaned location
  const cleaned = cleanLocationName(supplyLocation);
  if (cleaned && cleaned !== supplyLocation) {
    const coords3 = await searchByKeyword(cleaned);
    if (coords3) return coords3;
  }

  return null;
}

/**
 * Get subscriptions with null coordinates that need geocoding
 */
export async function getSubscriptionsToGeocode(
  prisma: PrismaClient
): Promise<Array<{ id: number; supplyLocation: string; houseName: string | null }>> {
  const retryCutoff = new Date(Date.now() - GEOCODE_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const results = await prisma.subscription.findMany({
    where: {
      lat: null,
      supplyLocation: { not: null },
      OR: [
        { geocodedAt: null },
        { geocodedAt: { lt: retryCutoff } },
      ],
    },
    select: {
      id: true,
      supplyLocation: true,
      houseName: true,
    },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results as any;
}

/**
 * Update subscription with geocoded coordinates
 */
export async function updateSubscriptionCoordinates(
  prisma: PrismaClient,
  id: number,
  coords: Coordinates
): Promise<void> {
  await prisma.subscription.update({
    where: { id },
    data: {
      lat: coords.lat,
      lng: coords.lng,
      geocodedAt: new Date(),
    },
  });
}

/**
 * Mark geocoding attempt as attempted (even if failed)
 */
export async function markGeocodeAttempted(
  prisma: PrismaClient,
  id: number
): Promise<void> {
  await prisma.subscription.update({
    where: { id },
    data: { geocodedAt: new Date() },
  });
}

/**
 * Process all subscriptions needing geocoding
 */
export async function processSubscriptions(prisma: PrismaClient): Promise<void> {
  console.info('[Subscription] Extracting subscriptions without coordinates...');
  const subscriptions = await getSubscriptionsToGeocode(prisma);

  if (subscriptions.length === 0) {
    console.info('[Subscription] No subscriptions to geocode');
    return;
  }

  console.info(`[Subscription] Starting geocoding for ${subscriptions.length} subscriptions`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < subscriptions.length; i++) {
    const sub = subscriptions[i];
    const coords = await geocodeSubscription(sub.supplyLocation, sub.houseName);

    if (coords) {
      await updateSubscriptionCoordinates(prisma, sub.id, coords);
      console.info(`[Subscription] (${i + 1}/${subscriptions.length}) ✓ ${sub.supplyLocation} → ${coords.lat},${coords.lng}`);
      successCount++;
    } else {
      await markGeocodeAttempted(prisma, sub.id);
      console.warn(`[Subscription] (${i + 1}/${subscriptions.length}) ✗ ${sub.supplyLocation}`);
      failCount++;
    }

    if (i < subscriptions.length - 1) await sleep(150);
  }

  const rate = subscriptions.length > 0 ? ((successCount / subscriptions.length) * 100).toFixed(1) : '0';
  console.info(`[Subscription] Complete — Success: ${successCount}, Failed: ${failCount} (${rate}%)`);
}

async function main(): Promise<void> {
  if (!process.env.KAKAO_REST_API_KEY) {
    console.error('KAKAO_REST_API_KEY environment variable not set');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    console.info('=== Subscription Geocoding Started ===');
    await processSubscriptions(prisma);
    console.info('\n=== Subscription Geocoding Complete ===');
  } finally {
    await prisma.$disconnect();
  }
}

import { fileURLToPath } from 'url';
import { resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
