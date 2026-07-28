/**
 * 부동산 정규화 Phase 1 — *Property 파생 테이블 백필.
 *
 * 거래 테이블(읽기 전용으로만 접근)에서 건물 단위 행을 뽑아
 * AptProperty / VillaProperty / OffitelProperty 를 채운다.
 * 거래 테이블은 수정하지 않으므로 롤백은 파생 테이블 3개를 비우는 것으로 끝난다.
 *
 * 안전장치 (2026-04 MySQL 좀비 사고 교훈):
 *  - 긴 트랜잭션을 만들지 않는다. 시군구(bjdCode 앞 5자리) 단위로 쪼갠 오토커밋 문장만 실행.
 *  - 문장마다 MAX_EXECUTION_TIME 힌트로 상한을 건다.
 *  - 청크 사이에 짧은 유휴를 둬 다른 쿼리가 끼어들 틈을 준다.
 *
 * 멱등성: attrDealKey 비교로 "가장 최근 거래의 속성" 이 이기게 하므로
 * 실행 순서·재실행과 무관하게 같은 결과가 나온다.
 *
 * 사용:
 *   node dist/scripts/backfillProperty.js              # 전체
 *   node dist/scripts/backfillProperty.js --type apt   # 종류 한정
 *   node dist/scripts/backfillProperty.js --verify     # 백필 없이 URL 집합만 대조
 */
import { prisma } from '../lib/prisma.js';

/**
 * 색인(사이트맵) 대상 건물명 조건.
 * 현재 사이트맵 쿼리(sitemapService.getRealEstateBuildings) 및 프론트
 * isValidBuildingName 과 반드시 동일해야 한다.
 *
 * ⚠️ 이건 백필의 WHERE 가 아니라 isIndexable 을 계산하는 식이다.
 * Property 에는 조건에 맞지 않는 건물도 전부 넣는다 — Phase 3 에서 거래가 propertyId 로
 * 붙어야 하는데, 여기서 걸러내면 30,552개 건물 / 144,823개 거래가 고아가 된다
 * (빌라 전월세는 12%가 제외 대상).
 */
export const INDEXABLE_EXPR = `(
  buildingName IS NOT NULL
  AND buildingName != ''
  AND CHAR_LENGTH(buildingName) >= 2
  AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
  AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
)`;

/** 건물 키를 만들 수 없는 행만 제외한다(이름 자체가 없는 경우). */
const BACKFILL_GUARD = `buildingName IS NOT NULL AND buildingName != ''`;

const DEAL_KEY = 'dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)';

/** 문장 상한 (ms). 청크 하나가 이보다 오래 걸리면 MySQL 이 끊는다. */
const STATEMENT_TIMEOUT_MS = 120_000;
/** 청크 사이 유휴 — 다른 쿼리에 숨 쉴 틈을 준다. */
const CHUNK_PAUSE_MS = 50;
/** bjdCode 앞 N 자리로 청크를 나눈다. 5 = 시군구. 건물 그룹은 bjdCode 를 공유하므로 그룹이 쪼개지지 않는다. */
const CHUNK_PREFIX_LEN = 5;

interface TypeConfig {
  /** URL 슬러그의 접두 (apt | villa | offitel) */
  slug: string;
  propertyTable: string;
  saleTable: string;
  rentTable: string;
}

/** 테이블명은 파라미터 바인딩이 불가하므로 신뢰 가능한 리터럴만 쓴다. */
const TYPES: Record<string, TypeConfig> = {
  apt: {
    slug: 'apt',
    propertyTable: 'AptProperty',
    saleTable: 'AptSaleTransaction',
    rentTable: 'AptRentTransaction',
  },
  villa: {
    slug: 'villa',
    propertyTable: 'VillaProperty',
    saleTable: 'VillaSaleTransaction',
    rentTable: 'VillaRentTransaction',
  },
  offitel: {
    slug: 'offitel',
    propertyTable: 'OffitelProperty',
    saleTable: 'OffitelSaleTransaction',
    rentTable: 'OffitelRentTransaction',
  },
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 해당 거래 테이블에 존재하는 시군구 코드 목록. */
async function listChunks(sourceTable: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ p: string }>>(
    `SELECT DISTINCT LEFT(bjdCode, ${CHUNK_PREFIX_LEN}) AS p
     FROM \`${sourceTable}\`
     WHERE ${BACKFILL_GUARD}
     ORDER BY p`
  );
  return rows.map((r) => r.p).filter(Boolean);
}

