import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { toRealEstateUrl } from '../../src/lib/realEstateUrl.js';
import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';

const dedicatedUrl = assertLocalTestDatabaseUrl(
  process.env.REAL_ESTATE_URL_TEST_DATABASE_URL
    ?? 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_real_estate_url_20260929_test?connection_limit=5&pool_timeout=10',
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

function buildingKey(propertyType: string, bjdCode: string, buildingName: string, dongName: string, jibun: string): string {
  return createHash('sha256')
    .update([propertyType, bjdCode, buildingName, dongName.trim(), jibun.trim()].join('\x1f'))
    .digest('hex');
}

const uniqueKey = buildingKey('apt', '1168010100', '단독아파트', '역삼동', '1-1');
const legacyOwnerKey = buildingKey('villa', '2817710100', 'BSVIEW', '도화동', '369-1');
const suffixOwnerKey = buildingKey('villa', '2817710200', 'BSVIEW', '용현동', '491-49');
const appendedVillaKey = buildingKey('villa', '2817710300', '새빌라', '학익동', '10');
const deferredBuildingName = '동명이빌라';
const deferredBjdCode = '2817710500';
const deferredFirstKey = buildingKey('villa', deferredBjdCode, deferredBuildingName, '도화동', '100-1');
const deferredSecondKey = buildingKey('villa', deferredBjdCode, deferredBuildingName, '도화동', '100-2');
const longKoreanBuildingName = '가'.repeat(200);
const longKoreanNameKey = buildingKey('apt', '1168010300', longKoreanBuildingName, '대치동', '200-1');
const fingerprintMismatch = 'f'.repeat(64);
const uniqueCanonicalPath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('단독아파트')}`;
const longKoreanCanonicalPath = `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent(longKoreanBuildingName)}`;
const legacyBasePath = '/real-estate/villa-sale/incheon/michuhol/BSVIEW';
const suffixCanonicalPath = `${legacyBasePath}/${encodeURIComponent('용현동-491-49')}`;
const appendedVillaCanonicalPath = `/real-estate/villa-sale/incheon/michuhol/${encodeURIComponent('새빌라')}`;
const deferredBasePath = `/real-estate/villa-sale/incheon/michuhol/${encodeURIComponent(deferredBuildingName)}`;
const deferredFirstHashAliasPath = `${deferredBasePath}/${deferredFirstKey}`;
const publicUrlRegistryMigrationPath = 'prisma/migrations/202609290001_real_estate_public_url_registry/migration.sql';

let tempDir = '';

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
    DROP TABLE IF EXISTS RealEstatePublicUrlAlias;
    DROP TABLE IF EXISTS RealEstatePublicUrlState;
    DROP TABLE IF EXISTS RealEstatePublicUrl;
    DROP TABLE IF EXISTS RealEstateSummaryState;
    DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
    DROP TABLE IF EXISTS RealEstateBuildingSummary;
    DROP TABLE IF EXISTS Region;
    DROP TABLE IF EXISTS VillaSaleTransaction;
    SET FOREIGN_KEY_CHECKS = 1;
  `);
  mysqlInDatabase(readFileSync(resolve('prisma/sql/20260929_summary_v2.sql'), 'utf8'));
  mysqlInDatabase(readFileSync(resolve(publicUrlRegistryMigrationPath), 'utf8'));
  mysqlInDatabase(`
    CREATE TABLE Region (
      id INT NOT NULL AUTO_INCREMENT,
      bjdCode VARCHAR(5) NOT NULL,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      slug VARCHAR(50) NOT NULL,
      lat DECIMAL(10,7) NOT NULL,
      lng DECIMAL(10,7) NOT NULL,
      PRIMARY KEY (id),
      UNIQUE KEY Region_bjdCode_key (bjdCode),
      UNIQUE KEY Region_city_district_key (city, district),
      UNIQUE KEY Region_city_slug_key (city, slug)
    );
    INSERT INTO Region (bjdCode, city, district, slug, lat, lng)
    VALUES
      ('11680', '서울특별시', '강남구', 'gangnam', 37.5172000, 127.0473000),
      ('28177', '인천광역시', '미추홀구', 'michuhol', 37.4636000, 126.6503000);
  `);
  mysqlInDatabase(`
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
      UNIQUE KEY RealEstateBuildingSummary_type_buildingName_bjdCode_key (type, buildingName, bjdCode),
      KEY RealEstateBuildingSummary_type_transactionCount_idx (type, transactionCount),
      KEY RealEstateBuildingSummary_type_city_district_tx_idx (type, city, district, transactionCount),
      KEY RealEstateBuildingSummary_type_buildingName_idx (type, buildingName),
      KEY RealEstateBuildingSummary_type_bjd_latest_tx_idx (type, bjdCode, latestDealYear, latestDealMonth, transactionCount),
      KEY RealEstateBuildingSummary_type_lat_lng_idx (type, lat, lng)
    );
  `);
  mysqlInDatabase(`
    CREATE TABLE VillaSaleTransaction (
      id INT NOT NULL AUTO_INCREMENT,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      houseType VARCHAR(20) NULL,
      buildYear INT NULL,
      floor INT NULL,
      exclusiveArea DECIMAL(10,2) NULL,
      jibun VARCHAR(20) NULL,
      roadName VARCHAR(100) NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      dealYear INT NOT NULL,
      dealMonth INT NOT NULL,
      dealDay INT NULL,
      dealAmount BIGINT NOT NULL,
      dealType VARCHAR(20) NULL,
      cancelDealDay VARCHAR(10) NULL,
      cancelDealType VARCHAR(20) NULL,
      buyerType VARCHAR(10) NULL,
      sellerType VARCHAR(10) NULL,
      registrationDate VARCHAR(20) NULL,
      sourceId VARCHAR(100) NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      syncedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      geocodedAt DATETIME(3) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY VillaSaleTransaction_sourceId_key (sourceId),
      KEY villa_sale_summary_idx (buildingName, bjdCode, dongName, jibun, dealYear, dealMonth, dealDay, id),
      KEY villa_sale_bjd_building_idx (bjdCode, buildingName),
      KEY villa_sale_area_idx (bjdCode, exclusiveArea),
      KEY villa_sale_city_idx (city)
    );
  `);
}

