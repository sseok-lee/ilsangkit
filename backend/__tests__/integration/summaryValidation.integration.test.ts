import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { setSummaryValidationTestHookForTests, validateAddressSummary } from '../../src/services/realEstateSummaryValidation.js';
import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';

const dedicatedUrl = assertLocalTestDatabaseUrl(
  process.env.SUMMARY_VALIDATION_TEST_DATABASE_URL
    ?? 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_summary_validation_20260929_test?connection_limit=5&pool_timeout=10',
);
const parsedUrl = new URL(dedicatedUrl);
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
const prisma = new PrismaClient({ datasources: { db: { url: dedicatedUrl } } });
let lockDir = '';
let reportDir = '';

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
    DROP TABLE IF EXISTS AptSaleTransaction;
    DROP TABLE IF EXISTS AptRentTransaction;
    DROP TABLE IF EXISTS VillaSaleTransaction;
    DROP TABLE IF EXISTS VillaRentTransaction;
    DROP TABLE IF EXISTS OffitelSaleTransaction;
    DROP TABLE IF EXISTS OffitelRentTransaction;
    DROP TABLE IF EXISTS RealEstateSummaryState;
    DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
    DROP TABLE IF EXISTS RealEstateBuildingSummary;
    SET FOREIGN_KEY_CHECKS = 1;
  `);
  mysqlInDatabase(readFileSync(resolve('prisma/sql/20260929_summary_v2.sql'), 'utf8'));
  mysqlInDatabase(`
    CREATE TABLE RealEstateBuildingSummary (
      id INT NOT NULL AUTO_INCREMENT,
      type VARCHAR(20) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      jibun VARCHAR(20) NULL,
      latestPrice BIGINT NULL,
      latestDealYear INT NULL,
      latestDealMonth INT NULL,
      latestDealDay INT NULL,
      buildYear INT NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      transactionCount INT NOT NULL DEFAULT 0,
      monthlyRent INT NULL,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id)
    );
  `);
}

function createSourceTables(): void {
  mysqlInDatabase(`
    CREATE TABLE AptSaleTransaction (
      id INT NOT NULL AUTO_INCREMENT,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      buildYear INT NULL,
      jibun VARCHAR(20) NULL,
      roadName VARCHAR(100) NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      dealYear INT NOT NULL,
      dealMonth INT NOT NULL,
      dealDay INT NULL,
      dealAmount BIGINT NOT NULL,
      sourceId VARCHAR(100) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY sourceId_unique (sourceId),
      KEY city_idx (city)
    );
    CREATE TABLE VillaSaleTransaction LIKE AptSaleTransaction;
    CREATE TABLE OffitelSaleTransaction LIKE AptSaleTransaction;
    CREATE TABLE AptRentTransaction (
      id INT NOT NULL AUTO_INCREMENT,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      buildYear INT NULL,
      jibun VARCHAR(20) NULL,
      roadName VARCHAR(100) NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      dealYear INT NOT NULL,
      dealMonth INT NOT NULL,
      dealDay INT NULL,
      rentType VARCHAR(10) NOT NULL,
      deposit BIGINT NOT NULL,
      monthlyRent INT NULL,
      sourceId VARCHAR(100) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY sourceId_unique (sourceId),
      KEY city_idx (city)
    );
    CREATE TABLE VillaRentTransaction LIKE AptRentTransaction;
    CREATE TABLE OffitelRentTransaction LIKE AptRentTransaction;
  `);
}

function seedSources(): void {
  mysqlInDatabase(`
    INSERT INTO RealEstateBuildingSummary
      (type, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount, monthlyRent)
    VALUES
      ('apt-sale', 'legacy-without-key', '1168010100', '서울특별시', '강남구', '역삼동', NULL, 1, 2020, 1, 1, 1999, NULL, NULL, 1, NULL);

    INSERT INTO AptSaleTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, dealAmount, sourceId)
    VALUES
      ('서울특별시', '강남구', '1168010100', '역삼동', '동명아파트', 2001, '1-1', '테헤란로1', 37.5000000, 127.0000000, 2026, 9, 1, 100000, 'apt-sale-1'),
      ('서울특별시', '강남구', '1168010100', '역삼동', '동명아파트', 2001, '1-1', '테헤란로1', 37.5000000, 127.0000000, 2026, 9, 1, 110000, 'apt-sale-2'),
      ('서울특별시', '강남구', '1168010200', '삼성동', '동명아파트', 2003, '2-2', '테헤란로2', 37.6000000, 127.1000000, 2026, 8, 31, 90000, 'apt-sale-3');

    INSERT INTO VillaSaleTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, dealAmount, sourceId)
    VALUES
      ('부산광역시', '중구', '2611010100', '중앙동', '빈지번빌라', 1998, NULL, '중앙대로1', 35.1000000, 129.0000000, 2026, 7, 3, 30000, 'villa-sale-1'),
      ('부산광역시', '중구', '2611010100', '중앙동', '빈지번빌라', 1998, '', '중앙대로2', 35.1000000, 129.0000000, 2026, 7, 4, 31000, 'villa-sale-2');

    INSERT INTO OffitelSaleTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, dealAmount, sourceId)
    VALUES
      ('대구광역시', '중구', '2711010100', '동인동', '도로명오피스텔', 2015, '10-1', '국채보상로1', 35.8700000, 128.6000000, 2026, 4, 1, 20000, 'offitel-sale-1'),
      ('대구광역시', '중구', '2711010100', '동인동', '도로명오피스텔', 2015, '10-1', '국채보상로2', 35.8700000, 128.6000000, 2026, 4, 2, 21000, 'offitel-sale-2');

    INSERT INTO AptRentTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, rentType, deposit, monthlyRent, sourceId)
    VALUES
      ('서울특별시', '강남구', '1168010100', '역삼동', '임대아파트', 2008, '3-3', '테헤란로3', 37.5100000, 127.0100000, 2026, 8, 1, '전세', 50000, 0, 'apt-rent-jeonse-old'),
      ('서울특별시', '강남구', '1168010100', '역삼동', '임대아파트', 2008, '3-3', '테헤란로3', 37.5100000, 127.0100000, 2026, 9, 1, '전세', 55000, 0, 'apt-rent-jeonse-new'),
      ('서울특별시', '강남구', '1168010100', '역삼동', '임대아파트', 2008, '3-3', '테헤란로3', 37.5100000, 127.0100000, 2026, 10, 1, '월세', 12000, 120, 'apt-rent-wolse-new');

    INSERT INTO VillaRentTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, rentType, deposit, monthlyRent, sourceId)
    VALUES
      ('광주광역시', '동구', '2911010100', '충장동', '좌표빌라', 2000, '5-5', '충장로1', 35.1500000, NULL, 2026, 6, 15, '월세', 8000, 80, 'villa-rent-lat-only');

    INSERT INTO OffitelRentTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, rentType, deposit, monthlyRent, sourceId)
    VALUES
      ('인천광역시', '연수구', '2818510100', '송도동', '렌트오피스텔', 2020, '7-7', '컨벤시아대로1', 37.3900000, 126.6400000, 2026, 5, 20, '월세', 10000, 100, 'offitel-rent-1');
  `);
}

async function digest(table: string): Promise<string> {
  const projection = table === 'RealEstateBuildingSummary'
    ? "type, buildingName, bjdCode, city, district, dongName, COALESCE(jibun, ''), COALESCE(lat, ''), COALESCE(lng, ''), latestPrice, latestDealYear, latestDealMonth, COALESCE(latestDealDay, '')"
    : "buildingName, bjdCode, city, district, dongName, COALESCE(jibun, ''), COALESCE(lat, ''), COALESCE(lng, ''), dealAmount, dealYear, dealMonth, COALESCE(dealDay, '')";
  const rows = await prisma.$queryRawUnsafe<Array<{ digestValue: string | null }>>(
    `SELECT SHA2(GROUP_CONCAT(row_digest ORDER BY id SEPARATOR '|'), 256) AS digestValue
     FROM (SELECT id, SHA2(CONCAT_WS('|', ${projection}), 256) AS row_digest FROM ${table}) d`,
  );
  return rows[0]?.digestValue ?? '';
}


function runScript(script: string, reportPath: string): { exitCode: number; stdout: string; stderr: string } {
  try {
    const stdout = execFileSync('npm', ['run', script, '--', `--report-out=${reportPath}`], {
      cwd: resolve('.'),
      env: {
        ...process.env,
        PATH: `/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:${process.env.PATH ?? ''}`,
        DATABASE_URL: dedicatedUrl,
        NODE_ENV: 'test',
        REAL_ESTATE_WRITE_LOCK_DIR: lockDir,
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { exitCode: 0, stdout, stderr: '' };
  } catch (error) {
    const err = error as { status?: number; stdout?: string; stderr?: string };
    return { exitCode: err.status ?? 1, stdout: err.stdout ?? '', stderr: err.stderr ?? '' };
  }
}

function readReport(path: string): { runId: string; complete: boolean; sourceFingerprint: string; missingKeys: number; duplicateKeys: number; mismatchedGroups: number; originalChanged: boolean; batches: Array<{ type: string; city: string; status: string; rowCount: number }> } {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function v2RowVersions(): Promise<Array<{ id: number; updatedAt: Date }>> {
  return prisma.$queryRawUnsafe<Array<{ id: number; updatedAt: Date }>>(
    `SELECT id, updatedAt FROM RealEstateBuildingSummaryV2 ORDER BY id`,
  );
}

async function summaryState(): Promise<{ status: string; runId: string; sourceFingerprint: string; reportText: string; validatedAt: Date | null } | undefined> {
  const rows = await prisma.$queryRawUnsafe<Array<{ status: string; runId: string; sourceFingerprint: string; reportText: string; validatedAt: Date | null }>>(
    `SELECT status, runId, sourceFingerprint, CAST(report AS CHAR) AS reportText, validatedAt FROM RealEstateSummaryState WHERE id = 1`,
  );
  return rows[0];
}

describe('summary V2 preparation and validation integration', () => {
  beforeAll(() => {
    resetDatabase();
    createSourceTables();
  });

  beforeEach(() => {
    mysqlInDatabase(`
      DELETE FROM RealEstateSummaryState;
      DELETE FROM RealEstateBuildingSummaryV2;
      DELETE FROM RealEstateBuildingSummary;
      DELETE FROM AptSaleTransaction;
      DELETE FROM AptRentTransaction;
      DELETE FROM VillaSaleTransaction;
      DELETE FROM VillaRentTransaction;
      DELETE FROM OffitelSaleTransaction;
      DELETE FROM OffitelRentTransaction;
    `);
    seedSources();
    lockDir = mkdtempSync(join(tmpdir(), 'summary-validation-lock-'));
    reportDir = mkdtempSync(join(tmpdir(), 'summary-validation-report-'));
    process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
    delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
  });

  afterEach(() => {
    setSummaryValidationTestHookForTests(undefined);
    if (lockDir) rmSync(lockDir, { recursive: true, force: true });
    if (reportDir) rmSync(reportDir, { recursive: true, force: true });
    lockDir = '';
    reportDir = '';
    delete process.env.REAL_ESTATE_WRITE_LOCK_DIR;
    delete process.env.REAL_ESTATE_WRITE_LOCK_TOKEN;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('prepares all six transaction types, preserves source and legacy rows, and verifies ready reruns without rebuilding', async () => {
    const legacyBefore = await digest('RealEstateBuildingSummary');
    const sourceBefore = await digest('AptSaleTransaction');
    const reportPath = join(reportDir, 'prepare.json');

    const prepared = runScript('summary:prepare-v2', reportPath);
    expect(prepared.exitCode).toBe(0);
    const report = readReport(reportPath);
    expect(report.complete).toBe(true);
    expect(report.missingKeys).toBe(0);
    expect(report.duplicateKeys).toBe(0);
    expect(report.mismatchedGroups).toBe(0);
    expect(report.originalChanged).toBe(false);
    expect(new Set(report.batches.map((batch) => batch.type))).toEqual(new Set(['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']));
    expect(report.batches.every((batch) => batch.status === 'complete')).toBe(true);

    const rows = await prisma.$queryRawUnsafe<Array<{ type: string; buildingName: string; city: string; latestPrice: bigint | number | null; monthlyRent: number | null; transactionCount: number; lng: string | null; jeonseDeposit: number | null; jeonseDealKey: number | null; wolseDeposit: number | null; wolseMonthlyRent: number | null; wolseDealKey: number | null }>>(
      `SELECT type, buildingName, city, latestPrice, monthlyRent, transactionCount, CAST(lng AS CHAR) AS lng, jeonseDeposit, jeonseDealKey, wolseDeposit, wolseMonthlyRent, wolseDealKey
       FROM RealEstateBuildingSummaryV2
       ORDER BY type, city, buildingName`,
    );
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'apt-sale', buildingName: '동명아파트', city: '서울특별시', latestPrice: 110000n, transactionCount: 2 }),
      expect.objectContaining({ type: 'apt-sale', buildingName: '동명아파트', city: '서울특별시', latestPrice: 90000n, transactionCount: 1 }),
      expect.objectContaining({ type: 'apt-rent', buildingName: '임대아파트', latestPrice: 12000n, monthlyRent: 120, transactionCount: 3, jeonseDeposit: 55000, jeonseDealKey: 20260901, wolseDeposit: 12000, wolseMonthlyRent: 120, wolseDealKey: 20261001 }),
      expect.objectContaining({ type: 'villa-rent', buildingName: '좌표빌라', lng: null, transactionCount: 1 }),
    ]));

    expect(await digest('RealEstateBuildingSummary')).toBe(legacyBefore);
    expect(await digest('AptSaleTransaction')).toBe(sourceBefore);

    const rowVersionsBefore = await v2RowVersions();
    const secondPath = join(reportDir, 'prepare-second.json');
    const second = runScript('summary:prepare-v2', secondPath);
    expect(second.exitCode).toBe(0);
    const secondReport = readReport(secondPath);
    expect(secondReport.runId).toBe(report.runId);
    const rowVersionsAfter = await v2RowVersions();
    expect(rowVersionsAfter).toEqual(rowVersionsBefore);
  });

  it('blocks ready when validation detects missing rows, bad values, bad coordinates, and changed sources', async () => {
    const preparePath = join(reportDir, 'prepare.json');
    expect(runScript('summary:prepare-v2', preparePath).exitCode).toBe(0);
    const runId = readReport(preparePath).runId;

    await prisma.$executeRawUnsafe(`DELETE FROM RealEstateBuildingSummaryV2 WHERE type = 'offitel-rent'`);
    await prisma.$executeRawUnsafe(`UPDATE RealEstateBuildingSummaryV2 SET latestPrice = latestPrice + 1 WHERE type = 'apt-sale' LIMIT 1`);
    await prisma.$executeRawUnsafe(`UPDATE RealEstateBuildingSummaryV2 SET lat = 1.0000000 WHERE type = 'villa-rent' LIMIT 1`);
    await prisma.$executeRawUnsafe(`UPDATE RealEstateBuildingSummaryV2 SET jeonseDeposit = jeonseDeposit + 1 WHERE type = 'apt-rent' LIMIT 1`);
    await prisma.$executeRawUnsafe(`UPDATE AptSaleTransaction SET dealAmount = dealAmount + 1 WHERE sourceId = 'apt-sale-2'`);
    const rowVersionsAfterTamper = await v2RowVersions();

    const verifyPath = join(reportDir, 'verify-failed.json');
    const verified = runScript('summary:verify-v2', verifyPath);
    expect(verified.exitCode).toBe(4);
    const report = readReport(verifyPath);
    expect(report.runId).toBe(runId);
    expect(report.complete).toBe(false);
    expect(report.originalChanged).toBe(false);
    expect(report.missingKeys).toBeGreaterThan(0);
    expect(report.mismatchedGroups).toBeGreaterThan(0);

    const state = await prisma.$queryRawUnsafe<Array<{ status: string; runId: string }>>(`SELECT status, runId FROM RealEstateSummaryState WHERE id = 1`);
    expect(state[0]).toEqual({ status: 'failed', runId });

    const prepareAgainPath = join(reportDir, 'prepare-after-failed-ready.json');
    const preparedAgain = runScript('summary:prepare-v2', prepareAgainPath);
    expect(preparedAgain.exitCode).toBe(4);
    expect(readReport(prepareAgainPath).runId).toBe(runId);
    expect(await v2RowVersions()).toEqual(rowVersionsAfterTamper);
  });

  it('fails validation for extra stale V2 rows in populated and V2-only cities', async () => {
    const preparePath = join(reportDir, 'prepare.json');
    expect(runScript('summary:prepare-v2', preparePath).exitCode).toBe(0);
    const runId = readReport(preparePath).runId;

    await prisma.$executeRawUnsafe(
      `INSERT INTO RealEstateBuildingSummaryV2
        (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
       VALUES
        ('villa-sale', SHA2('extra-populated-city', 256), '없는빌라', '2611010100', '부산광역시', '중구', '중앙동', '999', 1, 2026, 1, 1, 1999, NULL, NULL, 1),
        ('offitel-sale', SHA2('extra-v2-only-city', 256), '제주스테일', '5011010100', '제주특별자치도', '제주시', '일도동', '1', 1, 2026, 1, 1, 1999, NULL, NULL, 1)`,
    );

    const report = await validateAddressSummary(runId);
    expect(report.complete).toBe(false);
    expect(report.mismatchedGroups).toBeGreaterThanOrEqual(2);
    expect(await summaryState()).toMatchObject({ status: 'failed', runId });
  });

  it('public validate demotes invalid ready state and reports mid-interval source changes', async () => {
    const preparePath = join(reportDir, 'prepare.json');
    expect(runScript('summary:prepare-v2', preparePath).exitCode).toBe(0);
    const runId = readReport(preparePath).runId;

    await prisma.$executeRawUnsafe(`UPDATE RealEstateBuildingSummaryV2 SET wolseMonthlyRent = wolseMonthlyRent + 1 WHERE type = 'apt-rent' LIMIT 1`);
    setSummaryValidationTestHookForTests(async () => {
      await prisma.$executeRawUnsafe(`UPDATE AptSaleTransaction SET dealAmount = dealAmount + 1 WHERE sourceId = 'apt-sale-3'`);
      setSummaryValidationTestHookForTests(undefined);
    });

    const report = await validateAddressSummary(runId);
    expect(report.complete).toBe(false);
    expect(report.originalChanged).toBe(true);
    expect(report.mismatchedGroups).toBeGreaterThan(0);
    expect(await summaryState()).toMatchObject({ status: 'failed', runId });
  });

  it('public validate rejects stale or missing singleton state without mutating current readiness', async () => {
    const preparePath = join(reportDir, 'prepare.json');
    expect(runScript('summary:prepare-v2', preparePath).exitCode).toBe(0);
    const runId = readReport(preparePath).runId;
    const rowVersionsBefore = await v2RowVersions();
    const stateBefore = await summaryState();
    expect(stateBefore).toMatchObject({ status: 'ready', runId });

    const staleReport = await validateAddressSummary('stale-run-id');
    expect(staleReport.complete).toBe(false);
    expect(staleReport.runId).toBe(runId);
    expect(staleReport.mismatchedGroups).toBeGreaterThan(0);
    expect(await summaryState()).toEqual(stateBefore);
    expect(await v2RowVersions()).toEqual(rowVersionsBefore);

    await prisma.$executeRawUnsafe(`DELETE FROM RealEstateSummaryState`);
    const missingReport = await validateAddressSummary('missing-run-id');
    expect(missingReport.complete).toBe(false);
    expect(missingReport.runId).toBe('missing-run-id');
    expect(missingReport.mismatchedGroups).toBeGreaterThan(0);
    expect(await summaryState()).toBeUndefined();
    expect(await v2RowVersions()).toEqual(rowVersionsBefore);
  });

  it('verify rejects missing singleton state without creating summary authority', async () => {
    mysqlInDatabase(`
      DELETE FROM RealEstateSummaryState;
      DELETE FROM RealEstateBuildingSummaryV2;
      DELETE FROM RealEstateBuildingSummary;
      DELETE FROM AptSaleTransaction;
      DELETE FROM AptRentTransaction;
      DELETE FROM VillaSaleTransaction;
      DELETE FROM VillaRentTransaction;
      DELETE FROM OffitelSaleTransaction;
      DELETE FROM OffitelRentTransaction;
    `);
    const reportPath = join(reportDir, 'verify-missing-state.json');

    const verified = runScript('summary:verify-v2', reportPath);
    expect(verified.exitCode).toBe(4);
    const report = readReport(reportPath);
    expect(report.complete).toBe(false);
    expect(report.runId).toBe('missing-state');
    expect(report.mismatchedGroups).toBeGreaterThan(0);
    expect(await summaryState()).toBeUndefined();
  });

  it('recovers an interrupted never-ready preparing state by rebuilding under a new run', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
       VALUES (1, 'preparing', 'interrupted-before-ready', REPEAT('b', 64), CAST(? AS JSON), NULL)`,
      JSON.stringify({ runId: 'interrupted-before-ready', batches: [], lifecycle: { everReady: false } }),
    );

    const reportPath = join(reportDir, 'prepare-after-interrupted.json');
    const prepared = runScript('summary:prepare-v2', reportPath);
    expect(prepared.exitCode).toBe(0);
    const report = readReport(reportPath);
    expect(report.complete).toBe(true);
    expect(report.runId).not.toBe('interrupted-before-ready');
    expect(await summaryState()).toMatchObject({ status: 'ready', runId: report.runId });
  });

  it('does not mark ready when a failed inactive run cannot pass validation', async () => {
    await prisma.$executeRawUnsafe(
      `INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
       VALUES (1, 'failed', 'failed-before-b3', REPEAT('a', 64), CAST(? AS JSON), NULL)`,
      JSON.stringify({ runId: 'failed-before-b3', batches: [] }),
    );
    await prisma.$executeRawUnsafe(`DROP TABLE OffitelRentTransaction`);

    const reportPath = join(reportDir, 'prepare-failed.json');
    const prepared = runScript('summary:prepare-v2', reportPath);
    expect(prepared.exitCode).not.toBe(0);
    const state = await prisma.$queryRawUnsafe<Array<{ status: string }>>(`SELECT status FROM RealEstateSummaryState WHERE id = 1`);
    expect(state[0]?.status).toBe('failed');
  });
});
