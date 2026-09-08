#!/usr/bin/env tsx

// 학교 좌표 지오코딩 (카카오)
//
// 대상은 두 가지다:
//   1. 좌표가 없는 행 — 신규 학교
//   2. 좌표를 만든 주소(geocodedAddress)와 현재 주소가 달라진 행 — 학교 이전
//
// 2번이 없으면 이전한 학교의 좌표가 옛 위치를 계속 가리킨다. 2026-09-09 실측에서
// 12,540행 중 63건이 그 상태였고(여명학교 10.7km·호연고 34.5km·내덕초 200km),
// 전량 재지오코딩(12,540 콜)을 해야만 찾아낼 수 있었다.

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

interface KakaoResponse {
  documents: Array<{
    x: string;
    y: string;
    address_name?: string;
  }>;
}

/** 지오코딩 대상 판정에 필요한 최소 필드. */
export interface GeocodeCandidate {
  id: string;
  name: string;
  address: string | null;
  roadAddress: string | null;
  geocodedAddress: string | null;
  lat: unknown;
  lng: unknown;
}

/** 지오코딩에 쓸 주소. 도로명 우선, 없으면 지번. */
export function resolveGeocodeAddress(row: Pick<GeocodeCandidate, 'roadAddress' | 'address'>): string {
  return (row.roadAddress?.trim() || row.address?.trim() || '');
}

/**
 * 이 행을 (다시) 지오코딩해야 하는가.
 *
 * `geocodedAddress` 가 NULL 인 행은 건드리지 않는다. 기존 좌표는 표준데이터 CSV 의
 * 측량 좌표에서 왔고 카카오 도로명 중심점보다 정확한 경우가 많다 — 2026-09-09 에
 * 200m 초과 95건을 학교명 키워드 검색으로 교차검증하니 32건은 저장 좌표가 더
 * 정확했다(평택고는 주소 지오코딩이 1,746m 벗어났고, 인천 석정로 165 는 5개교가
 * 한 주소라 단지 입구로 찍혔다). 출처를 모르는 좌표를 일괄로 덮으면 그런 행이 나빠진다.
 */
export function needsGeocoding(row: GeocodeCandidate): boolean {
  const address = resolveGeocodeAddress(row);
  if (!address) return false;

  if (row.lat === null || row.lat === undefined) return true;
  if (row.lng === null || row.lng === undefined) return true;

  const geocoded = row.geocodedAddress?.trim();
  if (!geocoded) return false;

  return geocoded !== address;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchByAddress(query: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as KakaoResponse;
    if (!data.documents || data.documents.length === 0) return null;
    const doc = data.documents[0];
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch { return null; }
}

async function searchByKeyword(query: string, apiKey: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${apiKey}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as KakaoResponse;
    if (!data.documents || data.documents.length === 0) return null;
    const doc = data.documents[0];
    const lat = parseFloat(doc.y);
    const lng = parseFloat(doc.x);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  } catch { return null; }
}

/**
 * 기존 좌표의 출처를 현재 주소로 기록한다(일회성).
 *
 * 이걸 돌리기 전에는 모든 행이 `geocodedAddress IS NULL` 이라 주소가 바뀌어도
 * 재지오코딩 대상이 되지 않는다. 2026-09-09 전량 대조로 현재 좌표가 현재 주소와
 * 맞는 것을 확인했으므로(중앙값 0m·p99 173m, 어긋난 63건은 교정 완료) 그 사실을
 * 기록해 이후 변경을 감지할 수 있게 한다.
 */
export async function backfillGeocodedAddress(): Promise<number> {
  const rows = await prisma.school.findMany({
    where: { geocodedAddress: null, lat: { not: null }, lng: { not: null } },
    select: { id: true, roadAddress: true, address: true },
  });
  console.info(`=== geocodedAddress 백필 대상: ${rows.length}개 ===`);

  let n = 0;
  for (const row of rows) {
    const address = resolveGeocodeAddress(row);
    if (!address) continue;
    await prisma.school.update({ where: { id: row.id }, data: { geocodedAddress: address } });
    n++;
    if (n % 500 === 0) console.info(`  ${n}/${rows.length}`);
  }
  console.info(`백필 완료: ${n}개`);
  return n;
}

export async function geocodeSchools(): Promise<{
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
}> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error('KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  // 판정은 순수 함수가 한다(geocodeSchoolTargets.test.ts 로 고정). 12,540행 규모라
  // 앱 메모리로 걸러도 안전하다 — ev-charger(49만행)처럼 DB 안에서 접을 필요가 없다.
  const all = await prisma.school.findMany({
    select: {
      id: true, name: true, address: true, roadAddress: true,
      geocodedAddress: true, lat: true, lng: true,
    },
  });
  const schools = all.filter(needsGeocoding);

  const missing = schools.filter((s) => s.lat === null || s.lng === null).length;
  console.info(`=== 학교 geocoding 시작: ${schools.length}개 (좌표없음 ${missing} · 주소변경 ${schools.length - missing}) ===`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const address = resolveGeocodeAddress(school);

    let coords: { lat: number; lng: number } | null = null;

    // 1차: 주소로 검색
    coords = await searchByAddress(address, apiKey);

    // 2차: 학교명으로 키워드 검색
    if (!coords) {
      coords = await searchByKeyword(school.name, apiKey);
    }

    // 3차: 괄호 제거한 학교명으로 재시도 (예: "장대현중고등학교(중)" → "장대현중고등학교")
    if (!coords) {
      const cleanName = school.name.replace(/\(.*?\)/g, '').trim();
      if (cleanName !== school.name) {
        coords = await searchByKeyword(cleanName, apiKey);
      }
    }

    if (coords) {
      // 좌표와 그 출처 주소를 함께 쓴다. 따로 쓰면 다음 실행이 같은 행을 다시 집는다.
      await prisma.school.update({
        where: { id: school.id },
        data: { lat: coords.lat, lng: coords.lng, geocodedAddress: address },
      });
      successCount++;
    } else {
      // 실패해도 기존 좌표는 남긴다. 비우면 카카오가 못 찾는 주소(실측 73건)에서
      // 지도가 아예 사라진다.
      failCount++;
      if (failCount <= 20) {
        console.warn(`좌표 못찾음: ${school.name} (${address})`);
      }
    }

    if ((i + 1) % 100 === 0) {
      console.info(`진행: ${i + 1}/${schools.length} | 성공: ${successCount}, 실패: ${failCount}`);
    }

    // 카카오 API rate limit (초당 10건)
    if ((i + 1) % 10 === 0) {
      await sleep(1100);
    }
  }

  console.info(`\n=== geocoding 완료 ===`);
  console.info(`성공: ${successCount}, 실패: ${failCount}, 총: ${schools.length}`);

  return {
    totalRecords: schools.length,
    newRecords: 0,
    updatedRecords: successCount,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const run = process.argv.includes('--backfill-geocoded-address')
    ? backfillGeocodedAddress()
    : geocodeSchools();

  run
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
