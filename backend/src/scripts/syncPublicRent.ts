#!/usr/bin/env tsx
// 공공임대주택 단지 동기화 스크립트
// API: https://www.odcloud.kr/api/15058476 (JSON 형식)

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runSync, transformAndDedupe, batchUpsert } from '../services/baseSyncService.js';
import type { SyncStats } from '../services/baseSyncService.js';

const API_BASE = 'https://api.odcloud.kr/api/15058476/v1/uddi:44a87f6a-35ad-4d1e-a1ff-a1d7cae9fb04';
const PAGE_SIZE = 1000;

/**
 * 공공임대 API 응답 아이템 타입 (한글 필드명)
 */
export interface PublicRentApiItem {
  단지코드: string;
  단지명: string;
  지역본부명: string;
  지역명: string;
  단지구분명: string;
  세대수: string;
  동수: string;
  준공일자: string;
  입주지정기간시작일: string;
  입주지정기간종료일: string;
  주소: string;
  우편번호: string;
}

/**
 * 변환된 DB 아이템 타입
 */
export interface TransformedPublicRentItem {
  complexCode: string;
  complexName: string;
  regionHub: string | null;
  city: string | null;
  district: string | null;
  rentalType: string;
  householdCount: number;
  buildingCount: number;
  completionDate: Date | null;
  moveInStart: Date | null;
  moveInEnd: Date | null;
  address: string | null;
  zipCode: string | null;
  landlordAgency: string;
  sourceId: string;
}

/**
 * 날짜 문자열 변환 (YYYYMMDD → DateTime)
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null;
  const match = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(`${year}-${month}-${day}`);
  return isNaN(date.getTime()) ? null : date;
}

/**
 * 주소 문자열 파싱 (공백으로 구분된 지역명을 city/district로 분리)
 * 예: "서울특별시 강남구 테헤란로 100" → city: "서울특별시", district: "강남구"
 */
function parseAddress(addressStr: string): { city: string | null; district: string | null } {
  if (!addressStr || addressStr.trim() === '') {
    return { city: null, district: null };
  }

  const parts = addressStr.split(' ').filter((p) => p.length > 0);
  if (parts.length < 2) {
    return { city: null, district: null };
  }

  // 첫 번째 부분이 시/도, 두 번째 부분이 구/군/시
  return { city: parts[0], district: parts[1] };
}

/**
 * API 응답 아이템을 DB 필드로 변환
 */
export function transformPublicRentItem(
  item: PublicRentApiItem,
  city: string | null = null,
  district: string | null = null
): TransformedPublicRentItem {
  // 주소에서 city/district 파싱 (제공된 값이 없을 경우에만)
  let parsedCity = city;
  let parsedDistrict = district;

  if (!parsedCity || !parsedDistrict) {
    const addressParse = parseAddress(item.주소 || '');
    if (!parsedCity) parsedCity = addressParse.city;
    if (!parsedDistrict) parsedDistrict = addressParse.district;
  }

  // 빈 문자열은 null로 처리
  const regionHub = item.지역본부명?.trim() ? item.지역본부명.trim() : null;
  const address = item.주소?.trim() ? item.주소.trim() : null;
  const zipCode = item.우편번호?.trim() ? item.우편번호.trim() : null;

  // 세대수, 동수 정수 변환 (빈 문자열 또는 falsy 값은 0으로)
  const householdCount = item.세대수?.trim() ? parseInt(item.세대수.trim(), 10) : 0;
  const buildingCount = item.동수?.trim() ? parseInt(item.동수.trim(), 10) : 0;

  // 날짜 변환
  const completionDate = parseDate(item.준공일자);
  const moveInStart = parseDate(item.입주지정기간시작일);
  const moveInEnd = parseDate(item.입주지정기간종료일);

  // sourceId 생성
  const sourceId = `publicRent-${item.단지코드}`;

  return {
    complexCode: item.단지코드,
    complexName: item.단지명,
    regionHub,
    city: parsedCity,
    district: parsedDistrict,
    rentalType: item.단지구분명,
    householdCount: isNaN(householdCount) ? 0 : householdCount,
    buildingCount: isNaN(buildingCount) ? 0 : buildingCount,
    completionDate,
    moveInStart,
    moveInEnd,
    address,
    zipCode,
    landlordAgency: 'LH',
    sourceId,
  };
}

