import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, type RealEstateType } from './realEstateService.js';

const SALE_TYPES = new Set(['apt-sale', 'villa-sale', 'offitel-sale']);
// buildYear 컬럼이 없는 타입
const NO_BUILD_YEAR_TYPES = new Set<string>();

// 배치 간 짧은 sleep — 백엔드 쿼리가 MySQL에 들어갈 틈을 준다.
// 총 부하: 시·도 약 17 × 타입 6 × 50ms ≈ 5초. cron 15분 예산 대비 무시 가능.
const BATCH_PAUSE_MS = 50;

// 배치당 Prisma 트랜잭션 타임아웃. 서울(수십만 건) 여유 감안 60초.
const BATCH_TX_TIMEOUT_MS = 60_000;

// InnoDB 락 대기 한도(초). 경합이 오래 가지 않도록 짧게 두어 실패 시 다음 city로 바로 넘어감.
const LOCK_WAIT_TIMEOUT_SEC = 15;

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
               latestPrice, latestDealYear, latestDealMonth, buildYear, lat, lng,
               transactionCount, updatedAt)
            SELECT
              ? AS type,
              buildingName, bjdCode, city, district, dongName,
              ${priceField} AS latestPrice,
              dealYear AS latestDealYear, dealMonth AS latestDealMonth,
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
