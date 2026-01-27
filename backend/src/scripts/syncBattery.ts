// @TASK T2.3.2 - 폐형광등/폐건전지 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화
// API 소스: data.go.kr/15155673

import prisma from '../lib/prisma.js';
import crypto from 'crypto';

/**
 * 폐형광등/폐건전지 수거함 API 응답 아이템
 */
export interface BatteryApiItem {
  instlPlcNm: string; // 설치장소명
  dtlLoc: string; // 세부위치내용
  ctprvnNm: string; // 시도명
  signguNm: string; // 시군구명
  rdnmadr: string; // 도로명주소
  lnmadr: string; // 지번주소
  latitude: string; // 위도
  longitude: string; // 경도
  colctItmNm: string; // 수거품목명
  colctBoxCnt: string; // 수거함수량
  mngInsttNm: string; // 관리기관명
  mngInsttTelno: string; // 관리기관전화번호
}

/**
 * API 응답 전체 구조
 */
export interface BatteryApiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: BatteryApiItem[];
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/**
 * 변환된 시설 데이터
 */
interface TransformedFacility {
  id: string;
  category: 'battery';
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  bjdCode: string | null;
  details: {
    detailLocation: string;
    collectionItems: string;
    boxCount: number;
    managementAgency: string;
    phoneNumber: string;
  };
  sourceId: string;
  sourceUrl: string;
  syncedAt: Date;
}

/**
 * API 기본 URL
 */
const API_BASE_URL =
  'https://api.data.go.kr/openapi/tn_pubr_public_waste_lamp_battery_collection_box_api';

/**
 * 동기화 결과
 */
interface SyncResult {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
}

/**
 * API 데이터 조회 결과
 */
interface FetchResult {
  items: BatteryApiItem[];
  totalCount: number;
}

/**
 * 폐형광등/폐건전지 수거함 API 호출
 * @param pageNo - 페이지 번호
 * @param numOfRows - 페이지당 항목 수
 * @returns API 응답 데이터
 */
export async function fetchBatteryData(
  pageNo: number = 1,
  numOfRows: number = 100
): Promise<FetchResult> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY is not set');
  }

  const url = new URL(API_BASE_URL);
  url.searchParams.append('serviceKey', serviceKey);
  url.searchParams.append('pageNo', String(pageNo));
  url.searchParams.append('numOfRows', String(numOfRows));
  url.searchParams.append('type', 'json');

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const data: BatteryApiResponse = await response.json();

  // API 응답 에러 체크
  if (data.response.header.resultCode !== '00') {
    throw new Error(
      `API Error: ${data.response.header.resultCode} - ${data.response.header.resultMsg}`
    );
  }

  return {
    items: data.response.body.items || [],
    totalCount: data.response.body.totalCount,
  };
}

/**
 * 고유 ID 생성
 * @param item - API 응답 아이템
 * @returns 해시 기반 ID
 */
function generateId(item: BatteryApiItem): string {
  const raw = `${item.ctprvnNm}_${item.signguNm}_${item.instlPlcNm}_${item.latitude}_${item.longitude}`;
  const hash = crypto.createHash('md5').update(raw).digest('hex').substring(0, 12);
  return `battery_${hash}`;
}

/**
 * API 응답을 Facility 모델로 변환
 * @param item - API 응답 아이템
 * @returns 변환된 시설 데이터 또는 null (좌표 없는 경우)
 */
export function transformBatteryData(item: BatteryApiItem): TransformedFacility | null {
  // 좌표 파싱
  const lat = parseFloat(item.latitude);
  const lng = parseFloat(item.longitude);

  // 좌표가 유효하지 않으면 스킵
  if (!lat || !lng || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }

  // 주소 처리
  const roadAddress = item.rdnmadr?.trim() || null;
  const address = item.lnmadr?.trim() || null;

  // 수거함 수량 파싱
  const boxCount = parseInt(item.colctBoxCnt) || 1;

  const sourceId = generateId(item);

  return {
    id: sourceId,
    category: 'battery',
    name: item.instlPlcNm?.trim() || '폐형광등/폐건전지 수거함',
    address: address,
    roadAddress: roadAddress,
    lat,
    lng,
    city: item.ctprvnNm?.trim() || '',
    district: item.signguNm?.trim() || '',
    bjdCode: null,
    details: {
      detailLocation: item.dtlLoc?.trim() || '',
      collectionItems: item.colctItmNm?.trim() || '',
      boxCount,
      managementAgency: item.mngInsttNm?.trim() || '',
      phoneNumber: item.mngInsttTelno?.trim() || '',
    },
    sourceId,
    sourceUrl: 'https://www.data.go.kr/data/15155673/openapi.do',
    syncedAt: new Date(),
  };
}

/**
 * 전체 동기화 실행
 * @returns 동기화 결과
 */
export async function syncBatteryData(): Promise<SyncResult> {
  // 동기화 히스토리 생성
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'battery',
      status: 'running',
    },
  });

  let totalRecords = 0;
  let newRecords = 0;
  let updatedRecords = 0;

  try {
    // 첫 페이지 조회로 totalCount 확인
    let pageNo = 1;
    const numOfRows = 100;
    let hasMore = true;

    while (hasMore) {
      const { items, totalCount } = await fetchBatteryData(pageNo, numOfRows);

      // 각 아이템 변환 및 저장
      for (const item of items) {
        const transformed = transformBatteryData(item);
        if (!transformed) {
          continue; // 유효하지 않은 항목 스킵
        }

        // Upsert 실행
        const existing = await prisma.facility.findUnique({
          where: { id: transformed.id },
        });

        await prisma.facility.upsert({
          where: { id: transformed.id },
          create: {
            id: transformed.id,
            category: transformed.category,
            name: transformed.name,
            address: transformed.address,
            roadAddress: transformed.roadAddress,
            lat: transformed.lat,
            lng: transformed.lng,
            city: transformed.city,
            district: transformed.district,
            bjdCode: transformed.bjdCode,
            details: transformed.details,
            sourceId: transformed.sourceId,
            sourceUrl: transformed.sourceUrl,
            syncedAt: transformed.syncedAt,
          },
          update: {
            name: transformed.name,
            address: transformed.address,
            roadAddress: transformed.roadAddress,
            lat: transformed.lat,
            lng: transformed.lng,
            city: transformed.city,
            district: transformed.district,
            details: transformed.details,
            syncedAt: transformed.syncedAt,
          },
        });

        totalRecords++;
        if (existing) {
          updatedRecords++;
        } else {
          newRecords++;
        }
      }

      // 다음 페이지 확인
      const processedCount = pageNo * numOfRows;
      hasMore = processedCount < totalCount;
      pageNo++;
    }

    // 성공 기록
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'success',
        totalRecords,
        newRecords,
        updatedRecords,
        completedAt: new Date(),
      },
    });

    return { totalRecords, newRecords, updatedRecords };
  } catch (error) {
    // 실패 기록
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : String(error),
        completedAt: new Date(),
      },
    });

    throw error;
  }
}

// CLI 실행 지원
if (import.meta.url === `file://${process.argv[1]}`) {
  console.info('Starting battery data sync...');
  syncBatteryData()
    .then((result) => {
      console.info('Sync completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Sync failed:', error);
      process.exit(1);
    });
}
