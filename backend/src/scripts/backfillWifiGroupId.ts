/**
 * 기존 Wifi 행에 groupId 를 채우는 1회성 백필.
 *
 * 스키마에 groupId 를 추가해도 기존 행은 NULL 이라 장소 단위 상세가 아무것도 안 잡힌다.
 * 이 스크립트가 채우기 전까지 resolveWifiGroupRedirect 는 null 을 주고
 * 기존 AP URL 이 그대로 서빙된다(fail-open) — 그래서 배포와 백필 순서에 자유도가 있다.
 *
 * 실행: npx tsx src/scripts/backfillWifiGroupId.ts [--batch 1000] [--dry-run]
 *
 * 멱등하다. sync 가 이후 같은 값을 다시 써도 결과가 같다.
 */
import prisma from '../lib/prisma.js';
import { buildWifiGroupId } from '../services/wifiGroup.js';

export interface BackfillRow {
  id: string;
  name: string;
  city: string;
  district: string;
  address: string | null;
}

/**
 * 한 배치를 단일 UPDATE 로 접는다.
 *
 * 행마다 updateMany 를 부르면 14만 행에서 쿼리가 수만 건이 된다. CASE 매핑이면
 * 배치당 1건이다. 값은 전부 바인딩 파라미터로만 넣는다.
 */
export function buildGroupIdUpdateSql(
  rows: BackfillRow[],
): { sql: string; params: unknown[] } | null {
  if (rows.length === 0) return null;

  const cases = rows.map(() => 'WHEN ? THEN ?').join(' ');
  const placeholders = rows.map(() => '?').join(', ');
  const sql =
    `UPDATE Wifi SET \`groupId\` = CASE \`id\` ${cases} END ` +
    `WHERE \`id\` IN (${placeholders})`;

  const params: unknown[] = [];
  for (const r of rows) {
    params.push(r.id, buildWifiGroupId(r));
  }
  for (const r of rows) {
    params.push(r.id);
  }
  return { sql, params };
}

function parseArg(flag: string, fallback: number): number {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

export async function backfillWifiGroupId(): Promise<{ scanned: number; updated: number }> {
  const batchSize = parseArg('--batch', 1000);
  const dryRun = process.argv.includes('--dry-run');

  let scanned = 0;
  let updated = 0;
  let cursor: string | undefined;

  // id 커서 페이지네이션 — OFFSET 은 뒤로 갈수록 느려지고, 그 사이 sync 가
  // 행을 넣으면 건너뛰는 행이 생긴다.
  for (;;) {
    const rows = await prisma.wifi.findMany({
      select: { id: true, name: true, city: true, district: true, address: true },
      orderBy: { id: 'asc' },
      take: batchSize,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (rows.length === 0) break;

    scanned += rows.length;
    cursor = rows[rows.length - 1].id;

    const stmt = buildGroupIdUpdateSql(rows);
    if (stmt && !dryRun) {
      updated += await prisma.$executeRawUnsafe(stmt.sql, ...stmt.params);
    }

    console.log(`  ${scanned} 행 처리 (마지막 id ${cursor})`);
  }

  return { scanned, updated };
}

// 직접 실행될 때만 구동 (import 시에는 부작용 없음)
if (import.meta.url === `file://${process.argv[1]}`) {
  backfillWifiGroupId()
    .then(({ scanned, updated }) => {
      console.log(`완료: ${scanned} 행 스캔, ${updated} 행 갱신`);
      return prisma.$disconnect();
    })
    .catch(async (e) => {
      console.error('백필 실패:', e);
      await prisma.$disconnect();
      process.exit(1);
    });
}