function seedReadySummaryState(): void {
  mysqlInDatabase(`
    INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
    VALUES (1, 'ready', 'url-preservation-test-run', REPEAT('a', 64), JSON_OBJECT('complete', true), NOW(3))
    ON DUPLICATE KEY UPDATE status = VALUES(status), runId = VALUES(runId), validatedAt = VALUES(validatedAt);
  `);
}

function seedSummaryRows(order: 'original' | 'reversed' = 'original'): void {
  const rows = [
    `('apt-sale', '${uniqueKey}', '단독아파트', '1168010100', '서울특별시', '강남구', '역삼동', '1-1', 100000, 2026, 9, 1, 2001, 37.5000000, 127.0000000, 2)`,
    `('villa-sale', '${legacyOwnerKey}', 'BSVIEW', '2817710100', '인천광역시', '미추홀구', '도화동', '369-1', 50000, 2026, 8, 31, 2010, 37.4600000, 126.6600000, 3)`,
    `('villa-sale', '${suffixOwnerKey}', 'BSVIEW', '2817710200', '인천광역시', '미추홀구', '용현동', '491-49', 51000, 2026, 8, 30, 2011, 37.4500000, 126.6500000, 1)`,
  ];
  mysqlInDatabase(`
    INSERT INTO RealEstateBuildingSummaryV2
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES ${(order === 'original' ? rows : rows.reverse()).join(',')};
  `);
}

function seedLegacySummaryRows(): void {
  mysqlInDatabase(`
    INSERT INTO RealEstateBuildingSummary
      (type, buildingName, bjdCode, city, district, dongName, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('villa-sale', 'BSVIEW', '2817710100', '인천광역시', '미추홀구', '도화동', 50000, 2026, 8, 31, 2010, 37.4600000, 126.6600000, 3);
  `);
}

function seedDeferredSummaryRows(): void {
  mysqlInDatabase(`
    INSERT INTO RealEstateBuildingSummaryV2
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('villa-sale', '${deferredFirstKey}', '${deferredBuildingName}', '${deferredBjdCode}', '인천광역시', '미추홀구', '도화동', '100-1', 61000, 2026, 9, 2, 2015, 37.4700000, 126.6700000, 1),
      ('villa-sale', '${deferredSecondKey}', '${deferredBuildingName}', '${deferredBjdCode}', '인천광역시', '미추홀구', '도화동', '100-2', 62000, 2026, 9, 3, 2016, 37.4710000, 126.6710000, 1);
  `);
}

