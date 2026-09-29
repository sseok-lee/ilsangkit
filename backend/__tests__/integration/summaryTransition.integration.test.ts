import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  applyReleaseSchema,
  createPrismaSchemaDatabase,
  SchemaDriftError,
  SchemaViolationError,
} from '../../src/scripts/applyReleaseSchema.js';
import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';

const databaseUrl = assertLocalTestDatabaseUrl(process.env.HOUSING_TEST_DATABASE_URL);
const parsedUrl = new URL(databaseUrl);
const databaseName = decodeURIComponent(parsedUrl.pathname.replace(/^\//, ''));
const mysqlBaseArgs = [
  'docker',
  'exec',
  '-i',
  '-e',
  `MYSQL_PWD=${decodeURIComponent(parsedUrl.password)}`,
  'ilsangkit-mysql',
  'mysql',
  '-u',
  decodeURIComponent(parsedUrl.username),
];
const mysqlEnv = {
  ...process.env,
  MYSQL_PWD: decodeURIComponent(parsedUrl.password),
};

const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });

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

async function rowsFor(tableName: string): Promise<Array<Record<string, unknown>>> {
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`SELECT * FROM \`${tableName}\` ORDER BY id`);
}

async function legacyIndexes(): Promise<Array<Record<string, unknown>>> {
  return prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT INDEX_NAME, COLUMN_NAME, SEQ_IN_INDEX, NON_UNIQUE
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'RealEstateBuildingSummary'
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `);
}

async function v2Column(columnName: string): Promise<Record<string, unknown>> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT COLUMN_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'RealEstateBuildingSummaryV2'
      AND COLUMN_NAME = ?
  `, columnName);
  return rows[0];
}

async function v2Constraints(): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ CONSTRAINT_NAME: string }>>(`
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'RealEstateBuildingSummaryV2'
    ORDER BY CONSTRAINT_NAME
  `);
  return rows.map((row) => row.CONSTRAINT_NAME);
}

async function checkConstraints(tableName: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ CONSTRAINT_NAME: string }>>(`
    SELECT CONSTRAINT_NAME
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND CONSTRAINT_TYPE = 'CHECK'
    ORDER BY CONSTRAINT_NAME
  `, tableName);
  return rows.map((row) => row.CONSTRAINT_NAME);
}

async function columnDefinition(tableName: string, columnName: string): Promise<Record<string, unknown> | undefined> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
    SELECT COLUMN_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  `, tableName, columnName);
  return rows[0];
}

async function indexColumns(tableName: string, indexName: string): Promise<string[]> {
  const rows = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(`
    SELECT COLUMN_NAME
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
      AND INDEX_NAME = ?
    ORDER BY SEQ_IN_INDEX
  `, tableName, indexName);
  return rows.map(row => row.COLUMN_NAME);
}


async function tableExists(tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ c: bigint }>>(`
    SELECT COUNT(*) AS c
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `, tableName);
  return Number(rows[0]?.c ?? 0) > 0;
}

async function assertSummaryV2SchemaMatches(): Promise<void> {
  if (await tableExists('RealEstateBuildingSummaryV2')) {
    const buildingKey = await v2Column('buildingKey');
    if (buildingKey?.COLUMN_TYPE !== 'char(64)' || buildingKey?.IS_NULLABLE !== 'NO') {
      throw new Error('RealEstateBuildingSummaryV2 drift: buildingKey must be non-null char(64)');
    }

    const constraints = await v2Constraints();
    if (!constraints.includes('RealEstateBuildingSummaryV2_type_buildingKey_key')) {
      throw new Error('RealEstateBuildingSummaryV2 drift: missing unique(type, buildingKey)');
    }
  }

  if (await tableExists('RealEstateSummaryState')) {
    const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(`
      SELECT COLUMN_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'RealEstateSummaryState'
        AND COLUMN_NAME = 'sourceFingerprint'
    `);
    if (rows[0]?.COLUMN_TYPE !== 'char(64)' || rows[0]?.IS_NULLABLE !== 'NO') {
      throw new Error('RealEstateSummaryState drift: sourceFingerprint must be non-null char(64)');
    }
  }
}

async function resetFixture(): Promise<void> {
  await prisma.$disconnect();
  mysqlInDatabase(`
    SET FOREIGN_KEY_CHECKS = 0;
    DROP TABLE IF EXISTS WasteScheduleCoverage;
    DROP TABLE IF EXISTS WasteScheduleRevision;
    DROP TABLE IF EXISTS WasteAreaRelation;
    DROP TABLE IF EXISTS WasteAreaEntry;
    DROP TABLE IF EXISTS WasteArea;
    DROP TABLE IF EXISTS WastePublication;
    DROP TABLE IF EXISTS WasteGeneration;
    DROP TABLE IF EXISTS WasteStagedSchedule;
    DROP TABLE IF EXISTS WasteSchedule;
    DROP TABLE IF EXISTS Subscription;
    DROP TABLE IF EXISTS RealEstateSummaryState;
    DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
    DROP TABLE IF EXISTS ApartmentSaleTransaction;
    DROP TABLE IF EXISTS RealEstateBuildingSummary;
    SET FOREIGN_KEY_CHECKS = 1;

    CREATE TABLE RealEstateBuildingSummary (
      id INT NOT NULL AUTO_INCREMENT,
      type VARCHAR(20) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
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
      UNIQUE KEY legacy_type_buildingName_bjdCode_uq (type, buildingName, bjdCode),
      KEY legacy_type_tx_count_idx (type, transactionCount),
      KEY legacy_type_city_district_tx_idx (type, city, district, transactionCount),
      KEY legacy_type_buildingName_idx (type, buildingName),
      KEY legacy_type_bjd_latest_tx_idx (type, bjdCode, latestDealYear, latestDealMonth, transactionCount),
      KEY legacy_type_lat_lng_idx (type, lat, lng)
    );

    INSERT INTO RealEstateBuildingSummary
      (type, buildingName, bjdCode, city, district, dongName, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('apt-sale', '레거시아파트', '1168010100', '서울특별시', '강남구', '역삼동', 123000, 2026, 9, 28, 2001, 37.1234567, 127.1234567, 3);

    CREATE TABLE ApartmentSaleTransaction (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      buildingName VARCHAR(200) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dealAmount INT NOT NULL
    );

    INSERT INTO ApartmentSaleTransaction (buildingName, bjdCode, dealAmount)
    VALUES ('레거시아파트', '1168010100', 123000);

    CREATE TABLE Subscription (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(200) NOT NULL
    );

    CREATE TABLE WasteSchedule (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL
    );
  `);
}

async function applyC1Schema() {
  const report = await applyReleaseSchema(createPrismaSchemaDatabase(prisma));
  await assertSummaryV2SchemaMatches();
  return report;
}

beforeAll(() => {
  mysql(mysqlBaseArgs, `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
});

