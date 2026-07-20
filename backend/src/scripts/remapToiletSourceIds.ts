#!/usr/bin/env tsx
// @TASK Toilet ingestion repair — Task 2
// 목적: 기존 Toilet 행의 sourceId를 좌표 기반(구) → 개방자치단체코드+관리번호 기반(신)으로
// 리매핑한다. id(=`toilet-{구sourceId}`)는 절대 바꾸지 않는다 — 그래야 기존 색인 URL
// (`/toilet/{id}`)이 보존된다. 이후 고쳐진 sync가 새 sourceId로 매칭해 in-place 업데이트한다.
//
// 매칭은 2단계 패스로 수행된다 (exact가 항상 fallback보다 우선):
//
// [Pass 1: exact] 화장실명 + 소재지도로명주소 정확 일치 (CSV와 DB 모두 trim 후 비교)
// - CSV에서 동일 키가 2회 이상 등장하면 ambiguous로 간주해 맵에서 제외(매칭 스킵)
// - DB 행의 roadAddress가 비어있으면 매칭 대상에서 제외
//
// [Pass 2: fallback, 2026 행정구역 개편 대응] exact 패스에서 매칭 실패한 행만 대상.
// 개편으로 시·도 접두사나 신설 구가 도로명주소 앞부분에 삽입/변경되어도 "읍면동+도로명+번호"
// 꼬리는 안정적이라는 전제로, `reformStableKey` = 화장실명 + addressTail(도로명주소)로 재매칭한다.
// addressTail = 도로명주소를 공백으로 나눈 토큰 중 마지막으로 '시'/'군'/'구'로 끝나는 토큰
// **이후**의 나머지 부분(해당 토큰이 없으면 안전하게 전체 문자열을 그대로 사용).
// 예) "경기도 화성시 만세구 새솔동 노들길 19-47" / "경기도 화성시 새솔동 노들길 19-47"
//     → 둘 다 "새솔동 노들길 19-47" (매칭)
// 예) "전남광주통합특별시 광양시 진상면 옥진로 1129" / "전라남도 광양시 진상면 옥진로 1129"
//     → 둘 다 "진상면 옥진로 1129" (매칭)
// - fallback도 CSV에서 동일 reformStableKey가 2회 이상 등장하면 ambiguous로 제외(exact와 동일 가드)
// - exact 패스에서 이미 매칭된 행은 fallback 대상에서 제외(exact가 항상 fallback을 이김)
//
// 공통 가드(두 패스 모두 적용):
// - 계산된 newSourceId가 이미 현재 sourceId와 같으면 스킵(변경 없음)
// - 계산된 newSourceId가 이미 다른 기존 행(또는 이번 실행에서 먼저 배정된 행)에서
//   쓰이고 있으면 UNIQUE 위반 방지를 위해 스킵
//
// 사용법:
//   npx tsx src/scripts/remapToiletSourceIds.ts                # dry-run (기본, DB 미변경)
//   npx tsx src/scripts/remapToiletSourceIds.ts --apply         # 실제 UPDATE 실행
//   npx tsx src/scripts/remapToiletSourceIds.ts --local <path>  # CSV 경로 지정
//
// 멱등성: --apply 이후 재실행하면 "이미 신규 sourceId" 케이스로 전부 스킵되어 변경 0건이어야 한다.

import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { prisma } from '../lib/prisma.js';
import { parseToiletCSV, generateToiletSourceId } from '../services/csvParser.js';

const BATCH_SIZE = 500;

interface CsvKeyInfo {
  govCode: string;
  mngNo: string;
}

interface ExistingToiletRow {
  id: string;
  name: string;
  roadAddress: string | null;
  sourceId: string;
}

interface RemapPlanItem {
  id: string;
  currentSourceId: string;
  newSourceId: string;
  matchSource: 'exact' | 'fallback';
}