function seedLongKoreanNameSummaryRow(): void {
  mysqlInDatabase(`
    INSERT INTO RealEstateBuildingSummaryV2
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('apt-sale', '${longKoreanNameKey}', '${longKoreanBuildingName}', '1168010300', '서울특별시', '강남구', '대치동', '200-1', 120000, 2026, 9, 2, 2005, 37.5100000, 127.0100000, 1);
  `);
}

function writeBaseline(includeDeferred = false): string {
  const baselinePath = join(tempDir, 'legacy-baseline.json');
  const entries: Array<{ type: string; basePath: string; dongName: string | null; jibun: string | null; provenance: string }> = [
    {
      type: 'villa-sale',
      basePath: legacyBasePath,
      dongName: '도화동',
      jibun: '369-1',
      provenance: 'old-production-render',
    },
  ];
  if (includeDeferred) {
    entries.push({
      type: 'villa-sale',
      basePath: deferredBasePath,
      dongName: null,
      jibun: null,
      provenance: 'old-production-render-mixed-address',
    });
  }
  writeFileSync(
    baselinePath,
    JSON.stringify({
      provenance: 'production-detail-snapshot-2026-09-29',
      entries,
    }),
    'utf8',
  );
  return baselinePath;
}

function seedVillaSaleSourceRows(kind: 'appendable' | 'suffix-clash'): void {
  const extraRows = kind === 'appendable'
    ? `,('인천광역시', '미추홀구', '2817710300', '학익동', '새빌라', 2012, '10', '학익로10', 37.4400000, 126.6400000, 2026, 9, 1, 53000, 'villa-new-1')`
    : `,('인천광역시', '미추홀구', '2817710300', '문학동', 'BSVIEW', 2012, '1', '문학로1', 37.4400000, 126.6400000, 2026, 9, 1, 53000, 'villa-clash-1'),
       ('인천광역시', '미추홀구', '2817710400', '문학동', 'BSVIEW', 2013, '1', '문학로2', 37.4300000, 126.6300000, 2026, 9, 2, 54000, 'villa-clash-2')`;
  mysqlInDatabase(`
    INSERT INTO VillaSaleTransaction
      (city, district, bjdCode, dongName, buildingName, buildYear, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, dealAmount, sourceId)
    VALUES
      ('인천광역시', '미추홀구', '2817710100', '도화동', 'BSVIEW', 2010, '369-1', '도화로1', 37.4600000, 126.6600000, 2026, 8, 31, 50000, 'villa-owner-1'),
      ('인천광역시', '미추홀구', '2817710200', '용현동', 'BSVIEW', 2011, '491-49', '용현로1', 37.4500000, 126.6500000, 2026, 8, 30, 51000, 'villa-suffix-1')
      ${extraRows};
  `);
}

function seedDeferredVillaSaleSourceRows(): void {
  mysqlInDatabase(`
    INSERT INTO VillaSaleTransaction
      (city, district, bjdCode, dongName, buildingName, houseType, buildYear, floor, exclusiveArea, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, dealAmount, dealType, sourceId)
    VALUES
      ('인천광역시', '미추홀구', '${deferredBjdCode}', '도화동', '${deferredBuildingName}', '다세대', 2015, 3, 59.50, '100-1', '도화로100', 37.4700000, 126.6700000, 2026, 9, 2, 61000, '중개거래', 'villa-deferred-1'),
      ('인천광역시', '미추홀구', '${deferredBjdCode}', '도화동', '${deferredBuildingName}', '다세대', 2016, 4, 59.50, '100-2', '도화로101', 37.4710000, 126.6710000, 2026, 9, 3, 62000, '중개거래', 'villa-deferred-2');
  `);
}

async function runRegistryCli(args: string[]) {
  const module = await import('../../src/scripts/realEstateUrls.js');
  return module.runRealEstateUrlRegistryCli(args);
}

async function applyRegistry(): Promise<{ sourceFingerprint: string }> {
  return applyRegistryWithArgs([], false);
}