beforeEach(async () => {
  await resetFixture();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('summary V2 transition DDL', () => {
  it('creates only V2/state tables and preserves old-schema legacy summary plus source rows across reapply', async () => {
    const legacyRowsBefore = await rowsFor('RealEstateBuildingSummary');
    const sourceRowsBefore = await rowsFor('ApartmentSaleTransaction');
    const legacyIndexesBefore = await legacyIndexes();

    const firstReport = await applyC1Schema();
    const secondReport = await applyC1Schema();

    expect(await rowsFor('RealEstateBuildingSummary')).toEqual(legacyRowsBefore);
    expect(await rowsFor('ApartmentSaleTransaction')).toEqual(sourceRowsBefore);
    expect(await legacyIndexes()).toEqual(legacyIndexesBefore);

    await expect(prisma.$queryRawUnsafe('SELECT buildingKey FROM RealEstateBuildingSummary LIMIT 1')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`
      INSERT INTO RealEstateBuildingSummaryV2
        (type, buildingKey, buildingName, bjdCode, city, district, dongName, transactionCount)
      VALUES
        ('apt-sale', 'not-a-hex-key', 'bad', '1168010100', '서울특별시', '강남구', '역삼동', 1)
    `)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`
      INSERT INTO RealEstateBuildingSummaryV2
        (type, buildingKey, buildingName, bjdCode, city, district, dongName, transactionCount)
      VALUES
        ('apt-sale', '${'A'.repeat(64)}', 'uppercase', '1168010100', '서울특별시', '강남구', '역삼동', 1)
    `)).rejects.toThrow();

    expect(await v2Column('buildingKey')).toMatchObject({ COLUMN_TYPE: 'char(64)', IS_NULLABLE: 'NO' });
    expect(await v2Constraints()).toEqual(expect.arrayContaining([
      'RealEstateBuildingSummaryV2_type_buildingKey_key',
    ]));
    expect(firstReport.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ object: 'RealEstateBuildingSummaryV2', action: 'create' }),
      expect.objectContaining({ object: 'RealEstateSummaryState', action: 'create' }),
      expect.objectContaining({ object: 'Subscription.publicRental', action: 'alter' }),
      expect.objectContaining({ object: 'Subscription.supersededById', action: 'alter' }),
      expect.objectContaining({ object: 'WasteScheduleCoverage', action: 'create' }),
    ]));
    expect(secondReport.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ object: 'RealEstateBuildingSummaryV2', action: 'skip' }),
      expect.objectContaining({ object: 'RealEstateSummaryState', action: 'skip' }),
      expect.objectContaining({ object: 'Subscription.publicRental', action: 'skip' }),
      expect.objectContaining({ object: 'WasteScheduleCoverage_verified_target_chk', action: 'skip' }),
    ]));
    expect(firstReport.actions.every(action => action.action !== 'drift')).toBe(true);
    expect(firstReport.databaseVersion).toMatch(/\d+\.\d+/);
  });

  it('rejects a pre-existing V2 table with incompatible structure instead of accepting drift', async () => {
    mysqlInDatabase(`
      DROP TABLE IF EXISTS RealEstateSummaryState;
      DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
      CREATE TABLE RealEstateBuildingSummaryV2 (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        type VARCHAR(20) NOT NULL,
        buildingKey CHAR(63) NOT NULL
      );
    `);

    await expect(applyC1Schema()).rejects.toThrow(/RealEstateBuildingSummaryV2/);
  });

  it('applies public rental and waste CHECK allowlists, then rejects violating writes', async () => {
    await applyC1Schema();

    expect(await columnDefinition('Subscription', 'publicRental')).toMatchObject({
      COLUMN_TYPE: 'json',
      IS_NULLABLE: 'YES',
    });
    expect(await columnDefinition('Subscription', 'supersededById')).toMatchObject({
      COLUMN_TYPE: 'int',
      IS_NULLABLE: 'YES',
    });
    expect(await indexColumns('Subscription', 'Subscription_supersededById_idx')).toEqual(['supersededById']);
    expect(await checkConstraints('WastePublication')).toContain('WastePublication_singleton_chk');
    expect(await checkConstraints('WasteAreaRelation')).toContain('WasteAreaRelation_source_chk');
    expect(await checkConstraints('WasteScheduleCoverage')).toContain('WasteScheduleCoverage_verified_target_chk');

    await expect(prisma.$executeRawUnsafe('INSERT INTO WastePublication (id) VALUES (2)')).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`
      INSERT INTO WasteAreaRelation
        (generationId, relationKey, fromAreaId, alias, toAreaId, evidence, validFrom)
      VALUES
        ('missing', 'bad', NULL, NULL, 1, JSON_OBJECT(), CURRENT_DATE())
    `)).rejects.toThrow();
    await expect(prisma.$executeRawUnsafe(`
      INSERT INTO WasteScheduleCoverage
        (generationId, scheduleId, coverageKey, areaId, districtCode, scope, conditionText, state, reason, evidence)
      VALUES
        ('missing', 1, 'bad', NULL, NULL, 'whole', '', 'verified', '', JSON_OBJECT())
    `)).rejects.toThrow();
  });

  it('reports existing waste CHECK violations without modifying rows automatically', async () => {
    await applyC1Schema();
    mysqlInDatabase(`
      ALTER TABLE WastePublication DROP CHECK WastePublication_singleton_chk;
      INSERT INTO WastePublication (id) VALUES (2);
    `);

    await expect(applyC1Schema()).rejects.toBeInstanceOf(SchemaViolationError);
    const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>('SELECT id FROM WastePublication ORDER BY id');
    expect(rows).toEqual([{ id: 2 }]);
  });

  it('rejects missing Subscription and performs no earlier planned DDL', async () => {
    mysqlInDatabase('DROP TABLE Subscription;');

    await expect(applyC1Schema()).rejects.toBeInstanceOf(SchemaDriftError);
    expect(await tableExists('RealEstateBuildingSummaryV2')).toBe(false);
    expect(await tableExists('RealEstateSummaryState')).toBe(false);
  });

  it('rejects later public-rental drift without applying prior missing summary tables', async () => {
    mysqlInDatabase('ALTER TABLE Subscription ADD COLUMN publicRental VARCHAR(20) NULL;');

    await expect(applyC1Schema()).rejects.toThrow(/Subscription\.publicRental/);
    expect(await tableExists('RealEstateBuildingSummaryV2')).toBe(false);
    expect(await tableExists('RealEstateSummaryState')).toBe(false);
  });

  it('rejects existing waste column and index drift', async () => {
    await applyC1Schema();
    mysqlInDatabase('ALTER TABLE WasteArea DROP INDEX WasteArea_kind_code_key;');

    await expect(applyC1Schema()).rejects.toThrow(/WasteArea_kind_code_key/);

    await resetFixture();
    await applyC1Schema();
    mysqlInDatabase('ALTER TABLE WasteArea MODIFY COLUMN code VARCHAR(21) NOT NULL;');

    await expect(applyC1Schema()).rejects.toThrow(/WasteArea\.code/);
  });

  it('rejects existing waste foreign-key drift', async () => {
    await applyC1Schema();
    mysqlInDatabase('ALTER TABLE WasteAreaRelation DROP FOREIGN KEY WasteAreaRelation_toAreaId_fkey;');

    await expect(applyC1Schema()).rejects.toThrow(/WasteAreaRelation_toAreaId_fkey/);
  });

});
