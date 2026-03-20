#!/usr/bin/env tsx

// 좌표 없는 학교에 카카오 geocoding으로 좌표 보강

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

async function main(): Promise<void> {
  const apiKey = process.env.KAKAO_REST_API_KEY;
  if (!apiKey) {
    console.error('KAKAO_REST_API_KEY 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  // 좌표 없는 학교 조회
  const schools = await prisma.$queryRaw<Array<{
    id: string; name: string; address: string | null; roadAddress: string | null; city: string; district: string;
  }>>`
    SELECT id, name, address, roadAddress, city, district
    FROM School WHERE lat IS NULL
  `;

  console.info(`=== 학교 geocoding 시작: ${schools.length}개 ===`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < schools.length; i++) {
    const school = schools[i];
    const address = school.roadAddress || school.address;

    let coords: { lat: number; lng: number } | null = null;

    // 1차: 주소로 검색
    if (address) {
      coords = await searchByAddress(address, apiKey);
    }

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
      await prisma.school.update({
        where: { id: school.id },
        data: { lat: coords.lat, lng: coords.lng },
      });
      successCount++;
    } else {
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

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
