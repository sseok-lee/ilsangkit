import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { assertLocalTestDatabaseUrl } from '../../src/utils/testDatabaseGuard.js';
import { refreshLegacySummaries } from '../../src/services/realEstateLegacySummaryService.js';
import { TABLE_NAME_MAP } from '../../src/services/realEstateService.js';

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
const keyA = 'a'.repeat(64);
const keyB = 'b'.repeat(64);
const rentKeyA = 'c'.repeat(64);
const allTypes = Object.keys(TABLE_NAME_MAP);
const typeBasePrice: Record<string, number> = {
  'apt-sale': 100000,
  'apt-rent': 50000,
  'villa-sale': 70000,
  'villa-rent': 30000,
  'offitel-sale': 80000,
  'offitel-rent': 35000,
};
let app: Awaited<ReturnType<typeof importApp>>;
let lockDir: string;

async function importApp() {
  return (await import('../../src/app.js')).default;
}

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
    DROP TABLE IF EXISTS SearchLog;
    DROP TABLE IF EXISTS RealEstateSummaryState;
    DROP TABLE IF EXISTS RealEstateBuildingSummaryV2;
    DROP TABLE IF EXISTS RealEstateBuildingSummary;
    DROP TABLE IF EXISTS OffitelRentTransaction;
    DROP TABLE IF EXISTS VillaRentTransaction;
    DROP TABLE IF EXISTS AptRentTransaction;
    DROP TABLE IF EXISTS OffitelSaleTransaction;
    DROP TABLE IF EXISTS VillaSaleTransaction;
    DROP TABLE IF EXISTS AptSaleTransaction;
    DROP TABLE IF EXISTS Region;
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
      UNIQUE KEY RealEstateBuildingSummary_type_buildingName_bjdCode_key (type, buildingName, bjdCode),
      KEY RealEstateBuildingSummary_type_transactionCount_idx (type, transactionCount),
      KEY legacy_type_city_district_tx_idx (type, city, district, transactionCount),
      KEY RealEstateBuildingSummary_type_buildingName_idx (type, buildingName),
      KEY legacy_type_bjd_latest_tx_idx (type, bjdCode, latestDealYear, latestDealMonth, transactionCount),
      KEY RealEstateBuildingSummary_type_lat_lng_idx (type, lat, lng)
    );

    CREATE TABLE RealEstateBuildingSummaryV2 (
      id INT NOT NULL AUTO_INCREMENT,
      type VARCHAR(20) NOT NULL,
      buildingKey CHAR(64) NOT NULL,
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
      UNIQUE KEY RealEstateBuildingSummaryV2_type_buildingKey_key (type, buildingKey),
      KEY RealEstateBuildingSummaryV2_type_transactionCount_idx (type, transactionCount),
      KEY v2_type_city_district_tx_idx (type, city, district, transactionCount),
      KEY RealEstateBuildingSummaryV2_type_buildingName_idx (type, buildingName),
      KEY v2_type_bjd_latest_tx_idx (type, bjdCode, latestDealYear, latestDealMonth, transactionCount),
      KEY RealEstateBuildingSummaryV2_type_lat_lng_idx (type, lat, lng)
    );

    CREATE TABLE RealEstateSummaryState (
      id INT NOT NULL PRIMARY KEY,
      status VARCHAR(20) NOT NULL,
      runId VARCHAR(64) NOT NULL,
      sourceFingerprint CHAR(64) NOT NULL,
      report JSON NOT NULL,
      validatedAt DATETIME(3) NULL,
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)
    );

    CREATE TABLE AptSaleTransaction (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
      aptDong VARCHAR(50) NULL,
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
      UNIQUE KEY AptSaleTransaction_sourceId_key (sourceId),
      KEY apt_sale_identity_idx (bjdCode, buildingName, dongName, jibun),
      KEY apt_sale_summary_idx (buildingName, bjdCode, dongName, jibun, dealYear, dealMonth, dealDay, id)
    );

    CREATE TABLE VillaSaleTransaction LIKE AptSaleTransaction;
    CREATE TABLE OffitelSaleTransaction LIKE AptSaleTransaction;

    CREATE TABLE AptRentTransaction (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      bjdCode VARCHAR(10) NOT NULL,
      dongName VARCHAR(50) NOT NULL,
      buildingName VARCHAR(200) NOT NULL,
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
      rentType VARCHAR(10) NOT NULL,
      deposit BIGINT NOT NULL,
      monthlyRent INT NULL,
      contractTerm VARCHAR(30) NULL,
      contractType VARCHAR(10) NULL,
      preDeposit BIGINT NULL,
      preMonthlyRent INT NULL,
      useRenewalRight VARCHAR(10) NULL,
      sourceId VARCHAR(100) NOT NULL,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
      syncedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      geocodedAt DATETIME(3) NULL,
      UNIQUE KEY AptRentTransaction_sourceId_key (sourceId),
      KEY apt_rent_identity_idx (bjdCode, buildingName, dongName, jibun),
      KEY apt_rent_summary_idx (buildingName, bjdCode, dongName, jibun, dealYear, dealMonth, dealDay, id),
      KEY apt_rent_type_idx (rentType)
    );

    CREATE TABLE VillaRentTransaction LIKE AptRentTransaction;
    CREATE TABLE OffitelRentTransaction LIKE AptRentTransaction;

    CREATE TABLE Region (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      bjdCode VARCHAR(5) NOT NULL,
      city VARCHAR(50) NOT NULL,
      district VARCHAR(50) NOT NULL,
      slug VARCHAR(50) NOT NULL,
      lat DECIMAL(10,7) NOT NULL,
      lng DECIMAL(10,7) NOT NULL,
      UNIQUE KEY Region_bjdCode_key (bjdCode),
      UNIQUE KEY Region_city_district_key (city, district),
      UNIQUE KEY Region_city_slug_key (city, slug)
    );

    CREATE TABLE SearchLog (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      keyword VARCHAR(200) NOT NULL,
      category VARCHAR(50) NULL,
      resultCount INT NOT NULL DEFAULT 0,
      createdAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
    );

    INSERT INTO RealEstateSummaryState (id, status, runId, sourceFingerprint, report, validatedAt)
    VALUES (1, 'ready', 'summary-consumer-fixture', REPEAT('c', 64), JSON_OBJECT('complete', TRUE), '2026-09-29 00:00:00.000');

    INSERT INTO RealEstateBuildingSummary
      (type, buildingName, bjdCode, city, district, dongName, latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('apt-sale', '같은아파트', '1168010100', '서울특별시', '강남구', '역삼동', 100000, NULL, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 2),
      ('apt-rent', '같은아파트', '1168010100', '서울특별시', '강남구', '역삼동', 50000, 80, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 2),
      ('villa-sale', '테스트빌라', '1168010100', '서울특별시', '강남구', '역삼동', 70000, NULL, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1),
      ('villa-rent', '테스트빌라', '1168010100', '서울특별시', '강남구', '역삼동', 30000, 60, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1),
      ('offitel-sale', '테스트오피스텔', '1168010100', '서울특별시', '강남구', '역삼동', 80000, NULL, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1),
      ('offitel-rent', '테스트오피스텔', '1168010100', '서울특별시', '강남구', '역삼동', 35000, 70, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1);

    INSERT INTO RealEstateBuildingSummaryV2
      (type, buildingKey, buildingName, bjdCode, city, district, dongName, jibun, latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount)
    VALUES
      ('apt-sale', '${keyA}', '같은아파트', '1168010100', '서울특별시', '강남구', '역삼동', '1-1', 100000, NULL, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 2),
      ('apt-sale', '${keyB}', '같은아파트', '1168010100', '서울특별시', '강남구', '역삼동', '2-2', 120000, NULL, 2026, 9, 11, 2002, 37.5020000, 127.0320000, 3),
      ('apt-rent', '${rentKeyA}', '같은아파트', '1168010100', '서울특별시', '강남구', '역삼동', '1-1', 50000, 80, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 2),
      ('villa-sale', 'd${'d'.repeat(63)}', '테스트빌라', '1168010100', '서울특별시', '강남구', '역삼동', '3-3', 70000, NULL, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1),
      ('villa-rent', 'e${'e'.repeat(63)}', '테스트빌라', '1168010100', '서울특별시', '강남구', '역삼동', '3-3', 30000, 60, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1),
      ('offitel-sale', 'f${'f'.repeat(63)}', '테스트오피스텔', '1168010100', '서울특별시', '강남구', '역삼동', '4-4', 80000, NULL, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1),
      ('offitel-rent', 'g${'g'.repeat(63)}', '테스트오피스텔', '1168010100', '서울특별시', '강남구', '역삼동', '4-4', 35000, 70, 2026, 9, 10, 2001, 37.5010000, 127.0310000, 1);

    INSERT INTO AptSaleTransaction
      (dealAmount, buildYear, dealYear, dealMonth, dealDay, city, district, dongName, buildingName, bjdCode, jibun, roadName, exclusiveArea, floor, lat, lng, cancelDealDay, cancelDealType, sourceId)
    VALUES
      (100000, 2001, 2026, 9, 10, '서울특별시', '강남구', '역삼동', '같은아파트', '1168010100', '1-1', '테헤란로1', 84.1000, 10, 37.5010000, 127.0310000, NULL, NULL, 'apt-sale-a'),
      (120000, 2002, 2026, 9, 11, '서울특별시', '강남구', '역삼동', '같은아파트', '1168010100', '2-2', '테헤란로2', 84.2000, 11, 37.5020000, 127.0320000, NULL, NULL, 'apt-sale-b');

    INSERT INTO AptRentTransaction
      (deposit, monthlyRent, rentType, buildYear, dealYear, dealMonth, dealDay, city, district, dongName, buildingName, bjdCode, jibun, roadName, exclusiveArea, floor, lat, lng, sourceId)
    VALUES
      (50000, 80, '월세', 2001, 2026, 9, 10, '서울특별시', '강남구', '역삼동', '같은아파트', '1168010100', '1-1', '테헤란로1', 84.1000, 10, 37.5010000, 127.0310000, 'apt-rent-a');

    INSERT INTO Region (bjdCode, city, district, slug, lat, lng)
    VALUES ('11680', '서울특별시', '강남구', 'gangnam', 37.5000000, 127.0300000);
  `);
}

beforeAll(async () => {
  process.env.DATABASE_URL = databaseUrl;
  process.env.NODE_ENV = 'test';
  resetDatabase();
  lockDir = mkdtempSync(join(tmpdir(), 'summary-consumers-lock-'));
  process.env.REAL_ESTATE_WRITE_LOCK_DIR = lockDir;
  app = await importApp();


});

afterAll(async () => {
  delete process.env.REAL_ESTATE_SUMMARY_MODE;
  delete process.env.REAL_ESTATE_WRITE_LOCK_DIR;
  if (lockDir) rmSync(lockDir, { recursive: true, force: true });
  await prisma.$disconnect();
});

describe('summary consumers integration', () => {
  it('serves address-mode list/map/sitemap as separate keyed addresses', async () => {
    delete process.env.REAL_ESTATE_SUMMARY_MODE;

    const list = await request(app)
      .get('/api/real-estate/apt-sale/complexes')
      .query({ city: '서울특별시', district: '강남구', buildingName: '같은', page: 1, limit: 10 })
      .expect(200);
    expect(list.body.data.total).toBe(2);
    expect(list.body.data.items.map((item: { buildingKey: string }) => item.buildingKey).sort()).toEqual([keyA, keyB]);

    const map = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 4, swLat: 37.5, swLng: 127.03, neLat: 37.503, neLng: 127.033 })
      .expect(200);
    expect(map.body.data.granularity).toBe('building');
    expect(map.body.data.total).toBe(2);
    expect(map.body.data.items.map((item: { buildingKey: string }) => item.buildingKey).sort()).toEqual([keyA, keyB]);

    const sitemap = await request(app)
      .get('/api/sitemap/real-estate-buildings')
      .query({ page: 1, limit: 10 })
      .expect(200);
    expect(sitemap.body.total).toBe(7);
    const aptSaleSitemapKeys = sitemap.body.data
      .filter((item: { realEstateType: string }) => item.realEstateType === 'apt-sale')
      .map((item: { buildingKey: string }) => item.buildingKey)
      .sort();
    expect(aptSaleSitemapKeys).toEqual([keyA, keyB]);
  });

  it('serves compatibility list/map/sitemap from old-schema legacy rows without generated keys', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';

    const list = await request(app)
      .get('/api/real-estate/apt-sale/complexes')
      .query({ city: '서울특별시', district: '강남구', buildingName: '같은', page: 1, limit: 10 })
      .expect(200);
    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].buildingKey).toBeNull();
    expect(list.body.data.items[0].jibun).toBeNull();

    const map = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: 4, swLat: 37.5, swLng: 127.03, neLat: 37.503, neLng: 127.033 })
      .expect(200);
    expect(map.body.data.total).toBe(1);
    expect(map.body.data.items[0].buildingKey).toBeNull();

    const sitemap = await request(app)
      .get('/api/sitemap/real-estate-buildings')
      .query({ page: 1, limit: 10 })
      .expect(200);
    expect(sitemap.body.total).toBe(6);
    expect(sitemap.body.data.every((item: { buildingKey: string | null }) => item.buildingKey === null)).toBe(true);
  });

  it('keeps keyed detail stable across address and compatibility modes', async () => {
    delete process.env.REAL_ESTATE_SUMMARY_MODE;
    const address = await request(app)
      .get('/api/real-estate/apt-sale/building-info')
      .query({ bjdCode: '1168010100', buildingName: '같은아파트', buildingKey: keyB })
      .expect(200);

    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    const compatibility = await request(app)
      .get('/api/real-estate/apt-sale/building-info')
      .query({ bjdCode: '1168010100', buildingName: '같은아파트', buildingKey: keyB })
      .expect(200);

    expect(compatibility.body.data).toMatchObject({
      buildingKey: keyB,
      buildingName: '같은아파트',
      bjdCode: '1168010100',
      dongName: '역삼동',
      jibun: '2-2',
      latestDealAmount: 120000,
      latestDealYear: 2026,
      latestDealMonth: 9,
    });
    expect(compatibility.body.data).toEqual(address.body.data);
  });

  it('serves search suggestions from V2 by default and legacy shape in compatibility mode', async () => {
    delete process.env.REAL_ESTATE_SUMMARY_MODE;
    const address = await request(app)
      .get('/api/search/suggest')
      .query({ q: '같은', scope: 'realestate' })
      .expect(200);
    const addressBuildings = address.body.data.items.filter((item: { type: string }) => item.type === 'building');
    expect(addressBuildings.map((item: { buildingKey?: string }) => item.buildingKey).sort()).toEqual([keyA, keyB, rentKeyA]);

    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    const compatibility = await request(app)
      .get('/api/search/suggest')
      .query({ q: '같은', scope: 'realestate' })
      .expect(200);
    const compatibilityBuildings = compatibility.body.data.items.filter((item: { type: string }) => item.type === 'building');
    expect(compatibilityBuildings).toHaveLength(2);
    expect(compatibilityBuildings.every((item: { buildingKey?: string }) => item.buildingKey === undefined)).toBe(true);
    expect(compatibilityBuildings.map((item: { sublabel: string }) => item.sublabel).sort()).toEqual(['강남구 · 거래 2건', '강남구 · 거래 2건']);
  });
  it('serves list totals for all six real-estate types in both modes', async () => {
    for (const mode of ['address', 'compatibility'] as const) {
      if (mode === 'address') delete process.env.REAL_ESTATE_SUMMARY_MODE;
      else process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';

      for (const type of allTypes) {
        const response = await request(app)
          .get(`/api/real-estate/${type}/complexes`)
          .query({ city: '서울특별시', district: '강남구', page: 1, limit: 10 })
          .expect(200);

        expect(response.body.data.total, `${mode}/${type}`).toBe(type === 'apt-sale' && mode === 'address' ? 2 : 1);
        const expectedPrice = mode === 'address' && type === 'apt-sale' ? 120000 : typeBasePrice[type];
        expect(Number(response.body.data.items[0].latestPrice), `${mode}/${type}`).toBe(expectedPrice);
        if (mode === 'address') expect(response.body.data.items[0].buildingKey, `${mode}/${type}`).toBeTruthy();
        else expect(response.body.data.items[0].buildingKey, `${mode}/${type}`).toBeNull();
      }
    }
  });

  it('keeps sale and rent keyed detail stable across address and compatibility modes for the same address', async () => {
    for (const { type, key, priceField, price } of [
      { type: 'apt-sale', key: keyA, priceField: 'latestDealAmount', price: 100000 },
      { type: 'apt-rent', key: rentKeyA, priceField: 'latestDealAmount', price: 50000 },
    ]) {
      delete process.env.REAL_ESTATE_SUMMARY_MODE;
      const address = await request(app)
        .get(`/api/real-estate/${type}/building-info`)
        .query({ bjdCode: '1168010100', buildingName: '같은아파트', buildingKey: key })
        .expect(200);

      process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
      const compatibility = await request(app)
        .get(`/api/real-estate/${type}/building-info`)
        .query({ bjdCode: '1168010100', buildingName: '같은아파트', buildingKey: key })
        .expect(200);

      expect(compatibility.body.data).toEqual(address.body.data);
      expect(compatibility.body.data).toMatchObject({
        buildingKey: key,
        buildingName: '같은아파트',
        bjdCode: '1168010100',
        dongName: '역삼동',
        jibun: '1-1',
      });
      expect(Number(compatibility.body.data[priceField]), type).toBe(price);
    }
  });

  it('keeps search totals and sitemap index URL payloads bound to the active mode', async () => {
    delete process.env.REAL_ESTATE_SUMMARY_MODE;
    const addressSearch = await request(app)
      .get('/api/real-estate/search')
      .query({ keyword: '같은아파트', city: '서울특별시', district: '강남구' })
      .expect(200);
    expect(addressSearch.body.data.buildingCounts.apt).toBe(3);

    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    const compatibilitySearch = await request(app)
      .get('/api/real-estate/search')
      .query({ keyword: '같은아파트', city: '서울특별시', district: '강남구' })
      .expect(200);
    expect(compatibilitySearch.body.data.buildingCounts.apt).toBe(2);

    const compatibilitySitemap = await request(app)
      .get('/api/sitemap/real-estate-buildings')
      .query({ page: 1, limit: 10 })
      .expect(200);
    expect(compatibilitySitemap.body.data.every((item: { buildingKey: string | null }) => item.buildingKey === null)).toBe(true);
  });

  it('compatibility CLI refreshes legacy and V2 summaries after raw source updates without stale rows', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    await prisma.$executeRawUnsafe(
      `INSERT INTO AptSaleTransaction
        (dealAmount, buildYear, dealYear, dealMonth, dealDay, city, district, dongName, buildingName, bjdCode, jibun, roadName, exclusiveArea, floor, lat, lng, cancelDealDay, cancelDealType, sourceId)
       VALUES
        (130000, 2003, 2026, 9, 12, '서울특별시', '강남구', '역삼동', '같은아파트', '1168010100', '3-3', '테헤란로3', 84.3000, 12, 37.5030000, 127.0330000, NULL, NULL, 'apt-sale-c')`,
    );

    execFileSync('npx', ['tsx', 'src/scripts/refreshRealEstateSummary.ts'], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        REAL_ESTATE_SUMMARY_MODE: 'compatibility',
        REAL_ESTATE_WRITE_LOCK_DIR: lockDir,
        NODE_ENV: 'test',
      },
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const legacyRows = await prisma.$queryRawUnsafe<Array<{ transactionCount: number; latestPrice: bigint }>>(
      `SELECT transactionCount, latestPrice
       FROM RealEstateBuildingSummary
       WHERE type = 'apt-sale' AND buildingName = '같은아파트' AND bjdCode = '1168010100'`,
    );
    expect(legacyRows).toHaveLength(1);
    expect(legacyRows[0].transactionCount).toBe(3);
    expect(Number(legacyRows[0].latestPrice)).toBe(130000);

    const v2Rows = await prisma.$queryRawUnsafe<Array<{ count: bigint; maxPrice: bigint }>>(
      `SELECT COUNT(*) AS count, MAX(latestPrice) AS maxPrice
       FROM RealEstateBuildingSummaryV2
       WHERE type = 'apt-sale' AND buildingName = '같은아파트' AND bjdCode = '1168010100'`,
    );
    expect(Number(v2Rows[0].count)).toBe(3);
    expect(Number(v2Rows[0].maxPrice)).toBe(130000);
  });

  it('refreshes compatibility legacy summary with old-schema grouping and no key columns', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    const result = await refreshLegacySummaries(['apt-sale']);
    expect(result.complete).toBe(true);

    const rows = await prisma.$queryRawUnsafe<Array<{ buildingName: string; bjdCode: string; transactionCount: number; latestPrice: bigint }>>(
      `SELECT buildingName, bjdCode, transactionCount, latestPrice
       FROM RealEstateBuildingSummary
       WHERE type = 'apt-sale'
       ORDER BY id`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ buildingName: '같은아파트', bjdCode: '1168010100', transactionCount: 3 });
    expect(Number(rows[0].latestPrice)).toBe(130000);

    const columns = await prisma.$queryRawUnsafe<Array<{ COLUMN_NAME: string }>>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'RealEstateBuildingSummary'
         AND COLUMN_NAME IN ('buildingKey', 'jibun')`,
    );
    expect(columns).toEqual([]);
  });
});
