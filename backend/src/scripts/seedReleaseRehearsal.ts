import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBuildingKey } from '../lib/realEstateBuildingIdentity.js';
import { toRealEstateListUrl, toRealEstateUrl } from '../lib/realEstateUrl.js';
import { assertLocalTestDatabaseUrl } from '../utils/testDatabaseGuard.js';

const DEFAULT_DATABASE_URL = 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test';
const DEFAULT_REPORT_PATH = '../.superpowers/sdd/2026-09-29-branch-review-fixes/c3-release-fixture-report.json';
const DEFAULT_MYSQL_CONTAINER = 'ilsangkit-mysql';
const ORIGIN_MAIN_SCHEMA_REF = 'origin/main:backend/prisma/schema.prisma';

const FIXTURE_DB_NAME = 'ilsangkit_c3_release_20260929_test';
const CITY = '서울특별시';
const DISTRICT = '강남구';
const DONG = '역삼동';
const BJD_CODE = '1168010100';
const REGION_BJD_CODE = '11680';
const BUILDING_NAME = 'C3공통주택';
const SINGLE_ADDRESS_APT_SALE_BUILDING_NAME = 'C3기존단일주택';
const SINGLE_ADDRESS_APT_SALE_JIBUN = '333-3';
const SINGLE_ADDRESS_APT_SALE_ROAD_ADDRESS = '서울특별시 강남구 테헤란로 333';
const SINGLE_ADDRESS_APT_SALE_SOURCE_ID = 'c3-apt-sale-single-old-url';
const FIXTURE_NOW = '2026-09-29 09:00:00';
const FIXTURE_DATE_ISO = '2026-09-29T00:00:00.000Z';

export const RELEASE_REHEARSAL_TYPES = [
  { type: 'apt-sale', table: 'AptSaleTransaction', propertyType: 'apt', contract: 'sale' },
  { type: 'apt-rent', table: 'AptRentTransaction', propertyType: 'apt', contract: 'rent' },
  { type: 'villa-sale', table: 'VillaSaleTransaction', propertyType: 'villa', contract: 'sale' },
  { type: 'villa-rent', table: 'VillaRentTransaction', propertyType: 'villa', contract: 'rent' },
  { type: 'offitel-sale', table: 'OffitelSaleTransaction', propertyType: 'offitel', contract: 'sale' },
  { type: 'offitel-rent', table: 'OffitelRentTransaction', propertyType: 'offitel', contract: 'rent' },
] as const;

type ReleaseRehearsalType = typeof RELEASE_REHEARSAL_TYPES[number]['type'];
type ReleaseRehearsalPropertyType = typeof RELEASE_REHEARSAL_TYPES[number]['propertyType'];

type SeedConnection = {
  url: string;
  databaseName: string;
  host: string;
  port: number;
  user: string;
  password: string;
};

type CliOptions = {
  databaseUrl: string;
  mysqlContainer: string;
  reportPath: string;
  rawUpdate: boolean;
};

type FixtureReport = ReturnType<typeof createFixtureReport>;

const ADDRESS_FIXTURES = [
  {
    label: 'address-a',
    jibun: '101-1',
    roadAddress: '서울특별시 강남구 테헤란로 101',
    latitude: 37.5011,
    longitude: 127.0396,
  },
  {
    label: 'address-b',
    jibun: '202-2',
    roadAddress: '서울특별시 강남구 테헤란로 202',
    latitude: 37.5042,
    longitude: 127.0428,
  },
] as const;

const ADDITIVE_TABLES_OWNED_BY_C1 = [
  'RealEstateSummaryState',
  'RealEstateBuildingSummaryV2',
  'WastePublication',
  'WasteGeneration',
  'WasteAreaRelation',
  'WasteAreaEntry',
  'WasteArea',
  'WasteScheduleCoverage',
  'WasteScheduleRevision',
  'WasteStagedSchedule',
];

let originMainSchemaCache: string | null = null;
let originMainDdlCache: string | null = null;

function repoRoot(): string {
  const currentFile = fileURLToPath(import.meta.url);
  return resolve(dirname(currentFile), '../../..');
}

function backendRoot(): string {
  return resolve(repoRoot(), 'backend');
}

function sqlString(value: string | null | undefined): string {
  if (value === null || value === undefined) return 'NULL';
  return `'${value.replace(/'/g, "''")}'`;
}

function sqlJson(value: unknown): string {
  return sqlString(JSON.stringify(value));
}

function sqlIdentifier(value: string): string {
  if (!/^[A-Za-z0-9_]+$/.test(value)) {
    throw new Error(`Unsafe SQL identifier: ${value}`);
  }
  return `\`${value}\``;
}

