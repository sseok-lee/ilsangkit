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

interface NeisSchoolRow {
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
    const batchSize = 50;
    const totalBatches = Math.ceil(rows.length / batchSize);

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const batchNum = Math.floor(i / batchSize) + 1;

      for (const row of batch) {
        const sourceId = row.SD_SCHUL_CODE?.trim();
        const name = row.SCHUL_NM?.trim();

        if (!sourceId || !name) {
          skipCount++;
          continue;
        }

        const roadAddress = [row.ORG_RDNMA?.trim(), row.ORG_RDNDA?.trim()]
          .filter(Boolean)
          .join(' ');

        if (!roadAddress) {
          skipCount++;
          continue;
        }

        const { city, district } = parseAddress(roadAddress);
        const normalizedCity = normalizeCityName(city);

        if (!normalizedCity || !district) {
          skipCount++;
          continue;
        }

        const schoolData = {
          name,
          address: roadAddress,
          roadAddress,
          city: normalizedCity,
          district,
          schoolLevel: mapSchoolLevel(row.SCHUL_KND_SC_NM?.trim() || ''),
          foundedDate: row.FOND_YMD?.trim() || null,
          foundationType: row.FOND_SC_NM?.trim() || null,
          operationStatus: '운영',
          sidoEduCode: row.ATPT_OFCDC_SC_CODE?.trim() || null,
          sidoEduName: row.ATPT_OFCDC_SC_NM?.trim() || null,
          localEduName: row.JU_ORG_NM?.trim() || null,
          modifiedDate: row.LOAD_DTM?.trim() || null,
          // NEIS 추가 필드
          neisEduCode: row.ATPT_OFCDC_SC_CODE?.trim() || null,
          phoneNumber: row.ORG_TELNO?.trim() || null,
          faxNumber: row.ORG_FAXNO?.trim() || null,
          homepageUrl: row.HMPG_ADRES?.trim() || null,
          coeducationType: row.COEDU_SC_NM?.trim() || null,
          highSchoolType: mapHighSchoolType(row),
          dayNightType: row.DGHT_SC_NM?.trim() || null,
          syncedAt: new Date(),
        };

        // neisSchoolCode로 기존 학교 매칭 (CSV 병합된 학교 포함)
        const existing = await prisma.school.findFirst({
          where: { neisSchoolCode: sourceId },
          select: { id: true, sourceId: true },
        });

        if (existing) {
          await prisma.school.update({
            where: { id: existing.id },
            data: schoolData,
          });
          updateCount++;
        } else {
          // sourceId로도 한번 더 확인 (NEIS 전용 학교)
          const bySourceId = await prisma.school.findUnique({
            where: { sourceId },
            select: { id: true },
          });

          if (bySourceId) {
            await prisma.school.update({
              where: { sourceId },
              data: { ...schoolData, neisSchoolCode: sourceId },
            });
            updateCount++;
          } else {
            await prisma.school.create({
              data: {
                id: `school-${sourceId}`,
                sourceId,
                neisSchoolCode: sourceId,
                ...schoolData,
              },
            });
            newCount++;
          }
        }
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

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