/**
 * 거래 테이블 한 청크를 Property 로 upsert.
 *
 * 대표값 규칙: 그룹 내에서 가장 최근 거래(dealYear/Month/Day, 동률이면 id) 행의 속성을 쓴다.
 * ON DUPLICATE KEY UPDATE 에서 attrDealKey 를 비교해, 이미 더 최근 거래로 채워진 속성은
 * 덮어쓰지 않는다. attrDealKey 갱신은 그 비교들 뒤에 와야 한다(좌→우 평가).
 */
async function upsertChunk(
  cfg: TypeConfig,
  sourceTable: string,
  kind: 'sale' | 'rent',
  prefix: string
): Promise<number> {
  const lastKeyCol = kind === 'sale' ? 'lastSaleDealKey' : 'lastRentDealKey';
  const countCol = kind === 'sale' ? 'saleCount' : 'rentCount';
  // ON DUPLICATE KEY UPDATE 안에서 맨 컬럼명은 SELECT 서브쿼리의 동명 컬럼과 모호해진다.
  // 대상 테이블을 명시해 대상 행의 기존 값임을 분명히 한다.
  const p = `\`${cfg.propertyTable}\``;
  const prev = `COALESCE(${p}.attrDealKey, -1)`;

  const sql = `
    INSERT /*+ MAX_EXECUTION_TIME(${STATEMENT_TIMEOUT_MS}) */ INTO \`${cfg.propertyTable}\`
      (bjdCode, buildingName, city, district, roadName, dongName, jibun, buildYear, lat, lng,
       isIndexable, attrDealKey, \`${lastKeyCol}\`, \`${countCol}\`, createdAt, updatedAt)
    SELECT bjdCode, buildingName, city, district, roadName, dongName, jibun, buildYear, lat, lng,
           indexable, dealKey, dealKey, cnt, NOW(3), NOW(3)
    FROM (
      SELECT bjdCode, buildingName, city, district, roadName, dongName, jibun, buildYear, lat, lng,
             ${INDEXABLE_EXPR} AS indexable,
             ROW_NUMBER() OVER (
               PARTITION BY bjdCode, buildingName
               ORDER BY dealYear DESC, dealMonth DESC, COALESCE(dealDay, 1) DESC, id DESC
             ) AS rn,
             MAX(${DEAL_KEY}) OVER (PARTITION BY bjdCode, buildingName) AS dealKey,
             COUNT(*)         OVER (PARTITION BY bjdCode, buildingName) AS cnt
      FROM \`${sourceTable}\`
      WHERE ${BACKFILL_GUARD}
        AND LEFT(bjdCode, ${CHUNK_PREFIX_LEN}) = ?
    ) x
    WHERE rn = 1
    ON DUPLICATE KEY UPDATE
      city        = VALUES(city),
      district    = VALUES(district),
      isIndexable = VALUES(isIndexable),
      roadName  = IF(VALUES(attrDealKey) >= ${prev}, VALUES(roadName),  ${p}.roadName),
      dongName  = IF(VALUES(attrDealKey) >= ${prev}, VALUES(dongName),  ${p}.dongName),
      jibun     = IF(VALUES(attrDealKey) >= ${prev}, VALUES(jibun),     ${p}.jibun),
      buildYear = IF(VALUES(attrDealKey) >= ${prev}, VALUES(buildYear), ${p}.buildYear),
      lat       = IF(VALUES(attrDealKey) >= ${prev}, VALUES(lat),       ${p}.lat),
      lng       = IF(VALUES(attrDealKey) >= ${prev}, VALUES(lng),       ${p}.lng),
      attrDealKey = GREATEST(${prev}, VALUES(attrDealKey)),
      \`${lastKeyCol}\` = VALUES(\`${lastKeyCol}\`),
      \`${countCol}\`   = VALUES(\`${countCol}\`),
      updatedAt = NOW(3)
  `;

  return prisma.$executeRawUnsafe(sql, prefix);
}

