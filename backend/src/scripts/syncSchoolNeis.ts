#!/usr/bin/env tsx

// NEIS API 기반 학교 동기화 (기존 CSV sync 대체)
// SD_SCHUL_CODE를 sourceId로 사용하여 기존 URL 유지

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { NeisApiClient } from '../services/neisApiClient.js';
import { NEIS } from '../constants/index.js';
import {
  type SyncStats,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
} from '../services/baseSyncService.js';
import { CITY_NAME_MAP } from '../services/csvParser.js';
import { normalizeRegionName } from '../lib/normalizeRegionName.js';

export interface NeisSchoolRow {
  ATPT_OFCDC_SC_CODE: string;   // 시도교육청코드
  ATPT_OFCDC_SC_NM: string;     // 시도교육청명
  SD_SCHUL_CODE: string;        // 표준학교코드
  SCHUL_NM: string;             // 학교명
  ENG_SCHUL_NM: string;         // 영문학교명
  SCHUL_KND_SC_NM: string;      // 학교급구분명 (초등학교/중학교/고등학교/특수학교)
  LCTN_SC_NM: string;           // 소재지명
  JU_ORG_NM: string;            // 관할조직명 (교육지원청)
  FOND_SC_NM: string;           // 설립명 (공립/사립/국립)
  ORG_RDNZC: string;            // 도로명우편번호
  ORG_RDNMA: string;            // 도로명주소
  ORG_RDNDA: string;            // 도로명상세주소
  ORG_TELNO: string;            // 전화번호
  HMPG_ADRES: string;           // 홈페이지주소
  COEDU_SC_NM: string;          // 남녀공학구분명
  ORG_FAXNO: string;            // 팩스번호
  HS_SC_NM: string;             // 고등학교구분명
  INDST_SPECL_CCCCL_EXST_YN: string; // 산업체특별학급존재여부
  HS_GNRL_BUSNS_SC_NM: string;  // 고등학교일반전문구분명
  SPCLY_PURPS_HS_ORD_NM: string; // 특수목적고등학교계열명
  ENE_BFE_SEHF_SC_NM: string;   // 입시전후기구분명
  DGHT_SC_NM: string;           // 주야구분명
  FOND_YMD: string;             // 설립일자
  FOAS_MEMRD: string;           // 개교기념일
  LOAD_DTM: string;             // 수정일자
}

function normalizeCityName(name: string): string {
  return CITY_NAME_MAP[name] || name;
}

function parseAddress(address: string): { city: string; district: string } {
  const parts = address.trim().split(/\s+/);
  return { city: parts[0] || '', district: parts[1] || '' };
}

/**
 * 도로명주소에서 city/district를 도출하고 광주/전남 변종을 전남광주통합특별시로 통합한다
 * (재드리프트 방지). NEIS가 학교 실소스이므로 이 경로도 반드시 정규화를 거쳐야 한다.
 */
export function resolveSchoolRegion(roadAddress: string): { city: string; district: string } {
  const { city, district } = parseAddress(roadAddress);
  return normalizeRegionName(normalizeCityName(city), district);
}

function mapSchoolLevel(kind: string): string {
  if (kind.includes('초등')) return '초등학교';
  if (kind.includes('중학')) return '중학교';
  if (kind.includes('고등')) return '고등학교';
  if (kind.includes('특수')) return '특수학교';
  return kind;
}

function mapHighSchoolType(row: NeisSchoolRow): string | null {
  if (!row.SCHUL_KND_SC_NM?.includes('고등')) return null;
  const hsType = row.HS_SC_NM?.trim();
  const gnrl = row.HS_GNRL_BUSNS_SC_NM?.trim();
  if (hsType === '특성화고') return '특성화고';
  if (hsType === '특수목적고') return '특목고';
  if (hsType === '자율고') return '자율고';
  if (gnrl === '전문') return '특성화고';
  if (gnrl === '일반') return '일반고';
  return hsType || '일반고';
}

/**
 * 표준데이터 20열에 대응하는 필드.
 *
 * NEIS가 단일 소스가 된 뒤에도 이 구분은 남긴다 — 어느 필드가 어느 원본에서 왔는지를
 * 코드에 남겨두면 소유권이 다시 바뀔 때 무엇을 건드려야 하는지 한곳에서 보인다.
 */
