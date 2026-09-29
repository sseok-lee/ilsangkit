import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { refreshAddressSummaries } from '../../src/services/realEstateSummaryService.js';
import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';

const databaseUrl = assertLocalTestDatabaseUrl(process.env.HOUSING_TEST_DATABASE_URL);
const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
const mysqlPassword = decodeURIComponent(parsedUrl.password);
const mysqlUser = decodeURIComponent(parsedUrl.username);
const mysqlBaseArgs = [
  'docker',
  'exec',
  '-i',
  '-e',
  `MYSQL_PWD=${mysqlPassword}`,
  'ilsangkit-mysql',
  'mysql',
  '--default-character-set=utf8mb4',
  '-u',
  mysqlUser,
];
const mysqlEnv = { ...process.env, MYSQL_PWD: mysqlPassword };
const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
let lockDir: string;

function mysql(args: string[], input?: string): string {
  return execFileSync(args[0], args.slice(1), {
    env: mysqlEnv,
    input,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function mysqlInDatabase(sql: string): string {
  return mysql([...mysqlBaseArgs, databaseName], sql);
}

function resetDatabase(): void {
  mysql(mysqlBaseArgs, `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  mysqlInDatabase(`
    SET FOREIGN_KEY_CHECKS = 0;
    DROP TRIGGER IF EXISTS fail_seoul_v2_update;
    DROP TABLE IF EXISTS AptRentTransaction;
    DROP TABLE IF EXISTS RealEstateSummaryState;
    DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
    SET FOREIGN_KEY_CHECKS = 1;
  `);
  mysqlInDatabase(readFileSync(resolve('prisma/sql/20260929_summary_v2.sql'), 'utf8'));
  mysqlInDatabase(`
    CREATE TABLE AptRentTransaction (
      id INT NOT NULL AUTO_INCREMENT,
      deposit INT NULL,
      monthlyRent INT NULL,
      buildYear INT NULL,
      dealYear INT NOT NULL,
      dealMonth INT NOT NULL,
      dealDay INT NULL,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      jibun VARCHAR(20) NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      rentType VARCHAR(10) NOT NULL,
      PRIMARY KEY (id),
      KEY apt_rent_city_idx (city),
      KEY apt_rent_summary_idx (buildingName, bjdCode, dongName, jibun, rentType, dealYear, dealMonth, dealDay, id)
    );

    INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
    VALUES (1, 'ready', 'ready-before-refresh', REPEAT('a', 64), JSON_OBJECT('before', TRUE), '2026-09-29 00:00:00.000');

    INSERT INTO AptRentTransaction
      (deposit, monthlyRent, buildYear, dealYear, dealMonth, dealDay, city, district, dongName, buildingName, bjdCode, jibun, lat, lng, rentType)
    VALUES
      (50000, 0, 2001, 2026, 9, 1, '서울특별시', '강남구', '역삼동', '서울롤백아파트', '1168010100', '1-1', 37.1111111, 127.1111111, '전세'),
      (10000, 90, 2001, 2026, 9, 2, '서울특별시', '강남구', '역삼동', '서울롤백아파트', '1168010100', '1-1', 37.1111111, 127.1111111, '월세'),
      (60000, 0, 2002, 2026, 9, 2, '경기도', '성남시', '삼평동', '경기완료아파트', '4113510900', '2-2', 37.2222222, 127.2222222, '전세'),
      (12000, 110, 2002, 2026, 9, 2, '경기도', '성남시', '삼평동', '경기완료아파트', '4113510900', '2-2', 37.2222222, 127.2222222, '월세'),
      (65000, 0, 2002, 2026, 9, 2, '경기도', '성남시', '삼평동', '경기완료아파트', '4113510900', '2-2', 37.2222222, 127.2222222, '전세'),
      (13000, 130, 2002, 2026, 9, 2, '경기도', '성남시', '삼평동', '경기완료아파트', '4113510900', '2-2', 37.2222222, 127.2222222, '월세');

    INSERT INTO RealEstateBuildingSummaryV2
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('apt-rent', REPEAT('b', 64), '부산스테일아파트', '2611010100', '부산광역시', '중구', '중앙동', '3-3', 70000, 2026, 8, 31, 2003, 35.1111111, 129.1111111, 9);
  `);
  mysqlInDatabase(`
    DELIMITER //
    CREATE TRIGGER fail_seoul_v2_update
    BEFORE UPDATE ON RealEstateBuildingSummaryV2
    FOR EACH ROW
    BEGIN
      IF NEW.city = '서울특별시' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'forced seoul rollback';
      END IF;
    END//
    DELIMITER ;
  `);
}

async function readCountTimed(): Promise<number> {
  const start = performance.now();
  await prisma.$queryRawUnsafe<Array<{ count: bigint }>>('SELECT COUNT(*) AS count FROM RealEstateBuildingSummaryV2');
  return performance.now() - start;
}

describe('summary refresh V2 integration', () => {
  beforeAll(async () => {
    resetDatabase();
  });

  beforeEach(() => {
    lockDir = mkdtempSync(join(tmpdir(), 'summary-refresh-lock-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
  });

  afterAll(async () => {
    delete process.env.REAL_ESTATE_WRITE_LOCK_DIR;
    delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
    if (lockDir) rmSync(lockDir, { recursive: true, force: true });
    await prisma.$disconnect();
  });

  it('rolls back only the failed city batch, keeps ready state untouched, and allows reads under load', async () => {
    const readTimings: number[] = [];
    const refreshStartedAt = performance.now();
    const refreshPromise = refreshAddressSummaries(['apt-rent']);
    const readPromise = (async () => {
      for (let i = 0; i < 25; i += 1) {
        readTimings.push(await readCountTimed());
      }
    })();

    const [result] = await Promise.all([refreshPromise, readPromise]);
    const refreshMs = performance.now() - refreshStartedAt;

    expect(result.complete).toBe(false);
    expect(result.batches).toHaveLength(3);
    expect(result.batches).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'apt-rent', city: '서울특별시', status: 'failed', rowCount: 0, error: expect.stringContaining('forced seoul rollback') }),
      expect.objectContaining({ type: 'apt-rent', city: '경기도', status: 'complete', rowCount: 1 }),
      expect.objectContaining({ type: 'apt-rent', city: '부산광역시', status: 'complete', rowCount: 0 }),
    ]));

    const rows = await prisma.$queryRawUnsafe<Array<{ city: string; buildingName: string; jeonseDeposit: number | null; wolseMonthlyRent: number | null }>>(
      `SELECT city, buildingName, jeonseDeposit, wolseMonthlyRent
       FROM RealEstateBuildingSummaryV2
       ORDER BY city, buildingName`,
    );
    expect(rows).toEqual([
      { city: '경기도', buildingName: '경기완료아파트', jeonseDeposit: 65000, wolseMonthlyRent: 130 },
    ]);

    const stateRows = await prisma.$queryRawUnsafe<Array<{ status: string; runId: string; sourceFingerprint: string; reportText: string }>>(
      `SELECT status, runId, sourceFingerprint, JSON_UNQUOTE(JSON_EXTRACT(report, '$.before')) AS reportText
       FROM RealEstateSummaryState
       WHERE id = 1`,
    );
    expect(stateRows[0]).toEqual({ status: 'ready', runId: 'ready-before-refresh', sourceFingerprint: 'a'.repeat(64), reportText: 'true' });

    const maxReadMs = Math.max(...readTimings);
    const avgReadMs = readTimings.reduce((sum, value) => sum + value, 0) / readTimings.length;
    console.info(`[summaryRefresh.integration] rollbackMs=${refreshMs.toFixed(1)} readSamples=${readTimings.length} maxReadMs=${maxReadMs.toFixed(1)} avgReadMs=${avgReadMs.toFixed(1)}`);
    expect(maxReadMs).toBeLessThan(1000);
  });
});