function sqlNumber(value: number): string {
  if (!Number.isFinite(value)) throw new Error(`Unsafe SQL number: ${value}`);
  return String(value);
}

export function readOriginMainPrismaSchema(): string {
  if (originMainSchemaCache) return originMainSchemaCache;
  originMainSchemaCache = execFileSync('git', ['show', ORIGIN_MAIN_SCHEMA_REF], {
    cwd: repoRoot(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return originMainSchemaCache;
}

export function originMainSchemaFingerprint(): string {
  return createHash('sha256').update(readOriginMainPrismaSchema()).digest('hex');
}

export function generateOriginMainPrismaDdl(): string {
  if (originMainDdlCache) return originMainDdlCache;

  const tempDir = mkdtempSync(join(tmpdir(), 'c3-origin-main-prisma-'));
  const schemaPath = join(tempDir, 'schema.prisma');
  writeFileSync(schemaPath, readOriginMainPrismaSchema());

  originMainDdlCache = execFileSync(
    'npx',
    ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script'],
    {
      cwd: backendRoot(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, PATH: process.env.PATH },
    },
  );
  return originMainDdlCache;
}

export function listOriginMainTables(ddl = generateOriginMainPrismaDdl()): string[] {
  return Array.from(ddl.matchAll(/CREATE TABLE `([^`]+)`/g)).map((match) => match[1]);
}

function buildDropTablesSql(tables: string[]): string {
  const allTables = Array.from(new Set([...ADDITIVE_TABLES_OWNED_BY_C1, ...tables])).reverse();
  return allTables.map((table) => `DROP TABLE IF EXISTS ${sqlIdentifier(table)};`).join('\n');
}

function now(): string {
  return sqlString(FIXTURE_NOW);
}

function saleInsert(table: string, sourceId: string, addressIndex: number, amount: number, rawUpdate = false): string {
  const address = ADDRESS_FIXTURES[addressIndex];
  const dealMonth = rawUpdate ? 9 : addressIndex + 1;
  const dealDay = rawUpdate ? 29 : addressIndex + 10;
  const columns = [
    'city', 'district', 'bjdCode', 'dongName', 'buildingName',
    ...(table === 'AptSaleTransaction' ? ['aptDong'] : []),
    ...(table === 'VillaSaleTransaction' ? ['houseType'] : []),
    'buildYear', 'floor', 'exclusiveArea', 'jibun', 'roadName', 'lat', 'lng',
    'dealYear', 'dealMonth', 'dealDay', 'dealAmount', 'dealType', 'cancelDealDay', 'cancelDealType',
    'buyerType', 'sellerType',
    ...(table === 'OffitelSaleTransaction' ? [] : ['registrationDate']),
    'sourceId', 'updatedAt', 'syncedAt', 'geocodedAt',
  ];
  const values = [
    sqlString(CITY), sqlString(DISTRICT), sqlString(BJD_CODE), sqlString(DONG), sqlString(BUILDING_NAME),
    ...(table === 'AptSaleTransaction' ? [sqlString(`C3-${addressIndex + 1}동`)] : []),
    ...(table === 'VillaSaleTransaction' ? [sqlString('연립다세대')] : []),
    '2014', sqlNumber(addressIndex + (rawUpdate ? 15 : 5)), addressIndex === 0 ? '59.84' : '84.97', sqlString(address.jibun), sqlString(address.roadAddress), sqlNumber(address.latitude), sqlNumber(address.longitude),
    '2026', sqlNumber(dealMonth), sqlNumber(dealDay), sqlNumber(amount), sqlString('중개거래'), 'NULL', 'NULL',
    sqlString('개인'), sqlString('개인'),
    ...(table === 'OffitelSaleTransaction' ? [] : [sqlString(`2026-${String(dealMonth).padStart(2, '0')}-${String(dealDay).padStart(2, '0')}`)]),
    sqlString(sourceId), now(), now(), now(),
  ];

  return `INSERT INTO ${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(', ')}) VALUES (${values.join(', ')});`;
}


function singleAddressAptSaleInsert(): string {
  const columns = [
    'city', 'district', 'bjdCode', 'dongName', 'buildingName', 'aptDong',
    'buildYear', 'floor', 'exclusiveArea', 'jibun', 'roadName', 'lat', 'lng',
    'dealYear', 'dealMonth', 'dealDay', 'dealAmount', 'dealType', 'cancelDealDay', 'cancelDealType',
    'buyerType', 'sellerType', 'registrationDate', 'sourceId', 'updatedAt', 'syncedAt', 'geocodedAt',
  ];
  const values = [
    sqlString(CITY), sqlString(DISTRICT), sqlString(BJD_CODE), sqlString(DONG), sqlString(SINGLE_ADDRESS_APT_SALE_BUILDING_NAME), sqlString('C3-기존동'),
    '2016', '9', '72.50', sqlString(SINGLE_ADDRESS_APT_SALE_JIBUN), sqlString(SINGLE_ADDRESS_APT_SALE_ROAD_ADDRESS), '37.5063', '127.0451',
    '2026', '7', '21', '640000', sqlString('중개거래'), 'NULL', 'NULL',
    sqlString('개인'), sqlString('개인'), sqlString('2026-07-21'), sqlString(SINGLE_ADDRESS_APT_SALE_SOURCE_ID), now(), now(), now(),
  ];

  return `INSERT INTO AptSaleTransaction (${columns.map(sqlIdentifier).join(', ')}) VALUES (${values.join(', ')});`;
}

function singleAddressAptSaleLegacySummaryInsert(): string {
  return `INSERT INTO RealEstateBuildingSummary (type, buildingName, bjdCode, city, district, dongName, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount, monthlyRent, jeonseDeposit, jeonseDealKey, wolseDeposit, wolseMonthlyRent, wolseDealKey, updatedAt) VALUES ('apt-sale', ${sqlString(SINGLE_ADDRESS_APT_SALE_BUILDING_NAME)}, ${sqlString(BJD_CODE)}, ${sqlString(CITY)}, ${sqlString(DISTRICT)}, ${sqlString(DONG)}, 640000, 2026, 7, 21, 2016, 37.5063000, 127.0451000, 1, NULL, NULL, NULL, NULL, NULL, NULL, ${now()});`;
}

export function buildAdditiveSingleAddressAptSaleSql(): string {
  return [singleAddressAptSaleInsert(), singleAddressAptSaleLegacySummaryInsert()].join('\n');
}

function rentInsert(table: string, sourceId: string, addressIndex: number, rentType: '전세' | '월세', deposit: number, monthlyRent: number, rawUpdate = false): string {
  const address = ADDRESS_FIXTURES[addressIndex];
  const isJeonse = rentType === '전세';
  const dealMonth = rawUpdate ? 9 : addressIndex + (isJeonse ? 3 : 5);
  const dealDay = rawUpdate ? 29 : addressIndex + (isJeonse ? 11 : 17);
  const columns = [
    'city', 'district', 'bjdCode', 'dongName', 'buildingName',
    ...(table === 'VillaRentTransaction' ? ['houseType'] : []),
    'buildYear', 'floor', 'exclusiveArea', 'jibun', 'roadName', 'lat', 'lng',
    'dealYear', 'dealMonth', 'dealDay', 'rentType', 'deposit', 'monthlyRent',
    'contractTerm', 'contractType', 'preDeposit', 'preMonthlyRent', 'useRenewalRight',
    'sourceId', 'updatedAt', 'syncedAt', 'geocodedAt',
  ];
  const values = [
    sqlString(CITY), sqlString(DISTRICT), sqlString(BJD_CODE), sqlString(DONG), sqlString(BUILDING_NAME),
    ...(table === 'VillaRentTransaction' ? [sqlString('연립다세대')] : []),
    '2014', sqlNumber(addressIndex + (rawUpdate ? 20 : isJeonse ? 8 : 12)), addressIndex === 0 ? '59.84' : '84.97', sqlString(address.jibun), sqlString(address.roadAddress), sqlNumber(address.latitude), sqlNumber(address.longitude),
    '2026', sqlNumber(dealMonth), sqlNumber(dealDay), sqlString(rentType), sqlNumber(deposit), monthlyRent === 0 ? '0' : sqlNumber(monthlyRent),
    sqlString('2026.09~2028.09'), sqlString('신규'), sqlNumber(Math.max(deposit - 1000, 0)), sqlNumber(Math.max(monthlyRent - 5, 0)), sqlString('N'),
    sqlString(sourceId), now(), now(), now(),
  ];

  return `INSERT INTO ${sqlIdentifier(table)} (${columns.map(sqlIdentifier).join(', ')}) VALUES (${values.join(', ')});`;
}

function buildRealEstateSourceSql(): string {
  const statements: string[] = [];

  statements.push(singleAddressAptSaleInsert());

  for (const fixture of RELEASE_REHEARSAL_TYPES) {
    if (fixture.contract === 'sale') {
      statements.push(saleInsert(fixture.table, `c3-${fixture.type}-a`, 0, 510000));
      statements.push(saleInsert(fixture.table, `c3-${fixture.type}-b`, 1, 620000));
    } else {
      statements.push(rentInsert(fixture.table, `c3-${fixture.type}-a-jeonse`, 0, '전세', 430000, 0));
      statements.push(rentInsert(fixture.table, `c3-${fixture.type}-a-wolse`, 0, '월세', 20000, 170));
      statements.push(rentInsert(fixture.table, `c3-${fixture.type}-b-jeonse`, 1, '전세', 520000, 0));
      statements.push(rentInsert(fixture.table, `c3-${fixture.type}-b-wolse`, 1, '월세', 30000, 210));
    }
  }

  return statements.join('\n');
}

function buildLegacySummarySql(): string {
  return [
    singleAddressAptSaleLegacySummaryInsert(),
    ...RELEASE_REHEARSAL_TYPES.map(({ type, contract }) => {
    const latestPrice = contract === 'sale' ? 620000 : 520000;
    const monthlyRent = contract === 'sale' ? 'NULL' : '0';
    const transactionCount = contract === 'sale' ? 2 : 4;
    return `INSERT INTO RealEstateBuildingSummary (type, buildingName, bjdCode, city, district, dongName, latestPrice, latestDealYear, latestDealMonth, latestDealDay, buildYear, lat, lng, transactionCount, monthlyRent, jeonseDeposit, jeonseDealKey, wolseDeposit, wolseMonthlyRent, wolseDealKey, updatedAt) VALUES (${sqlString(type)}, ${sqlString(BUILDING_NAME)}, ${sqlString(BJD_CODE)}, ${sqlString(CITY)}, ${sqlString(DISTRICT)}, ${sqlString(DONG)}, ${latestPrice}, 2026, 6, 18, 2014, 37.5042000, 127.0428000, ${transactionCount}, ${monthlyRent}, ${contract === 'rent' ? 520000 : 'NULL'}, ${contract === 'rent' ? 20260618 : 'NULL'}, ${contract === 'rent' ? 30000 : 'NULL'}, ${contract === 'rent' ? 210 : 'NULL'}, ${contract === 'rent' ? 20260619 : 'NULL'}, ${now()});`;
  }),
  ].join('\n');
}

function buildRegionSql(): string {
  return `INSERT INTO Region (bjdCode, city, district, slug, lat, lng) VALUES (${sqlString(REGION_BJD_CODE)}, ${sqlString(CITY)}, ${sqlString(DISTRICT)}, 'gangnam', 37.5172363, 127.0473248);`;
}

function buildLandSql(): string {
  const statements: string[] = [];
  const landUses = ['A구역 상업용지', 'B구역 업무용지', '업무시설', '주거복합', '근린생활'];
  for (let index = 0; index < 24; index += 1) {
    const area = 100 + index * 3.5;
    const amount = 1_500_000 + index * 25_000;
    const month = (index % 9) + 1;
    const day = (index % 25) + 1;
    const landUse = landUses[index % landUses.length];
    const jimok = index % 3 === 0 ? '대' : index % 3 === 1 ? '잡종지' : '도로';
    const jibun = `${index % 2 === 0 ? 'A' : 'B'}-${index + 1}`;
    statements.push(`INSERT INTO LandSaleTransaction (city, district, bjdCode, dongName, jibun, jimok, landUse, dealArea, shareDeal, dealAmount, dealType, dealYear, dealMonth, dealDay, cancelDealDay, cancelDealType, sourceId, updatedAt, syncedAt) VALUES (${sqlString(CITY)}, ${sqlString(DISTRICT)}, ${sqlString(BJD_CODE)}, ${sqlString(DONG)}, ${sqlString(jibun)}, ${sqlString(jimok)}, ${sqlString(landUse)}, ${area.toFixed(2)}, ${index % 4 === 0 ? 'TRUE' : 'FALSE'}, ${amount}, ${sqlString('중개거래')}, 2026, ${month}, ${day}, NULL, NULL, ${sqlString(`c3-land-${index + 1}`)}, ${now()}, ${now()});`);
  }

  statements.push(`INSERT INTO LandAreaSummary (bjdCode, dongName, city, district, transactionCount, recentCount, avgPricePerPyeong, daeCount, daeNonShareCount, latestDealDate, jimokBreakdown, isIndexable, updatedAt) VALUES (${sqlString(BJD_CODE)}, ${sqlString(DONG)}, ${sqlString(CITY)}, ${sqlString(DISTRICT)}, 24, 24, 45500000.00, 8, 6, ${sqlString('2026-09-29 00:00:00')}, ${sqlJson({ 대: 8, 잡종지: 8, 도로: 8 })}, TRUE, ${now()});`);
  return statements.join('\n');
}

function buildWasteSql(): string {
  return `INSERT INTO WasteSchedule (id, city, district, targetRegion, emissionPlace, details, sourceId, sourceUrl, govCode, updatedAt, syncedAt) VALUES (1001, ${sqlString(CITY)}, ${sqlString(DISTRICT)}, ${sqlString(DONG)}, ${sqlString('내 집 앞 지정 장소')}, ${sqlJson({ title: 'C3 릴리즈 리허설용 쓰레기 배출 안내', wasteType: '생활쓰레기', collectionDays: ['월', '수', '금'], emissionTime: '일몰 후 18:00~24:00' })}, 'c3-waste-1001', 'https://example.local/c3/waste', '3220000', ${now()}, ${now()});`;
}

function buildSubscriptionSql(): string {
  return `INSERT INTO Subscription (id, houseManageNo, pblancNo, sourceType, houseName, houseType, houseDetailType, rentType, publicRentType, regionName, supplyLocation, supplyZipCode, totalSupplyCount, announcementDate, receptionStartDate, receptionEndDate, winnerDate, contractStartDate, contractEndDate, moveInMonth, constructorName, developerName, homepage, pblancUrl, inquiryTel, status, lat, lng, geocodedAt, geocodeAttempts, updatedAt) VALUES (1, 'C3HM1', 'C3PB1', 'APT', 'C3 리허설 분양', 'APT', '민영', NULL, NULL, '서울', '서울특별시 강남구 역삼동', '06236', 12, ${sqlString('2026-09-01 00:00:00')}, ${sqlString('2026-09-29 00:00:00')}, ${sqlString('2026-10-10 00:00:00')}, ${sqlString('2026-10-20 00:00:00')}, ${sqlString('2026-11-01 00:00:00')}, ${sqlString('2026-11-05 00:00:00')}, '2027-03', 'C3건설', 'C3시행', 'https://example.local/c3/subscription', 'https://example.local/c3/subscription/source', '02-0000-0000', '접수중', 37.5011000, 127.0396000, ${now()}, 0, ${now()});
INSERT INTO SubscriptionUnitType (subscriptionId, modelNo, houseType, supplyArea, generalCount, specialCount, topAmount, newlywedsCount, multiChildCount, firstLifeCount, elderlyCount, institutionCount, youthCount, newbornCount, transferCount, etcCount) VALUES (1, '084A', '84A', '84.97', 8, 4, 120000, 1, 1, 1, 1, 0, 0, 0, 0, 0);`;
}

function buildContentSql(): string {
  return `INSERT INTO Guide (id, title, slug, content, summary, category, articleType, thumbnailUrl, keywords, published, viewCount, publishedAt, updatedAt) VALUES ('guide-c3-release', 'C3 생활정보 이용 가이드', 'c3-release-guide', 'C3 리허설 fixture guide content', '릴리즈 리허설 baseline 가이드입니다.', '생활정보', 'news', NULL, 'c3,release', TRUE, 3, ${now()}, ${now()});
INSERT INTO Article (id, title, slug, content, summary, category, articleType, thumbnailUrl, keywords, sources, sourceExternalId, status, viewCount, publishedAt, updatedAt) VALUES ('article-c3-release', 'C3 동네소식', 'c3-release-article', 'C3 리허설 fixture article content', '릴리즈 리허설 baseline 기사입니다.', '동네소식', 'local', NULL, 'c3,release', ${sqlJson([{ name: 'C3', url: 'https://example.local/c3/article' }])}, 'c3-release-article', 'published', 4, ${now()}, ${now()});`;
}

function buildFacilitySql(): string {
  return `INSERT INTO Hospital (id, name, address, roadAddress, lat, lng, city, district, bjdCode, sourceId, sourceUrl, updatedAt, syncedAt, phone, ykiho) VALUES ('hospital-c3-1', 'C3 리허설 병원', '서울특별시 강남구 역삼동 101-1', '서울특별시 강남구 테헤란로 101', 37.5011000, 127.0396000, ${sqlString(CITY)}, ${sqlString(DISTRICT)}, '11680', 'c3-hospital-1', 'https://example.local/c3/hospital', ${now()}, ${now()}, '02-1111-2222', 'C3YKIHO');`;
}

function buildSearchAndSyncSql(): string {
  return `INSERT INTO SearchLog (sessionId, keyword, category, city, district, lat, lng, resultCount) VALUES ('c3-session', 'C3공통주택', 'real-estate', ${sqlString(CITY)}, ${sqlString(DISTRICT)}, 37.5011000, 127.0396000, 6);
INSERT INTO SyncHistory (category, status, totalRecords, newRecords, updatedRecords, startedAt, completedAt) VALUES ('c3-release', 'success', 1, 1, 0, ${now()}, ${now()});`;
}

function buildSeedRowsSql(): string {
  return [
    buildRegionSql(),
    buildRealEstateSourceSql(),
    buildLegacySummarySql(),
    buildLandSql(),
    buildWasteSql(),
    buildSubscriptionSql(),
    buildContentSql(),
    buildFacilitySql(),
    buildSearchAndSyncSql(),
  ].join('\n');
}

export function validateSeedDatabaseUrl(rawUrl: string | undefined = DEFAULT_DATABASE_URL): SeedConnection {
  const guardedUrl = assertLocalTestDatabaseUrl(rawUrl);
  const parsed = new URL(guardedUrl);
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));

  return {
    url: guardedUrl,
    databaseName,
    host: parsed.hostname,
    port: Number(parsed.port),
    user: decodeURIComponent(parsed.username || 'root'),
    password: decodeURIComponent(parsed.password || ''),
  };
}

export function buildBaselineSql(databaseName: string): string {
  const ddl = generateOriginMainPrismaDdl();
  const originTables = listOriginMainTables(ddl);
  const db = sqlIdentifier(databaseName);

  return `CREATE DATABASE IF NOT EXISTS ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE ${db};
SET FOREIGN_KEY_CHECKS=0;
${buildDropTablesSql(originTables)}
SET FOREIGN_KEY_CHECKS=1;
${ddl}
${buildSeedRowsSql()}
`;
}

export function buildRawUpdateSql(): string {
  const statements: string[] = [];
  for (const fixture of RELEASE_REHEARSAL_TYPES) {
    if (fixture.contract === 'sale') {
      statements.push(saleInsert(fixture.table, `c3-raw-update-${fixture.type}-c`, 1, 730000, true));
    } else {
      statements.push(rentInsert(fixture.table, `c3-raw-update-${fixture.type}-c-jeonse`, 1, '전세', 610000, 0, true));
    }
  }
  return statements.join('\n');
}

function releaseTypeCounts(count: number, overrides: Partial<Record<ReleaseRehearsalType, number>> = {}): Record<ReleaseRehearsalType, number> {
  return {
    ...Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type }) => [type, count])),
    ...overrides,
  } as Record<ReleaseRehearsalType, number>;
}

function rawSourceRowCounts(): Record<ReleaseRehearsalType, number> {
  return Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type, contract }) => [type, type === 'apt-sale' ? 3 : contract === 'sale' ? 2 : 4])) as Record<ReleaseRehearsalType, number>;
}

function rawSourceRowCountsAfterRawUpdate(): Record<ReleaseRehearsalType, number> {
  return Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type, contract }) => [type, type === 'apt-sale' ? 4 : contract === 'sale' ? 3 : 5])) as Record<ReleaseRehearsalType, number>;
}

function realEstateListUrl(type: ReleaseRehearsalType): string {
  return toRealEstateListUrl({ type, city: CITY, district: DISTRICT });
}

function buildingKeyFor(propertyType: ReleaseRehearsalPropertyType, jibun: string, buildingName = BUILDING_NAME): string {
  return makeBuildingKey({ propertyType, bjdCode: BJD_CODE, buildingName, dongName: DONG, jibun });
}

function realEstateDetailEntries(type: ReleaseRehearsalType, propertyType: ReleaseRehearsalPropertyType, expectedMode: 'legacy-summary' | 'address-summary-v2') {
  return ADDRESS_FIXTURES.map((address) => {
    const buildingKey = buildingKeyFor(propertyType, address.jibun);
    return {
      label: address.label,
      buildingKey,
      currentUrl: toRealEstateUrl({ type, city: CITY, district: DISTRICT, buildingName: BUILDING_NAME, buildingKey }),
      oldReleaseUrl: toRealEstateUrl({ type, city: CITY, district: DISTRICT, buildingName: BUILDING_NAME }),
      expectedMode,
    };
  });
}

function oldUnkeyedAptSaleUrl(): string {
  return toRealEstateUrl({ type: 'apt-sale', city: CITY, district: DISTRICT, buildingName: SINGLE_ADDRESS_APT_SALE_BUILDING_NAME });
}

function rawUpdateSourceIds(): Record<ReleaseRehearsalType, string> {
  return Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type, contract }) => [type, contract === 'sale' ? `c3-raw-update-${type}-c` : `c3-raw-update-${type}-c-jeonse`])) as Record<ReleaseRehearsalType, string>;
}

export function createFixtureReport(rawSourceFingerprint: string | null, options: { rawUpdateApplied?: boolean; fixtureInputFingerprint?: string } = {}) {
  const fixtureInputFingerprint = options.fixtureInputFingerprint ?? createFixtureInputFingerprint();
  const rawUpdateApplied = options.rawUpdateApplied === true;

  return {
    generatedAt: FIXTURE_DATE_ISO,
    database: {
      host: '127.0.0.1',
      port: 3307,
      name: FIXTURE_DB_NAME,
    },
    schema: {
      baselineSource: 'origin/main:backend/prisma/schema.prisma',
      originMainSchemaSha256: originMainSchemaFingerprint(),
      generatedBy: 'prisma migrate diff --from-empty --to-schema-datamodel <origin-main-schema> --script',
      c1AdditiveTablesAbsentInitially: true,
    },
    baselineContract: {
      oldMainCompatible: true,
      prefilledRealEstateSummaryV2: false,
      prefilledRealEstateSummaryState: false,
      prefilledWasteAdditiveTables: false,
      summaryModeDefault: 'address',
      compatibilityModeEnv: 'REAL_ESTATE_SUMMARY_MODE=compatibility',
    },
    modeCounts: {
      legacySummary: releaseTypeCounts(1, { 'apt-sale': 2 }),
      expectedAddressSummaryV2: releaseTypeCounts(2, { 'apt-sale': 3 }),
      rawSourceRows: rawUpdateApplied ? rawSourceRowCountsAfterRawUpdate() : rawSourceRowCounts(),
      baselineRawSourceRows: rawSourceRowCounts(),
      expectedAfterRawUpdateSourceRows: rawSourceRowCountsAfterRawUpdate(),
      landTransactions: 24,
      wasteSchedules: 1,
      subscriptions: 1,
    },
    urls: {
      home: '/',
      health: '/api/health',
      realEstateLists: Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type }) => [type, realEstateListUrl(type)])) as Record<ReleaseRehearsalType, string>,
      realEstateDetails: Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type, propertyType }) => [type, realEstateDetailEntries(type, propertyType, 'address-summary-v2')])) as Record<ReleaseRehearsalType, ReturnType<typeof realEstateDetailEntries>>,
      land: {
        region: '/real-estate/land/seoul/gangnam/역삼동',
        transactionsPage1: '/real-estate/land/seoul/gangnam/역삼동?page=1&limit=10',
        transactionsPage2: '/real-estate/land/seoul/gangnam/역삼동?page=2&limit=10',
        page2: '/real-estate/land/seoul/gangnam/역삼동?page=2&limit=10',
        queryA: '/real-estate/land/seoul/gangnam/역삼동?q=A-',
        queryB: '/real-estate/land/seoul/gangnam/역삼동?q=B-',
        queryAExpectedText: 'A-',
        queryBExpectedText: 'B-',
        queryAExpectedCount: 12,
        queryBExpectedCount: 12,
      },
      waste: {
        list: '/trash?city=seoul&district=%EA%B0%95%EB%82%A8%EA%B5%AC',
        schedule: '/trash/1001',
      },
      subscription: {
        list: '/subscription',
        detail: '/subscription/1',
      },
      retention: {
        oldUnkeyedUrl: oldUnkeyedAptSaleUrl(),
        buildingName: SINGLE_ADDRESS_APT_SALE_BUILDING_NAME,
        jibun: SINGLE_ADDRESS_APT_SALE_JIBUN,
        buildingKey: buildingKeyFor('apt', SINGLE_ADDRESS_APT_SALE_JIBUN, SINGLE_ADDRESS_APT_SALE_BUILDING_NAME),
      },
    },
    rawUpdateOperation: {
      command: 'C3_RELEASE_DATABASE_URL=<guarded-local-test-url> npx tsx src/scripts/seedReleaseRehearsal.ts --raw-update',
      expectedNewSourceIds: rawUpdateSourceIds(),
      expectedSourceRowsAfterUpdate: rawSourceRowCountsAfterRawUpdate(),
      preservesBaselineSummaryUntilRefresh: true,
    },
    fixtureInputFingerprint,
    rawSourceFingerprint,
  };
}

function fingerprintInput() {
  return {
    schemaSource: ORIGIN_MAIN_SCHEMA_REF,
    schemaSha256: originMainSchemaFingerprint(),
    city: CITY,
    district: DISTRICT,
    dong: DONG,
    bjdCode: BJD_CODE,
    buildingName: BUILDING_NAME,
    retainedOldUnkeyedBuildingName: SINGLE_ADDRESS_APT_SALE_BUILDING_NAME,
    retainedOldUnkeyedJibun: SINGLE_ADDRESS_APT_SALE_JIBUN,
    types: RELEASE_REHEARSAL_TYPES.map(({ type, table, propertyType, contract }) => ({ type, table, propertyType, contract })),
    addresses: ADDRESS_FIXTURES.map(({ label, jibun, roadAddress }) => ({ label, jibun, roadAddress })),
    landTransactionCount: 24,
    wasteSourceId: 'c3-waste-1001',
    subscriptionKey: 'C3HM1/C3PB1/APT',
  };
}

export function createFixtureInputFingerprint(): string {
  return createHash('sha256').update(JSON.stringify(fingerprintInput())).digest('hex');
}

function parseCliOptions(argv: string[], env: Record<string, string | undefined>): CliOptions {
  let databaseUrl = env.C3_RELEASE_DATABASE_URL ?? env.HOUSING_TEST_DATABASE_URL ?? DEFAULT_DATABASE_URL;
  let mysqlContainer = env.C3_MYSQL_CONTAINER ?? DEFAULT_MYSQL_CONTAINER;
  let reportPath = env.C3_RELEASE_REPORT_PATH ?? DEFAULT_REPORT_PATH;
  let rawUpdate = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const nextValue = () => {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${arg} requires a value`);
      }
      index += 1;
      return value;
    };

    if (arg === '--raw-update') {
      rawUpdate = true;
    } else if (arg === '--database-url') {
      databaseUrl = nextValue();
    } else if (arg.startsWith('--database-url=')) {
      databaseUrl = arg.slice('--database-url='.length);
    } else if (arg === '--mysql-container') {
      mysqlContainer = nextValue();
    } else if (arg.startsWith('--mysql-container=')) {
      mysqlContainer = arg.slice('--mysql-container='.length);
    } else if (arg === '--report') {
      reportPath = nextValue();
    } else if (arg.startsWith('--report=')) {
      reportPath = arg.slice('--report='.length);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { databaseUrl, mysqlContainer, reportPath, rawUpdate };
}