export interface NeisIdentityFields {
  name: string;
  address: string;
  roadAddress: string;
  city: string;
  district: string;
  schoolLevel: string;
  foundedDate: string | null;
  foundationType: string | null;
  operationStatus: string;
  sidoEduCode: string | null;
  sidoEduName: string | null;
  localEduName: string | null;
  modifiedDate: string | null;
}

/** 표준데이터에 없는 필드 — NEIS가 소유한다. */
export interface NeisEnrichmentFields {
  neisEduCode: string | null;
  phoneNumber: string | null;
  faxNumber: string | null;
  homepageUrl: string | null;
  coeducationType: string | null;
  highSchoolType: string | null;
  dayNightType: string | null;
}

export interface NeisSchoolData {
  sourceId: string;
  schoolKind: string;
  identity: NeisIdentityFields;
  enrichment: NeisEnrichmentFields;
}

/**
 * NEIS 레코드를 신원/보강으로 분리해 만든다. 학교로 볼 수 없는 레코드는 null.
 */
export function buildNeisSchoolData(row: NeisSchoolRow): NeisSchoolData | null {
  const sourceId = row.SD_SCHUL_CODE?.trim();
  const name = row.SCHUL_NM?.trim();
  if (!sourceId || !name) return null;

  // 검정고시/비학교 데이터 필터링
  const schoolKind = row.SCHUL_KND_SC_NM?.trim() || '';
  if (!schoolKind || name.includes('검정고시')) return null;

  const roadAddress = [row.ORG_RDNMA?.trim(), row.ORG_RDNDA?.trim()]
    .filter(Boolean)
    .join(' ');
  if (!roadAddress) return null;

  const { city, district } = resolveSchoolRegion(roadAddress);
  if (!city || !district) return null;

  return {
    sourceId,
    schoolKind,
    identity: {
      name,
      address: roadAddress,
      roadAddress,
      city,
      district,
      schoolLevel: mapSchoolLevel(schoolKind),
      foundedDate: row.FOND_YMD?.trim() || null,
      foundationType: row.FOND_SC_NM?.trim() || null,
      operationStatus: '운영',
      sidoEduCode: row.ATPT_OFCDC_SC_CODE?.trim() || null,
      sidoEduName: row.ATPT_OFCDC_SC_NM?.trim() || null,
      localEduName: row.JU_ORG_NM?.trim() || null,
      modifiedDate: row.LOAD_DTM?.trim() || null,
    },
    enrichment: {
      neisEduCode: row.ATPT_OFCDC_SC_CODE?.trim() || null,
      phoneNumber: row.ORG_TELNO?.trim() || null,
      faxNumber: row.ORG_FAXNO?.trim() || null,
      homepageUrl: row.HMPG_ADRES?.trim() || null,
      coeducationType: row.COEDU_SC_NM?.trim() || null,
      highSchoolType: mapHighSchoolType(row),
      dayNightType: row.DGHT_SC_NM?.trim() || null,
    },
  };
}

/**
 * 실제로 쓸 데이터. NEIS가 단일 소스이므로 신원·보강을 모두 쓴다.
 *
 * 한때는 표준 sourceId('B'+9자리) 행에 보강 필드만 썼다(#783). mergeSchoolNeis가 학교명만으로
 * 매칭해 남의 학교 neisSchoolCode를 박은 행이 940건 있었고, 신원까지 쓰면 그 링크를 따라
 * 지역·주소·교육청이 다른 학교 값으로 덮였기 때문이다.
 *
 * 그 처방은 표준데이터가 신원의 권위라는 전제에 기댔다. 전제가 깨졌다 — 표준데이터는
 * CSV·tn_ API 모두 referenceDate 2026-03-20 이고 2026 인천 행정구역 개편을 반영하지 않는다
 * (제물포·영종·서해·검단구 0건). 표준데이터로 지역을 쓰면 채택한 신설구가 되돌아간다.
 *
 * 그래서 NEIS 단일 소스로 재구성했다. reconcileSchoolNeisRows가 정확 매핑으로 링크를 다시
 * 맺었으므로(교정 940·신규 1,541) 신원을 따라 써도 남의 학교 값이 오지 않는다. 오히려 쓰지
 * 않으면 이미 오염된 932건의 지역·주소가 영구히 남는다.
 *
 * 오연결 방어는 여기가 아니라 upsert 경로에 있다 — 같은 neisSchoolCode가 여러 행에 걸리면
 * 아무 행도 쓰지 않는다.
 */
