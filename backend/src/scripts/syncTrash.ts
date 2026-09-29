// @TASK T2.2 - 쓰레기 배출 일정 데이터 동기화 스크립트
// @SPEC docs/planning/02-trd.md#데이터-동기화
// NOTE: 쓰레기 배출 데이터는 좌표가 없어 지도 마커 표시 불가 → WasteSchedule 테이블에 저장

import { PublicApiClient } from '../services/publicApiClient.js';
import prisma from '../lib/prisma.js';
import type { Prisma } from '@prisma/client';
import crypto from 'crypto';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { SYNC } from '../constants/index.js';
import { normalizeRegionName } from '../lib/normalizeRegionName.js';
import {
  assertWasteAreaDiscoveryWriteEnabled,
  prepareWasteGeneration,
} from '../services/wastePublicationService.js';
import type { ReferenceBundle } from '../types/wasteArea.js';
import { loadValidatedWasteReferences, type WasteReferenceInput, type WasteReferenceMetadata } from '../services/wasteReferenceLoader.js';
import { resolveWasteSyncCliOptions } from './wasteSyncOptions.js';

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
  govCode: string | null;
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
  /** @deprecated Use npm run waste:publish instead. */
  approvalReportHash?: string;
  /** @deprecated Use npm run waste:publish instead. */
  expectedBaseGenerationId?: string | null;
  references?: ReferenceBundle;
  referenceMetadata?: WasteReferenceMetadata;
  referenceInput?: WasteReferenceInput;
  reportOut?: string;
}

/**
 * 동기화 결과
 */
interface SyncResult {
  status?: 'dry-run' | 'prepared';
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  generationId?: string | null;
  reportHash?: string;
  canPublish?: boolean;
  reviewReport?: unknown;
}

interface PageEvidence<T> {
  pageNo: number;
  numOfRows: number;
  totalCount: number;
  itemCount: number;
  fingerprint: string;
  items: T[];
}

interface CompleteTrashPages {
  items: TrashApiResponse[];
  pages: PageEvidence<TrashApiResponse>[];
  totalCount: number;
}

type ErrnoException = Error & { code?: string };

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

  // 광주/전남 변종을 전남광주통합특별시로 통합 (재드리프트 방지, Task A2 — WasteSchedule).
  // trash는 시도 풀네임을 그대로 저장하는 컨벤션이라 normalizeCityName은 적용하지 않는다.
  // normalizeRegionName은 광주/전남 변종만 통합하고 그 외(서울특별시 등)는 passthrough.
  // sourceId는 원본 CTPV_NM/SGG_NM 기반 해시라 정규화하지 않아 식별자 안정성을 유지한다.
  const { city, district } = normalizeRegionName(row.CTPV_NM, row.SGG_NM);

  return {
    city,
    district,
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
    govCode: row.OPN_ATMY_GRP_CD?.trim() || null,
  };
}

export async function fetchCompleteTrashPages(
  serviceKey: string,
  pageSize: number = SYNC.PAGE_SIZE
): Promise<CompleteTrashPages> {
  const client = new PublicApiClient(
    'https://apis.data.go.kr/1741000/household_waste_info/info',
    serviceKey,
    { maxRetries: SYNC.MAX_RETRIES, retryDelay: SYNC.RETRY_BASE_DELAY_MS }
  );
  const pages: PageEvidence<TrashApiResponse>[] = [];
  const seenPageNumbers = new Set<number>();
  let expectedTotalCount: number | null = null;
  let totalPages = 1;

  for (let pageNo = 1; pageNo <= totalPages; pageNo += 1) {
    const response = await client.fetchData<TrashApiResponse>({
      pageNo,
      numOfRows: pageSize,
    });
    const body = response.response.body;
    const items = normalizeApiItems(body.items);

    if (body.pageNo !== pageNo) {
      throw new Error(`Trash page index mismatch: expected ${pageNo}, got ${body.pageNo}`);
    }
    if (seenPageNumbers.has(body.pageNo)) {
      throw new Error(`Trash duplicate page index: ${body.pageNo}`);
    }
    seenPageNumbers.add(body.pageNo);
    if (body.numOfRows !== pageSize && pageNo !== Math.ceil(body.totalCount / pageSize || 1)) {
      throw new Error(`Trash page size mismatch on page ${pageNo}`);
    }
    if (expectedTotalCount === null) {
      expectedTotalCount = body.totalCount;
      totalPages = Math.max(1, Math.ceil(body.totalCount / pageSize));
    } else if (expectedTotalCount !== body.totalCount) {
      throw new Error('Trash totalCount changed across pages');
    }

    pages.push({
      pageNo: body.pageNo,
      numOfRows: body.numOfRows,
      totalCount: body.totalCount,
      itemCount: items.length,
      fingerprint: createHash('sha256').update(JSON.stringify(response)).digest('hex'),
      items,
    });
  }

  const items = pages.flatMap((page) => page.items);
  const totalCount = expectedTotalCount ?? 0;
  if (items.length !== totalCount) {
    throw new Error(`Trash incomplete page collection: expected ${totalCount}, got ${items.length}`);
  }

  return { items, pages, totalCount };
}