async function applyDeferredRegistry(): Promise<{ sourceFingerprint: string }> {
  seedDeferredSummaryRows();
  seedDeferredVillaSaleSourceRows();
  return applyRegistryWithArgs(['--unresolved-policy=defer'], true);
}

async function applyRegistryWithArgs(extraArgs: string[], includeDeferredBaseline: boolean): Promise<{ sourceFingerprint: string }> {
  const baselinePath = writeBaseline(includeDeferredBaseline);
  const dryRun = await runRegistryCli(['--dry-run', '--baseline', baselinePath, ...extraArgs]);
  expect(dryRun.blockers).toEqual([]);
  const reportPath = join(tempDir, `apply-${Date.now()}.json`);
  return runRegistryCli([
    '--apply',
    '--baseline',
    baselinePath,
    ...extraArgs,
    '--expected-fingerprint',
    dryRun.sourceFingerprint,
    '--expected-plan-fingerprint',
    dryRun.planFingerprint,
    '--report-out',
    reportPath,
  ]);
}

async function publicUrlRows(): Promise<Array<{ type: string; buildingKey: string; canonicalPath: string }>> {
  return prisma.$queryRawUnsafe<Array<{ type: string; buildingKey: string; canonicalPath: string }>>(
    `SELECT type, buildingKey, canonicalPath FROM RealEstatePublicUrl ORDER BY type, canonicalPath`,
  );
}

async function publicUrlEvidenceRows(buildingKeys: string[]): Promise<Array<{
  type: string;
  buildingKey: string;
  canonicalPath: string;
  basePath: string;
  evidenceSource: string;
}>> {
  const placeholders = buildingKeys.map(() => '?').join(', ');
  return prisma.$queryRawUnsafe<Array<{
    type: string;
    buildingKey: string;
    canonicalPath: string;
    basePath: string;
    evidenceSource: string;
  }>>(
    `SELECT type, buildingKey, canonicalPath, basePath, JSON_UNQUOTE(JSON_EXTRACT(evidence, '$.source')) AS evidenceSource
       FROM RealEstatePublicUrl
      WHERE buildingKey IN (${placeholders})
      ORDER BY buildingKey`,
    ...buildingKeys,
  );
}