export interface RemapResult {
  totalCsvRows: number;
  // Pass 1 (exact: name + 도로명주소 정확 일치)
  ambiguousCsvKeys: number;
  usableCsvKeys: number;
  matchedExact: number; // exact 패스에서 CSV 키가 발견된 행 수 (planned + alreadyCurrent + collision 포함)
  // Pass 2 (fallback: 2026 행정구역 개편 대응 reformStableKey)
  ambiguousFallbackKeys: number;
  usableFallbackKeys: number;
  matchedFallback: number; // fallback 패스에서 CSV 키가 발견된 행 수 (exact 미매칭 행 중, planned + alreadyCurrent + collision 포함)
  totalExistingRows: number;
  unmatched: number; // roadAddress 없음 또는 두 패스 모두 CSV 키 미발견 (최종 미매칭)
  alreadyCurrent: number; // newSourceId === 기존 sourceId (두 패스 합산)
  collisionsSkipped: number; // newSourceId가 다른 행과 충돌 (두 패스 합산)
  collisionsSkippedExact: number;
  collisionsSkippedFallback: number;
  planned: RemapPlanItem[]; // 실제 변경 대상
}

function buildKey(name: string, roadAddress: string): string {
  return `${name.trim()}|${roadAddress.trim()}`;
}

// 2026 행정구역 개편 대응: 도로명주소에서 마지막 시/군/구 토큰 "이후" 부분(읍면동+도로명+번호)만
// 추출한다. 개편은 시·도 접두사나 신설 구를 앞부분에 삽입/변경할 뿐, 이 꼬리는 안정적이라는 전제.
// 해당 토큰이 없으면 안전하게 trim된 전체 문자열을 그대로 반환한다(폴백 이득은 없지만 안전).
function addressTail(roadAddress: string): string {
  const trimmed = roadAddress.trim();
  const tokens = trimmed.split(/\s+/);
  let lastIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.endsWith('시') || token.endsWith('군') || token.endsWith('구')) {
      lastIdx = i;
    }
  }
  if (lastIdx === -1) return trimmed;
  return tokens.slice(lastIdx + 1).join(' ');
}

function reformStableKey(name: string, roadAddress: string): string {
  return `${name.trim()}|${addressTail(roadAddress)}`;
}

