import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertC3TestDatabaseUrl } from '../../src/scripts/rehearseReleaseDatabaseFaults.js';

const shouldRunFaultDbTests = process.env.RUN_C3_DB_FAULT_TESTS === '1';
const faultDescribe = shouldRunFaultDbTests ? describe : describe.skip;

function requireFaultTestDatabaseUrl(): string {
  if (!shouldRunFaultDbTests) throw new Error('RUN_C3_DB_FAULT_TESTS=1 is required for C3 DB fault integration tests');
  const url = assertC3TestDatabaseUrl(process.env.C3_DB_FAULT_TEST_DATABASE_URL);
  const databaseName = decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
  if (!/^ilsangkit_c3_db_faults_[a-z0-9_]*_test$/.test(databaseName)) {
    throw new Error('C3 DB fault integration tests require a dedicated ilsangkit_c3_db_faults_*_test database');
  }
  return url;
}

const databaseUrl = shouldRunFaultDbTests ? requireFaultTestDatabaseUrl() : '';
const parsedUrl = shouldRunFaultDbTests ? new URL(databaseUrl) : null;
const databaseName = parsedUrl ? decodeURIComponent(parsedUrl.pathname.replace(/^\//, '')) : '';
const mysqlPassword = parsedUrl ? decodeURIComponent(parsedUrl.password) : '';
const mysqlUser = parsedUrl ? decodeURIComponent(parsedUrl.username) : '';
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
let reportDir = '';
let lockDir = '';

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
    DROP TABLE IF EXISTS AptRentTransaction;
    DROP TABLE IF EXISTS RealEstateBuildingSummary;
    DROP TABLE IF EXISTS RealEstateSummaryState;
    DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
    SET FOREIGN_KEY_CHECKS = 1;
  `);
  mysqlInDatabase(readFileSync(resolve('prisma/sql/20260929_summary_v2.sql'), 'utf8'));
  mysqlInDatabase(`
    CREATE TABLE RealEstateBuildingSummary (
      id INT NOT NULL AUTO_INCREMENT,
      type VARCHAR(20) NOT NULL,
      buildingKey CHAR(64) NULL,
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
      jeonseDeposit INT NULL,
      jeonseDealKey INT NULL,
      wolseDeposit INT NULL,
      wolseMonthlyRent INT NULL,
      wolseDealKey INT NULL,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      PRIMARY KEY (id),
      KEY legacy_summary_type_city_idx (type, city)
    );

    CREATE TABLE AptRentTransaction (
      id INT NOT NULL AUTO_INCREMENT,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      buildYear INT NULL,
      jibun VARCHAR(20) NULL,
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
      KEY apt_rent_city_idx (city)
    );
  `);
}

function seedRows(): void {
  mysqlInDatabase(`
    DELETE FROM RealEstateSummaryState;
    DELETE FROM RealEstateBuildingSummaryV2;
    DELETE FROM RealEstateBuildingSummary;
    DELETE FROM AptRentTransaction;

    INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
    VALUES (1, 'ready', 'c3-ready-before-fault', REPEAT('a', 64), JSON_OBJECT('ready', TRUE), '2026-09-29 00:00:00.000');

    INSERT INTO RealEstateBuildingSummaryV2
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, monthlyRent,
       latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount,
       jeonseDeposit, jeonseDealKey, wolseDeposit, wolseMonthlyRent, wolseDealKey)
    VALUES
      ('apt-rent', SHA2('c3-existing-v2', 256), 'C3락아파트', '1168010100', '서울특별시', '강남구', '역삼동', '1-1', 50000, 0,
       2026, 8, 31, 2008, 37.5100000, 127.0100000, 2,
       50000, 20260831, 10000, 90, 20260830);

    INSERT INTO RealEstateBuildingSummary
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, monthlyRent,
       latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount,
       jeonseDeposit, jeonseDealKey, wolseDeposit, wolseMonthlyRent, wolseDealKey)
    VALUES
      ('apt-rent', SHA2('c3-existing-legacy', 256), 'C3레거시아파트', '1168010100', '서울특별시', '강남구', '역삼동', '2-2', 40000, 0,
       2026, 8, 30, 2007, 37.5200000, 127.0200000, 1,
       40000, 20260830, 9000, 80, 20260829);

    INSERT INTO AptRentTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, lat, lng, dealYear, dealMonth, dealDay, rentType, deposit, monthlyRent, sourceId)
    VALUES
      ('서울특별시', '강남구', '1168010100', '역삼동', 'C3락아파트', 2008, '1-1', 37.5100000, 127.0100000, 2026, 9, 1, '전세', 55000, 0, 'c3-apt-rent-jeonse'),
      ('서울특별시', '강남구', '1168010100', '역삼동', 'C3락아파트', 2008, '1-1', 37.5100000, 127.0100000, 2026, 9, 2, '월세', 12000, 120, 'c3-apt-rent-wolse');
  `);
}

function runFault(kind: 'invalid-check' | 'city-timeout', reportPath: string): ReturnType<typeof spawnSync> {
  return spawnSync(
    'npx',
    ['tsx', 'src/scripts/rehearseReleaseDatabaseFaults.ts', '--kind', kind, '--report-out', reportPath],
    {
      cwd: resolve('.'),
      env: {
        ...process.env,
        PATH: `/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:${process.env.PATH ?? ''}`,
        C3_TEST_DATABASE_URL: databaseUrl,
        REAL_ESTATE_WRITE_LOCK_DIR: lockDir,
        NODE_ENV: 'test',
      },
      encoding: 'utf8',
    },
  );
}

type FaultReport = {
  kind: string;
  expectedFault: boolean;
  injectedReason: string;
  detectedReason: string;
  preserved: boolean;
  failureClass: string;
  beforeDigest: Record<string, string>;
  afterDigest: Record<string, string>;
  target?: { type: string; city: string };
};

function readReport(path: string): FaultReport {
  return JSON.parse(readFileSync(path, 'utf8')) as FaultReport;
}

faultDescribe('rehearseReleaseDatabaseFaults C3 integration', () => {
  beforeAll(() => {
    resetDatabase();
  });

  beforeEach(() => {
    seedRows();
    reportDir = mkdtempSync(join(tmpdir(), 'c3-db-fault-report-'));
    lockDir = mkdtempSync(join(tmpdir(), 'c3-db-fault-lock-'));
  });

  afterEach(() => {
    if (reportDir) rmSync(reportDir, { recursive: true, force: true });
    if (lockDir) rmSync(lockDir, { recursive: true, force: true });
    reportDir = '';
    lockDir = '';
  });

  afterAll(() => {
    if (reportDir) rmSync(reportDir, { recursive: true, force: true });
    if (lockDir) rmSync(lockDir, { recursive: true, force: true });
  });

  it('injects a wrong C1 CHECK, detects schema drift through the real verifier, restores the constraint, and preserves rows', () => {
    const reportPath = join(reportDir, 'invalid-check.json');
    const result = runFault('invalid-check', reportPath);
    expect(result.status).toBe(10);
    expect(result.stderr).toContain('expected database fault detected');

    const report = readReport(reportPath);
    expect(report).toMatchObject({
      kind: 'invalid-check',
      expectedFault: true,
      preserved: true,
      failureClass: 'schema-drift',
    });
    expect(report.injectedReason).toContain('RealEstateBuildingSummaryV2_buildingKey_hex_chk');
    expect(report.detectedReason).toMatch(/RealEstateBuildingSummaryV2|buildingKey_hex_chk|drift/i);
    expect(report.afterDigest).toEqual(report.beforeDigest);

    const cleanCheck = mysqlInDatabase(`
      SELECT CHECK_CLAUSE
      FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
      WHERE CONSTRAINT_SCHEMA = DATABASE()
        AND CONSTRAINT_NAME = 'RealEstateBuildingSummaryV2_buildingKey_hex_chk';
    `);
    expect(cleanCheck).toContain("^[a-f0-9]{64}$");
    expect(cleanCheck.replace(/\\/g, '')).toContain("'c'");
  });

  it('holds a V2 city row lock, forces the real V2 refresh to time out, releases the lock, and keeps V2/source/legacy/state digests unchanged', () => {
    const reportPath = join(reportDir, 'city-timeout.json');
    const result = runFault('city-timeout', reportPath);
    expect(result.status).toBe(10);
    expect(result.stderr).toContain('expected database fault detected');

    const report = readReport(reportPath);
    expect(report).toMatchObject({
      kind: 'city-timeout',
      expectedFault: true,
      preserved: true,
      failureClass: 'refresh-transaction-timeout',
      target: { type: 'apt-rent', city: '서울특별시' },
    });
    expect(report.injectedReason).toContain('held apt-rent/서울특별시 V2 row lock');
    expect(report.detectedReason).toMatch(/P2028|timeout|expired|Transaction already closed/i);
    expect(report.afterDigest).toEqual(report.beforeDigest);
  }, 20_000);
});
