#!/usr/bin/env tsx
// 공매(auction) 물건 주소 → 좌표 보강 (카카오 지오코딩)
// 온비드 API는 좌표를 제공하지 않으므로 onbidCltrNm(지번주소)로 geocoding하여 지도/로드뷰 활성화.

import { PrismaClient } from '@prisma/client';

export interface Coordinates {
  lat: number;
  lng: number;
}

interface KakaoResponse {
  documents: Array<{ x: string; y: string }>;
}

/** 실패 지오코딩 재시도 최소 대기(일) */
const GEOCODE_RETRY_DAYS = 30;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 공매 주소 정제: 카카오 주소검색 방해 요소 제거
 * - "(근생 및 오피스텔)" 등 괄호 이하 제거
 * - " 외 2필지 ..." 등 추가 필지 표현 제거
 */
export function cleanAuctionAddress(address: string): string {
  return String(address ?? '')
    .replace(/\(.*$/, '')
    .replace(/\s+외\s+.*$/, '')
    .trim();
}

/**
 * 주소에서 "시도 ... 동/리/가 + 지번" 핵심부만 추출(가장 높은 적중률).
 * 예: "경기도 화성시 남양읍 신남리 산10-2 임야" → "경기도 화성시 남양읍 신남리 산10-2"
 * 매칭 실패 시 null.
 */
export function extractAddressCore(address: string): string | null {
  const cleaned = cleanAuctionAddress(address);
  const m = cleaned.match(/^(.+?(?:동|리|가|로|길))\s+(산?\s*\d+(?:-\d+)?)/);
  if (!m) return null;
  const jibun = m[2].replace(/산\s+/, '산'); // "산 10-2" → "산10-2"
  return `${m[1]} ${jibun}`.trim();
}

function parseCoords(response: KakaoResponse): Coordinates | null {
  const doc = response.documents?.[0];
  if (!doc) return null;
  const lat = parseFloat(doc.y);
  const lng = parseFloat(doc.x);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { lat, lng };
}

const apiKey = process.env.KAKAO_REST_API_KEY;

async function searchByAddress(query: string): Promise<Coordinates | null> {
  if (!apiKey || !query) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

async function searchByKeyword(query: string): Promise<Coordinates | null> {
  if (!apiKey || !query) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

/**
 * 3단계 전략: 1) 동/리+지번 핵심 주소검색 2) 정제 전체주소 검색 3) 키워드 fallback
 */
export async function geocodeAuctionAddress(
  address: string,
  deps: {
    addr?: (q: string) => Promise<Coordinates | null>;
    kw?: (q: string) => Promise<Coordinates | null>;
  } = {},
): Promise<Coordinates | null> {
  const addr = deps.addr ?? searchByAddress;
  const kw = deps.kw ?? searchByKeyword;

  const core = extractAddressCore(address);
  if (core) {
    const c = await addr(core);
    if (c) return c;
  }
  const cleaned = cleanAuctionAddress(address);
  if (cleaned && cleaned !== core) {
    const c = await addr(cleaned);
    if (c) return c;
  }
  if (cleaned) {
    const c = await kw(cleaned);
    if (c) return c;
  }
  return null;
}

interface AuctionAddrRow { address: string }

export async function getUngeocodedAddresses(prisma: PrismaClient, limit?: number): Promise<string[]> {
  const retryCutoff = new Date(Date.now() - GEOCODE_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const rows = (await prisma.auctionItem.findMany({
    where: {
      lat: null,
      address: { not: '' },
      OR: [{ geocodedAt: null }, { geocodedAt: { lt: retryCutoff } }],
    },
    select: { address: true },
    distinct: ['address'],
    ...(limit ? { take: limit } : {}),
  })) as AuctionAddrRow[];
  return rows.map((r) => r.address);
}

async function main(): Promise<void> {
  if (!apiKey) {
    console.error('KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }
  const limitArg = process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1];
  const limit = limitArg ? parseInt(limitArg, 10) : undefined;

  const prisma = new PrismaClient();
  try {
    const addresses = await getUngeocodedAddresses(prisma, limit);
    console.info(`=== 공매 좌표 보강 시작: ${addresses.length}개 고유 주소 ===`);
    let ok = 0, fail = 0;
    for (let i = 0; i < addresses.length; i++) {
      const address = addresses[i];
      const coords = await geocodeAuctionAddress(address);
      if (coords) {
        const r = await prisma.auctionItem.updateMany({
          where: { address, lat: null },
          data: { lat: coords.lat, lng: coords.lng, geocodedAt: new Date() },
        });
        ok++;
        if ((i + 1) % 100 === 0 || i < 5) console.info(`(${i + 1}/${addresses.length}) ✓ ${address.slice(0, 30)} → ${coords.lat},${coords.lng} (${r.count}건)`);
      } else {
        await prisma.auctionItem.updateMany({ where: { address, lat: null }, data: { geocodedAt: new Date() } });
        fail++;
      }
      if (i < addresses.length - 1) await sleep(120);
    }
    const rate = addresses.length ? ((ok / addresses.length) * 100).toFixed(1) : '0';
    console.info(`\n=== 공매 좌표 보강 완료 — 성공 ${ok}, 실패 ${fail} (${rate}%) ===`);
  } finally {
    await prisma.$disconnect();
  }
}

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { installRuntimeGuard } from './_runtimeGuard.js';

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const guardMinutes = Number(process.env.GEOCODE_GUARD_MINUTES) || 45;
  installRuntimeGuard({ maxMinutes: guardMinutes, name: 'geocodeAuction' });
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