async function backfillType(cfg: TypeConfig): Promise<void> {
  for (const [kind, sourceTable] of [
    ['sale', cfg.saleTable],
    ['rent', cfg.rentTable],
  ] as const) {
    const chunks = await listChunks(sourceTable);
    console.log(`[backfillProperty] ${sourceTable} → ${cfg.propertyTable}: 청크 ${chunks.length}개`);

    let done = 0;
    for (const prefix of chunks) {
      const affected = await upsertChunk(cfg, sourceTable, kind, prefix);
      done += 1;
      if (done % 25 === 0 || done === chunks.length) {
        console.log(`[backfillProperty]   ${sourceTable} ${done}/${chunks.length} (마지막 청크 ${prefix}: ${affected}행)`);
      }
      await sleep(CHUNK_PAUSE_MS);
    }
  }
}

/**
 * 현재 사이트맵 쿼리가 만드는 URL 집합과 Property 가 만들 URL 집합을 대조한다.
 * 차이가 0 이어야 Phase 2(사이트맵 전환)로 넘어갈 수 있다.
 */
async function verify(targets: TypeConfig[]): Promise<boolean> {
  let ok = true;
  for (const cfg of targets) {
    for (const [kind, sourceTable] of [
      ['sale', cfg.saleTable],
      ['rent', cfg.rentTable],
    ] as const) {
      const keyCol = kind === 'sale' ? 'lastSaleDealKey' : 'lastRentDealKey';
      const [current] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        // 현재 사이트맵 쿼리가 만드는 URL 수를 그대로 재현한다.
        `SELECT COUNT(*) AS n FROM (
           SELECT city, district, buildingName FROM \`${sourceTable}\`
           WHERE ${INDEXABLE_EXPR} GROUP BY city, district, buildingName
         ) t`
      );
      const [next] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
        // Phase 2 의 사이트맵 쿼리와 같은 조건 — 색인 대상이면서 그 유형의 거래가 있는 건물.
        `SELECT COUNT(*) AS n FROM \`${cfg.propertyTable}\`
         WHERE isIndexable = 1 AND \`${keyCol}\` IS NOT NULL`
      );
      const a = Number(current.n);
      const b = Number(next.n);
      const mark = a === b ? '일치' : `★불일치 (차이 ${b - a})`;
      if (a !== b) ok = false;
      console.log(`[verify] ${cfg.slug}-${kind}: 현재 ${a} / Property ${b} — ${mark}`);
    }
  }
  return ok;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const typeArg = args.includes('--type') ? args[args.indexOf('--type') + 1] : undefined;
  const verifyOnly = args.includes('--verify');

  if (typeArg && !TYPES[typeArg]) {
    throw new Error(`알 수 없는 --type: ${typeArg} (apt | villa | offitel)`);
  }
  const targets = typeArg ? [TYPES[typeArg]] : Object.values(TYPES);

  if (!verifyOnly) {
    const started = Date.now();
    for (const cfg of targets) await backfillType(cfg);
    console.log(`[backfillProperty] 백필 완료 (${Math.round((Date.now() - started) / 1000)}초)`);
  }

  // 검증도 --type 범위를 따른다. 부분 백필 중에 아직 비어 있는 종류까지 실패로 잡지 않는다.
  const ok = await verify(targets);
  if (!ok) {
    console.error('[backfillProperty] URL 집합이 일치하지 않는다 — Phase 2 로 넘어가면 안 된다.');
    process.exitCode = 1;
  }
}

// CLI 로 직접 실행할 때만 돈다. 테스트가 INDEXABLE_EXPR 을 import 해도 백필이 실행되지 않도록.
const isMain =
  process.argv[1] !== undefined &&
  /backfillProperty\.(js|ts)$/.test(process.argv[1]);

if (isMain) {
  main()
    .catch((err) => {
      console.error('[backfillProperty] 실패:', err?.message || err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
