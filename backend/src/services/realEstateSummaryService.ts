import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);
// buildYear 컬럼이 없는 타입
const NO_BUILD_YEAR_TYPES = new Set<string>();

// 배치 간 짧은 sleep — 백엔드 쿼리가 MySQL에 들어갈 틈을 준다.
// 총 부하: 시·도 약 17 × 타입 6 × 50ms ≈ 5초. cron 15분 예산 대비 무시 가능.
const BATCH_PAUSE_MS = 50;

// 배치당 Prisma 트랜잭션 타임아웃. inner 서브쿼리에 윈도우 함수 4개
// (ROW_NUMBER + COUNT + MAX(lat) + MAX(lng))를 평가하므로 거래량 많은 시·도
// (apt-rent 경기 등)는 60초를 넘겨 P2028로 실패하던 사례 → 5분으로 상향.
const BATCH_TX_TIMEOUT_MS = 300_000;

// InnoDB 락 대기 한도(초). 경합이 오래 가지 않도록 짧게 두어 실패 시 다음 city로 바로 넘어감.
const LOCK_WAIT_TIMEOUT_SEC = 15;

/**
 * 전월세 요약 행의 전세/월세 분리 컬럼을 채우는 UPDATE.
 *
 * 왜 INSERT 에 통합하지 않는가: 통합하면 `SELECT *` 가 윈도우 두 겹을 통과해 넓은 행
 * 집합을 두 번 실체화한다. 로컬 운영 스냅샷 실측(경기 apt-rent 67,477행) —
 * 현행 INSERT 3.13s / 통합 8.87s(2.8배) / 이 경량 UPDATE 0.58s. 결과 건수는 셋 다 6,218 로 동일.
 * 배치당 증가분이 2.8배가 아니라 약 18% 로 줄고, 문장이 짧게 둘로 나뉘어 락 점유 시간도
 * 통합안보다 짧다. 2026-04-18 에 단일 INSERT 가 버퍼풀을 10분 점유해 사이트를
 * 무한로딩시킨 이력이 있는 함수라 기존 INSERT 는 그대로 둔다.
 *
 * rn=1 로 rentType 별 최신 1건을 고른 뒤 MAX(CASE ...) 로 건물당 한 행에 접는다.
 * 여기서 MAX 는 크기 비교가 아니라 그룹당 후보가 1개뿐인 상태에서의 접기 용도다.
 */
function buildRentSplitUpdate(table: string): string {
  return `UPDATE RealEstateBuildingSummary s
    JOIN (
      SELECT buildingName, bjdCode,
        MAX(CASE WHEN rentType = '전세' THEN deposit END)     AS jDeposit,
        MAX(CASE WHEN rentType = '전세' THEN dealKey END)     AS jDealKey,
        MAX(CASE WHEN rentType = '월세' THEN deposit END)     AS wDeposit,
        MAX(CASE WHEN rentType = '월세' THEN monthlyRent END) AS wMonthly,
        MAX(CASE WHEN rentType = '월세' THEN dealKey END)     AS wDealKey
      FROM (
        SELECT buildingName, bjdCode, rentType, deposit, monthlyRent,
          dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1) AS dealKey,
          ROW_NUMBER() OVER (
            PARTITION BY buildingName, bjdCode, rentType
            ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC
          ) AS rn
        FROM ${table}
        WHERE city = ?
      ) ranked
      WHERE rn = 1
      GROUP BY buildingName, bjdCode
    ) t ON t.buildingName = s.buildingName AND t.bjdCode = s.bjdCode
    SET s.jeonseDeposit    = t.jDeposit,
        s.jeonseDealKey    = t.jDealKey,
        s.wolseDeposit     = t.wDeposit,
        s.wolseMonthlyRent = t.wMonthly,
        s.wolseDealKey     = t.wDealKey
    WHERE s.type = ? AND s.city = ?`;
}

/**
 * 특정 타입의 Summary 테이블을 **시·도 단위 청크**로 재생성.
 *
 * 2026-04-18 사고: 단일 `INSERT INTO RealEstateBuildingSummary ... SELECT`가
 * 전체 트랜잭션 테이블을 스캔하며 10분 넘게 버퍼풀/락을 점유 → 백엔드 Prisma 풀이
 * 전원 대기 → 사이트 무한로딩. MySQL `MAX_EXECUTION_TIME`은 DML에는 효과 없음.
 *
 * 해법: 소스 테이블의 `city` 별로 DELETE+INSERT를 분할. 각 city 배치는 자체
 * `$transaction` + `innodb_lock_wait_timeout` 세션 설정으로 감쌈. 배치 사이
 * 짧은 sleep으로 다른 트랜잭션이 끼어들 공간을 보장.
 *
 * bjdCode(10자리 법정동 코드)는 시·도를 넘지 않으므로 window function의
 * `PARTITION BY buildingName, bjdCode` 은 city 단위로 분할해도 결과 동일.
 */
