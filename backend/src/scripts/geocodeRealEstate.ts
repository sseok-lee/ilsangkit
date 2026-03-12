#!/usr/bin/env tsx
// @TASK Phase2-8 - 카카오 Geocoding 좌표 보강 스크립트

import { PrismaClient } from '@prisma/client';

export interface UniqueBuilding {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  roadName: string | null;
  jibun: string | null;
}

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

export type RealEstateTable =
  | 'aptSaleTransaction'
  | 'aptRentTransaction'
  | 'villaSaleTransaction'
  | 'villaRentTransaction'
  | 'offitelSaleTransaction'
  | 'offitelRentTransaction';

const REAL_ESTATE_TABLES: RealEstateTable[] = [
  'aptSaleTransaction',
  'aptRentTransaction',
  'villaSaleTransaction',
  'villaRentTransaction',
  'offitelSaleTransaction',
  'offitelRentTransaction',
];

function getPropertySuffix(table: RealEstateTable): string {
  if (table.startsWith('apt')) return '아파트';
  if (table.startsWith('offitel')) return '오피스텔';
  return '';
}

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
 * 카카오 주소 검색 API (법정동+지번 → 정확한 좌표)
 */
async function searchByAddress(query: string): Promise<Coordinates | null> {
  if (!apiKey) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

/**
 * 카카오 키워드 검색 API (건물명 → 장소 검색)
 */
async function searchByKeyword(query: string): Promise<Coordinates | null> {
  if (!apiKey) return null;
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    return parseCoords((await res.json()) as KakaoResponse);
  } catch { return null; }
}

// 하위 호환
export const geocodeAddress = searchByKeyword;
export const geocodeByKeyword = searchByKeyword;

/**
 * 3단계 지오코딩 전략
 * 1) 주소 API: "시 구 동 지번" (가장 정확)
 * 2) 키워드 API: "구 건물명 아파트"
 * 3) 키워드 API: "시 구 건물명"
 */
async function geocodeBuilding(
  building: UniqueBuilding,
  table: RealEstateTable
): Promise<Coordinates | null> {
  const { city, district, dongName, jibun, buildingName, roadName } = building;
  const suffix = getPropertySuffix(table);

  // 1) 주소 API: 법정동 + 지번 (가장 정확)
  if (dongName && jibun) {
    const addrQuery = `${city} ${district} ${dongName} ${jibun}`;
    const coords = await searchByAddress(addrQuery);
    if (coords) return coords;
    await sleep(100);
  }

  // 2) 주소 API: 도로명 주소
  if (roadName && roadName.trim()) {
    const roadQuery = `${city} ${district} ${roadName}`;
    const coords = await searchByAddress(roadQuery);
    if (coords) return coords;
    await sleep(100);
  }

  // 3) 키워드 API: "구 건물명 아파트"
  const kwName = suffix && !buildingName.includes(suffix) ? `${buildingName}${suffix}` : buildingName;
  const kwQuery = `${district} ${kwName}`;
  const coords2 = await searchByKeyword(kwQuery);
  if (coords2) return coords2;
  await sleep(100);

  // 4) 키워드 API: "시 구 동 건물명"
  if (dongName) {
    const lastQuery = `${city} ${district} ${dongName} ${buildingName}`;
    return searchByKeyword(lastQuery);
  }

  return null;
}

export async function getUniqueBuildings(
  prisma: PrismaClient,
  table: RealEstateTable
): Promise<UniqueBuilding[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[table];
  return model.findMany({
    where: { lat: null },
    select: {
      buildingName: true,
      bjdCode: true,
      city: true,
      district: true,
      dongName: true,
      roadName: true,
      jibun: true,
    },
    distinct: ['buildingName', 'bjdCode'],
  }) as Promise<UniqueBuilding[]>;
}

export async function updateBuildingCoordinates(
  prisma: PrismaClient,
  table: RealEstateTable,
  building: UniqueBuilding,
  coords: Coordinates
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[table];
  const result = await model.updateMany({
    where: { buildingName: building.buildingName, bjdCode: building.bjdCode, lat: null },
    data: { lat: coords.lat, lng: coords.lng },
  });
  return result.count;
}

// 하위 호환
export function buildSearchQuery(building: UniqueBuilding): string {
  if (building.roadName?.trim()) return `${building.city} ${building.district} ${building.roadName} ${building.buildingName}`;
  return `${building.city} ${building.district} ${building.buildingName}`;
}
export function parseKakaoCoordinates(response: KakaoResponse): Coordinates | null {
  return parseCoords(response);
}

async function processTable(prisma: PrismaClient, table: RealEstateTable): Promise<void> {
  console.info(`\n[${table}] 좌표 없는 건물 추출 중...`);
  const buildings = await getUniqueBuildings(prisma, table);

  if (buildings.length === 0) {
    console.info(`[${table}] 좌표 보강 대상 없음`);
    return;
  }

  console.info(`[${table}] ${buildings.length}개 건물 좌표 보강 시작`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < buildings.length; i++) {
    const building = buildings[i];
    const coords = await geocodeBuilding(building, table);

    if (coords) {
      const cnt = await updateBuildingCoordinates(prisma, table, building, coords);
      console.info(`[${table}] (${i + 1}/${buildings.length}) ✓ ${building.buildingName} → ${coords.lat},${coords.lng} (${cnt}건)`);
      successCount++;
    } else {
      console.warn(`[${table}] (${i + 1}/${buildings.length}) ✗ ${building.buildingName} [${building.dongName} ${building.jibun ?? ''}]`);
      failCount++;
    }

    if (i < buildings.length - 1) await sleep(150);
  }

  const rate = buildings.length > 0 ? ((successCount / buildings.length) * 100).toFixed(1) : '0';
  console.info(`[${table}] 완료 — 성공: ${successCount}, 실패: ${failCount} (${rate}%)`);
}

async function main(): Promise<void> {
  if (!process.env.KAKAO_REST_API_KEY) {
    console.error('KAKAO_REST_API_KEY 환경변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const tableArg = process.argv.find(a => a.startsWith('--table='))?.split('=')[1] as RealEstateTable | undefined;
  const tables = tableArg ? [tableArg] : REAL_ESTATE_TABLES;

  const prisma = new PrismaClient();
  try {
    console.info(`=== 부동산 데이터 좌표 보강 시작 (${tables.join(', ')}) ===`);
    for (const table of tables) {
      await processTable(prisma, table);
    }
    console.info('\n=== 좌표 보강 완료 ===');
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
