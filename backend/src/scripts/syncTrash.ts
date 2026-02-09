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
 * 실제 API 응답 필드 (대문자 + 언더스코어) - 1 row에 4개 유형 포함
 */
export interface TrashApiResponse {
  /** 시도명 */
  CTPV_NM: string;
  /** 시군구명 */
  SGG_NM: string;
  /** 관리구역명 */
  MNG_ZONE_NM?: string;
  /** 관리구역대상지역명 */
  MNG_ZONE_TRGT_RGN_NM?: string;
  /** 배출장소 */
  EMSN_PLC?: string;
  /** 배출장소유형 */
  EMSN_PLC_TYPE?: string;

  // 생활쓰레기
  /** 생활쓰레기 배출요일 */
  LF_WST_EMSN_DOW?: string;
  /** 생활쓰레기 배출시작시간 */
  LF_WST_EMSN_BGNG_TM?: string;
  /** 생활쓰레기 배출종료시간 */
  LF_WST_EMSN_END_TM?: string;
  /** 생활쓰레기 배출방법 */
  LF_WST_EMSN_MTHD?: string;

  // 음식물쓰레기
  /** 음식물쓰레기 배출요일 */
  FOD_WST_EMSN_DOW?: string;
  /** 음식물쓰레기 배출시작시간 */
  FOD_WST_EMSN_BGNG_TM?: string;
  /** 음식물쓰레기 배출종료시간 */
  FOD_WST_EMSN_END_TM?: string;
  /** 음식물쓰레기 배출방법 */
  FOD_WST_EMSN_MTHD?: string;

  // 재활용
  /** 재활용 배출요일 */
  RCYCL_EMSN_DOW?: string;
  /** 재활용 배출시작시간 */
  RCYCL_EMSN_BGNG_TM?: string;
  /** 재활용 배출종료시간 */
  RCYCL_EMSN_END_TM?: string;
  /** 재활용 배출방법 */
  RCYCL_EMSN_MTHD?: string;

  // 대형폐기물
  /** 대형폐기물 배출시작시간 */
  TMPRY_BULK_WASTE_EMSN_BGNG_TM?: string;
  /** 대형폐기물 배출종료시간 */
  TMPRY_BULK_WASTE_EMSN_END_TM?: string;
  /** 대형폐기물 배출방법 */
  TMPRY_BULK_WASTE_EMSN_MTHD?: string;
  /** 대형폐기물 배출장소 */
  TMPRY_BULK_WASTE_EMSN_PLC?: string;

  // 관리
  /** 미수거일 */
  UNCLLT_DAY?: string;
  /** 관리부서명 */
  MNG_DEPT_NM?: string;
  /** 관리부서전화번호 */
  MNG_DEPT_TELNO?: string;
  /** 관리번호 */
  MNG_NO?: string;
  /** 개방자치단체그룹코드 */
  OPN_ATMY_GRP_CD?: string;
  /** 데이터생성일자 */
  DAT_CRTR_YMD?: string;
  /** 최종수정시점 */
  LAST_MDFCN_PNT?: string;
}

/**
 * 유형별 배출 정보
 */
interface WasteTypeInfo {
  dayOfWeek?: string;
  beginTime?: string;
  endTime?: string;
  method?: string;
}

/**
 * 대형폐기물 배출 정보
 */
interface BulkWasteInfo {
  beginTime?: string;
  endTime?: string;
  method?: string;
  place?: string;
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
    emissionPlaceType?: string;
    managementZone?: string;
    livingWaste?: WasteTypeInfo;
    foodWaste?: WasteTypeInfo;
    recyclable?: WasteTypeInfo;
    bulkWaste?: BulkWasteInfo;
    uncollectedDay?: string;
    manageDepartment?: string;
    managePhone?: string;
    dataCreatedDate?: string;
    lastModified?: string;
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

  // sourceId: MNG_NO 우선, 없으면 해시 폴백
  let sourceId: string;
  if (row.MNG_NO) {
    sourceId = row.MNG_NO;
  } else {
    const sourceIdParts = [
      row.CTPV_NM,
      row.SGG_NM,
      row.MNG_ZONE_TRGT_RGN_NM || '',
      row.EMSN_PLC || '',
    ].join('-');
    sourceId = crypto.createHash('md5').update(sourceIdParts).digest('hex');
  }

  // 유형별 sub-object: 관련 필드가 하나라도 있을 때만 생성
  const livingWaste: WasteTypeInfo | undefined =
    row.LF_WST_EMSN_DOW || row.LF_WST_EMSN_BGNG_TM || row.LF_WST_EMSN_END_TM || row.LF_WST_EMSN_MTHD
      ? {
          dayOfWeek: row.LF_WST_EMSN_DOW,
          beginTime: row.LF_WST_EMSN_BGNG_TM,
          endTime: row.LF_WST_EMSN_END_TM,
          method: row.LF_WST_EMSN_MTHD,
        }
      : undefined;

  const foodWaste: WasteTypeInfo | undefined =
    row.FOD_WST_EMSN_DOW || row.FOD_WST_EMSN_BGNG_TM || row.FOD_WST_EMSN_END_TM || row.FOD_WST_EMSN_MTHD
      ? {
          dayOfWeek: row.FOD_WST_EMSN_DOW,
          beginTime: row.FOD_WST_EMSN_BGNG_TM,
          endTime: row.FOD_WST_EMSN_END_TM,
          method: row.FOD_WST_EMSN_MTHD,
        }
      : undefined;

  const recyclable: WasteTypeInfo | undefined =
    row.RCYCL_EMSN_DOW || row.RCYCL_EMSN_BGNG_TM || row.RCYCL_EMSN_END_TM || row.RCYCL_EMSN_MTHD
      ? {
          dayOfWeek: row.RCYCL_EMSN_DOW,
          beginTime: row.RCYCL_EMSN_BGNG_TM,
          endTime: row.RCYCL_EMSN_END_TM,
          method: row.RCYCL_EMSN_MTHD,
        }
      : undefined;

  const bulkWaste: BulkWasteInfo | undefined =
    row.TMPRY_BULK_WASTE_EMSN_BGNG_TM || row.TMPRY_BULK_WASTE_EMSN_END_TM || row.TMPRY_BULK_WASTE_EMSN_MTHD || row.TMPRY_BULK_WASTE_EMSN_PLC
      ? {
          beginTime: row.TMPRY_BULK_WASTE_EMSN_BGNG_TM,
          endTime: row.TMPRY_BULK_WASTE_EMSN_END_TM,
          method: row.TMPRY_BULK_WASTE_EMSN_MTHD,
          place: row.TMPRY_BULK_WASTE_EMSN_PLC,
        }
      : undefined;

  return {
    city: row.CTPV_NM,
    district: row.SGG_NM,
    targetRegion: row.MNG_ZONE_TRGT_RGN_NM || null,
    emissionPlace: row.EMSN_PLC || null,
    details: {
      emissionPlaceType: row.EMSN_PLC_TYPE,
      managementZone: row.MNG_ZONE_NM,
      livingWaste,
      foodWaste,
      recyclable,
      bulkWaste,
      uncollectedDay: row.UNCLLT_DAY,
      manageDepartment: row.MNG_DEPT_NM,
      managePhone: row.MNG_DEPT_TELNO,
      dataCreatedDate: row.DAT_CRTR_YMD,
      lastModified: row.LAST_MDFCN_PNT,
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
