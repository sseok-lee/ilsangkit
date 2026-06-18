/**
 * district 데이터 백필.
 *
 * 일부 단축형 광역시(대구/부산/인천/광주/대전/울산)에서 공공 API의 시군구명에 시명이
 * 박혀 "대구동구"처럼 저장된 기존 행을, 신뢰 가능한 address 기준으로 재도출해 교정한다.
 * (영향: raw 시군구명을 쓰던 hospital·wifi. 그 외 카테고리는 이미 주소 파싱이라 정상)
 *
 * 사용법:
 *   npx tsx src/scripts/backfillDistrict.ts            # dry-run (미리보기, 쓰기 없음)
 *   npx tsx src/scripts/backfillDistrict.ts --apply    # 실제 반영
 *
 * 주소 기준이라 "부산진구"처럼 시명으로 시작하는 실제 구는 망가지지 않는다.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { normalizeDistrict } from '../lib/addressParser.js';

const APPLY = process.argv.includes('--apply');
const READ_BATCH = 1000;
const WRITE_CHUNK = 100; // 짧은 트랜잭션 단위 (장시간 락 방지)

// 영향 모델만 대상. 나머지는 이미 주소 파싱으로 district가 정상.
const TARGETS = [
  { name: 'hospital', model: prisma.hospital },
  { name: 'wifi', model: prisma.wifi },
] as const;

interface Fix {
  id: string;
  from: string;
  to: string;
  city: string;
  address: string | null;
}

async function backfillModel(target: (typeof TARGETS)[number]): Promise<{ name: string; scanned: number; fixed: number }> {
  const model = target.model as {
    findMany: (args: unknown) => Promise<Array<{ id: string; city: string; district: string; address: string | null; roadAddress: string | null }>>;
    update: (args: unknown) => Prisma.PrismaPromise<unknown>;
  };

  let cursor: string | null = null;
  let scanned = 0;
  const fixes: Fix[] = [];

  for (;;) {
    const rows = await model.findMany({
      take: READ_BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, city: true, district: true, address: true, roadAddress: true },
    });
    if (rows.length === 0) break;
    cursor = rows[rows.length - 1].id;

    for (const r of rows) {
      scanned++;
      const derived = normalizeDistrict(r.district ?? '', r.address || r.roadAddress);
      if (derived && derived !== r.district) {
        fixes.push({ id: r.id, from: r.district, to: derived, city: r.city, address: r.address ?? r.roadAddress });
      }
    }
  }

  // 미리보기 샘플
  console.log(`\n[${target.name}] scanned=${scanned}, to-fix=${fixes.length}${APPLY ? '' : '  (dry-run)'}`);
  fixes.slice(0, 8).forEach((f) => console.log(`   ${f.city}: "${f.from}" → "${f.to}"   (${f.address ?? ''})`));
  if (fixes.length > 8) console.log(`   … 외 ${fixes.length - 8}건`);

  if (APPLY && fixes.length > 0) {
    for (let i = 0; i < fixes.length; i += WRITE_CHUNK) {
      const chunk = fixes.slice(i, i + WRITE_CHUNK);
      await prisma.$transaction(chunk.map((f) => model.update({ where: { id: f.id }, data: { district: f.to } })));
      console.log(`   applied ${Math.min(i + WRITE_CHUNK, fixes.length)}/${fixes.length}`);
    }
  }

  return { name: target.name, scanned, fixed: fixes.length };
}

async function main(): Promise<void> {
  console.log(`district 백필 시작 — mode=${APPLY ? 'APPLY' : 'DRY-RUN'}`);
  const results = [];
  for (const t of TARGETS) {
    results.push(await backfillModel(t));
  }
  console.log('\n=== 요약 ===');
  results.forEach((r) => console.log(`  ${r.name}: ${r.fixed}건 ${APPLY ? '교정' : '교정 예정'} (스캔 ${r.scanned})`));
  if (!APPLY) console.log('\n실제 반영하려면 --apply 플래그로 재실행하세요.');
}

main()
  .catch((err) => {
    console.error('백필 실패:', err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
