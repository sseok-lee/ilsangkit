#!/usr/bin/env tsx
// Geocoding script for LH 공공임대 (PublicRentalComplex) using Kakao Map API

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
 * 3-step geocoding strategy for LH 공공임대:
 * 1) Address API: complexName (rnAdres = 도로명주소, 가장 정확)
 * 2) Keyword API: complexNameKor + " " + city + " " + district
 * 3) Keyword API: complexName (keyword로 재시도)
 */
async function geocodePublicRental(
  complexName: string,
  complexNameKor: string | null,
  city: string,
  district: string
): Promise<Coordinates | null> {
  // 1) Address API: complexName (도로명주소)
  const coords1 = await searchByAddress(complexName);
  if (coords1) return coords1;
  await sleep(100);

  // 2) Keyword API: 단지명 + 지역
  if (complexNameKor && complexNameKor.trim()) {
    const keywordQuery = `${complexNameKor} ${city} ${district}`;
    const coords2 = await searchByKeyword(keywordQuery);
    if (coords2) return coords2;
    await sleep(100);
  }

  // 3) Keyword API: complexName 재시도
  const coords3 = await searchByKeyword(complexName);
  if (coords3) return coords3;

  return null;
}

/**
 * Get distinct complexCodes for LH 공공임대 needing geocoding.
 * Returns one representative row per complexCode (same address across variants).
 */
export async function getPublicRentalsToGeocode(
  prisma: PrismaClient
): Promise<Array<{ complexCode: string; complexName: string; complexNameKor: string | null; city: string; district: string }>> {
  const retryCutoff = new Date(Date.now() - GEOCODE_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const results = await prisma.publicRentalComplex.findMany({
    where: {
      lat: null,
      OR: [
        { geocodedAt: null },
        { geocodedAt: { lt: retryCutoff } },
      ],
    },
    select: {
      complexCode: true,
      complexName: true,
      complexNameKor: true,
      city: true,
      district: true,
    },
    distinct: ['complexCode'],
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return results as any;
}

/**
 * Update all variants of a complex (by complexCode) with geocoded coordinates
 */
export async function updatePublicRentalCoordinates(
  prisma: PrismaClient,
  complexCode: string,
  coords: Coordinates
): Promise<void> {
  await prisma.publicRentalComplex.updateMany({
    where: { complexCode },
    data: {
      lat: coords.lat,
      lng: coords.lng,
      geocodedAt: new Date(),
    },
  });
}

/**
 * Mark all variants of a complex (by complexCode) as geocoding attempted
 */
export async function markGeocodeAttempted(
  prisma: PrismaClient,
  complexCode: string
): Promise<void> {
  await prisma.publicRentalComplex.updateMany({
    where: { complexCode },
    data: { geocodedAt: new Date() },
  });
}

/**
 * Process all LH 공공임대 needing geocoding
 */
export async function processPublicRentals(prisma: PrismaClient): Promise<void> {
  console.info('[PublicRent] Extracting public rentals without coordinates...');
  const rentals = await getPublicRentalsToGeocode(prisma);

  if (rentals.length === 0) {
    console.info('[PublicRent] No public rentals to geocode');
    return;
  }

  console.info(`[PublicRent] Starting geocoding for ${rentals.length} complexes`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < rentals.length; i++) {
    const rental = rentals[i];
    const coords = await geocodePublicRental(
      rental.complexName,
      rental.complexNameKor,
      rental.city,
      rental.district
    );

    if (coords) {
      await updatePublicRentalCoordinates(prisma, rental.complexCode, coords);
      console.info(`[PublicRent] (${i + 1}/${rentals.length}) ✓ ${rental.complexName} → ${coords.lat},${coords.lng}`);
      successCount++;
    } else {
      await markGeocodeAttempted(prisma, rental.complexCode);
      console.warn(`[PublicRent] (${i + 1}/${rentals.length}) ✗ ${rental.complexName}`);
      failCount++;
    }

    if (i < rentals.length - 1) await sleep(150);
  }

  const rate = rentals.length > 0 ? ((successCount / rentals.length) * 100).toFixed(1) : '0';
  console.info(`[PublicRent] Complete — Success: ${successCount}, Failed: ${failCount} (${rate}%)`);
}

async function main(): Promise<void> {
  if (!process.env.KAKAO_REST_API_KEY) {
    console.error('KAKAO_REST_API_KEY environment variable not set');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    console.info('=== PublicRent Geocoding Started ===');
    await processPublicRentals(prisma);
    console.info('\n=== PublicRent Geocoding Complete ===');
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