export async function refreshSummary(type: string): Promise<number> {
  const table = TABLE_NAME_MAP[type];
  if (!table) throw new Error(`Unknown real estate type: ${type}`);

  const priceField = SALE_TYPES.has(type) ? 'dealAmount' : 'deposit';
  const buildYearCol = NO_BUILD_YEAR_TYPES.has(type) ? 'NULL' : 'buildYear';
  // 매매 테이블에는 monthlyRent 컬럼 자체가 없다. 전월세만 실제 컬럼을 읽는다.
  const monthlyRentCol = SALE_TYPES.has(type) ? 'NULL' : 'monthlyRent';

  // 해당 타입 소스 테이블에 존재하는 city 나열
  const rows = await prisma.$queryRawUnsafe<Array<{ city: string | null }>>(
    `SELECT DISTINCT city FROM ${table} WHERE city IS NOT NULL AND city != ''`,
  );
  const cities = rows
    .map((r) => r.city)
    .filter((c): c is string => typeof c === 'string' && c.length > 0);

  let total = 0;
  for (const city of cities) {
    try {
      const inserted = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(
            `SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SEC}`,
          );
          await tx.$executeRawUnsafe(
            `DELETE FROM RealEstateBuildingSummary WHERE type = ? AND city = ?`,
            type,
            city,
          );
          const n = await tx.$executeRawUnsafe(
            `INSERT INTO RealEstateBuildingSummary
              (type, buildingName, bjdCode, city, district, dongName,
               latestPrice, monthlyRent,
               latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng,
               transactionCount, updatedAt)
            SELECT
              ? AS type,
              buildingName, bjdCode, city, district, dongName,
              ${priceField} AS latestPrice,
              ${monthlyRentCol} AS monthlyRent,
              dealYear AS latestDealYear, dealMonth AS latestDealMonth, dealDay AS latestDealDay,
              ${buildYearCol} AS buildYear,
              _maxLat AS lat,
              _maxLng AS lng,
              _txCount AS transactionCount,
              NOW()
            -- 윈도우 함수는 inner 서브쿼리에서 평가되어야 함.
            -- WHERE _rn = 1 이 outer에 있으므로, COUNT/MAX OVER 를 outer로 옮기면
            -- 파티션당 1행만 남은 상태에서 집계되어 transactionCount가 항상 1이 된다.
            FROM (
              SELECT *,
                ROW_NUMBER() OVER (
                  PARTITION BY buildingName, bjdCode
                  ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC
                ) AS _rn,
                COUNT(*) OVER (PARTITION BY buildingName, bjdCode) AS _txCount,
                MAX(lat) OVER (PARTITION BY buildingName, bjdCode) AS _maxLat,
                MAX(lng) OVER (PARTITION BY buildingName, bjdCode) AS _maxLng
              FROM ${table}
              WHERE city = ?
            ) ranked
            WHERE _rn = 1`,
            type,
            city,
          );
          return Number(n) || 0;
        },
        { timeout: BATCH_TX_TIMEOUT_MS },
      );
      total += inserted;

      // 전세/월세 분리 컬럼 UPDATE는 위 DELETE+INSERT와 별도 트랜잭션으로 분리한다.
      // 같은 트랜잭션에 묶으면 이 UPDATE가 실패(락 대기 타임아웃 등)할 때 이미 성공한
      // DELETE+INSERT까지 롤백돼 해당 시·도의 latestPrice/latestDealDay/transactionCount가
      // 갱신되지 않는다 — sitemap lastmod, 인근 단지, 건물 목록, 검색 자동완성이 전부
      // 이 레거시 컬럼만 읽으므로 기본 갱신은 분리 UPDATE의 성패와 무관하게 항상
      // 커밋되어야 한다. 매매 테이블에는 rentType 컬럼 자체가 없어 건너뛴다.
      if (!SALE_TYPES.has(type)) {
        try {
          await prisma.$transaction(
            async (tx) => {
              await tx.$executeRawUnsafe(
                `SET SESSION innodb_lock_wait_timeout = ${LOCK_WAIT_TIMEOUT_SEC}`,
              );
              await tx.$executeRawUnsafe(buildRentSplitUpdate(table), city, type, city);
            },
            { timeout: BATCH_TX_TIMEOUT_MS },
          );
        } catch (err) {
          // 분리 UPDATE 실패는 새 컬럼(jeonseDeposit 등)만 갱신 안 된 채로 남긴다 —
          // 기본 갱신은 이미 위에서 커밋됐으므로 여기서 city 루프를 멈추지 않는다.
          console.error(`[Summary] ${type}/${city} 전월세 분리 UPDATE 실패:`, err);
        }
      }
    } catch (err) {
      // 한 city 배치가 실패해도 나머지 city는 계속 — 치명적 장애가 여러 시·도로
      // 퍼지는 것을 차단. 실패 로그로 원인 추적.
      console.error(`[Summary] ${type}/${city} 실패:`, err);
    }
    await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
  }

  return total;
}

/**
 * 모든 타입의 Summary 갱신. 한 타입이 실패해도 다음 타입으로 계속 진행.
 */
export async function refreshAllSummaries(): Promise<void> {
  const types = Object.keys(TABLE_NAME_MAP) as RealEstateType[];
  for (const type of types) {
    const start = Date.now();
    try {
      const count = await refreshSummary(type);
      console.info(`[Summary] ${type}: ${count} buildings refreshed (${Date.now() - start}ms)`);
    } catch (err) {
      console.error(`[Summary] ${type} 실패 (${Date.now() - start}ms):`, err);
    }
  }
}
