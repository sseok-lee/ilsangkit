// @TASK T2.3.1 - 의류수거함 데이터 동기화
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { Prisma } from '@prisma/client';
import prisma from '../lib/prisma.js';
import { fetchPublicApi, PublicApiResponse } from '../lib/publicApiClient.js';

/**
 * 의류수거함 API 응답 아이템 인터페이스
 */
export interface ClothesApiItem {
  mngNo: string;          // 관리번호
  instlPlc: string;       // 설치장소명
  ctprvnNm: string;       // 시도명
  signguNm: string;       // 시군구명
  rdnmadr: string;        // 도로명주소
  lnmadr: string;         // 지번주소
  latitude: string;       // 위도
  longitude: string;      // 경도
  mngInsttNm: string;     // 관리기관명
  instlYmd: string;       // 설치일자
  phoneNumber: string;    // 전화번호
}

/**
 * 동기화 결과 인터페이스
 */
interface SyncResult {
  status: 'success' | 'failed';
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  errorMessage?: string;
}

/**
 * 동기화 옵션 인터페이스
 */
interface SyncOptions {
  numOfRows?: number;
}

/**
 * 시도명 변환 맵
 */
const CITY_NAME_MAP: Record<string, string> = {
  '서울특별시': '서울',
  '부산광역시': '부산',
  '대구광역시': '대구',
  '인천광역시': '인천',
  '광주광역시': '광주',
  '대전광역시': '대전',
  '울산광역시': '울산',
  '세종특별자치시': '세종',
  '경기도': '경기',
  '강원도': '강원',
  '강원특별자치도': '강원',
  '충청북도': '충북',
  '충청남도': '충남',
  '전라북도': '전북',
  '전북특별자치도': '전북',
  '전라남도': '전남',
  '경상북도': '경북',
  '경상남도': '경남',
  '제주특별자치도': '제주',
};

/**
 * 시도명을 짧은 형태로 변환
 */
function normalizeCityName(ctprvnNm: string): string {
  return CITY_NAME_MAP[ctprvnNm] || ctprvnNm;
}

/**
 * 의류수거함 데이터 유효성 검사
 */
export function isValidClothesData(item: ClothesApiItem): boolean {
  // 필수 필드 확인
  if (!item.mngNo || item.mngNo.trim() === '') {
    return false;
  }

  // 좌표 확인
  const lat = parseFloat(item.latitude);
  const lng = parseFloat(item.longitude);

  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return false;
  }

  // 한국 좌표 범위 확인 (대략적)
  if (lat < 33 || lat > 39 || lng < 124 || lng > 132) {
    return false;
  }

  return true;
}

/**
 * API 응답을 Facility 모델 형식으로 변환
 */
export function transformClothesData(item: ClothesApiItem): Prisma.FacilityCreateInput {
  const lat = parseFloat(item.latitude);
  const lng = parseFloat(item.longitude);

  const roadAddress = item.rdnmadr?.trim() || null;
  const address = item.lnmadr?.trim() || null;

  return {
    id: `clothes-${item.mngNo}`,
    category: 'clothes',
    name: item.instlPlc || `의류수거함 ${item.mngNo}`,
    address: address || roadAddress,
    roadAddress: roadAddress,
    lat: new Prisma.Decimal(lat),
    lng: new Prisma.Decimal(lng),
    city: normalizeCityName(item.ctprvnNm),
    district: item.signguNm,
    sourceId: item.mngNo,
    details: {
      managementNo: item.mngNo,
      managementAgency: item.mngInsttNm || null,
      installDate: item.instlYmd || null,
      phoneNumber: item.phoneNumber || null,
    },
  };
}

/**
 * API 엔드포인트
 */
const CLOTHES_API_ENDPOINT = '/openapi/tn_pubr_public_clothing_collect_bins_api';

/**
 * 의류수거함 데이터 동기화 실행
 */
export async function syncClothesData(options: SyncOptions = {}): Promise<SyncResult> {
  const { numOfRows = 1000 } = options;
  const result: SyncResult = {
    status: 'success',
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
  };

  // SyncHistory 시작 기록
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'clothes',
      status: 'running',
    },
  });

  try {
    let pageNo = 1;
    let hasMore = true;
    const allItems: ClothesApiItem[] = [];

    // 페이지네이션 처리
    while (hasMore) {
      const response: PublicApiResponse<ClothesApiItem> = await fetchPublicApi(
        CLOTHES_API_ENDPOINT,
        {
          pageNo,
          numOfRows,
        }
      );

      const items = response.response.body.items || [];
      allItems.push(...items);

      result.totalRecords = response.response.body.totalCount;

      // 다음 페이지 확인
      const totalPages = Math.ceil(response.response.body.totalCount / numOfRows);
      hasMore = pageNo < totalPages;
      pageNo++;
    }

    // 유효한 데이터만 필터링
    const validItems = allItems.filter(isValidClothesData);

    // DB 저장 (upsert)
    for (const item of validItems) {
      const data = transformClothesData(item);

      // 기존 데이터 확인
      const existing = await prisma.facility.findUnique({
        where: { id: data.id },
      });

      if (existing) {
        await prisma.facility.update({
          where: { id: data.id },
          data: {
            ...data,
            syncedAt: new Date(),
          },
        });
        result.updatedRecords++;
      } else {
        await prisma.facility.create({
          data,
        });
        result.newRecords++;
      }
    }

    // SyncHistory 성공 기록
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'success',
        totalRecords: result.totalRecords,
        newRecords: result.newRecords,
        updatedRecords: result.updatedRecords,
        completedAt: new Date(),
      },
    });

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    result.status = 'failed';
    result.errorMessage = errorMessage;

    // SyncHistory 실패 기록
    await prisma.syncHistory.update({
      where: { id: syncHistory.id },
      data: {
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      },
    });

    return result;
  }
}

// CLI 실행용
if (import.meta.url === `file://${process.argv[1]}`) {
  syncClothesData()
    .then((result) => {
      console.info('동기화 완료:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('동기화 실패:', error);
      process.exit(1);
    });
}
