// @TASK T2.2 - 쓰레기 배출 일정 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화
// NOTE: 쓰레기 배출 데이터는 좌표가 없어 지도 마커 표시 불가 → WasteSchedule 테이블에 저장

import { PublicApiClient } from '../services/publicApiClient.js';
import prisma from '../lib/prisma.js';
import crypto from 'crypto';

/**
 * 공공데이터 API 응답 타입 (생활쓰레기 배출정보)
 * API: https://www.data.go.kr/data/15155080/openapi.do
 *
 * 실제 API 응답 필드 (대문자 + 언더스코어)
 */
export interface TrashApiResponse {
  /** 시도명 */
  CTPV_NM: string;
  /** 시군구명 */
  SGG_NM: string;
  /** 관리구역대상지역명 */
  MNG_ZONE_TRGT_RGN_NM?: string;
  /** 배출장소 */
  EMSN_PLC?: string;
  /** 배출품목 */
  EMSN_ITM?: string;
  /** 배출요일 */
  EMSN_DAY?: string;
  /** 배출시간 */
  EMSN_TIME?: string;
  /** 배출방법 */
  EMSN_MTH?: string;
  /** 수거요일 */
  CLLCT_DAY?: string;
  /** 수거시간 */
  CLLCT_TIME?: string;
  /** 수거방법 */
  CLLCT_MTH?: string;
  /** 관리기관명 */
  MNG_INST_NM?: string;
  /** 관리기관전화번호 */
  MNG_INST_TELNO?: string;
  /** 데이터기준일자 */
  DATA_STDR_DE?: string;
}

/**
 * WasteSchedule 모델에 저장할 데이터 타입
 */
interface TransformedWasteSchedule {
  city: string;
  district: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: {
    emissionItem?: string;
    emissionDay?: string;
    emissionTime?: string;
    emissionMethod?: string;
    collectDay?: string;
    collectTime?: string;
    collectMethod?: string;
    manageInstitute?: string;
    managePhone?: string;
    dataStandardDate?: string;
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
 * API 응답 데이터를 WasteSchedule 모델로 변환
 * @param row - API 응답 데이터
 * @returns 변환된 WasteSchedule 데이터 또는 null (유효하지 않은 경우)
 */
export function transformTrashData(row: TrashApiResponse): TransformedWasteSchedule | null {
  // 필수 필드 검사
  if (!row.CTPV_NM || !row.SGG_NM) {
    return null;
  }

  // sourceId 생성 (시도+시군구+지역+장소 해시)
  const sourceIdParts = [
    row.CTPV_NM,
    row.SGG_NM,
    row.MNG_ZONE_TRGT_RGN_NM || '',
    row.EMSN_PLC || '',
    row.EMSN_ITM || '',
    row.EMSN_DAY || '',
  ].join('-');

  // MD5 해시 생성 (중복 방지용, 32자 고정)
  const sourceId = crypto.createHash('md5').update(sourceIdParts).digest('hex');

  return {
    city: row.CTPV_NM,
    district: row.SGG_NM,
    targetRegion: row.MNG_ZONE_TRGT_RGN_NM || null,
    emissionPlace: row.EMSN_PLC || null,
    details: {
      emissionItem: row.EMSN_ITM,
      emissionDay: row.EMSN_DAY,
      emissionTime: row.EMSN_TIME,
      emissionMethod: row.EMSN_MTH,
      collectDay: row.CLLCT_DAY,
      collectTime: row.CLLCT_TIME,
      collectMethod: row.CLLCT_MTH,
      manageInstitute: row.MNG_INST_NM,
      managePhone: row.MNG_INST_TELNO,
      dataStandardDate: row.DATA_STDR_DE,
    },
    sourceId,
    sourceUrl: 'https://www.data.go.kr/data/15155080/openapi.do',
  };
}

/**
 * 쓰레기 배출 일정 데이터 동기화 실행
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
      category: 'waste_schedule',
      status: 'running',
    },
  });

  try {
    // API 클라이언트 생성
    const client = new PublicApiClient(
      'https://apis.data.go.kr/1741000/household_waste_info/info',
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
        const existingCount = await prisma.wasteSchedule.count({
          where: {
            city: transformed.city,
            district: transformed.district,
            sourceId: transformed.sourceId,
          },
        });

        if (existingCount > 0) {
          result.updatedRecords++;
        } else {
          result.newRecords++;
        }

        // Upsert 실행
        await prisma.wasteSchedule.upsert({
          where: {
            city_district_sourceId: {
              city: transformed.city,
              district: transformed.district,
              sourceId: transformed.sourceId,
            },
          },
          create: {
            ...transformed,
            syncedAt: new Date(),
          },
          update: {
            targetRegion: transformed.targetRegion,
            emissionPlace: transformed.emissionPlace,
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
