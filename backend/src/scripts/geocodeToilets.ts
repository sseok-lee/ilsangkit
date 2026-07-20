#!/usr/bin/env tsx

// 좌표 없는 화장실에 카카오 geocoding으로 좌표 보강
// (geocodeSchool.ts 미러 — 신규 CSV에서 좌표 컬럼이 사라져 transformToiletRow가
//  lat/lng=null로 저장한 행을 도로명/지번 주소로 지오코딩해 채운다)

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

interface KakaoResponse {
  documents: Array<{
    x: string;
    y: string;
    address_name?: string;
  }>;
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

export async function geocodeToilets(): Promise<{
  total: number;
  updated: number;
  failed: number;
}> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    throw new Error('KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  // 좌표 없는 화장실 조회
  const toilets = await prisma.$queryRaw<Array<{
    id: string; name: string; address: string | null; roadAddress: string | null; city: string; district: string;
  }>>`
    SELECT id, name, address, roadAddress, city, district
    FROM Toilet WHERE lat IS NULL
  `;

  console.info(`=== 화장실 geocoding 시작: ${toilets.length}개 ===`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toilets.length; i++) {
    const toilet = toilets[i];
    // 도로명 주소 우선, 없으면 지번 주소로 폴백
    const address = toilet.roadAddress || toilet.address;

    let coords: { lat: number; lng: number } | null = null;

    // 1차: 주소로 검색
    if (address) {
      coords = await searchByAddress(address, apiKey);
    }

    // 2차: 화장실명으로 키워드 검색
    if (!coords) {
      coords = await searchByKeyword(toilet.name, apiKey);
    }

    if (coords) {
      await prisma.toilet.update({
        where: { id: toilet.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      successCount++;
    } else {
      failCount++;
      if (failCount <= 20) {
        console.warn(`좌표 못찾음: ${toilet.name} (${address})`);
      }
    }

    if ((i + 1) % 100 === 0) {
      console.info(`진행: ${i + 1}/${toilets.length} | 성공: ${successCount}, 실패: ${failCount}`);
    }

    // 카카오 API rate limit (초당 10건)
    if ((i + 1) % 10 === 0) {
      await sleep(1100);
    }
  }

  console.info(`\n=== geocoding 완료 ===`);
  console.info(`성공: ${successCount}, 실패: ${failCount}, 총: ${toilets.length}`);

  return {
    total: toilets.length,
    updated: successCount,
    failed: failCount,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  geocodeToilets()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
