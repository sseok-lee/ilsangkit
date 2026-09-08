#!/usr/bin/env tsx
/**
 * reconcileSchoolNeisRows — 학교 행을 NEIS 기준으로 정리한다 (일회성 마이그레이션).
 *
 * ## 배경
 *
 * mergeSchoolNeis 가 NEIS 를 학교명만으로 매칭해(다중 후보 2,592건) 표준행 940건에
 * 남의 학교 neisSchoolCode 를 박았다. syncSchoolNeis 가 그 링크를 따라 지역·주소·전화·
 * 학급·학과를 계속 덮어써, 좌표는 서울 영등포인데 주소·목록은 대구 동구인 행이 됐다.
 * 동시에 같은 학교가 표준행과 NEIS행으로 각각 남아 중복 페이지가 됐다.
 *
 * 학교 데이터를 NEIS 단일 소스로 재구성한다(사용자 결정). 이 스크립트는 그 전환의
 * 데이터 정리 부분이다.
 *
 * ## 무엇을 하는가
 *
 *   1. 링크 교정·연결 — schoolNeisMatcher 의 정확 매핑으로 neisSchoolCode 를 다시 맺는다
 *   2. 중복 제거      — 같은 NEIS 코드의 행이 여럿이면 표준행을 살리고 나머지는 삭제 + 301
 *   3. 삭제           — NEIS 현재 목록에 없는 학교(폐교·통폐합)는 삭제 + 410
 *   4. 학급·학과 정리 — 링크가 바뀐/삭제된 학교의 자식 행을 지운다 (sync 가 다시 채운다)
 *
 * URL 은 유지한다. school-B... 가 네이버 유입 89일 5,515뷰 — school 상세 전체의 76% 를
 * 받고 있다(구글은 클릭 0). 그래서 생존자는 표준행이고, 삭제되는 NEIS행을 301 한다.
 *
 * ## 표준데이터를 마지막으로 쓰는 곳
 *
 * 매핑에만 쓴다. 학교ID ↔ NEIS 코드를 한 번 확정하면 이후로는 필요 없다. 로컬 CSV 를
 * 쓰는 이유: DB 표준행이 바로 이 파일에서 왔으므로 매칭률이 가장 높고(99.30% vs
 * tn_ API 99.19%), 네트워크 없이 재현된다.
 *
 * ## 안전 설계
 *
 *  - dry-run 기본. --apply 없이는 DB 를 바꾸지 않는다.
 *  - 계획을 파일로 덤프하고 불변식 검사를 통과해야만 쓴다(assertPlanInvariants).
 *  - 301·410 산출물을 파일로 내보낸다. 이 파일이 배포된 뒤에 --apply 해야 한다.
 *  - PK id 목록 기반 청크 처리. 조건 풀스캔 UPDATE/DELETE 를 하지 않는다.
 *  - 적용 후 남은 행 수·코드 유일성을 재확인하고 어긋나면 exit 1.
 *
 * ## 실행 순서 (중요)
 *
 *   1) dry-run 으로 산출물 생성
 *        node dist/scripts/reconcileSchoolNeisRows.js
 *   2) school-redirects.json 을 frontend server/data/facilityRedirects.json 에 합치고
 *      school-gone.json 을 server/data/goneFacilities.json 으로 커밋 → 배포
 *      (행이 사라지기 전에 301·410 이 살아 있어야 한다)
 *   3) 적용
 *        node dist/scripts/reconcileSchoolNeisRows.js --apply
 *   4) 학급·학과 재적재
 *        npm run sync:school:enrollment && npm run sync:school:department
 *
 * 사용법:
 *   npx tsx src/scripts/reconcileSchoolNeisRows.ts [--apply] [--csv=<path>] [--out=<dir>]
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma.js';
import { NeisApiClient } from '../services/neisApiClient.js';
import { NEIS } from '../constants/index.js';
import { parseSchoolCSV } from '../services/csvParser.js';
import {
  buildSchoolNeisMapping,
  type MatchableStandardSchool,
  type MatchableNeisSchool,
} from '../services/schoolNeisMatcher.js';
import {
  planSchoolReconcile,
  buildRedirectMap,
  buildGoneList,
  collectAffectedSchoolIds,
  assertPlanInvariants,
  type SchoolRowState,
} from '../services/schoolReconcilePlan.js';

const DEFAULT_CSV = path.resolve(import.meta.dirname, '../../prisma/data/school.csv');
const CHUNK = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** syncSchoolNeis 와 같은 기준으로 학교로 볼 수 있는 NEIS 레코드의 코드만 모은다. */
function collectLiveNeisCodes(rows: MatchableNeisSchool[]): Set<string> {
  const live = new Set<string>();
  for (const r of rows) {
    const code = (r.SD_SCHUL_CODE ?? '').trim();
    const name = (r.SCHUL_NM ?? '').trim();
    const kind = (r.SCHUL_KND_SC_NM ?? '').trim();
    if (!code || !name || !kind || name.includes('검정고시')) continue;
    const road = [(r.ORG_RDNMA ?? '').trim(), (r.ORG_RDNDA ?? '').trim()].filter(Boolean).join(' ');
    if (!road) continue;
    live.add(code);
  }
  return live;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const csvArg = args.find((a) => a.startsWith('--csv='));
  const outArg = args.find((a) => a.startsWith('--out='));
  const csvPath = csvArg ? path.resolve(csvArg.slice('--csv='.length)) : DEFAULT_CSV;
  const outDir = outArg ? path.resolve(outArg.slice('--out='.length)) : process.cwd();

  console.log(`=== 학교 행 NEIS 기준 정리 (${apply ? 'APPLY' : 'DRY-RUN'}) ===`);

  const apiKey = process.env.NEIS_API_KEY;
  if (!apiKey) throw new Error('NEIS_API_KEY 환경 변수가 설정되지 않았습니다.');
  if (!fs.existsSync(csvPath)) throw new Error(`매핑용 표준데이터 CSV 가 없습니다: ${csvPath}`);

  // 1. NEIS 전량 수집
  const client = new NeisApiClient(apiKey);
  const neisRows = await client.fetchAllPages<MatchableNeisSchool>(
    NEIS.ENDPOINTS.SCHOOL_INFO,
    { SCHUL_KND_SC_NM: '' },
    NEIS.PAGE_SIZE
  );
  const liveCodes = collectLiveNeisCodes(neisRows);
  console.log(`NEIS 수집 ${neisRows.length}건 → 학교로 인정 ${liveCodes.size}건`);
  // 0건이면 API 장애다 — 전량 삭제 계획이 나오므로 반드시 멈춘다.
  if (liveCodes.size === 0) throw new Error('NEIS 에서 학교를 하나도 받지 못했습니다. 중단합니다.');

  // 2. 매핑 (표준데이터는 여기서 마지막으로 쓰인다)
  const csvRows = await parseSchoolCSV(csvPath);
  const standard: MatchableStandardSchool[] = csvRows.map((r) => ({
    schoolId: (r['학교ID'] ?? '').trim(),
    schoolNm: (r['학교명'] ?? '').trim(),
    schoolSe: (r['학교급구분'] ?? '').trim(),
    rdnmadr: (r['소재지도로명주소'] ?? '').trim(),
    lnmadr: (r['소재지지번주소'] ?? '').trim(),
  }));
  const { mapping, stats } = buildSchoolNeisMapping(standard, neisRows);
  console.log(
    `매핑 ${mapping.size}/${standard.length} ` +
    `(1단계 ${stats.byName_road} · 2단계 ${stats.byName_region} · 3단계 ${stats.byRoad_level} · ` +
    `다중 ${stats.ambiguous} · 미매칭 ${stats.unmatched} · 충돌폐기 ${stats.droppedByCollision})`
  );

  // 3. DB 현재 상태
  const dbRows = await prisma.school.findMany({
    select: { id: true, sourceId: true, neisSchoolCode: true, name: true, city: true, district: true },
  });
  const rows: SchoolRowState[] = dbRows.map((r) => ({
    id: r.id,
    sourceId: r.sourceId,
    neisSchoolCode: r.neisSchoolCode,
  }));
  console.log(`DB 학교 행 ${rows.length}건`);

  // 4. 계획 + 불변식 검사
  const plan = planSchoolReconcile(rows, mapping, liveCodes);
  assertPlanInvariants(rows, plan);

  const dup = plan.remove.filter((r) => r.reason === 'duplicate');
  const gone = plan.remove.filter((r) => r.reason === 'not-in-neis');
  const corrected = plan.relink.filter((r) => r.from);
  const newlyLinked = plan.relink.filter((r) => !r.from);
  const survivors = rows.length - plan.remove.length;

  console.log('');
  console.log(`  링크 교정        : ${corrected.length}`);
  console.log(`  신규 연결        : ${newlyLinked.length}`);
  console.log(`  중복 삭제 (301)  : ${dup.length}`);
  console.log(`  NEIS 없음 (410)  : ${gone.length}`);
  console.log(`  변경 없음        : ${plan.unchanged.length}`);
  console.log(`  ─ 적용 후 행 수  : ${survivors} (${rows.length} → ${survivors}, ${rows.length - survivors} 감소)`);
  console.log('  불변식 검사      : 통과');

  // 5. 산출물
  const byId = new Map(dbRows.map((r) => [r.id, r]));
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const write = (name: string, body: string): string => {
    const p = path.join(outDir, name);
    fs.writeFileSync(p, body);
    return p;
  };

  const redirects = buildRedirectMap(plan);
  const goneIds = buildGoneList(plan);
  const files = [
    write('school-redirects.json', JSON.stringify(redirects, null, 2) + '\n'),
    write('school-gone.json', JSON.stringify(goneIds, null, 2) + '\n'),
    write(
      `school-reconcile-plan-${stamp}.tsv`,
      ['action\tid\tname\tcity\tdistrict\tfrom\tto']
        .concat(
          plan.relink.map((r) => {
            const d = byId.get(r.id);
            return `relink\t${r.id}\t${d?.name ?? ''}\t${d?.city ?? ''}\t${d?.district ?? ''}\t${r.from ?? ''}\t${r.to}`;
          }),
          plan.remove.map((r) => {
            const d = byId.get(r.id);
            return `remove:${r.reason}\t${r.id}\t${d?.name ?? ''}\t${d?.city ?? ''}\t${d?.district ?? ''}\t\t${r.redirectTo ?? ''}`;
          })
        )
        .join('\n') + '\n'
    ),
  ];
  console.log('\n산출물:');
  for (const f of files) console.log(`  ${f}`);

  if (!apply) {
    console.log('\ndry-run 이므로 DB 를 변경하지 않았습니다.');
    console.log('school-redirects.json / school-gone.json 을 배포한 뒤 --apply 하세요.');
    return;
  }

  // 6. 적용 — 자식 행 삭제 → 링크 교정 → 행 삭제
  const affected = collectAffectedSchoolIds(plan);
  console.log(`\n[1/3] 학급·학과 정리 (${affected.length}개 학교)`);
  let enrollDeleted = 0;
  let deptDeleted = 0;
  for (let i = 0; i < affected.length; i += CHUNK) {
    const ids = affected.slice(i, i + CHUNK);
    enrollDeleted += (await prisma.schoolEnrollment.deleteMany({ where: { schoolId: { in: ids } } })).count;
    deptDeleted += (await prisma.schoolDepartment.deleteMany({ where: { schoolId: { in: ids } } })).count;
    if (i + CHUNK < affected.length) await sleep(100);
  }
  console.log(`  SchoolEnrollment ${enrollDeleted}행, SchoolDepartment ${deptDeleted}행 삭제`);

  console.log(`\n[2/3] 링크 교정·연결 (${plan.relink.length}건)`);
  // 행마다 값이 달라 updateMany 로 묶을 수 없다. PK 단건 update 를 청크 단위로 돈다.
  let relinked = 0;
  for (let i = 0; i < plan.relink.length; i += CHUNK) {
    const chunk = plan.relink.slice(i, i + CHUNK);
    for (const r of chunk) {
      await prisma.school.update({ where: { id: r.id }, data: { neisSchoolCode: r.to } });
      relinked++;
    }
    console.log(`  ${Math.min(i + CHUNK, plan.relink.length)}/${plan.relink.length}`);
    if (i + CHUNK < plan.relink.length) await sleep(100);
  }
  if (relinked !== plan.relink.length) {
    throw new Error(`링크 갱신 수 불일치: ${relinked} != ${plan.relink.length}`);
  }

  console.log(`\n[3/3] 행 삭제 (${plan.remove.length}건)`);
  const removeIds = plan.remove.map((r) => r.id);
  let removed = 0;
  for (let i = 0; i < removeIds.length; i += CHUNK) {
    const ids = removeIds.slice(i, i + CHUNK);
    removed += (await prisma.school.deleteMany({ where: { id: { in: ids } } })).count;
    if (i + CHUNK < removeIds.length) await sleep(100);
  }
  console.log(`  ${removed}행 삭제`);

  // 7. 사후 검증
  const finalCount = await prisma.school.count();
  const nullCode = await prisma.school.count({ where: { neisSchoolCode: null } });
  const dupCodes = await prisma.$queryRaw<Array<{ c: bigint }>>`
    SELECT COUNT(*) AS c FROM (
      SELECT neisSchoolCode FROM School WHERE neisSchoolCode IS NOT NULL
      GROUP BY neisSchoolCode HAVING COUNT(*) > 1
    ) t
  `;
  const dupCodeCount = Number(dupCodes[0]?.c ?? 0);

  console.log('\n=== 사후 검증 ===');
  console.log(`  남은 행       : ${finalCount} (예상 ${survivors})`);
  console.log(`  코드 NULL     : ${nullCode} (예상 0)`);
  console.log(`  코드 중복 그룹: ${dupCodeCount} (예상 0)`);

  const ok = finalCount === survivors && nullCode === 0 && dupCodeCount === 0;
  if (!ok) {
    console.error('\n사후 검증 실패.');
    process.exit(1);
  }
  console.log('\n완료. 학급·학과를 다시 채우세요:');
  console.log('  npm run sync:school:enrollment && npm run sync:school:department');
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main()
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
