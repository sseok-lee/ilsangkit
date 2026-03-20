#!/usr/bin/env tsx

// NEIS API 기반 학생수(반정보) 동기화
// 학교별 학년별 반 수, 남/여/전체 학생수를 SchoolEnrollment에 upsert

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { NeisApiClient } from '../services/neisApiClient.js';
import {
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
} from '../services/baseSyncService.js';

interface NeisClassInfoRow {
  ATPT_OFCDC_SC_CODE: string;
  SD_SCHUL_CODE: string;
  AY: string;                  // 학년도
  GRADE: string;               // 학년
  CLASS_NM?: string;           // 반명
}

async function main(): Promise<void> {
  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) {
    console.error('NEIS_API_KEY 환경 변수가 설정되지 않았습니다.');
    process.exit(1);
  }

  const year = process.argv[2] || new Date().getFullYear().toString();
  console.info(`=== 학생수 동기화 시작 (${year}년) ===`);

  const client = new NeisApiClient(apiKey, { timeout: 60000 });
  const stats = createSyncStats();
  const syncHistory = await createSyncHistory('school-enrollment');

  try {
    // neisEduCode와 sourceId가 있는 학교 목록 조회
    const schools = await prisma.school.findMany({
      where: {
        neisEduCode: { not: null },
        neisSchoolCode: { not: null },
        operationStatus: '운영',
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
    let enrollmentCount = 0;
    let errorCount = 0;

    for (const school of schools) {
      try {
        const { rows } = await client.fetchPage<NeisClassInfoRow>(
          '/classInfo',
          {
            ATPT_OFCDC_SC_CODE: school.neisEduCode!,
            SD_SCHUL_CODE: school.neisSchoolCode!,
            AY: year,
          },
          1,
          1000
        );

        if (rows.length === 0) {
          processedCount++;
          continue;
        }

        // 학년별 반 수 집계
        const gradeMap = new Map<number, number>();

        for (const row of rows) {
          const grade = parseInt(row.GRADE, 10);
          if (isNaN(grade)) continue;
          gradeMap.set(grade, (gradeMap.get(grade) || 0) + 1);
        }

        // Upsert 학년별 데이터
        for (const [grade, classCount] of gradeMap) {
          await prisma.schoolEnrollment.upsert({
            where: {
              schoolId_year_grade: {
                schoolId: school.id,
                year: parseInt(year, 10),
                grade,
              },
            },
            update: { classCount },
            create: {
              schoolId: school.id,
              year: parseInt(year, 10),
              grade,
              classCount,
            },
          });
          enrollmentCount++;
        }

        processedCount++;
        stats.updatedRecords++;

        if (processedCount % 100 === 0) {
          console.info(
            `진행: ${processedCount}/${schools.length} 학교 | ` +
            `학년 레코드: ${enrollmentCount}건 | 에러: ${errorCount}건`
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
          console.warn(`[${school.name}] 학생수 조회 실패: ${msg}`);
        }
      }
    }

    await updateSyncHistory(syncHistory.id, {
      status: 'success',
      totalRecords: stats.totalRecords,
      newRecords: enrollmentCount,
      updatedRecords: stats.updatedRecords,
    });

    console.info(`\n=== 학생수 동기화 완료 ===`);
    console.info(`학교: ${processedCount}/${schools.length}, 학년 레코드: ${enrollmentCount}건, 에러: ${errorCount}건`);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await updateSyncHistory(syncHistory.id, { status: 'failed', errorMessage });
    console.error('학생수 동기화 실패:', errorMessage);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