function runMysqlSql(connection: SeedConnection, sql: string, container: string): void {
  const args = [
    'exec',
    '-i',
    '-e',
    `MYSQL_PWD=${connection.password}`,
    container,
    'mysql',
    '--default-character-set=utf8mb4',
    '-u',
    connection.user,
  ];

  execFileSync('docker', args, {
    input: sql,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

function writeReport(reportPath: string, report: FixtureReport): string {
  const absolutePath = resolve(process.cwd(), reportPath);
  mkdirSync(dirname(absolutePath), { recursive: true });
  writeFileSync(absolutePath, `${JSON.stringify(report, null, 2)}
`);
  return absolutePath;
}

async function computeDbRawSourceFingerprint(databaseUrl: string): Promise<string> {
  process.env.DATABASE_URL = databaseUrl;
  const { computeRealEstateSourceFingerprint } = await import('../services/realEstateSummaryValidation.js');
  const { prisma } = await import('../lib/prisma.js');
  try {
    return await computeRealEstateSourceFingerprint();
  } finally {
    await prisma.$disconnect();
  }
}

export async function runSeedReleaseRehearsal(argv = process.argv.slice(2), env: Record<string, string | undefined> = process.env): Promise<FixtureReport> {
  const options = parseCliOptions(argv, env);
  const connection = validateSeedDatabaseUrl(options.databaseUrl);
  const fixtureInputFingerprint = createFixtureInputFingerprint();
  const sql = options.rawUpdate ? `USE ${sqlIdentifier(connection.databaseName)};
${buildRawUpdateSql()}
` : buildBaselineSql(connection.databaseName);

  runMysqlSql(connection, sql, options.mysqlContainer);

  const dbFingerprint = await computeDbRawSourceFingerprint(connection.url);
  const report = {
    ...createFixtureReport(dbFingerprint, { rawUpdateApplied: options.rawUpdate, fixtureInputFingerprint }),
    operation: options.rawUpdate ? 'raw-update' : 'baseline-seed',
  };
  const reportFile = writeReport(options.reportPath, report);

  console.log(JSON.stringify({
    operation: report.operation,
    database: report.database,
    rawSourceFingerprint: report.rawSourceFingerprint,
    fixtureInputFingerprint: report.fixtureInputFingerprint,
    reportFile,
  }, null, 2));

  return report;
}

const currentFile = fileURLToPath(import.meta.url);
const invokedFile = process.argv[1] ? resolve(process.argv[1]) : '';

if (currentFile === invokedFile) {
  runSeedReleaseRehearsal().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
