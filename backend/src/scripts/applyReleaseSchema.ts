import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { assertLocalTestDatabaseUrl } from '../utils/testDatabaseGuard.js';

export interface ExpectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  default?: string | null;
  extra?: string;
}

export interface ExpectedIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface ExpectedCheck {
  name: string;
  clause: string;
}

export interface ExpectedForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface ExpectedTable {
  name: string;
  columns: ExpectedColumn[];
  indexes: ExpectedIndex[];
  checks: ExpectedCheck[];
  foreignKeys?: ExpectedForeignKey[];
  createSql?: string;
}

export interface IntrospectedColumn {
  name: string;
  type: string;
  nullable: boolean;
  default: string | null;
  extra: string;
}

export interface IntrospectedIndex {
  name: string;
  unique: boolean;
  columns: string[];
}

export interface IntrospectedCheck {
  name: string;
  clause: string;
}

export interface IntrospectedForeignKey {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export interface IntrospectedTable {
  name: string;
  columns: IntrospectedColumn[];
  indexes: IntrospectedIndex[];
  checks: IntrospectedCheck[];
  foreignKeys: IntrospectedForeignKey[];
}

export interface ValidationResult {
  ok: boolean;
  checksum: string;
  errors: string[];
}

export interface SchemaDatabase {
  query<T>(sql: string, ...params: unknown[]): Promise<T[]>;
  execute(sql: string): Promise<unknown>;
  withSession?<T>(fn: (db: SchemaDatabase) => Promise<T>): Promise<T>;
  pinnedSession?: boolean;
}

export interface ApplyAction {
  object: string;
  action: 'create' | 'alter' | 'skip' | 'violation' | 'drift';
  checksum?: string;
  details?: string;
  violations?: number;
}

export interface ApplyReport {
  databaseVersion?: string;
  actions: ApplyAction[];
}

export class SchemaDriftError extends Error {
  constructor(message: string, public readonly actions: ApplyAction[] = []) {
    super(message);
    this.name = 'SchemaDriftError';
  }
}

export class SchemaViolationError extends Error {
  constructor(message: string, public readonly actions: ApplyAction[] = []) {
    super(message);
    this.name = 'SchemaViolationError';
  }
}

const SUMMARY_V2_SQL = `
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
  KEY RealEstateBuildingSummaryV2_type_city_district_tx_idx (type, city, district, transactionCount),
  KEY RealEstateBuildingSummaryV2_type_buildingName_idx (type, buildingName),
  KEY RealEstateBuildingSummaryV2_type_bjd_latest_tx_idx (type, bjdCode, latestDealYear, latestDealMonth, transactionCount),
  KEY RealEstateBuildingSummaryV2_type_lat_lng_idx (type, lat, lng),
  CONSTRAINT RealEstateBuildingSummaryV2_buildingKey_hex_chk CHECK (REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

const SUMMARY_STATE_SQL = `
CREATE TABLE RealEstateSummaryState (
  id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  runId VARCHAR(64) NOT NULL,
  sourceFingerprint CHAR(64) NOT NULL,
  report JSON NOT NULL,
  validatedAt DATETIME(3) NULL,
  updatedAt DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  CONSTRAINT RealEstateSummaryState_singleton_chk CHECK (id = 1),
  CONSTRAINT RealEstateSummaryState_status_chk CHECK (status IN ('preparing', 'failed', 'ready')),
  CONSTRAINT RealEstateSummaryState_sourceFingerprint_hex_chk CHECK (REGEXP_LIKE(sourceFingerprint, '^[a-f0-9]{64}$', 'c'))
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

const REAL_ESTATE_PUBLIC_URL_SQL = `
CREATE TABLE \`RealEstatePublicUrl\` (
  \`id\` INTEGER NOT NULL AUTO_INCREMENT,
  \`type\` VARCHAR(20) NOT NULL,
  \`buildingKey\` CHAR(64) NOT NULL,
  \`bjdCode\` VARCHAR(10) NOT NULL,
  \`buildingName\` VARCHAR(200) NOT NULL,
  \`basePath\` TEXT NOT NULL,
  \`basePathHash\` CHAR(64) NOT NULL,
  \`canonicalPath\` TEXT NOT NULL,
  \`pathHash\` CHAR(64) NOT NULL,
  \`dongName\` VARCHAR(50) NULL,
  \`jibun\` VARCHAR(20) NULL,
  \`addressSnapshot\` JSON NOT NULL,
  \`evidence\` JSON NOT NULL,
  \`sourceFingerprint\` CHAR(64) NOT NULL,
  \`baselineProvenance\` VARCHAR(255) NULL,
  \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (\`id\`),
  UNIQUE INDEX \`RealEstatePublicUrl_type_buildingKey_key\`(\`type\`, \`buildingKey\`),
  INDEX \`RealEstatePublicUrl_pathHash_idx\`(\`pathHash\`),
  INDEX \`RealEstatePublicUrl_type_basePathHash_idx\`(\`type\`, \`basePathHash\`),
  INDEX \`RealEstatePublicUrl_type_buildingKey_basePathHash_idx\`(\`type\`, \`buildingKey\`, \`basePathHash\`),
  INDEX \`RealEstatePublicUrl_type_bjdCode_buildingName_idx\`(\`type\`, \`bjdCode\`, \`buildingName\`),
  INDEX \`RealEstatePublicUrl_sourceFingerprint_idx\`(\`sourceFingerprint\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

const REAL_ESTATE_PUBLIC_URL_STATE_SQL = `
CREATE TABLE \`RealEstatePublicUrlState\` (
  \`id\` INTEGER NOT NULL,
  \`status\` VARCHAR(20) NOT NULL,
  \`sourceFingerprint\` CHAR(64) NOT NULL,
  \`baselineProvenance\` VARCHAR(255) NULL,
  \`report\` JSON NOT NULL,
  \`validatedAt\` DATETIME(3) NULL,
  \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),

  PRIMARY KEY (\`id\`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
`;

export const SUMMARY_V2_TABLES: ExpectedTable[] = [
  {
    name: 'RealEstateBuildingSummaryV2',
    createSql: SUMMARY_V2_SQL,
    columns: [
      { name: 'id', type: 'int', nullable: false, extra: 'auto_increment' },
      { name: 'type', type: 'varchar(20)', nullable: false },
      { name: 'buildingKey', type: 'char(64)', nullable: false },
      { name: 'buildingName', type: 'varchar(200)', nullable: false },
      { name: 'bjdCode', type: 'varchar(10)', nullable: false },
      { name: 'city', type: 'varchar(50)', nullable: false },
      { name: 'district', type: 'varchar(50)', nullable: false },
      { name: 'dongName', type: 'varchar(50)', nullable: false },
      { name: 'jibun', type: 'varchar(20)', nullable: true },
      { name: 'latestPrice', type: 'bigint', nullable: true },
      { name: 'latestDealYear', type: 'int', nullable: true },
      { name: 'latestDealMonth', type: 'int', nullable: true },
      { name: 'latestDealDay', type: 'int', nullable: true },
      { name: 'buildYear', type: 'int', nullable: true },
      { name: 'lat', type: 'decimal(10,7)', nullable: true },
      { name: 'lng', type: 'decimal(10,7)', nullable: true },
      { name: 'transactionCount', type: 'int', nullable: false, default: '0' },
      { name: 'monthlyRent', type: 'int', nullable: true },
      { name: 'jeonseDeposit', type: 'int', nullable: true },
      { name: 'jeonseDealKey', type: 'int', nullable: true },
      { name: 'wolseDeposit', type: 'int', nullable: true },
      { name: 'wolseMonthlyRent', type: 'int', nullable: true },
      { name: 'wolseDealKey', type: 'int', nullable: true },
      { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)', extra: 'on update CURRENT_TIMESTAMP(3)' },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['id'] },
      { name: 'RealEstateBuildingSummaryV2_type_buildingKey_key', unique: true, columns: ['type', 'buildingKey'] },
      { name: 'RealEstateBuildingSummaryV2_type_transactionCount_idx', unique: false, columns: ['type', 'transactionCount'] },
      { name: 'RealEstateBuildingSummaryV2_type_city_district_tx_idx', unique: false, columns: ['type', 'city', 'district', 'transactionCount'] },
      { name: 'RealEstateBuildingSummaryV2_type_buildingName_idx', unique: false, columns: ['type', 'buildingName'] },
      { name: 'RealEstateBuildingSummaryV2_type_bjd_latest_tx_idx', unique: false, columns: ['type', 'bjdCode', 'latestDealYear', 'latestDealMonth', 'transactionCount'] },
      { name: 'RealEstateBuildingSummaryV2_type_lat_lng_idx', unique: false, columns: ['type', 'lat', 'lng'] },
    ],
    checks: [
      { name: 'RealEstateBuildingSummaryV2_buildingKey_hex_chk', clause: "REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c')" },
    ],
  },
  {
    name: 'RealEstateSummaryState',
    createSql: SUMMARY_STATE_SQL,
    columns: [
      { name: 'id', type: 'int', nullable: false },
      { name: 'status', type: 'varchar(20)', nullable: false },
      { name: 'runId', type: 'varchar(64)', nullable: false },
      { name: 'sourceFingerprint', type: 'char(64)', nullable: false },
      { name: 'report', type: 'json', nullable: false },
      { name: 'validatedAt', type: 'datetime(3)', nullable: true },
      { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)', extra: 'on update CURRENT_TIMESTAMP(3)' },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['id'] },
    ],
    checks: [
      { name: 'RealEstateSummaryState_singleton_chk', clause: 'id = 1' },
      { name: 'RealEstateSummaryState_status_chk', clause: "status IN ('preparing', 'failed', 'ready')" },
      { name: 'RealEstateSummaryState_sourceFingerprint_hex_chk', clause: "REGEXP_LIKE(sourceFingerprint, '^[a-f0-9]{64}$', 'c')" },
    ],
  },
];

export const REAL_ESTATE_PUBLIC_URL_TABLES: ExpectedTable[] = [
  {
    name: 'RealEstatePublicUrl',
    createSql: REAL_ESTATE_PUBLIC_URL_SQL,
    columns: [
      { name: 'id', type: 'int', nullable: false, extra: 'auto_increment' },
      { name: 'type', type: 'varchar(20)', nullable: false },
      { name: 'buildingKey', type: 'char(64)', nullable: false },
      { name: 'bjdCode', type: 'varchar(10)', nullable: false },
      { name: 'buildingName', type: 'varchar(200)', nullable: false },
      { name: 'basePath', type: 'text', nullable: false },
      { name: 'basePathHash', type: 'char(64)', nullable: false },
      { name: 'canonicalPath', type: 'text', nullable: false },
      { name: 'pathHash', type: 'char(64)', nullable: false },
      { name: 'dongName', type: 'varchar(50)', nullable: true },
      { name: 'jibun', type: 'varchar(20)', nullable: true },
      { name: 'addressSnapshot', type: 'json', nullable: false },
      { name: 'evidence', type: 'json', nullable: false },
      { name: 'sourceFingerprint', type: 'char(64)', nullable: false },
      { name: 'baselineProvenance', type: 'varchar(255)', nullable: true },
      { name: 'createdAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)' },
      { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)', extra: 'on update CURRENT_TIMESTAMP(3)' },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['id'] },
      { name: 'RealEstatePublicUrl_type_buildingKey_key', unique: true, columns: ['type', 'buildingKey'] },
      { name: 'RealEstatePublicUrl_pathHash_idx', unique: false, columns: ['pathHash'] },
      { name: 'RealEstatePublicUrl_type_basePathHash_idx', unique: false, columns: ['type', 'basePathHash'] },
      { name: 'RealEstatePublicUrl_type_buildingKey_basePathHash_idx', unique: false, columns: ['type', 'buildingKey', 'basePathHash'] },
      { name: 'RealEstatePublicUrl_type_bjdCode_buildingName_idx', unique: false, columns: ['type', 'bjdCode', 'buildingName'] },
      { name: 'RealEstatePublicUrl_sourceFingerprint_idx', unique: false, columns: ['sourceFingerprint'] },
    ],
    checks: [],
  },
  {
    name: 'RealEstatePublicUrlState',
    createSql: REAL_ESTATE_PUBLIC_URL_STATE_SQL,
    columns: [
      { name: 'id', type: 'int', nullable: false },
      { name: 'status', type: 'varchar(20)', nullable: false },
      { name: 'sourceFingerprint', type: 'char(64)', nullable: false },
      { name: 'baselineProvenance', type: 'varchar(255)', nullable: true },
      { name: 'report', type: 'json', nullable: false },
      { name: 'validatedAt', type: 'datetime(3)', nullable: true },
      { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)', extra: 'on update CURRENT_TIMESTAMP(3)' },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['id'] },
    ],
    checks: [],
  },
];

const WASTE_CHECKS: Record<string, ExpectedCheck> = {
  WastePublication_singleton_chk: {
    name: 'WastePublication_singleton_chk',
    clause: '`id` = 1',
  },
  WasteAreaRelation_source_chk: {
    name: 'WasteAreaRelation_source_chk',
    clause: "(`fromAreaId` IS NOT NULL AND `alias` IS NULL) OR (`fromAreaId` IS NULL AND `alias` IS NOT NULL)",
  },
  WasteScheduleCoverage_verified_target_chk: {
    name: 'WasteScheduleCoverage_verified_target_chk',
    clause: "`state` <> 'verified' OR (`areaId` IS NOT NULL AND `districtCode` IS NULL) OR (`areaId` IS NULL AND `districtCode` IS NOT NULL)",
  },
};

const WASTE_VIOLATION_SQL: Record<string, string> = {
  WastePublication_singleton_chk: 'SELECT COUNT(*) AS count FROM `WastePublication` WHERE `id` <> 1',
  WasteAreaRelation_source_chk: `
    SELECT COUNT(*) AS count FROM \`WasteAreaRelation\`
    WHERE NOT ((\`fromAreaId\` IS NOT NULL AND \`alias\` IS NULL)
      OR (\`fromAreaId\` IS NULL AND \`alias\` IS NOT NULL))
  `,
  WasteScheduleCoverage_verified_target_chk: `
    SELECT COUNT(*) AS count FROM \`WasteScheduleCoverage\`
    WHERE \`state\` = 'verified'
      AND NOT ((\`areaId\` IS NOT NULL AND \`districtCode\` IS NULL)
        OR (\`areaId\` IS NULL AND \`districtCode\` IS NOT NULL))
  `,
};

const WASTE_ADD_CHECK_SQL: Record<string, string> = {
  WastePublication_singleton_chk: 'ALTER TABLE `WastePublication` ADD CONSTRAINT `WastePublication_singleton_chk` CHECK (`id` = 1)',
  WasteAreaRelation_source_chk: `
    ALTER TABLE \`WasteAreaRelation\`
      ADD CONSTRAINT \`WasteAreaRelation_source_chk\`
      CHECK ((\`fromAreaId\` IS NOT NULL AND \`alias\` IS NULL)
        OR (\`fromAreaId\` IS NULL AND \`alias\` IS NOT NULL))
  `,
  WasteScheduleCoverage_verified_target_chk: `
    ALTER TABLE \`WasteScheduleCoverage\`
      ADD CONSTRAINT \`WasteScheduleCoverage_verified_target_chk\`
      CHECK (\`state\` <> 'verified'
        OR ((\`areaId\` IS NOT NULL AND \`districtCode\` IS NULL)
          OR (\`areaId\` IS NULL AND \`districtCode\` IS NOT NULL)))
  `,
};


const WASTE_TABLES: ExpectedTable[] = [
  {
    name: 'WasteStagedSchedule',
    columns: [{ name: 'scheduleId', type: 'int', nullable: false }],
    indexes: [{ name: 'PRIMARY', unique: true, columns: ['scheduleId'] }],
    checks: [],
    foreignKeys: [{ name: 'WasteStagedSchedule_scheduleId_fkey', columns: ['scheduleId'], referencedTable: 'WasteSchedule', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' }],
  },
  {
    name: 'WasteGeneration',
    columns: [
      { name: 'id', type: 'varchar(36)', nullable: false },
      { name: 'baseGenerationId', type: 'varchar(36)', nullable: true },
      { name: 'status', type: "enum('staging','ready','published','failed')", nullable: false },
      { name: 'referenceVersion', type: 'varchar(128)', nullable: false },
      { name: 'inputHash', type: 'varchar(64)', nullable: false },
      { name: 'reportHash', type: 'varchar(64)', nullable: false },
      { name: 'sourceComplete', type: 'tinyint(1)', nullable: false },
      { name: 'createdAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)' },
      { name: 'publishedAt', type: 'datetime(3)', nullable: true },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['id'] },
      { name: 'WasteGeneration_baseGenerationId_idx', unique: false, columns: ['baseGenerationId'] },
      { name: 'WasteGeneration_status_idx', unique: false, columns: ['status'] },
      { name: 'WasteGeneration_inputHash_idx', unique: false, columns: ['inputHash'] },
    ],
    checks: [],
    foreignKeys: [{ name: 'WasteGeneration_baseGenerationId_fkey', columns: ['baseGenerationId'], referencedTable: 'WasteGeneration', referencedColumns: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE' }],
  },
  {
    name: 'WastePublication',
    columns: [
      { name: 'id', type: 'int', nullable: false, default: '1' },
      { name: 'activeGenerationId', type: 'varchar(36)', nullable: true },
      { name: 'updatedAt', type: 'datetime(3)', nullable: false, default: 'CURRENT_TIMESTAMP(3)' },
    ],
    indexes: [{ name: 'PRIMARY', unique: true, columns: ['id'] }],
    checks: [WASTE_CHECKS.WastePublication_singleton_chk],
    foreignKeys: [{ name: 'WastePublication_activeGenerationId_fkey', columns: ['activeGenerationId'], referencedTable: 'WasteGeneration', referencedColumns: ['id'], onDelete: 'SET NULL', onUpdate: 'CASCADE' }],
  },
  {
    name: 'WasteArea',
    columns: [
      { name: 'id', type: 'int', nullable: false, extra: 'auto_increment' },
      { name: 'kind', type: "enum('administrative','legal')", nullable: false },
      { name: 'code', type: 'varchar(20)', nullable: false },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['id'] },
      { name: 'WasteArea_kind_code_key', unique: true, columns: ['kind', 'code'] },
    ],
    checks: [],
    foreignKeys: [],
  },
  {
    name: 'WasteAreaEntry',
    columns: [
      { name: 'generationId', type: 'varchar(36)', nullable: false },
      { name: 'areaId', type: 'int', nullable: false },
      { name: 'level', type: "enum('province','district','dong','ri')", nullable: false },
      { name: 'city', type: 'varchar(50)', nullable: false },
      { name: 'district', type: 'varchar(50)', nullable: false },
      { name: 'districtCode', type: 'varchar(20)', nullable: false },
      { name: 'name', type: 'varchar(100)', nullable: false },
      { name: 'validFrom', type: 'date', nullable: false },
      { name: 'validTo', type: 'date', nullable: true },
      { name: 'evidence', type: 'json', nullable: false },
      { name: 'indexEligible', type: 'tinyint(1)', nullable: false, default: '0' },
      { name: 'indexReason', type: 'varchar(255)', nullable: true },
      { name: 'contentFingerprint', type: 'varchar(64)', nullable: false },
      { name: 'contentUpdatedAt', type: 'datetime(3)', nullable: false },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['generationId', 'areaId'] },
      { name: 'WasteAreaEntry_generationId_city_district_name_idx', unique: false, columns: ['generationId', 'city', 'district', 'name'] },
      { name: 'WasteAreaEntry_areaId_idx', unique: false, columns: ['areaId'] },
    ],
    checks: [],
    foreignKeys: [
      { name: 'WasteAreaEntry_generationId_fkey', columns: ['generationId'], referencedTable: 'WasteGeneration', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'WasteAreaEntry_areaId_fkey', columns: ['areaId'], referencedTable: 'WasteArea', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
    ],
  },
  {
    name: 'WasteAreaRelation',
    columns: [
      { name: 'generationId', type: 'varchar(36)', nullable: false },
      { name: 'relationKey', type: 'varchar(64)', nullable: false },
      { name: 'fromAreaId', type: 'int', nullable: true },
      { name: 'alias', type: 'varchar(100)', nullable: true },
      { name: 'toAreaId', type: 'int', nullable: false },
      { name: 'evidence', type: 'json', nullable: false },
      { name: 'validFrom', type: 'date', nullable: false },
      { name: 'validTo', type: 'date', nullable: true },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['generationId', 'relationKey'] },
      { name: 'WasteAreaRelation_generationId_fromAreaId_idx', unique: false, columns: ['generationId', 'fromAreaId'] },
      { name: 'WasteAreaRelation_generationId_toAreaId_idx', unique: false, columns: ['generationId', 'toAreaId'] },
      { name: 'WasteAreaRelation_toAreaId_idx', unique: false, columns: ['toAreaId'] },
    ],
    checks: [WASTE_CHECKS.WasteAreaRelation_source_chk],
    foreignKeys: [
      { name: 'WasteAreaRelation_generationId_fkey', columns: ['generationId'], referencedTable: 'WasteGeneration', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'WasteAreaRelation_fromEntry_fkey', columns: ['generationId', 'fromAreaId'], referencedTable: 'WasteAreaEntry', referencedColumns: ['generationId', 'areaId'], onDelete: 'NO ACTION', onUpdate: 'NO ACTION' },
      { name: 'WasteAreaRelation_toEntry_fkey', columns: ['generationId', 'toAreaId'], referencedTable: 'WasteAreaEntry', referencedColumns: ['generationId', 'areaId'], onDelete: 'NO ACTION', onUpdate: 'NO ACTION' },
      { name: 'WasteAreaRelation_toAreaId_fkey', columns: ['toAreaId'], referencedTable: 'WasteArea', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
    ],
  },
  {
    name: 'WasteScheduleRevision',
    columns: [
      { name: 'generationId', type: 'varchar(36)', nullable: false },
      { name: 'scheduleId', type: 'int', nullable: false },
      { name: 'city', type: 'varchar(50)', nullable: false },
      { name: 'district', type: 'varchar(50)', nullable: false },
      { name: 'sourceId', type: 'varchar(100)', nullable: false },
      { name: 'targetRegion', type: 'text', nullable: true },
      { name: 'emissionPlace', type: 'varchar(100)', nullable: true },
      { name: 'details', type: 'json', nullable: true },
      { name: 'sourceUrl', type: 'varchar(500)', nullable: true },
      { name: 'govCode', type: 'varchar(20)', nullable: true },
      { name: 'rawPayload', type: 'json', nullable: true },
      { name: 'provenance', type: "enum('legacy','raw')", nullable: false },
      { name: 'contentHash', type: 'varchar(64)', nullable: false },
      { name: 'sourceModifiedAt', type: 'datetime(3)', nullable: true },
      { name: 'observedAt', type: 'datetime(3)', nullable: false },
      { name: 'contentUpdatedAt', type: 'datetime(3)', nullable: false },
      { name: 'state', type: "enum('active','inactive','conflict')", nullable: false },
      { name: 'missingCompleteRuns', type: 'int', nullable: false },
      { name: 'terminationEvidence', type: 'json', nullable: true },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['generationId', 'scheduleId'] },
      { name: 'WasteScheduleRevision_generationId_city_district_state_idx', unique: false, columns: ['generationId', 'city', 'district', 'state'] },
      { name: 'WasteScheduleRevision_scheduleId_idx', unique: false, columns: ['scheduleId'] },
    ],
    checks: [],
    foreignKeys: [
      { name: 'WasteScheduleRevision_generationId_fkey', columns: ['generationId'], referencedTable: 'WasteGeneration', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'WasteScheduleRevision_scheduleId_fkey', columns: ['scheduleId'], referencedTable: 'WasteSchedule', referencedColumns: ['id'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
    ],
  },
  {
    name: 'WasteScheduleCoverage',
    columns: [
      { name: 'generationId', type: 'varchar(36)', nullable: false },
      { name: 'scheduleId', type: 'int', nullable: false },
      { name: 'coverageKey', type: 'varchar(64)', nullable: false },
      { name: 'areaId', type: 'int', nullable: true },
      { name: 'districtCode', type: 'varchar(20)', nullable: true },
      { name: 'scope', type: "enum('whole','partial','conditional')", nullable: false },
      { name: 'conditionText', type: 'text', nullable: false },
      { name: 'state', type: "enum('verified','unresolved','conflict')", nullable: false },
      { name: 'reason', type: 'varchar(255)', nullable: false },
      { name: 'evidence', type: 'json', nullable: false },
    ],
    indexes: [
      { name: 'PRIMARY', unique: true, columns: ['generationId', 'scheduleId', 'coverageKey'] },
      { name: 'WasteScheduleCoverage_generationId_areaId_state_idx', unique: false, columns: ['generationId', 'areaId', 'state'] },
      { name: 'WasteScheduleCoverage_generationId_districtCode_state_idx', unique: false, columns: ['generationId', 'districtCode', 'state'] },
    ],
    checks: [WASTE_CHECKS.WasteScheduleCoverage_verified_target_chk],
    foreignKeys: [
      { name: 'WasteScheduleCoverage_revision_fkey', columns: ['generationId', 'scheduleId'], referencedTable: 'WasteScheduleRevision', referencedColumns: ['generationId', 'scheduleId'], onDelete: 'CASCADE', onUpdate: 'CASCADE' },
      { name: 'WasteScheduleCoverage_areaEntry_fkey', columns: ['generationId', 'areaId'], referencedTable: 'WasteAreaEntry', referencedColumns: ['generationId', 'areaId'], onDelete: 'NO ACTION', onUpdate: 'NO ACTION' },
    ],
  },
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeType(type: string): string {
  return type.toLowerCase().replace(/^int\(\d+\)$/, 'int');
}

function normalizeDefault(value: string | null | undefined): string | null {
  if (value == null) return null;
  return normalizeWhitespace(value)
    .toLowerCase()
    .replace(/^'(.+)'$/, '$1');
}

function normalizeExtra(value: string | undefined): string {
  return normalizeWhitespace(value ?? '')
    .toLowerCase()
    .replace(/\bdefault_generated\b/g, '')
    .trim();
}

export function classifyColumn(column: IntrospectedColumn): IntrospectedColumn {
  return {
    ...column,
    type: normalizeType(column.type),
    default: normalizeDefault(column.default),
    extra: normalizeExtra(column.extra),
  };
}

function stripWholeExpressionParens(value: string): string {
  let current = value;
  while (current.startsWith('(') && current.endsWith(')')) {
    let depth = 0;
    let inString = false;
    let wrapsWholeExpression = true;
    for (let index = 0; index < current.length; index += 1) {
      const char = current[index];
      if (char === "'") {
        inString = !inString;
      }
      if (inString) continue;
      if (char === '(') depth += 1;
      if (char === ')') depth -= 1;
      if (depth === 0 && index < current.length - 1) {
        wrapsWholeExpression = false;
        break;
      }
    }
    if (!wrapsWholeExpression) break;
    current = current.slice(1, -1);
  }
  return current;
}

export function normalizeCheckClause(clause: string): string {
  let normalized = '';
  let inString = false;
  for (let index = 0; index < clause.length; index += 1) {
    const char = clause[index];
    if (!inString && clause.slice(index, index + 8).toLowerCase() === '_utf8mb4') {
      index += 7;
      continue;
    }
    if (!inString && /^(?:^|\W)and(?:\W|$)/i.test(clause.slice(Math.max(0, index - 1), index + 4))) {
      normalized += '&&';
      index += 2;
      continue;
    }
    if (!inString && /^(?:^|\W)or(?:\W|$)/i.test(clause.slice(Math.max(0, index - 1), index + 3))) {
      normalized += '||';
      index += 1;
      continue;
    }
    if (char === "'") {
      inString = !inString;
      normalized += char;
      continue;
    }
    if (inString) {
      if (char === '\\' && clause[index + 1] === "'") continue;
      normalized += char;
      continue;
    }
    if (char === '`' || char === '\\') continue;
    if (/\s/.test(char)) continue;
    normalized += char.toLowerCase();
  }
  let stripped = stripWholeExpressionParens(normalized);
  let previous = '';
  while (previous !== stripped) {
    previous = stripped;
    stripped = stripped.replace(/\(([^()]+)\)/g, (match, inner: string) => {
      return /&&|\|\|/.test(inner) ? match : inner;
    });
  }
  return stripped;
}

export function rejectDangerousSql(sql: string): void {
  if (/\b(drop|truncate)\b/i.test(sql) || /\brename\s+table\b/i.test(sql)) {
    throw new Error('Forbidden DDL token in release schema SQL');
  }
  if (/alter\s+table\s+`?RealEstateBuildingSummary`?/i.test(sql)) {
    throw new Error('Forbidden legacy summary mutation in release schema SQL');
  }
}

function stableChecksum(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function validateExistingTable(expected: ExpectedTable, actual: IntrospectedTable): ValidationResult {
  const errors: string[] = [];
  const actualColumns = new Map(actual.columns.map(column => [column.name, classifyColumn(column)]));
  const actualIndexes = new Map(actual.indexes.map(index => [index.name, index]));
  const actualChecks = new Map(actual.checks.map(check => [check.name, check]));

  for (const expectedColumn of expected.columns) {
    const actualColumn = actualColumns.get(expectedColumn.name);
    if (!actualColumn) {
      errors.push(`${expected.name}.${expectedColumn.name}: missing column`);
      continue;
    }
    const expectedType = normalizeType(expectedColumn.type);
    if (actualColumn.type !== expectedType) {
      errors.push(`${expected.name}.${expectedColumn.name}: expected type ${expectedType}, got ${actualColumn.type}`);
    }
    if (actualColumn.nullable !== expectedColumn.nullable) {
      errors.push(`${expected.name}.${expectedColumn.name}: expected nullable ${expectedColumn.nullable}, got ${actualColumn.nullable}`);
    }
    const expectedDefault = normalizeDefault(expectedColumn.default);
    if (expectedDefault !== null && actualColumn.default !== expectedDefault) {
      errors.push(`${expected.name}.${expectedColumn.name}: expected default ${expectedDefault}, got ${actualColumn.default}`);
    }
    const expectedExtra = normalizeExtra(expectedColumn.extra);
    if (expectedExtra && !actualColumn.extra.includes(expectedExtra)) {
      errors.push(`${expected.name}.${expectedColumn.name}: expected extra ${expectedExtra}, got ${actualColumn.extra}`);
    }
  }

  for (const expectedIndex of expected.indexes) {
    const actualIndex = actualIndexes.get(expectedIndex.name);
    if (!actualIndex) {
      errors.push(`${expected.name}.${expectedIndex.name}: missing index`);
      continue;
    }
    if (actualIndex.unique !== expectedIndex.unique
      || actualIndex.columns.join(',') !== expectedIndex.columns.join(',')) {
      errors.push(`${expected.name}.${expectedIndex.name}: index drift`);
    }
  }

  for (const expectedCheck of expected.checks) {
    const actualCheck = actualChecks.get(expectedCheck.name);
    if (!actualCheck) {
      errors.push(`${expected.name}.${expectedCheck.name}: missing CHECK`);
      continue;
    }
    if (normalizeCheckClause(actualCheck.clause) !== normalizeCheckClause(expectedCheck.clause)) {
      errors.push(`${expected.name}.${expectedCheck.name}: CHECK drift`);
    }
  }

  const actualForeignKeys = new Map((actual.foreignKeys ?? []).map(foreignKey => [foreignKey.name, foreignKey]));
  for (const expectedForeignKey of expected.foreignKeys ?? []) {
    const actualForeignKey = actualForeignKeys.get(expectedForeignKey.name);
    if (!actualForeignKey) {
      errors.push(`${expected.name}.${expectedForeignKey.name}: missing foreign key`);
      continue;
    }
    if (actualForeignKey.columns.join(',') !== expectedForeignKey.columns.join(',')
      || actualForeignKey.referencedTable !== expectedForeignKey.referencedTable
      || actualForeignKey.referencedColumns.join(',') !== expectedForeignKey.referencedColumns.join(',')
      || actualForeignKey.onDelete !== expectedForeignKey.onDelete
      || actualForeignKey.onUpdate !== expectedForeignKey.onUpdate) {
      errors.push(`${expected.name}.${expectedForeignKey.name}: foreign key drift`);
    }
  }

  return {
    ok: errors.length === 0,
    checksum: stableChecksum({
      columns: expected.columns.map(column => actualColumns.get(column.name)),
      indexes: expected.indexes.map(index => actualIndexes.get(index.name)),
      checks: expected.checks.map(check => actualChecks.get(check.name)),
      foreignKeys: (expected.foreignKeys ?? []).map(foreignKey => actualForeignKeys.get(foreignKey.name)),
    }),
    errors,
  };
}

async function tableExists(db: SchemaDatabase, tableName: string): Promise<boolean> {
  const rows = await db.query<{ count: bigint | number }>(`
    SELECT COUNT(*) AS count
    FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
  `, tableName);
  return Number(rows[0]?.count ?? 0) > 0;
}

async function introspectTable(db: SchemaDatabase, tableName: string): Promise<IntrospectedTable> {
  const columnRows = await db.query<{
    COLUMN_NAME: string;
    COLUMN_TYPE: string;
    IS_NULLABLE: 'YES' | 'NO';
    COLUMN_DEFAULT: string | null;
    EXTRA: string;
  }>(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    ORDER BY ORDINAL_POSITION
  `, tableName);
  const indexRows = await db.query<{
    INDEX_NAME: string;
    NON_UNIQUE: number | bigint;
    COLUMN_NAME: string;
    SEQ_IN_INDEX: number | bigint;
  }>(`
    SELECT INDEX_NAME, NON_UNIQUE, COLUMN_NAME, SEQ_IN_INDEX
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = ?
    ORDER BY INDEX_NAME, SEQ_IN_INDEX
  `, tableName);
  const checkRows = await db.query<{ CONSTRAINT_NAME: string; CHECK_CLAUSE: string }>(`
    SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
    JOIN INFORMATION_SCHEMA.CHECK_CONSTRAINTS cc
      ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
     AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
    WHERE tc.TABLE_SCHEMA = DATABASE()
      AND tc.TABLE_NAME = ?
      AND tc.CONSTRAINT_TYPE = 'CHECK'
    ORDER BY tc.CONSTRAINT_NAME
  `, tableName);
  const foreignKeyRows = await db.query<{
    CONSTRAINT_NAME: string;
    COLUMN_NAME: string;
    REFERENCED_TABLE_NAME: string;
    REFERENCED_COLUMN_NAME: string;
    ORDINAL_POSITION: number | bigint;
    DELETE_RULE: string;
    UPDATE_RULE: string;
  }>(`
    SELECT kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME, kcu.REFERENCED_TABLE_NAME,
           kcu.REFERENCED_COLUMN_NAME, kcu.ORDINAL_POSITION, rc.DELETE_RULE, rc.UPDATE_RULE
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
    JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
      ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
     AND rc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
    WHERE kcu.TABLE_SCHEMA = DATABASE()
      AND kcu.TABLE_NAME = ?
      AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION
  `, tableName);

  const indexes = new Map<string, IntrospectedIndex>();
  for (const row of indexRows) {
    const index = indexes.get(row.INDEX_NAME) ?? {
      name: row.INDEX_NAME,
      unique: Number(row.NON_UNIQUE) === 0,
      columns: [],
    };
    index.columns[Number(row.SEQ_IN_INDEX) - 1] = row.COLUMN_NAME;
    indexes.set(row.INDEX_NAME, index);
  }

  const foreignKeys = new Map<string, IntrospectedForeignKey>();
  for (const row of foreignKeyRows) {
    const foreignKey = foreignKeys.get(row.CONSTRAINT_NAME) ?? {
      name: row.CONSTRAINT_NAME,
      columns: [],
      referencedTable: row.REFERENCED_TABLE_NAME,
      referencedColumns: [],
      onDelete: row.DELETE_RULE.toUpperCase(),
      onUpdate: row.UPDATE_RULE.toUpperCase(),
    };
    foreignKey.columns[Number(row.ORDINAL_POSITION) - 1] = row.COLUMN_NAME;
    foreignKey.referencedColumns[Number(row.ORDINAL_POSITION) - 1] = row.REFERENCED_COLUMN_NAME;
    foreignKeys.set(row.CONSTRAINT_NAME, foreignKey);
  }

  return {
    name: tableName,
    columns: columnRows.map(row => ({
      name: row.COLUMN_NAME,
      type: row.COLUMN_TYPE,
      nullable: row.IS_NULLABLE === 'YES',
      default: row.COLUMN_DEFAULT,
      extra: row.EXTRA,
    })),
    indexes: Array.from(indexes.values()).map(index => ({
      ...index,
      columns: index.columns.filter(Boolean),
    })),
    checks: checkRows.map(row => ({
      name: row.CONSTRAINT_NAME,
      clause: row.CHECK_CLAUSE,
    })),
    foreignKeys: Array.from(foreignKeys.values()).map(foreignKey => ({
      ...foreignKey,
      columns: foreignKey.columns.filter(Boolean),
      referencedColumns: foreignKey.referencedColumns.filter(Boolean),
    })),
  };
}

interface PlannedStep extends ApplyAction {
  sql?: string;
  verifyTable?: ExpectedTable;
}

async function planExpectedTable(db: SchemaDatabase, expected: ExpectedTable, plan: PlannedStep[]): Promise<void> {
  if (!(await tableExists(db, expected.name))) {
    if (!expected.createSql) throw new Error(`${expected.name}: missing create SQL`);
    rejectDangerousSql(expected.createSql);
    plan.push({ object: expected.name, action: 'create', sql: expected.createSql, verifyTable: expected });
    return;
  }

  const actual = await introspectTable(db, expected.name);
  const validation = validateExistingTable(expected, actual);
  if (!validation.ok) {
    const action = { object: expected.name, action: 'drift' as const, details: validation.errors.join('; ') };
    throw new SchemaDriftError(`${expected.name} drift: ${validation.errors.join('; ')}`, [...plan, action]);
  }
  plan.push({ object: expected.name, action: 'skip', checksum: validation.checksum });
}

function migrationStatements(): Map<string, string> {
  const sql = readFileSync(resolve(process.cwd(), 'prisma/migrations/202609280001_waste_area_discovery/migration.sql'), 'utf8');
  const statements = sql
    .split(/;\s*(?:\n|$)/)
    .map(statement => statement.trim())
    .filter(Boolean);
  const result = new Map<string, string>();
  for (const statement of statements) {
    const match = statement.match(/CREATE TABLE `([^`]+)`/);
    if (match) result.set(match[1], statement);
  }
  return result;
}

async function planPublicRental(db: SchemaDatabase, plan: PlannedStep[]): Promise<void> {
  if (!(await tableExists(db, 'Subscription'))) {
    const action = { object: 'Subscription', action: 'drift' as const, details: 'Subscription table absent' };
    throw new SchemaDriftError('Subscription table is required for public-rental release schema', [...plan, action]);
  }
  const columns = await db.query<{
    COLUMN_NAME: string;
    COLUMN_TYPE: string;
    IS_NULLABLE: 'YES' | 'NO';
  }>(`
    SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Subscription'
      AND COLUMN_NAME IN ('publicRental', 'supersededById')
  `);
  const byName = new Map(columns.map(column => [column.COLUMN_NAME, column]));

  const publicRental = byName.get('publicRental');
  if (!publicRental) {
    plan.push({ object: 'Subscription.publicRental', action: 'alter', sql: 'ALTER TABLE `Subscription` ADD COLUMN `publicRental` JSON NULL' });
  } else if (publicRental.COLUMN_TYPE.toLowerCase() !== 'json' || publicRental.IS_NULLABLE !== 'YES') {
    const action = { object: 'Subscription.publicRental', action: 'drift' as const };
    throw new SchemaDriftError('Subscription.publicRental drift', [...plan, action]);
  } else {
    plan.push({ object: 'Subscription.publicRental', action: 'skip' });
  }

  const supersededById = byName.get('supersededById');
  if (!supersededById) {
    plan.push({ object: 'Subscription.supersededById', action: 'alter', sql: 'ALTER TABLE `Subscription` ADD COLUMN `supersededById` INTEGER NULL' });
  } else if (normalizeType(supersededById.COLUMN_TYPE) !== 'int' || supersededById.IS_NULLABLE !== 'YES') {
    const action = { object: 'Subscription.supersededById', action: 'drift' as const };
    throw new SchemaDriftError('Subscription.supersededById drift', [...plan, action]);
  } else {
    plan.push({ object: 'Subscription.supersededById', action: 'skip' });
  }

  const indexRows = await db.query<{ INDEX_NAME: string; COLUMN_NAME: string; NON_UNIQUE: number | bigint }>(`
    SELECT INDEX_NAME, COLUMN_NAME, NON_UNIQUE
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Subscription'
      AND INDEX_NAME = 'Subscription_supersededById_idx'
    ORDER BY SEQ_IN_INDEX
  `);
  if (indexRows.length === 0) {
    plan.push({ object: 'Subscription_supersededById_idx', action: 'alter', sql: 'CREATE INDEX `Subscription_supersededById_idx` ON `Subscription` (`supersededById`)' });
  } else if (indexRows.length !== 1 || indexRows[0]?.COLUMN_NAME !== 'supersededById' || Number(indexRows[0]?.NON_UNIQUE) !== 1) {
    const action = { object: 'Subscription_supersededById_idx', action: 'drift' as const };
    throw new SchemaDriftError('Subscription_supersededById_idx drift', [...plan, action]);
  } else {
    plan.push({ object: 'Subscription_supersededById_idx', action: 'skip' });
  }
}

async function countViolations(db: SchemaDatabase, checkName: string): Promise<number> {
  const rows = await db.query<{ count: bigint | number }>(WASTE_VIOLATION_SQL[checkName] ?? '');
  return Number(rows[0]?.count ?? 0);
}

function expectedWasteTables(): ExpectedTable[] {
  const statements = migrationStatements();
  return WASTE_TABLES.map(table => ({
    ...table,
    createSql: statements.get(table.name),
  }));
}

async function planWaste(db: SchemaDatabase, plan: PlannedStep[]): Promise<void> {
  for (const expected of expectedWasteTables()) {
    if (!(await tableExists(db, expected.name))) {
      if (!expected.createSql) throw new Error(`${expected.name}: missing create SQL`);
      rejectDangerousSql(expected.createSql);
      plan.push({ object: expected.name, action: 'create', sql: expected.createSql, verifyTable: expected });
      continue;
    }

    const actual = await introspectTable(db, expected.name);
    const existingCheckNames = new Set(actual.checks.map(check => check.name));
    const structuralExpected = {
      ...expected,
      checks: expected.checks.filter(check => existingCheckNames.has(check.name)),
    };
    const validation = validateExistingTable(structuralExpected, actual);
    if (!validation.ok) {
      const action = { object: expected.name, action: 'drift' as const, details: validation.errors.join('; ') };
      throw new SchemaDriftError(`${expected.name} drift: ${validation.errors.join('; ')}`, [...plan, action]);
    }
    plan.push({ object: expected.name, action: 'skip', checksum: validation.checksum });

    for (const expectedCheck of expected.checks) {
      if (existingCheckNames.has(expectedCheck.name)) {
        plan.push({ object: expectedCheck.name, action: 'skip', checksum: stableChecksum(expectedCheck) });
        continue;
      }
      const violations = await countViolations(db, expectedCheck.name);
      if (violations > 0) {
        const action = { object: expectedCheck.name, action: 'violation' as const, violations };
        throw new SchemaViolationError(`${expectedCheck.name} has ${violations} existing violations`, [...plan, action]);
      }
      const addSql = WASTE_ADD_CHECK_SQL[expectedCheck.name];
      rejectDangerousSql(addSql);
      plan.push({ object: expectedCheck.name, action: 'alter', sql: addSql, checksum: stableChecksum(expectedCheck) });
    }
  }
}

async function buildReleaseSchemaPlan(db: SchemaDatabase): Promise<PlannedStep[]> {
  const plan: PlannedStep[] = [];
  for (const expected of SUMMARY_V2_TABLES) {
    await planExpectedTable(db, expected, plan);
  }
  for (const expected of REAL_ESTATE_PUBLIC_URL_TABLES) {
    await planExpectedTable(db, expected, plan);
  }
  await planPublicRental(db, plan);
  await planWaste(db, plan);
  return plan;
}

async function executePlannedStep(db: SchemaDatabase, step: PlannedStep): Promise<ApplyAction> {
  if (!step.sql) {
    return { object: step.object, action: step.action, checksum: step.checksum, details: step.details, violations: step.violations };
  }
  rejectDangerousSql(step.sql);
  await db.execute('SET SESSION lock_wait_timeout = 3');
  const timeoutRows = await db.query<{ lock_wait_timeout: number | bigint | string }>('SELECT @@SESSION.lock_wait_timeout AS lock_wait_timeout');
  if (Number(timeoutRows[0]?.lock_wait_timeout) !== 3) {
    throw new SchemaDriftError('Unable to pin low DDL lock_wait_timeout before schema mutation', [
      { object: step.object, action: 'drift', details: 'lock_wait_timeout was not 3 on DDL session' },
    ]);
  }
  await db.execute(step.sql);
  if (!step.verifyTable) return { object: step.object, action: step.action, checksum: step.checksum };

  const actual = await introspectTable(db, step.verifyTable.name);
  const validation = validateExistingTable(step.verifyTable, actual);
  if (!validation.ok) {
    throw new SchemaDriftError(`${step.verifyTable.name} drift after create: ${validation.errors.join('; ')}`, [
      { object: step.verifyTable.name, action: 'drift', details: validation.errors.join('; ') },
    ]);
  }
  return { object: step.object, action: step.action, checksum: validation.checksum };
}

type PrismaLike = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe' | '$transaction'>;

type PrismaSessionLike = Pick<PrismaClient, '$queryRawUnsafe' | '$executeRawUnsafe'>;

function createPrismaSessionDatabase(prisma: PrismaSessionLike): SchemaDatabase {
  return {
    query: <T>(sql: string, ...params: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...params),
    execute: (sql: string) => prisma.$executeRawUnsafe(sql),
    pinnedSession: true,
  };
}

export function createPrismaSchemaDatabase(prisma: PrismaLike): SchemaDatabase {
  return {
    query: <T>(sql: string, ...params: unknown[]) => prisma.$queryRawUnsafe<T[]>(sql, ...params),
    execute: (sql: string) => prisma.$executeRawUnsafe(sql),
    withSession: async <T>(fn: (db: SchemaDatabase) => Promise<T>) => prisma.$transaction(
      async tx => fn(createPrismaSessionDatabase(tx as PrismaSessionLike)),
      { timeout: 60_000, maxWait: 10_000 },
    ),
  };
}

async function applyReleaseSchemaInSession(db: SchemaDatabase): Promise<ApplyReport> {
  const versionRows = await db.query<{ version: string }>('SELECT VERSION() AS version');
  await db.execute('SET SESSION lock_wait_timeout = 3');
  const timeoutRows = await db.query<{ lock_wait_timeout: number | bigint | string }>('SELECT @@SESSION.lock_wait_timeout AS lock_wait_timeout');
  if (Number(timeoutRows[0]?.lock_wait_timeout) !== 3) {
    throw new SchemaDriftError('Unable to set low DDL lock_wait_timeout for release schema session');
  }

  const plan = await buildReleaseSchemaPlan(db);
  const actions: ApplyAction[] = [];
  for (const step of plan) {
    actions.push(await executePlannedStep(db, step));
  }

  return {
    databaseVersion: versionRows[0]?.version,
    actions,
  };
}

export async function applyReleaseSchema(db: SchemaDatabase): Promise<ApplyReport> {
  if (!db.pinnedSession && db.withSession) {
    return db.withSession(sessionDb => applyReleaseSchemaInSession(sessionDb));
  }
  return applyReleaseSchemaInSession(db);
}

async function main(): Promise<void> {
  const databaseUrl = assertLocalTestDatabaseUrl(process.env.HOUSING_TEST_DATABASE_URL);
  process.env.DATABASE_URL = databaseUrl;
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  try {
    const report = await applyReleaseSchema(createPrismaSchemaDatabase(prisma));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
