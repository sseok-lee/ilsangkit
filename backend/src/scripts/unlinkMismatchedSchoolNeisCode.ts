#!/usr/bin/env tsx
/**
 * unlinkMismatchedSchoolNeisCode — 표준데이터 행에 잘못 박힌 neisSchoolCode 를 끊는다.
 *
 * 배경: mergeSchoolNeis 가 NEIS 를 학교명만으로 매칭했다(`Map.set(n.name, n)` — 동명 그룹에서
 * 마지막 하나가 모든 동명 학교에 붙는다). 그 결과 표준데이터 행이 동명 타 학교의 코드를 물고,
 * syncSchoolNeis 가 그 링크를 따라 지역·주소·전화를 계속 덮어썼다. PR #783 이 신원 쓰기는
 * 막았지만 링크가 남아 있어 보강 필드(전화·팩스·홈페이지)는 여전히 남의 학교 값을 받는다.
 *
 * 판정: 표준데이터 정본(도로명주소 → resolveSchoolRegion)과 DB city/district 가 어긋나면
 * 링크가 틀렸다. 단 2026 인천 행정구역 개편은 DB 가 최신이고 원본(기준일 2025-09-22)이
 * 옛 구명을 담고 있으므로 제외한다.
 *
 * 실측(2026-09-08): 표준데이터 행 10,956 중 지역 불일치 1,070 → 개편 141 제외 → 대상 929.
 * 학교명 불일치는 0건이므로 행의 정체 자체는 정확하다.
 *
 * 안전 설계:
 *  - dry-run 기본. --apply 없이는 DB 를 바꾸지 않는다.
 *  - 대상 행을 파일로 덤프한 뒤에만 쓴다(복구 근거).
 *  - PK id 목록 기반 청크 UPDATE. 조건 풀스캔 UPDATE 를 하지 않는다.
 *  - 정본 지역을 못 구하면 건드리지 않는다(fail-safe).
 *  - neisSchoolCode 만 NULL 로 한다. 행 삭제도, 다른 컬럼 변경도 하지 않는다.
 *
 * 사용법(로컬):
 *   npx tsx src/scripts/unlinkMismatchedSchoolNeisCode.ts                    # dry-run (기본)
 *   npx tsx src/scripts/unlinkMismatchedSchoolNeisCode.ts --apply
 *   npx tsx src/scripts/unlinkMismatchedSchoolNeisCode.ts --csv=/path/school.csv
 *
 * 운영은 src 가 배포되지 않으므로 dist 로 실행한다(adoptRegionReform 과 동일):
 *   node dist/scripts/unlinkMismatchedSchoolNeisCode.js
 *   node dist/scripts/unlinkMismatchedSchoolNeisCode.js --apply
 */

import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma.js';
import { parseSchoolCSV } from '../services/csvParser.js';
import { resolveSchoolRegion, isStandardDataSourceId } from './syncSchoolNeis.js';

export interface RegionComparison {
  dbCity: string;
  dbDistrict: string;
  authoritativeCity: string;
  authoritativeDistrict: string;
}

/**
 * 2026 인천 행정구역 개편 전이(옛 구 → 신설구). 실측으로 확인한 5개 전이만 담는다.
 * DB 가 신설구, 표준데이터 원본이 옛 구명을 갖는 방향만 개편으로 인정한다.
 */
const ADMIN_REORG_TRANSITIONS: ReadonlySet<string> = new Set([
  '인천|서구|서해구',
  '인천|서구|검단구',
  '인천|중구|영종구',
  '인천|중구|제물포구',
  '인천|동구|제물포구',
]);

/**
 * DB 와 정본의 지역 차이가 행정구역 개편으로 설명되는지.
 */
export function isAdminReorgTransition(c: RegionComparison): boolean {
  if (c.dbCity !== c.authoritativeCity) return false;
  if (c.dbDistrict === c.authoritativeDistrict) return false;
  return ADMIN_REORG_TRANSITIONS.has(`${c.dbCity}|${c.authoritativeDistrict}|${c.dbDistrict}`);
}

/**
 * 이 행의 neisSchoolCode 를 끊어야 하는지.
 */
export function shouldUnlinkNeisCode(
  args: { neisSchoolCode: string | null } & RegionComparison
): boolean {
  if (!args.neisSchoolCode) return false;
  // 정본 지역을 못 구했으면 판단 근거가 없다.
  if (!args.authoritativeCity || !args.authoritativeDistrict) return false;
  if (args.dbCity === args.authoritativeCity && args.dbDistrict === args.authoritativeDistrict) {
    return false;
  }
  return !isAdminReorgTransition(args);
}

// ============================================================================
// 이하 CLI 실행부
// ============================================================================

const DEFAULT_CSV = path.resolve(import.meta.dirname, '../../prisma/data/school.csv');
const CHUNK_SIZE = 200;

interface CsvRow {
  name: string;
  roadAddress: string;
}

/**
 * 표준데이터 CSV 를 읽어 학교ID → 정본으로 만든다.
 * 인코딩·파싱은 기존 parseSchoolCSV 를 그대로 쓴다(EUC-KR 처리 포함).
 */
async function readStandardCsv(csvPath: string): Promise<Map<string, CsvRow>> {
  const rows = await parseSchoolCSV(csvPath);
  const map = new Map<string, CsvRow>();
  for (const row of rows) {
    const id = row['학교ID']?.trim();
    if (!id) continue;
    map.set(id, {
      name: row['학교명']?.trim() ?? '',
      roadAddress: row['소재지도로명주소']?.trim() ?? '',
    });
  }
  return map;
}