async function computePlan(csvPath: string): Promise<RemapResult> {
  console.info(`[remapToiletSourceIds] CSV 파싱 중: ${csvPath}`);
  const csvRows = await parseToiletCSV(csvPath);
  console.info(`[remapToiletSourceIds] CSV 총 ${csvRows.length}행`);

  // 1) 두 개의 CSV 룩업 맵을 한 번의 순회로 동시 구축한다.
  //    - keyToInfo: name|roadAddress 정확 일치 (exact, Pass 1)
  //    - fallbackKeyToInfo: name|addressTail(roadAddress) (fallback, Pass 2 — 2026 행정구역 개편 대응)
  //    둘 다 동일한 ambiguous 가드(중복 키 2회 이상 등장 시 맵에서 제외)를 독립적으로 적용한다.
  const keyToInfo = new Map<string, CsvKeyInfo>();
  const ambiguousKeys = new Set<string>();

  const fallbackKeyToInfo = new Map<string, CsvKeyInfo>();
  const ambiguousFallbackKeys = new Set<string>();

  for (const row of csvRows) {
    const name = row['화장실명']?.trim() || '';
    const roadAddress = row['소재지도로명주소']?.trim() || '';
    if (!name || !roadAddress) continue;

    const govCode = row['개방자치단체코드']?.trim() || '';
    const mngNo = row['관리번호']?.trim() || '';
    if (!mngNo) continue; // 관리번호 없으면 신규 sourceId 계산 불가 (transform과 동일 전제)

    const info: CsvKeyInfo = { govCode, mngNo };

    // exact 키
    const key = buildKey(name, roadAddress);
    if (!ambiguousKeys.has(key)) {
      if (keyToInfo.has(key)) {
        // 두 번째 등장 -> ambiguous로 승격, 맵에서 제거
        keyToInfo.delete(key);
        ambiguousKeys.add(key);
      } else {
        keyToInfo.set(key, info);
      }
    }

    // fallback(reform-stable) 키 — exact와 완전히 독립적인 맵/ambiguous 집합
    const fallbackKey = reformStableKey(name, roadAddress);
    if (!ambiguousFallbackKeys.has(fallbackKey)) {
      if (fallbackKeyToInfo.has(fallbackKey)) {
        fallbackKeyToInfo.delete(fallbackKey);
        ambiguousFallbackKeys.add(fallbackKey);
      } else {
        fallbackKeyToInfo.set(fallbackKey, info);
      }
    }
  }

  console.info(
    `[remapToiletSourceIds] exact 사용 가능 CSV 키: ${keyToInfo.size}, ambiguous 제외: ${ambiguousKeys.size}`
  );
  console.info(
    `[remapToiletSourceIds] fallback 사용 가능 CSV 키: ${fallbackKeyToInfo.size}, ambiguous 제외: ${ambiguousFallbackKeys.size}`
  );

  // 2) 기존 Toilet 전 행 조회
  const existingRows = await prisma.toilet.findMany({
    select: { id: true, name: true, roadAddress: true, sourceId: true },
  });
  console.info(`[remapToiletSourceIds] 기존 Toilet 행: ${existingRows.length}`);

  // 충돌 가드용: 기존 sourceId 전체 집합 + 이번 실행에서 새로 배정된 sourceId 집합
  // (exact/fallback 두 패스가 공유 — exact가 먼저 처리되므로 exact 배정분이 자연히 fallback보다 우선)
  const existingSourceIds = new Set(existingRows.map((r) => r.sourceId));
  const assignedThisRun = new Set<string>();

  let matchedExact = 0;
  let matchedFallback = 0;
  let alreadyCurrent = 0;
  let collisionsSkippedExact = 0;
  let collisionsSkippedFallback = 0;
  let unmatched = 0;
  const planned: RemapPlanItem[] = [];

  // fallback 후보: roadAddress는 있지만 exact 패스에서 CSV 키를 찾지 못한 행
  const fallbackCandidates: { row: ExistingToiletRow; roadAddress: string }[] = [];

  // Pass 1: exact
  for (const row of existingRows as ExistingToiletRow[]) {
    const roadAddress = row.roadAddress?.trim() || '';
    if (!roadAddress) {
      unmatched++;
      continue;
    }

    const key = buildKey(row.name, roadAddress);
    const info = keyToInfo.get(key);
    if (!info) {
      // exact 미매칭 -> fallback 후보로 이월 (exact 우선 원칙: exact가 매칭되면 fallback은 시도조차 안 함)
      fallbackCandidates.push({ row, roadAddress });
      continue;
    }

    matchedExact++;
    const newSourceId = generateToiletSourceId(info.govCode, info.mngNo);

    if (newSourceId === row.sourceId) {
      alreadyCurrent++;
      continue;
    }

    // 충돌 가드: 다른 기존 행이 이미 이 sourceId를 쓰고 있거나(자기 자신 제외),
    // 이번 실행에서 이미 다른 행에 배정됐으면 스킵
    const usedByAnotherExistingRow =
      existingSourceIds.has(newSourceId) && newSourceId !== row.sourceId;
    const usedByThisRunAlready = assignedThisRun.has(newSourceId);

    if (usedByAnotherExistingRow || usedByThisRunAlready) {
      collisionsSkippedExact++;
      continue;
    }

    assignedThisRun.add(newSourceId);
    planned.push({ id: row.id, currentSourceId: row.sourceId, newSourceId, matchSource: 'exact' });
  }

  // Pass 2: fallback (2026 행정구역 개편 대응) — exact에서 매칭 실패한 행만 대상
  for (const { row, roadAddress } of fallbackCandidates) {
    const fallbackKey = reformStableKey(row.name, roadAddress);
    const info = fallbackKeyToInfo.get(fallbackKey);
    if (!info) {
      unmatched++;
      continue;
    }

    matchedFallback++;
    const newSourceId = generateToiletSourceId(info.govCode, info.mngNo);

    if (newSourceId === row.sourceId) {
      alreadyCurrent++;
      continue;
    }

    const usedByAnotherExistingRow =
      existingSourceIds.has(newSourceId) && newSourceId !== row.sourceId;
    const usedByThisRunAlready = assignedThisRun.has(newSourceId);

    if (usedByAnotherExistingRow || usedByThisRunAlready) {
      collisionsSkippedFallback++;
      continue;
    }

    assignedThisRun.add(newSourceId);
    planned.push({
      id: row.id,
      currentSourceId: row.sourceId,
      newSourceId,
      matchSource: 'fallback',
    });
  }

  return {
    totalCsvRows: csvRows.length,
    ambiguousCsvKeys: ambiguousKeys.size,
    usableCsvKeys: keyToInfo.size,
    matchedExact,
    ambiguousFallbackKeys: ambiguousFallbackKeys.size,
    usableFallbackKeys: fallbackKeyToInfo.size,
    matchedFallback,
    totalExistingRows: existingRows.length,
    unmatched,
    alreadyCurrent,
    collisionsSkipped: collisionsSkippedExact + collisionsSkippedFallback,
    collisionsSkippedExact,
    collisionsSkippedFallback,
    planned,
  };
}