/**
 * 쓰레기 배출 일정 데이터 동기화 실행
 * @param options - 동기화 옵션
 * @returns 동기화 결과
 */
export async function syncTrashData(options: SyncOptions): Promise<SyncResult> {
  const {
    serviceKey,
    dryRun = false,
    pageSize = SYNC.PAGE_SIZE,
  } = options;

  rejectLegacyPublicationOptions(options);

  const result: SyncResult = {
    status: dryRun ? 'dry-run' : 'prepared',
    totalRecords: 0,
    newRecords: 0,
    updatedRecords: 0,
    skippedRecords: 0,
  };

  if (!dryRun) {
    assertWasteAreaDiscoveryWriteEnabled();
  }

  try {
    const loadedReferences = await resolveWasteReferences(options, dryRun);
    if (options.reportOut) {
      await verifyReviewReportDestination(options.reportOut);
    }

    // 모든 페이지 데이터 조회 + 페이지 증거 검증
    const collection = await fetchCompleteTrashPages(serviceKey, pageSize);
    const allItems = collection.items;

    console.info(`[syncTrashData] Fetched ${allItems.length} items from API`);

    // 데이터 변환
    console.info('Transforming data...');
    const transformedItems: TransformedWasteSchedule[] = [];
    for (const item of allItems) {
      const transformed = transformTrashData(item);
      if (transformed) {
        transformedItems.push(transformed);
      } else {
        throw new Error('Trash parse failed for a source row');
      }
    }
    result.totalRecords = transformedItems.length;
    console.info(`Transformed ${transformedItems.length} items, skipped ${result.skippedRecords}`);

    const preparedRows = dryRun
      ? transformedItems.map((item, index) => ({ ...item, scheduleId: -(index + 1), rawPayload: allItems[index] }))
      : await reserveRawWasteSchedules(transformedItems, allItems);
    const baseGenerationId = dryRun ? null : await readActiveWasteGenerationId();
    const prepared = await prepareWasteGeneration({
      baseGenerationId,
      references: loadedReferences.references,
      rows: preparedRows,
      provenance: 'raw',
      sourceComplete: true,
      dryRun,
      evidence: {
        collection: buildCollectionEvidence(collection, transformedItems.length),
        reference: loadedReferences.metadata,
      },
    });
    result.generationId = prepared.generationId;
    result.reportHash = prepared.reportHash;
    result.canPublish = prepared.canPublish;
    result.reviewReport = prepared.reviewReport;
    if (options.reportOut) {
      await writeReviewReport(options.reportOut, prepared.reviewReport);
    }
    if (dryRun) {
      result.newRecords = transformedItems.length;
      return result;
    }

    const loggedResult: SyncResult = { ...result };
    delete loggedResult.reviewReport;
    console.info(`[syncTrashData] Sync completed:`, loggedResult);

    return result;
  } catch (error) {
    if (!dryRun) {
      await recordFailedWasteSyncAttempt(error);
    }

    throw error;
  }
}

function rejectLegacyPublicationOptions(options: SyncOptions): void {
  if (options.approvalReportHash !== undefined || options.expectedBaseGenerationId !== undefined) {
    throw new Error('Trash sync now prepares candidates only. Publish with npm run waste:publish after reviewing the report.');
  }
}

async function readActiveWasteGenerationId(): Promise<string | null> {
  const publication = await prisma.wastePublication.findUnique({
    where: { id: 1 },
    select: { activeGenerationId: true },
  });
  return publication?.activeGenerationId ?? null;
}