interface Candidate {
  id: string;
  sourceId: string;
  name: string;
  neisSchoolCode: string;
  dbCity: string;
  dbDistrict: string;
  authCity: string;
  authDistrict: string;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const csvArg = args.find((a) => a.startsWith('--csv='));
  const csvPath = csvArg ? path.resolve(csvArg.slice('--csv='.length)) : DEFAULT_CSV;

  console.log(`=== 표준데이터 행 오연결 링크 정리 (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);
  console.log(`정본 CSV: ${csvPath}`);

  if (!fs.existsSync(csvPath)) {
    console.error(`정본 CSV 를 찾을 수 없습니다: ${csvPath}`);
    process.exit(1);
  }

  const csv = await readStandardCsv(csvPath);
  console.log(`정본 학교 수: ${csv.size}`);

  const rows = await prisma.school.findMany({
    where: { neisSchoolCode: { not: null } },
    select: { id: true, sourceId: true, name: true, neisSchoolCode: true, city: true, district: true },
  });
  console.log(`링크 보유 행: ${rows.length}`);

  const candidates: Candidate[] = [];
  let notStandard = 0;
  let notInCsv = 0;
  let reorgSkipped = 0;
  let nameMismatch = 0;
  let regionOk = 0;

  for (const r of rows) {
    if (!isStandardDataSourceId(r.sourceId)) {
      notStandard++;
      continue;
    }
    const truth = csv.get(r.sourceId);
    if (!truth) {
      notInCsv++;
      continue;
    }
    if (truth.name !== r.name) nameMismatch++;

    const { city: authCity, district: authDistrict } = resolveSchoolRegion(truth.roadAddress);
    const comparison = {
      neisSchoolCode: r.neisSchoolCode,
      dbCity: r.city ?? '',
      dbDistrict: r.district ?? '',
      authoritativeCity: authCity,
      authoritativeDistrict: authDistrict,
    };

    if (shouldUnlinkNeisCode(comparison)) {
      candidates.push({
        id: r.id,
        sourceId: r.sourceId,
        name: r.name,
        neisSchoolCode: r.neisSchoolCode!,
        dbCity: comparison.dbCity,
        dbDistrict: comparison.dbDistrict,
        authCity,
        authDistrict,
      });
    } else if (isAdminReorgTransition(comparison)) {
      reorgSkipped++;
    } else {
      regionOk++;
    }
  }

  console.log('');
  console.log(`표준데이터 형식 아님(NEIS 소유 행) 제외 : ${notStandard}`);
  console.log(`정본에 없는 sourceId 제외              : ${notInCsv}`);
  console.log(`지역 일치                              : ${regionOk}`);
  console.log(`행정구역 개편으로 제외                 : ${reorgSkipped}`);
  console.log(`학교명 불일치(참고, 이 작업 대상 아님) : ${nameMismatch}`);
  console.log(`★ 링크를 끊을 대상                     : ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('\n대상이 없습니다.');
    return;
  }

  // 시/도 불일치와 시군구만 불일치를 나눠 보여준다 — 후자는 개편 목록 누락 가능성 점검용.
  const cityDiff = candidates.filter((c) => c.dbCity !== c.authCity);
  const districtOnly = candidates.filter((c) => c.dbCity === c.authCity);
  console.log(`  ├ 시/도 불일치      : ${cityDiff.length}`);
  console.log(`  └ 시군구만 불일치   : ${districtOnly.length}`);

  if (districtOnly.length > 0) {
    console.log('\n시군구만 불일치 전수(개편 누락 여부를 눈으로 확인하라):');
    for (const c of districtOnly) {
      console.log(`  ${c.sourceId} ${c.name} | DB ${c.dbCity}/${c.dbDistrict} → 정본 ${c.authCity}/${c.authDistrict}`);
    }
  }

  console.log('\n시/도 불일치 표본 10건:');
  for (const c of cityDiff.slice(0, 10)) {
    console.log(`  ${c.sourceId} ${c.name} | DB ${c.dbCity}/${c.dbDistrict} (code ${c.neisSchoolCode}) → 정본 ${c.authCity}/${c.authDistrict}`);
  }

  const dumpPath = path.resolve(
    process.cwd(),
    `unlink-school-neis-code-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.tsv`
  );
  fs.writeFileSync(
    dumpPath,
    ['id\tsourceId\tname\tneisSchoolCode\tdbCity\tdbDistrict\tauthCity\tauthDistrict']
      .concat(
        candidates.map(
          (c) => `${c.id}\t${c.sourceId}\t${c.name}\t${c.neisSchoolCode}\t${c.dbCity}\t${c.dbDistrict}\t${c.authCity}\t${c.authDistrict}`
        )
      )
      .join('\n')
  );
  console.log(`\n대상 덤프: ${dumpPath}`);

  if (!apply) {
    console.log('\ndry-run 이므로 DB 를 변경하지 않았습니다. 적용하려면 --apply 를 붙이세요.');
    return;
  }

  console.log(`\n${candidates.length}건의 neisSchoolCode 를 NULL 로 바꿉니다...`);
  let updated = 0;
  for (let i = 0; i < candidates.length; i += CHUNK_SIZE) {
    const chunk = candidates.slice(i, i + CHUNK_SIZE);
    const result = await prisma.school.updateMany({
      where: { id: { in: chunk.map((c) => c.id) } },
      data: { neisSchoolCode: null },
    });
    updated += result.count;
    console.log(`  ${Math.min(i + CHUNK_SIZE, candidates.length)}/${candidates.length} (누적 ${updated}건)`);
    if (i + CHUNK_SIZE < candidates.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const remaining = await prisma.school.count({
    where: { id: { in: candidates.map((c) => c.id) }, neisSchoolCode: { not: null } },
  });
  console.log(`\n완료: ${updated}건 갱신, 대상 중 링크 잔존 ${remaining}건`);
  if (remaining > 0) {
    console.error('일부 행이 갱신되지 않았습니다.');
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
