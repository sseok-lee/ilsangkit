#!/usr/bin/env tsx

// NEIS API 기반 학과정보 동기화 (특성화고/산업고 전용)
// SchoolDepartment 테이블에 학과명 upsert

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { NeisApiClient } from '../services/neisApiClient.js';
import {
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
} from '../services/baseSyncService.js';

interface NeisDepartmentRow {
  ATPT_OFCDC_SC_CODE: string;
  SD_SCHUL_CODE: string;
  SCHUL_NM: string;
  ORD_SC_NM: string;            // 계열명 (공업계/상업계/특성화 등)
  DGHT_CRSE_SC_NM?: string;     // 주야구분
}

export async function syncSchoolDepartments(): Promise<{
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
}> {
  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    throw new Error('NEIS_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  console.info('=== 계열정보 동기화 시작 (고등학교) ===');

  const client = new NeisApiClient(apiKey, { timeout: 60000 });
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('school-department');

  try {
    // 특성화고/산업고 학교만 대상
    const schools = await prisma.school.findMany({
      where: {
        neisEduCode: { not: null },
        neisSchoolCode: { not: null },
        operationStatus: '운영',
        schoolLevel: '고등학교',
      },
      select: {
        id: true,
        neisSchoolCode: true,
        neisEduCode: true,
        name: true,
      },
    });

    console.info(`대상 학교: ${schools.length}개`);
    stats.totalRecords = schools.length;

    let processedCount = 0;
    let deptCount = 0;
    let errorCount = 0;

    for (const school of schools) {
      try {
        const { rows } = await client.fetchPage<NeisDepartmentRow>(
          '/schulAflcoinfo',
          {
            ATPT_OFCDC_SC_CODE: school.neisEduCode!,
            SD_SCHUL_CODE: school.neisSchoolCode!,
          },
          1,
          100
        );

        if (rows.length === 0) {
          processedCount++;
          continue;
        }

        // 중복 계열명 제거
        const uniqueDepts = new Set<string>();
        for (const row of rows) {
          const deptName = row.ORD_SC_NM?.trim();
          if (deptName && deptName !== '일반계') uniqueDepts.add(deptName);
        }

        for (const departmentName of uniqueDepts) {
          await prisma.schoolDepartment.upsert({
            where: {
              schoolId_departmentName: {
                schoolId: school.id,
                departmentName,
              },
            },
            update: {},
            create: {
              schoolId: school.id,
              departmentName,
            },
          });
          deptCount++;
        }

        processedCount++;
        stats.updatedRecords++;

        if (processedCount % 50 === 0) {
          console.info(
            `진행: ${processedCount}/${schools.length} 학교 | ` +
            `학과: ${deptCount}건 | 에러: ${errorCount}건`
          );
        }

        // Rate limit 방지
        if (processedCount % 50 === 0) {
          await new Promise(r => setTimeout(r, 200));
        }
      } catch (error) {
        errorCount++;
        const msg = error instanceof Error ? error.message : 'Unknown';
        if (errorCount <= 5) {
          console.warn(`[${school.name}] 학과정보 조회 실패: ${msg}`);
        }
      }
    }

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: deptCount,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`\n=== 학과정보 동기화 완료 ===`);
    console.info(`학교: ${processedCount}/${schools.length}, 학과: ${deptCount}건, 에러: ${errorCount}건`);

    return {
      totalRecords: stats.totalRecords,
      newRecords: deptCount,
      updatedRecords: stats.updatedRecords,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncHistory(syncHistory.id, { status: 'failed', errorMessage });
    console.error('학과정보 동기화 실패:', errorMessage);
    throw error;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncSchoolDepartments()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