export async function reserveRawWasteSchedules(
  items: TransformedWasteSchedule[],
  rawRows: TrashApiResponse[]
): Promise<Array<TransformedWasteSchedule & { scheduleId: number; rawPayload: TrashApiResponse }>> {
  const reserved: Array<TransformedWasteSchedule & { scheduleId: number; rawPayload: TrashApiResponse }> = [];
  const BATCH_SIZE = SYNC.BATCH_SIZE;
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const rawBatch = rawRows.slice(i, i + BATCH_SIZE);
    const batchReserved = await prisma.$transaction(async (tx) => {
      const rows: Array<TransformedWasteSchedule & { scheduleId: number; rawPayload: TrashApiResponse }> = [];
      for (let j = 0; j < batch.length; j += 1) {
        const transformed = batch[j];
        const existing = await tx.wasteSchedule.findUnique({
          where: {
            city_district_sourceId: {
              city: transformed.city,
              district: transformed.district,
              sourceId: transformed.sourceId,
            },
          },
          select: { id: true },
        });
        if (existing) {
          rows.push({ ...transformed, scheduleId: existing.id, rawPayload: rawBatch[j] });
          continue;
        }
        const schedule = await tx.wasteSchedule.create({
          data: {
            ...transformed,
            details: transformed.details as unknown as Prisma.InputJsonValue,
            syncedAt: new Date(),
          },
          select: { id: true },
        });
        await tx.wasteStagedSchedule.create({
          data: { scheduleId: schedule.id },
        });
        rows.push({ ...transformed, scheduleId: schedule.id, rawPayload: rawBatch[j] });
      }
      return rows;
    });
    reserved.push(...batchReserved);
  }
  return reserved;
}

async function recordFailedWasteSyncAttempt(error: unknown): Promise<void> {
  await prisma.syncHistory.create({
    data: {
      category: 'waste_schedule',
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : String(error),
      completedAt: new Date(),
    },
  });
}

async function resolveWasteReferences(
  options: Pick<SyncOptions, 'references' | 'referenceMetadata' | 'referenceInput'>,
  dryRun: boolean
): Promise<{ references: ReferenceBundle; metadata?: WasteReferenceMetadata }> {
  if (options.references) {
    return { references: options.references, metadata: options.referenceMetadata };
  }
  if (!options.referenceInput) {
    if (dryRun) {
      return { references: { version: 'dry-run-empty-reference', areas: [], relations: [], sourceAreaKinds: {} } };
    }
    throw new Error('Explicit validated reference input is required before waste collection writes');
  }
  return loadValidatedWasteReferences(options.referenceInput);
}

function buildCollectionEvidence(collection: CompleteTrashPages, transformedCount: number) {
  return {
    pageCount: collection.pages.length,
    totalCount: collection.totalCount,
    pageFingerprints: collection.pages.map((page) => page.fingerprint),
    parseFailureCount: collection.totalCount - transformedCount,
    rawSourceRowCount: collection.items.length,
  };
}


export function redactSyncResultForLog(result: SyncResult): Omit<SyncResult, 'reviewReport'> {
  const loggedResult: SyncResult = { ...result };
  delete loggedResult.reviewReport;
  return loggedResult;
}

async function writeReviewReport(reportOut: string, report: unknown): Promise<void> {
  const resolved = path.resolve(reportOut);
  const dir = path.dirname(resolved);
  await mkdir(dir, { recursive: true });
  const tempPath = path.join(dir, `.${path.basename(resolved)}.${process.pid}.${randomUUID()}.tmp`);
  await writeFile(tempPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await rename(tempPath, resolved);
}

async function verifyReviewReportDestination(reportOut: string): Promise<void> {
  const resolved = path.resolve(reportOut);
  const dir = path.dirname(resolved);
  try {
    const existing = await stat(resolved).catch((error: ErrnoException) => {
      if (error.code === 'ENOENT') return null;
      throw error;
    });
    if (existing?.isDirectory()) {
      throw new Error('path is a directory');
    }
    await mkdir(dir, { recursive: true });
    const tempPath = path.join(dir, `.${path.basename(resolved)}.preflight.${process.pid}.${randomUUID()}.tmp`);
    await writeFile(tempPath, '', 'utf8');
    await rm(tempPath, { force: true });
  } catch (error) {
    throw new Error(`Waste report destination is not writable: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function normalizeApiItems<T>(items: T[] | { item: T | T[] } | null | undefined): T[] {
  if (!items) return [];
  if (Array.isArray(items)) return items;
  if (typeof items === 'object' && 'item' in items) {
    return Array.isArray(items.item) ? items.item : [items.item];
  }
  return [];
}

// CLI 실행 지원
if (import.meta.url === `file://${process.argv[1]}`) {
  const legacyPublishArg = process.argv
    .slice(2)
    .find((arg) => arg.startsWith('--approval-report-hash=') || arg.startsWith('--expected-base='));
  if (legacyPublishArg) {
    console.error('[syncTrash] Approval flags moved to npm run waste:publish. This command only prepares a generation.');
    process.exit(1);
  }
  const cliOptions = resolveWasteSyncCliOptions(process.argv.slice(2), process.env);

  console.info(`[syncTrash] Starting sync... (dryRun: ${cliOptions.dryRun})`);

  syncTrashData({
    ...cliOptions,
  })
    .then((result) => {
      console.info('[syncTrash] Sync completed:', redactSyncResultForLog(result));
      process.exit(0);
    })
    .catch((error) => {
      console.error('[syncTrash] Sync failed:', error);
      process.exit(1);
    });
}
