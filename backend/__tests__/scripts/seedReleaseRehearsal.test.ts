import { describe, expect, it } from 'vitest';
import { makeBuildingKey } from '../../src/lib/realEstateBuildingIdentity.js';
import {
  buildBaselineSql,
  buildRawUpdateSql,
  createFixtureReport,
  buildAdditiveSingleAddressAptSaleSql,
  listOriginMainTables,
  RELEASE_REHEARSAL_TYPES,
  validateSeedDatabaseUrl,
} from '../../src/scripts/seedReleaseRehearsal.js';

describe('seedReleaseRehearsal fixture contract', () => {
  it('guards writes to a dedicated localhost *_test database', () => {
    expect(validateSeedDatabaseUrl('mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test')).toMatchObject({
      databaseName: 'ilsangkit_c3_release_20260929_test',
    });

    expect(() => validateSeedDatabaseUrl('mysql://root:rootpassword@127.0.0.1:3307/ilsangkit')).toThrow(/_test/);
    expect(() => validateSeedDatabaseUrl('mysql://root:rootpassword@db.example.com:3306/ilsangkit_c3_release_20260929_test')).toThrow(/localhost:3307/);
  });

  it('creates an origin-main Prisma baseline without prefilled C1 additive readiness tables', () => {
    const sql = buildBaselineSql('ilsangkit_c3_release_20260929_test');

    expect(sql).toContain('CREATE DATABASE IF NOT EXISTS `ilsangkit_c3_release_20260929_test`');
    expect(sql).toContain('DROP TABLE IF EXISTS `RealEstateSummaryState`');
    expect(sql).toContain('DROP TABLE IF EXISTS `RealEstateBuildingSummaryV2`');
    expect(sql).toContain('DROP TABLE IF EXISTS `WasteStagedSchedule`');
    expect(sql).not.toMatch(/CREATE TABLE `RealEstateSummaryState`/i);
    expect(sql).not.toMatch(/CREATE TABLE `RealEstateBuildingSummaryV2`/i);
    expect(sql).not.toMatch(/CREATE TABLE `WasteStagedSchedule`/i);
    expect(sql).not.toMatch(/INSERT INTO RealEstateSummaryState/i);

    expect(listOriginMainTables()).toContain('RealEstateBuildingSummary');
    const legacySummaryCreate = sql.match(/CREATE TABLE `RealEstateBuildingSummary` \(([\s\S]*?)\n\) DEFAULT CHARACTER SET/)?.[1] ?? '';
    expect(legacySummaryCreate).toContain('`lat` DECIMAL(10, 7) NULL');
    expect(legacySummaryCreate).toContain('`lng` DECIMAL(10, 7) NULL');
    expect(legacySummaryCreate).toContain('`latestPrice` BIGINT NULL');
    expect(legacySummaryCreate).not.toContain('`latitude`');
    expect(legacySummaryCreate).not.toContain('`longitude`');
    expect(legacySummaryCreate).not.toContain('`buildingKey`');
    expect(legacySummaryCreate).not.toMatch(/`jibun`/);

    for (const { type, table } of RELEASE_REHEARSAL_TYPES) {
      expect(sql, `${type} source table`).toContain(`CREATE TABLE \`${table}\``);
      expect(sql, `${type} source rows`).toContain(`c3-${type}-a`);
      expect(sql, `${type} source rows`).toContain(`c3-${type}-b`);
      expect(sql, `${type} legacy summary`).toContain(`('${type}', 'C3공통주택'`);
    }

    expect(sql).toContain('CREATE TABLE `LandSaleTransaction`');
    expect(sql).toContain('`dealArea` DECIMAL(12, 2) NULL');
    expect(sql).toContain('CREATE TABLE `WasteSchedule`');
    expect(sql).toContain('`details` JSON NULL');
    expect(sql).toContain('CREATE TABLE `Subscription`');
    expect(sql).toContain('UNIQUE INDEX `Subscription_houseManageNo_pblancNo_sourceType_key`');
    expect(sql).toContain('INSERT INTO LandSaleTransaction');
    expect(sql).toContain('c3-land-24');
  });

  it('builds a bounded raw update operation for rollback-refresh acceptance across all six source types', () => {
    const sql = buildRawUpdateSql();

    for (const { type } of RELEASE_REHEARSAL_TYPES) {
      expect(sql).toContain(`c3-raw-update-${type}-c`);
    }
    expect(sql).toContain('C3공통주택');
    expect(sql).not.toMatch(/RealEstateSummaryState|RealEstateBuildingSummaryV2/);
  });


  it('adds one distinct single-address apt-sale fixture for retained old unkeyed detail proof', () => {
    const sql = buildBaselineSql('ilsangkit_c3_release_20260929_test');

    expect(sql).toContain('C3기존단일주택');
    expect(sql).toContain('c3-apt-sale-single-old-url');
    expect(sql).toContain('333-3');
    expect(sql).toContain("('apt-sale', 'C3기존단일주택'");
    expect(sql).not.toContain('c3-apt-rent-single-old-url');

    const additiveSql = buildAdditiveSingleAddressAptSaleSql();
    expect(additiveSql).toContain('AptSaleTransaction');
    expect(additiveSql).toContain('RealEstateBuildingSummary');
    expect(additiveSql).toContain('c3-apt-sale-single-old-url');
    expect(additiveSql).toContain('C3기존단일주택');
    expect(additiveSql).not.toContain('RealEstateBuildingSummaryV2');
    expect(additiveSql).not.toContain('RealEstateSummaryState');
  });

  it('reports canonical keys, URLs, mode counts, and fingerprints without credentials or raw row dumps', () => {
    const report = createFixtureReport('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef');

    expect(report.database).toEqual({ host: '127.0.0.1', port: 3307, name: 'ilsangkit_c3_release_20260929_test' });
    expect(report.schema.baselineSource).toBe('origin/main:backend/prisma/schema.prisma');
    expect(report.baselineContract.prefilledRealEstateSummaryV2).toBe(false);
    expect(report.modeCounts.legacySummary).toEqual({
      ...Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type }) => [type, 1])),
      'apt-sale': 2,
    });
    expect(report.modeCounts.expectedAddressSummaryV2).toEqual({
      ...Object.fromEntries(RELEASE_REHEARSAL_TYPES.map(({ type }) => [type, 2])),
      'apt-sale': 3,
    });
    expect(report.modeCounts.landTransactions).toBe(24);

    const expectedAptKeyA = makeBuildingKey({
      propertyType: 'apt',
      bjdCode: '1168010100',
      buildingName: 'C3공통주택',
      dongName: '역삼동',
      jibun: '101-1',
    });
    const aptSaleDetails = report.urls.realEstateDetails['apt-sale'];
    expect(aptSaleDetails).toHaveLength(2);
    expect(aptSaleDetails[0].buildingKey).toBe(expectedAptKeyA);
    expect(aptSaleDetails[0].currentUrl).toContain(expectedAptKeyA);
    expect(aptSaleDetails[0].oldReleaseUrl).not.toContain(expectedAptKeyA);
    expect(aptSaleDetails[0].currentUrl).not.toBe(aptSaleDetails[1].currentUrl);
    expect(report.urls.retention.oldUnkeyedUrl).toContain('C3%EA%B8%B0%EC%A1%B4%EB%8B%A8%EC%9D%BC%EC%A3%BC%ED%83%9D');
    expect(report.urls.retention.oldUnkeyedUrl).not.toContain(expectedAptKeyA);

    expect(report.urls.land.transactionsPage2).toContain('page=2');
    expect(report.urls.land.page2).toBe(report.urls.land.transactionsPage2);
    expect(report.urls.land.queryA).toContain('?q=A-');
    expect(report.urls.land.queryB).toContain('?q=B-');
    expect(report.urls.land.queryAExpectedText).toBe('A-');
    expect(report.urls.land.queryBExpectedText).toBe('B-');
    expect(report.urls.land.queryAExpectedCount).toBe(12);
    expect(report.urls.land.queryBExpectedCount).toBe(12);
    expect(report.urls.land.queryA).not.toContain('keyword=');
    expect(report.urls.waste.list).toBe('/trash?city=seoul&district=%EA%B0%95%EB%82%A8%EA%B5%AC');
    expect(report.urls.waste.schedule).toBe('/trash/1001');
    expect(report.rawUpdateOperation.expectedNewSourceIds['offitel-rent']).toBe('c3-raw-update-offitel-rent-c-jeonse');
    expect(report.fixtureInputFingerprint).toMatch(/^[a-f0-9]{64}$/);
    expect(report.rawSourceFingerprint).toMatch(/^[a-f0-9]{64}$/);

    const rawUpdateReport = createFixtureReport(null, {
      rawUpdateApplied: true,
      fixtureInputFingerprint: report.fixtureInputFingerprint,
    });
    expect(rawUpdateReport.fixtureInputFingerprint).toBe(report.fixtureInputFingerprint);
    expect(rawUpdateReport.rawSourceFingerprint).toBeNull();
    expect(rawUpdateReport.modeCounts.rawSourceRows['apt-sale']).toBe(4);
    expect(rawUpdateReport.modeCounts.rawSourceRows['apt-rent']).toBe(5);
    expect(rawUpdateReport.modeCounts.baselineRawSourceRows['apt-sale']).toBe(3);
    expect(rawUpdateReport.modeCounts.baselineRawSourceRows['apt-rent']).toBe(4);
    expect(rawUpdateReport.urls.land.page2).toBe(rawUpdateReport.urls.land.transactionsPage2);

    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain('rootpassword');
    expect(serialized).not.toContain('dealAmount');
    expect(serialized).not.toContain('INSERT INTO');
  });
});