/**
 * 단일 페이지 API 호출
 */
async function fetchPage(pageNo: number): Promise<{ items: PublicRentApiItem[]; totalCount: number }> {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('DATA_GO_KR_SERVICE_KEY 환경변수가 설정되지 않았습니다.');
  }

  const url = new URL(API_BASE);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('pageNo', String(pageNo));
  url.searchParams.set('perPage', String(PAGE_SIZE));

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as { data?: PublicRentApiItem[]; totalCount?: number };
  return {
    items: data.data || [],
    totalCount: data.totalCount || 0,
  };
}

/**
 * 모든 페이지 데이터 가져오기 (페이지네이션 처리)
 */
async function fetchAllPages(): Promise<PublicRentApiItem[]> {
  const allItems: PublicRentApiItem[] = [];
  let pageNo = 1;
  let totalCount = 0;

  // 첫 페이지 요청
  const firstPage = await fetchPage(pageNo);
  allItems.push(...firstPage.items);
  totalCount = firstPage.totalCount;

  console.info(`Total records from API: ${totalCount}`);

  // 남은 페이지 모두 가져오기
  while (allItems.length < totalCount) {
    pageNo++;
    const page = await fetchPage(pageNo);
    allItems.push(...page.items);
    console.info(`Fetched page ${pageNo}: ${page.items.length} items (total so far: ${allItems.length}/${totalCount})`);

    // API rate limit 고려
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return allItems;
}

/**
 * 공공임대 동기화 메인 함수
 */
async function syncPublicRent(): Promise<SyncStats> {
  return runSync('public-rental', async (stats) => {
    // 모든 페이지 데이터 가져오기
    const rawItems = await fetchAllPages();
    stats.totalRecords = rawItems.length;

    // 데이터 변환 및 중복 제거
    const transformedItems = transformAndDedupe(
      rawItems,
      (item) => transformPublicRentItem(item),
      (item) => item.sourceId,
      stats
    );

    console.info(`After deduplication: ${transformedItems.length} items (skipped: ${stats.skippedRecords})`);

    // 배치 upsert
    const { newCount, updateCount } = await batchUpsert(
      transformedItems,
      async (item) => {
        const result = await prisma.publicRentalComplex.upsert({
          where: { sourceId: item.sourceId },
          update: {
            complexCode: item.complexCode,
            complexName: item.complexName,
            regionHub: item.regionHub,
            city: item.city || '',
            district: item.district || '',
            rentalType: item.rentalType,
            householdCount: item.householdCount,
            buildingCount: item.buildingCount,
            completionDate: item.completionDate,
            moveInStart: item.moveInStart,
            moveInEnd: item.moveInEnd,
            address: item.address,
            zipCode: item.zipCode,
            landlordAgency: item.landlordAgency,
            syncedAt: new Date(),
          },
          create: {
            complexCode: item.complexCode,
            complexName: item.complexName,
            regionHub: item.regionHub,
            city: item.city || '',
            district: item.district || '',
            rentalType: item.rentalType,
            householdCount: item.householdCount,
            buildingCount: item.buildingCount,
            completionDate: item.completionDate,
            moveInStart: item.moveInStart,
            moveInEnd: item.moveInEnd,
            address: item.address,
            zipCode: item.zipCode,
            landlordAgency: item.landlordAgency,
            sourceId: item.sourceId,
          },
        });

        return result.id ? 'new' : 'updated';
      }
    );

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
  });
}

// 스크립트 직접 실행 시
if (import.meta.url === `file://${process.argv[1]}`) {
  syncPublicRent()
    .then(() => {
      console.log('✅ 공공임대 동기화 완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ 공공임대 동기화 실패:', error);
      process.exit(1);
    });
}

export { syncPublicRent };
