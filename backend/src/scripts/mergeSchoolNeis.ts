#!/usr/bin/env tsx

// CSV 학교에 NEIS 데이터를 병합하고 중복 NEIS 레코드를 삭제하는 일회성 스크립트
// 1. 이름 매칭으로 CSV 학교에 NEIS 필드(전화번호, 홈페이지 등) + neisSchoolCode 설정
// 2. 매칭된 NEIS 중복 레코드의 enrollment/department를 CSV 레코드로 이전
// 3. NEIS 중복 레코드 삭제

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';

async function main(): Promise<void> {
  console.info('=== CSV ↔ NEIS 학교 병합 시작 ===');

  // CSV 학교: lat이 있는 것 (원본 CSV에서 온 학교)
  // NEIS 학교: phoneNumber가 있고 lat이 없는 것
  const csvSchools = await prisma.$queryRaw<Array<{ id: string; name: string; sourceId: string }>>`
    SELECT id, name, sourceId FROM School WHERE lat IS NOT NULL
  `;
  console.info(`CSV 학교: ${csvSchools.length}개`);

  const neisSchools = await prisma.$queryRaw<Array<{
    id: string; name: string; sourceId: string;
    neisEduCode: string | null; phoneNumber: string | null; faxNumber: string | null;
    homepageUrl: string | null; coeducationType: string | null;
    highSchoolType: string | null; dayNightType: string | null;
    schoolLevel: string | null; foundationType: string | null;
    foundedDate: string | null; sidoEduName: string | null; localEduName: string | null;
  }>>`
    SELECT id, name, sourceId, neisEduCode, phoneNumber, faxNumber, homepageUrl,
           coeducationType, highSchoolType, dayNightType, schoolLevel, foundationType,
           foundedDate, sidoEduName, localEduName
    FROM School WHERE phoneNumber IS NOT NULL AND lat IS NULL
  `;
  console.info(`NEIS 학교: ${neisSchools.length}개`);

  // NEIS 학교를 이름으로 인덱싱
  const neisByName = new Map<string, typeof neisSchools[0]>();
  for (const n of neisSchools) {
    neisByName.set(n.name, n);
  }

  let mergedCount = 0;
  let skippedCount = 0;
  let enrollmentMoved = 0;
  let departmentMoved = 0;
  const processedNeisIds = new Set<string>();

  for (const csv of csvSchools) {
    const neis = neisByName.get(csv.name);
    if (!neis || processedNeisIds.has(neis.id)) {
      skippedCount++;
      continue;
    }

    // 1. CSV 학교에 NEIS 데이터 병합
    await prisma.school.update({
      where: { id: csv.id },
      data: {
        neisSchoolCode: neis.sourceId,
        neisEduCode: neis.neisEduCode,
        phoneNumber: neis.phoneNumber,
        faxNumber: neis.faxNumber,
        homepageUrl: neis.homepageUrl,
        coeducationType: neis.coeducationType,
        highSchoolType: neis.highSchoolType,
        dayNightType: neis.dayNightType,
        // CSV에 없는 필드만 NEIS에서 가져오기
        ...(csv.name ? {} : { schoolLevel: neis.schoolLevel }),
      },
    });

    // 2. NEIS 레코드의 enrollment를 CSV 레코드로 이전
    const enrollments = await prisma.schoolEnrollment.findMany({
      where: { schoolId: neis.id },
    });
    for (const e of enrollments) {
      await prisma.schoolEnrollment.upsert({
        where: {
          schoolId_year_grade: {
            schoolId: csv.id,
            year: e.year,
            grade: e.grade,
          },
        },
        update: { classCount: e.classCount },
        create: {
          schoolId: csv.id,
          year: e.year,
          grade: e.grade,
          classCount: e.classCount,
        },
      });
      enrollmentMoved++;
    }

    // 3. NEIS 레코드의 department를 CSV 레코드로 이전
    const departments = await prisma.schoolDepartment.findMany({
      where: { schoolId: neis.id },
    });
    for (const d of departments) {
      await prisma.schoolDepartment.upsert({
        where: {
          schoolId_departmentName: {
            schoolId: csv.id,
            departmentName: d.departmentName,
          },
        },
        update: {},
        create: {
          schoolId: csv.id,
          departmentName: d.departmentName,
        },
      });
      departmentMoved++;
    }

    // 4. NEIS 중복 레코드의 관계 데이터 삭제 후 본 레코드 삭제
    await prisma.schoolEnrollment.deleteMany({ where: { schoolId: neis.id } });
    await prisma.schoolDepartment.deleteMany({ where: { schoolId: neis.id } });
    await prisma.school.deleteMany({ where: { id: neis.id } });

    processedNeisIds.add(neis.id);
    mergedCount++;

    if (mergedCount % 500 === 0) {
      console.info(`진행: ${mergedCount}/${csvSchools.length} 병합, ${skippedCount} 스킵`);
    }
  }

  // NEIS에만 있는 학교(신규)에도 neisSchoolCode 설정
  const neisOnly = await prisma.school.findMany({
    where: { neisSchoolCode: null, phoneNumber: { not: null } },
    select: { id: true, sourceId: true },
  });
  for (const s of neisOnly) {
    await prisma.school.update({
      where: { id: s.id },
      data: { neisSchoolCode: s.sourceId },
    });
  }
  console.info(`NEIS 전용 학교 ${neisOnly.length}개에 neisSchoolCode 설정`);

  console.info(`\n=== 병합 완료 ===`);
  console.info(`병합: ${mergedCount}, 스킵(미매칭): ${skippedCount}`);
  console.info(`이전된 enrollment: ${enrollmentMoved}, department: ${departmentMoved}`);

  // 최종 통계
  const total = await prisma.school.count();
  const withCoords = await prisma.$queryRaw<[{ cnt: bigint }]>`SELECT COUNT(*) as cnt FROM School WHERE lat IS NOT NULL`;
  const withPhone = await prisma.school.count({ where: { phoneNumber: { not: null } } });
  console.info(`\n최종: 총 ${total}개, 좌표: ${withCoords[0].cnt}개, 전화번호: ${withPhone}개`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