export function resolveNeisWriteData(
  built: Pick<NeisSchoolData, 'identity' | 'enrichment'>
): Record<string, unknown> {
  return { ...built.identity, ...built.enrichment, syncedAt: new Date() };
}

export async function syncSchoolsNeis(): Promise<SyncStats> {
  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    throw new Error('NEIS_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  const client = new NeisApiClient(apiKey);
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('school');

  try {
    console.info('=== NEIS 학교기본정보 동기화 시작 ===');

    // 모든 학교 데이터 조회
    const rows = await client.fetchAllPages<NeisSchoolRow>(
      NEIS.ENDPOINTS.SCHOOL_INFO,
      { SCHUL_KND_SC_NM: '' },  // 전체 학교급
      NEIS.PAGE_SIZE
    );

    stats.totalRecords = rows.length;
    console.info(`총 ${rows.length}건 조회 완료`);

    let newCount = 0;
    let updateCount = 0;
    let skipCount = 0;
    // 같은 neisSchoolCode 를 여러 행이 물어 어느 행을 갱신할지 결정할 수 없었던 건수.
    let ambiguousLinkCount = 0;
    const batchSize = 50;
    const totalBatches = Math.ceil(rows.length / batchSize);

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      for (const row of batch) {
        const built = buildNeisSchoolData(row);
        if (!built) {
          skipCount++;
          continue;
        }

        const { sourceId } = built;

        // neisSchoolCode 에는 unique 제약이 없다. 여러 행이 같은 코드를 물면 어느 행이
        // 갱신될지 실행마다 달라지므로(기존 findFirst) 모호한 링크는 건드리지 않는다.
        const linked = await prisma.school.findMany({
          where: { neisSchoolCode: sourceId },
          select: { id: true, sourceId: true },
          orderBy: { id: 'asc' },
          take: 2,
        });

        if (linked.length > 1) {
          ambiguousLinkCount++;
          skipCount++;
          continue;
        }

        const target = linked[0]
          ?? (await prisma.school.findUnique({
            where: { sourceId },
            select: { id: true, sourceId: true },
          }));

        if (target) {
          const data = resolveNeisWriteData(built);
          // 링크 없이 sourceId 로 찾은 행은 NEIS 전용 행이므로 자기 코드로 링크를 채운다.
          if (!linked[0]) {
            data.neisSchoolCode = sourceId;
          }
          await prisma.school.update({ where: { id: target.id }, data });
          updateCount++;
          continue;
        }

        // NEIS 가 단일 소스이므로 학교급을 가리지 않고 만든다. 한때 초·중·고를 막은 것은
        // 표준 sync 가 그 학교급을 소유했기 때문이고, 그 sync 는 더 이상 신원을 쓰지 않는다.
        await prisma.school.create({
          data: {
            id: `school-${sourceId}`,
            sourceId,
            neisSchoolCode: sourceId,
            ...built.identity,
            ...built.enrichment,
            syncedAt: new Date(),
          },
        });
        newCount++;
      }

      console.info(
        `Batch ${batchNum}/${totalBatches} | ` +
        `처리: ${Math.min(i + batchSize, rows.length)}/${rows.length} | ` +
        `신규: ${newCount}, 업데이트: ${updateCount}, 스킵: ${skipCount}`
      );
    }

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
    stats.skippedRecords = skipCount;

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: stats.newRecords,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`\n=== 동기화 완료 ===`);
    console.info(`총: ${stats.totalRecords}, 신규: ${newCount}, 업데이트: ${updateCount}, 스킵: ${skipCount}`);
    console.info(
      `링크 모호로 건너뜀: ${ambiguousLinkCount}건`
    );
    return stats;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncHistory(syncHistory.id, {
      status: 'failed',
      errorMessage,
    });
    console.error('학교 동기화 실패:', errorMessage);
    throw error;
  }
}

// CLI 직접 실행
async function main(): Promise<void> {
  try {
    await syncSchoolsNeis();
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