describe('real estate URL preservation integration', () => {
  beforeAll(() => {
    process.env.DATABASE_URL = dedicatedUrl;
    process.env.NODE_ENV = 'test';
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    process.env.REAL_ESTATE_SUMMARY_MODE = 'address';
    mysql(mysqlBaseArgs, `CREATE DATABASE IF NOT EXISTS \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
  });

  beforeEach(() => {
    vi.resetModules();
    process.env.DATABASE_URL = dedicatedUrl;
    process.env.NODE_ENV = 'test';
    process.env.REAL_ESTATE_URL_MODE = 'preserved';
    process.env.REAL_ESTATE_SUMMARY_MODE = 'address';
    tempDir = mkdtempSync(join(tmpdir(), 'real-estate-url-preservation-'));
    vi.stubEnv('REAL_ESTATE_WRITE_LOCK_DIR', tempDir);
    vi.stubEnv('REAL_ESTATE_WRITE_LOCK_TOKEN', undefined);
    resetDatabase();
    seedReadySummaryState();
    seedSummaryRows();
  });

  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = '';
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('applies unique canonical paths and readable duplicate suffixes with durable key ownership', async () => {
    const report = await applyRegistry();

    expect(report.applied).toBe(true);
    await expect(publicUrlRows()).resolves.toEqual(expect.arrayContaining([
      { type: 'apt-sale', buildingKey: uniqueKey, canonicalPath: uniqueCanonicalPath },
      { type: 'villa-sale', buildingKey: legacyOwnerKey, canonicalPath: legacyBasePath },
      { type: 'villa-sale', buildingKey: suffixOwnerKey, canonicalPath: suffixCanonicalPath },
    ]));
  });

  it('applies deferred legacy groups as shared base canonical rows without assigning a public hash URL', async () => {
    const report = await applyDeferredRegistry();

    expect(report.applied).toBe(true);
    await expect(publicUrlEvidenceRows([deferredFirstKey, deferredSecondKey])).resolves.toEqual([
      {
        type: 'villa-sale',
        buildingKey: deferredFirstKey,
        canonicalPath: deferredBasePath,
        basePath: deferredBasePath,
        evidenceSource: 'legacy-deferred',
      },
      {
        type: 'villa-sale',
        buildingKey: deferredSecondKey,
        canonicalPath: deferredBasePath,
        basePath: deferredBasePath,
        evidenceSource: 'legacy-deferred',
      },
    ]);
    await expect(
      prisma.$queryRawUnsafe<Array<{ buildingKey: string }>>(
        'SELECT buildingKey FROM RealEstatePublicUrl WHERE canonicalPath = ? ORDER BY buildingKey',
        deferredBasePath,
      )
    ).resolves.toEqual([{ buildingKey: deferredFirstKey }, { buildingKey: deferredSecondKey }]);
  });

  it('resolves a deferred legacy base URL as a grouped identity without a building key', async () => {
    await applyDeferredRegistry();
    const app = (await import('../../src/app.js')).default;

    const result = await request(app).get('/api/real-estate/resolve-url').query({ path: deferredBasePath });

    expect(result.status).toBe(200);
    expect(result.body.data).toEqual(expect.objectContaining({
      mode: 'preserved',
      type: 'villa-sale',
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      canonicalPath: deferredBasePath,
      redirect: false,
      legacyGrouped: true,
    }));
    expect(result.body.data.buildingKey).toBeUndefined();
  });

  it('returns all deferred legacy group transactions in the keyless detail snapshot', async () => {
    await applyDeferredRegistry();
    const { getDetailSnapshot } = await import('../../src/services/realEstateDetailService.js');

    const snapshot = await getDetailSnapshot('villa-sale', {
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      mode: 'sale',
      months: 6,
    }, new Date('2026-09-29T00:00:00.000Z'));

    expect(snapshot.filters).toEqual(expect.objectContaining({
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      canonicalPath: deferredBasePath,
      legacyGrouped: true,
      mode: 'sale',
      months: 6,
      area: '59.50',
    }));
    expect(snapshot.filters.buildingKey).toBeUndefined();
    expect(snapshot.points.map((point) => point.id).sort((a, b) => a - b)).toEqual([1, 2]);
    expect(snapshot.table.total).toBe(2);
  });

  it('resolves a prepared deferred group into one preserved base and one address-specific detail', async () => {
    await applyDeferredRegistry();
    const baselinePath = join(tempDir, 'resolved-baseline.json');
    writeFileSync(baselinePath, JSON.stringify({ provenance: 'captured-production-detail', entries: [
      { type: 'villa-sale', basePath: deferredBasePath, dongName: '도화동', jibun: '100-1', provenance: 'captured-production-detail' },
    ] }));
    const args = ['--baseline', baselinePath, '--resolve-deferred'];
    const before = await publicUrlRows();
    const dry = await runRegistryCli(['--dry-run', ...args]);
    expect(dry.toUpdate).toBe(2);
    expect(await publicUrlRows()).toEqual(before);
    const applied = await runRegistryCli(['--apply', ...args,
      '--expected-fingerprint', dry.sourceFingerprint,
      '--expected-plan-fingerprint', dry.planFingerprint]);
    expect(applied.toUpdate).toBe(2);
    const app = (await import('../../src/app.js')).default;
    const suffixPath = `${deferredBasePath}/${encodeURIComponent('도화동-100-2')}`;
    const { getDetailPage } = await import('../../src/services/realEstateDetailService.js');
    for (const [path, key, expectedId] of [[deferredBasePath, deferredFirstKey, 1], [suffixPath, deferredSecondKey, 2]] as const) {
      const resolved = await request(app).get('/api/real-estate/resolve-url').query({ path });
      expect(resolved.status).toBe(200);
      expect(resolved.body.data).toMatchObject({ buildingKey: key, canonicalPath: path });
      expect(resolved.body.data.legacyGrouped).not.toBe(true);
      const detail = await getDetailPage('villa-sale', {
        bjdCode: deferredBjdCode, buildingName: deferredBuildingName, buildingKey: key,
        mode: 'sale', months: 6, area: '59.50', page: 1,
      }, new Date('2026-09-29T00:00:00.000Z'));
      expect(detail.items.map(item => item.id)).toEqual([expectedId]);
      expect(detail.total).toBe(1);
    }
    const hash = await request(app).get('/api/real-estate/resolve-url').query({ path: deferredFirstHashAliasPath });
    expect(hash.status).toBe(404);
    const repeat = await runRegistryCli(['--dry-run', ...args]);
    expect(repeat.toUpdate).toBe(0);
    expect(repeat.toCreate).toBe(0);
    expect(await publicUrlRows()).toEqual(expect.arrayContaining(before.filter(row => ![deferredFirstKey, deferredSecondKey].includes(row.buildingKey))));
  });

  it('returns all deferred legacy group transactions in the keyless detail page', async () => {
    await applyDeferredRegistry();
    const { getDetailPage } = await import('../../src/services/realEstateDetailService.js');

    const page = await getDetailPage('villa-sale', {
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      mode: 'sale',
      months: 6,
      area: '59.50',
      page: 1,
    }, new Date('2026-09-29T00:00:00.000Z'));

    expect(page.total).toBe(2);
    expect(page.items.map((item) => item.id).sort((a, b) => Number(a) - Number(b))).toEqual([1, 2]);
  });

  it('isolates a deferred member detail snapshot when the keyed URL is requested', async () => {
    await applyDeferredRegistry();
    const { getDetailSnapshot } = await import('../../src/services/realEstateDetailService.js');

    const snapshot = await getDetailSnapshot('villa-sale', {
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      buildingKey: deferredFirstKey,
      mode: 'sale',
      months: 6,
    }, new Date('2026-09-29T00:00:00.000Z'));

    expect(snapshot.filters).toEqual(expect.objectContaining({
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      buildingKey: deferredFirstKey,
      canonicalPath: deferredBasePath,
      dongName: '도화동',
      jibun: '100-1',
      mode: 'sale',
      months: 6,
      area: '59.50',
    }));
    expect(snapshot.points.map((point) => point.id)).toEqual([1]);
    expect(snapshot.table.total).toBe(1);
  });

  it('isolates a deferred member detail page when the keyed URL is requested', async () => {
    await applyDeferredRegistry();
    const { getDetailPage } = await import('../../src/services/realEstateDetailService.js');

    const page = await getDetailPage('villa-sale', {
      bjdCode: deferredBjdCode,
      buildingName: deferredBuildingName,
      buildingKey: deferredSecondKey,
      mode: 'sale',
      months: 6,
      area: '59.50',
      page: 1,
    }, new Date('2026-09-29T00:00:00.000Z'));

    expect(page.total).toBe(1);
    expect(page.items.map((item) => item.id)).toEqual([2]);
  });

  it('roundtrips a 200-character Korean building name through registry apply and exact resolve', async () => {
    seedLongKoreanNameSummaryRow();
    expect(longKoreanCanonicalPath.length).toBeGreaterThan(1_000);
    await applyRegistry();
    const app = (await import('../../src/app.js')).default;

    const rows = await publicUrlRows();
    expect(rows).toEqual(expect.arrayContaining([
      { type: 'apt-sale', buildingKey: longKoreanNameKey, canonicalPath: longKoreanCanonicalPath },
    ]));

    const resolved = await request(app).get('/api/real-estate/resolve-url').query({ path: longKoreanCanonicalPath });
    expect(resolved.status).toBe(200);
    expect(resolved.body.data).toEqual(expect.objectContaining({
      type: 'apt-sale',
      buildingKey: longKoreanNameKey,
      canonicalPath: longKoreanCanonicalPath,
      redirect: false,
    }));
  });

  it('keeps canonical ownership stable after V2 summary rows are deleted and reinserted', async () => {
    await applyRegistry();
    const before = await publicUrlRows();

    await prisma.$executeRawUnsafe('DELETE FROM RealEstateBuildingSummaryV2');
    seedSummaryRows('reversed');
    await applyRegistry();

    await expect(publicUrlRows()).resolves.toEqual(before);
  });

  it('does not duplicate mappings when apply is rerun against the same summary input', async () => {
    await applyRegistry();
    await applyRegistry();

    const rows = await publicUrlRows();
    expect(rows).toHaveLength(3);
    expect(new Set(rows.map((row) => row.buildingKey)).size).toBe(3);
    expect(new Set(rows.map((row) => row.canonicalPath)).size).toBe(3);
  });

  it('appends a new city summary building URL through the active address refresh path', async () => {
    await applyRegistry();
    seedVillaSaleSourceRows('appendable');
    const { refreshSummariesForActiveMode } = await import('../../src/services/realEstateSummaryService.js');

    const result = await refreshSummariesForActiveMode(['villa-sale']);
    expect(result.complete).toBe(true);
    expect(result.batches).toEqual([
      { type: 'villa-sale', city: '인천광역시', rowCount: 3, status: 'complete' },
    ]);

    await expect(publicUrlRows()).resolves.toEqual(expect.arrayContaining([
      { type: 'villa-sale', buildingKey: legacyOwnerKey, canonicalPath: legacyBasePath },
      { type: 'villa-sale', buildingKey: suffixOwnerKey, canonicalPath: suffixCanonicalPath },
      { type: 'villa-sale', buildingKey: appendedVillaKey, canonicalPath: appendedVillaCanonicalPath },
    ]));
  });

  it('appends a new city summary building URL through the active compatibility refresh path', async () => {
    await applyRegistry();
    seedVillaSaleSourceRows('appendable');
    vi.stubEnv('REAL_ESTATE_SUMMARY_MODE', 'compatibility');
    vi.stubEnv('REAL_ESTATE_URL_MODE', 'preserved');
    const { refreshSummariesForActiveMode } = await import('../../src/services/realEstateSummaryService.js');

    const result = await refreshSummariesForActiveMode(['villa-sale']);
    expect(result.complete).toBe(true);
    expect(result.batches).toEqual([
      { type: 'villa-sale', city: '인천광역시', rowCount: 3, status: 'complete' },
      { type: 'villa-sale', city: '인천광역시', rowCount: 3, status: 'complete' },
    ]);

    await expect(publicUrlRows()).resolves.toEqual(expect.arrayContaining([
      { type: 'villa-sale', buildingKey: legacyOwnerKey, canonicalPath: legacyBasePath },
      { type: 'villa-sale', buildingKey: suffixOwnerKey, canonicalPath: suffixCanonicalPath },
      { type: 'villa-sale', buildingKey: appendedVillaKey, canonicalPath: appendedVillaCanonicalPath },
    ]));
  });

  it('rolls back the city summary refresh when URL append detects a readable suffix clash', async () => {
    await applyRegistry();
    const beforeUrls = await publicUrlRows();
    const beforeSummary = await prisma.$queryRawUnsafe<Array<{ buildingKey: string; dongName: string; jibun: string | null }>>(
      `SELECT buildingKey, dongName, jibun FROM RealEstateBuildingSummaryV2 WHERE type = 'villa-sale' ORDER BY buildingKey`,
    );
    seedVillaSaleSourceRows('suffix-clash');
    const { refreshSummary } = await import('../../src/services/realEstateSummaryService.js');

    await expect(refreshSummary('villa-sale')).resolves.toBe(0);

    await expect(publicUrlRows()).resolves.toEqual(beforeUrls);
    await expect(
      prisma.$queryRawUnsafe<Array<{ buildingKey: string; dongName: string; jibun: string | null }>>(
        `SELECT buildingKey, dongName, jibun FROM RealEstateBuildingSummaryV2 WHERE type = 'villa-sale' ORDER BY buildingKey`,
      )
    ).resolves.toEqual(beforeSummary);
  });

  it('refuses apply when the expected fingerprint does not match the dry-run input', async () => {
    const baselinePath = writeBaseline();

    await expect(
      runRegistryCli([
        '--apply',
        '--baseline',
        baselinePath,
        '--expected-fingerprint',
        fingerprintMismatch,
      ])
    ).rejects.toThrow(/fingerprint/i);
    await expect(publicUrlRows()).resolves.toEqual([]);
  });

  it('resolves an exact canonical path through the public API without redirecting', async () => {
    await applyRegistry();
    const app = (await import('../../src/app.js')).default;

    const canonical = await request(app).get('/api/real-estate/resolve-url').query({ path: uniqueCanonicalPath });
    expect(canonical.status).toBe(200);
    expect(canonical.body.data).toEqual(expect.objectContaining({
      mode: 'preserved',
      type: 'apt-sale',
      buildingKey: uniqueKey,
      canonicalPath: uniqueCanonicalPath,
      redirect: false,
    }));
  });

  it('keeps preserved registry readiness and legacy list/search fallbacks while keyed detail uses V2 during compatibility rollback', async () => {
    await applyRegistry();
    seedLegacySummaryRows();
    seedVillaSaleSourceRows('appendable');
    vi.stubEnv('REAL_ESTATE_SUMMARY_MODE', 'compatibility');
    vi.stubEnv('REAL_ESTATE_URL_MODE', 'preserved');
    const { assertActiveSummaryReady } = await import('../../src/services/realEstateSummaryReadiness.js');
    const app = (await import('../../src/app.js')).default;

    await expect(assertActiveSummaryReady()).resolves.toEqual(expect.objectContaining({
      mode: 'compatibility',
      ready: true,
    }));

    const list = await request(app).get('/api/real-estate/villa-sale/complexes').query({
      city: '인천광역시',
      district: '미추홀구',
      page: 1,
      limit: 10,
    });
    expect(list.status).toBe(200);
    expect(list.body.data.items[0]).toEqual(expect.objectContaining({
      buildingName: 'BSVIEW',
      buildingKey: null,
      bjdCode: '2817710100',
      city: '인천광역시',
      district: '미추홀구',
      dongName: '도화동',
    }));
    expect(list.body.data.items[0].canonicalPath).toBeUndefined();
    expect(toRealEstateUrl({ ...list.body.data.items[0], type: 'villa-sale' })).toBe(legacyBasePath);

    const search = await request(app).get('/api/real-estate/villa-sale/complexes').query({
      keyword: 'BSVIEW',
      page: 1,
      limit: 10,
    });
    expect(search.status).toBe(200);
    expect(search.body.data.items[0]).toEqual(expect.objectContaining({
      buildingName: 'BSVIEW',
      buildingKey: null,
      bjdCode: '2817710100',
    }));
    expect(search.body.data.items[0].canonicalPath).toBeUndefined();
    expect(toRealEstateUrl({ ...search.body.data.items[0], type: 'villa-sale' })).toBe(legacyBasePath);

    const detail = await request(app).get('/api/real-estate/villa-sale/building-info').query({
      bjdCode: '2817710100',
      buildingName: 'BSVIEW',
      buildingKey: legacyOwnerKey,
    });
    expect(detail.status).toBe(200);
    expect(detail.body.data).toEqual(expect.objectContaining({
      buildingKey: legacyOwnerKey,
      bjdCode: '2817710100',
      buildingName: 'BSVIEW',
      canonicalPath: legacyBasePath,
      dongName: '도화동',
      jibun: '369-1',
    }));
  });

  it('returns 404 for known 64-hex public suffixes instead of exposing unpublished hash aliases', async () => {
    await applyDeferredRegistry();
    const app = (await import('../../src/app.js')).default;

    const uniqueAlias = await request(app).get('/api/real-estate/resolve-url').query({ path: `${uniqueCanonicalPath}/${uniqueKey}` });
    expect(uniqueAlias.status).toBe(404);
    expect(uniqueAlias.body.error.code).toBe('NOT_FOUND');

    const deferredAlias = await request(app).get('/api/real-estate/resolve-url').query({ path: deferredFirstHashAliasPath });
    expect(deferredAlias.status).toBe(404);
    expect(deferredAlias.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for an unknown preserved URL without guessing another building', async () => {
    await applyRegistry();
    const app = (await import('../../src/app.js')).default;

    const result = await request(app).get('/api/real-estate/resolve-url').query({
      path: `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('없는아파트')}`,
    });

    expect(result.status).toBe(404);
    expect(result.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 503 when the preserved URL registry cannot be read', async () => {
    await applyRegistry();
    mysqlInDatabase('DROP TABLE IF EXISTS RealEstatePublicUrlAlias, RealEstatePublicUrlState, RealEstatePublicUrl');
    const app = (await import('../../src/app.js')).default;

    const result = await request(app).get('/api/real-estate/resolve-url').query({ path: uniqueCanonicalPath });

    expect(result.status).toBe(503);
    expect(result.body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
