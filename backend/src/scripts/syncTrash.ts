// @TASK T2.2 - 쓰레기 배출 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화

import { PublicApiClient } from '../services/publicApiClient.js';
import prisma from '../lib/prisma.js';
import { FacilityCategory } from '@prisma/client';

/**
 * 공공데이터 API 응답 타입 (생활쓰레기 배출정보)
 * API: https://www.data.go.kr/data/15155080/openapi.do
 */
export interface TrashApiResponse {
  /** 시도명 */
  ctpvNm: string;
  /** 시군구명 */
  sggNm: string;
  /** 행정동명 */
  adongNm: string;
  /** 법정동코드 (5자리) */
  ldongCd: string;
  /** 배출장소명 */
  dsbdPlcNm: string;
  /** 배출요일 */
  dsbdWeekday: string;
  /** 배출시작시간 */
  dsbdBgngTm: string;
  /** 배출종료시간 */
  dsbdEndTm: string;
  /** 배출순번 */
  dsbdSrtnSn: string;
  /** 위도 */
  lat: string;
  /** 경도 */
  lot: string;
}

/**
 * Facility 모델에 저장할 데이터 타입
 */
interface TransformedFacility {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  bjdCode: string | null;
  details: {
    neighborhood: string;
    collectionDays: string;
    startTime: string;
    endTime: string;
    serialNumber: string;
  };
  sourceId: string;
  sourceUrl: string;
}

/**
 * 동기화 옵션
 */
interface SyncOptions {
  /** 공공데이터 API 서비스 키 */
  serviceKey: string;
  /** 드라이런 모드 (DB 저장 안함) */
  dryRun?: boolean;
  /** 페이지 크기 (기본값: 100) */
  pageSize?: number;
}

/**
 * 동기화 결과
 */
interface SyncResult {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
}

/**
 * API 응답 데이터를 Facility 모델로 변환
 * @param row - API 응답 데이터
 * @returns 변환된 Facility 데이터 또는 null (유효하지 않은 경우)
 */
export function transformTrashData(row: TrashApiResponse): TransformedFacility | null {
  // 좌표 유효성 검사
  const lat = parseFloat(row.lat);
  const lng = parseFloat(row.lot);

  if (!row.lat || !row.lot || isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) {
    return null;
  }

  // sourceId 생성 (법정동코드 + 배출순번)
  const sourceId = `${row.ldongCd}-${row.dsbdSrtnSn}`;

  // ID 생성 (trash 카테고리 prefix + sourceId)
  const id = `trash-${sourceId}`;

  return {
    id,
    category: 'trash' as FacilityCategory,
    name: row.dsbdPlcNm || `${row.adongNm} 생활쓰레기 배출장소`,
    address: null,
    roadAddress: null,
    lat,
    lng,
    city: row.ctpvNm,
    district: row.sggNm,
    bjdCode: row.ldongCd?.substring(0, 5) || null,
    details: {
      neighborhood: row.adongNm || '',
      collectionDays: row.dsbdWeekday || '',
      startTime: row.dsbdBgngTm || '',
      endTime: row.dsbdEndTm || '',
      serialNumber: row.dsbdSrtnSn || '',
    },
    sourceId,
    sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
  };
}

/**
 * 쓰레기 배출 데이터 동기화 실행
 * @param options - 동기화 옵션
 * @returns 동기화 결과
 */
export async function syncTrashData(options: SyncOptions): Promise<SyncResult> {
  const { serviceKey, dryRun = false, pageSize = 100 } = options;

  const result: SyncResult = {
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
  };

  // SyncHistory 생성
  const syncHistory = await prisma.syncHistory.create({
    data: {
      category: 'trash',
      status: 'running',
    },
  });

  try {
    // API 클라이언트 생성
    const client = new PublicApiClient(
      'https://apis.data.go.kr/1741000/household_waste_info',
      serviceKey,
      { maxRetries: 3, retryDelay: 1000 }
    );

    // 모든 페이지 데이터 조회
    const allItems = await client.fetchAllPages<TrashApiResponse>(pageSize);

    console.info(`[syncTrashData] Fetched ${allItems.length} items from API`);

    // 데이터 변환 및 저장
    for (const item of allItems) {
      const transformed = transformTrashData(item);

      if (!transformed) {
        result.skippedRecords++;
        continue;
      }

      result.totalRecords++;

      if (!dryRun) {
        // 기존 데이터 존재 여부 확인
        const existingCount = await prisma.facility.count({
          where: {
            category: 'trash',
            sourceId: transformed.sourceId,
          },
        });

        if (existingCount > 0) {
          result.updatedRecords++;
        } else {
          result.newRecords++;
        }

        // Upsert 실행
        await prisma.facility.upsert({
          where: {
            category_sourceId: {
              category: 'trash',
              sourceId: transformed.sourceId,
            },
          },
          create: {
            ...transformed,
            syncedAt: new Date(),
          },
          update: {
            name: transformed.name,
            lat: transformed.lat,
            lng: transformed.lng,
            city: transformed.city,
            district: transformed.district,
            bjdCode: transformed.bjdCode,
            details: transformed.details,
            syncedAt: new Date(),
          },
        });
      } else {
        // Dry run 모드: 카운트만
        result.newRecords++;
      }
    }

    // SyncHistory 업데이트 (성공)
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

    console.info(`[syncTrashData] Sync completed:`, result);

    return result;
  } catch (error) {
    // SyncHistory 업데이트 (실패)
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
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;

  if (!serviceKey) {
    console.error('OPENAPI_SERVICE_KEY environment variable is required');
    process.exit(1);
  }

  const dryRun = process.argv.includes('--dry-run');

  console.info(`[syncTrash] Starting sync... (dryRun: ${dryRun})`);

  syncTrashData({ serviceKey, dryRun })
    .then((result) => {
      console.info('[syncTrash] Sync completed:', result);
      process.exit(0);
    })
    .catch((error) => {
      console.error('[syncTrash] Sync failed:', error);
      process.exit(1);
    });
}