async function applyPlan(planned: RemapPlanItem[]): Promise<number> {
  let updated = 0;
  for (let i = 0; i < planned.length; i += BATCH_SIZE) {
    const batch = planned.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      batch.map((item) =>
        prisma.toilet.update({
          where: { id: item.id }, // id는 절대 불변 — WHERE 절 대상일 뿐
          data: { sourceId: item.newSourceId },
        })
      )
    );
    updated += batch.length;
    console.info(`[remapToiletSourceIds] apply 진행: ${updated}/${planned.length}`);
  }
  return updated;
}

function printReport(result: RemapResult, applied: boolean, updatedCount?: number): void {
  const totalMatched = result.matchedExact + result.matchedFallback;
  const matchRate =
    result.totalExistingRows > 0 ? ((totalMatched / result.totalExistingRows) * 100).toFixed(1) : '0.0';

  console.info('\n=== remapToiletSourceIds 리포트 ===');
  console.info(`CSV 총 행수: ${result.totalCsvRows}`);
  console.info('--- Pass 1: exact (name+도로명주소) ---');
  console.info(`CSV 사용가능 키: ${result.usableCsvKeys}`);
  console.info(`CSV ambiguous 키(중복, 제외): ${result.ambiguousCsvKeys}`);
  console.info(`matched-exact: ${result.matchedExact}`);
  console.info(`collisions-skipped(exact): ${result.collisionsSkippedExact}`);
  console.info('--- Pass 2: fallback (2026 행정구역 개편 대응, reformStableKey) ---');
  console.info(`CSV 사용가능 키: ${result.usableFallbackKeys}`);
  console.info(`CSV ambiguous 키(중복, 제외): ${result.ambiguousFallbackKeys}`);
  console.info(`matched-fallback: ${result.matchedFallback}`);
  console.info(`collisions-skipped(fallback): ${result.collisionsSkippedFallback}`);
  console.info('--- 종합 ---');
  console.info(`기존 Toilet 행수: ${result.totalExistingRows}`);
  console.info(`still-unmatched(roadAddress 없음 또는 두 패스 모두 키 미발견): ${result.unmatched}`);
  console.info(`이미 신규 sourceId(변경 불필요): ${result.alreadyCurrent}`);
  console.info(`충돌로 스킵(합산): ${result.collisionsSkipped}`);
  console.info(`변경 대상(계획): ${result.planned.length}`);
  console.info(`매칭률(exact+fallback / 기존 행수): ${matchRate}% (${totalMatched}/${result.totalExistingRows})`);
  if (applied) {
    console.info(`실제 UPDATE 완료: ${updatedCount ?? 0}`);
  } else {
    console.info('DRY-RUN — DB 미변경. 실제 적용하려면 --apply 옵션을 사용하세요.');
  }
  console.info('===================================\n');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');

  let csvPath: string;
  const localFileIndex = args.indexOf('--local');
  if (localFileIndex !== -1 && args[localFileIndex + 1]) {
    csvPath = path.resolve(args[localFileIndex + 1]);
  } else {
    csvPath = path.resolve(import.meta.dirname, '../../prisma/data/toilet.csv');
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    console.error('prisma/data/toilet.csv에 파일을 넣거나 --local 옵션으로 경로를 지정하세요.');
    process.exit(1);
  }

  const result = await computePlan(csvPath);

  if (apply) {
    const updated = await applyPlan(result.planned);
    printReport(result, true, updated);
  } else {
    printReport(result, false);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch((error) => {
    console.error('Fatal error:', error);
    prisma.$disconnect().finally(() => process.exit(1));
  });
