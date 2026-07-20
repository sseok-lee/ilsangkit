#!/usr/bin/env tsx
// @TASK Toilet ingestion repair — Task 2
// 목적: 기존 Toilet 행의 sourceId를 좌표 기반(구) → 개방자치단체코드+관리번호 기반(신)으로
// 리매핑한다. id(=`toilet-{구sourceId}`)는 절대 바꾸지 않는다 — 그래야 기존 색인 URL
// (`/toilet/{id}`)이 보존된다. 이후 고쳐진 sync가 새 sourceId로 매칭해 in-place 업데이트한다.
//
// 매칭 키: 화장실명 + 소재지도로명주소 (CSV와 DB 모두 trim 후 비교)
// - CSV에서 동일 키가 2회 이상 등장하면 ambiguous로 간주해 맵에서 제외(매칭 스킵)
// - DB 행의 roadAddress가 비어있으면 매칭 대상에서 제외
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
}

export interface RemapResult {
  totalCsvRows: number;
  ambiguousCsvKeys: number;
  usableCsvKeys: number;
  totalExistingRows: number;
  unmatched: number; // roadAddress 없음 또는 CSV 키 미발견
  alreadyCurrent: number; // newSourceId === 기존 sourceId
  collisionsSkipped: number; // newSourceId가 다른 행과 충돌
  planned: RemapPlanItem[]; // 실제 변경 대상
}

function buildKey(name: string, roadAddress: string): string {
  return `${name.trim()}|${roadAddress.trim()}`;
}

async function computePlan(csvPath: string): Promise<RemapResult> {
  console.info(`[remapToiletSourceIds] CSV 파싱 중: ${csvPath}`);
  const csvRows = await parseToiletCSV(csvPath);
  console.info(`[remapToiletSourceIds] CSV 총 ${csvRows.length}행`);

  // 1) name|roadAddress -> {govCode, mngNo} 맵 구축, 중복 키는 ambiguous로 제외
  const keyToInfo = new Map<string, CsvKeyInfo>();
  const ambiguousKeys = new Set<string>();

  for (const row of csvRows) {
    const name = row['화장실명']?.trim() || '';
    const roadAddress = row['소재지도로명주소']?.trim() || '';
    if (!name || !roadAddress) continue;

    const govCode = row['개방자치단체코드']?.trim() || '';
    const mngNo = row['관리번호']?.trim() || '';
    if (!mngNo) continue; // 관리번호 없으면 신규 sourceId 계산 불가 (transform과 동일 전제)

    const key = buildKey(name, roadAddress);
    if (ambiguousKeys.has(key)) continue;

    if (keyToInfo.has(key)) {
      // 두 번째 등장 -> ambiguous로 승격, 맵에서 제거
      keyToInfo.delete(key);
      ambiguousKeys.add(key);
      continue;
    }

    keyToInfo.set(key, { govCode, mngNo });
  }

  console.info(
    `[remapToiletSourceIds] 사용 가능 CSV 키: ${keyToInfo.size}, ambiguous 제외: ${ambiguousKeys.size}`
  );

  // 2) 기존 Toilet 전 행 조회
  const existingRows = await prisma.toilet.findMany({
    select: { id: true, name: true, roadAddress: true, sourceId: true },
  });
  console.info(`[remapToiletSourceIds] 기존 Toilet 행: ${existingRows.length}`);

  // 충돌 가드용: 기존 sourceId 전체 집합 + 이번 실행에서 새로 배정된 sourceId 집합
  const existingSourceIds = new Set(existingRows.map((r) => r.sourceId));
  const assignedThisRun = new Set<string>();

  let unmatched = 0;
  let alreadyCurrent = 0;
  let collisionsSkipped = 0;
  const planned: RemapPlanItem[] = [];

  for (const row of existingRows as ExistingToiletRow[]) {
    const roadAddress = row.roadAddress?.trim() || '';
    if (!roadAddress) {
      unmatched++;
      continue;
    }

    const key = buildKey(row.name, roadAddress);
    const info = keyToInfo.get(key);
    if (!info) {
      unmatched++;
      continue;
    }

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
      collisionsSkipped++;
      continue;
    }

    assignedThisRun.add(newSourceId);
    planned.push({ id: row.id, currentSourceId: row.sourceId, newSourceId });
  }

  return {
    totalCsvRows: csvRows.length,
    ambiguousCsvKeys: ambiguousKeys.size,
    usableCsvKeys: keyToInfo.size,
    totalExistingRows: existingRows.length,
    unmatched,
    alreadyCurrent,
    collisionsSkipped,
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
  console.info('\n=== remapToiletSourceIds 리포트 ===');
  console.info(`CSV 총 행수: ${result.totalCsvRows}`);
  console.info(`CSV 사용가능 키(name+도로명주소): ${result.usableCsvKeys}`);
  console.info(`CSV ambiguous 키(중복, 제외): ${result.ambiguousCsvKeys}`);
  console.info(`기존 Toilet 행수: ${result.totalExistingRows}`);
  console.info(`미매칭(roadAddress 없음 또는 키 미발견): ${result.unmatched}`);
  console.info(`이미 신규 sourceId(변경 불필요): ${result.alreadyCurrent}`);
  console.info(`충돌로 스킵: ${result.collisionsSkipped}`);
  console.info(`변경 대상(계획): ${result.planned.length}`);
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
