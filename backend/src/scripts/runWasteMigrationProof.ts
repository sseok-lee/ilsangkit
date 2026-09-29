import { spawnSync } from 'node:child_process';
import { statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';
import { assertLocalTestDatabaseUrl } from '../utils/testDatabaseGuard.js';

const migrationPath = 'prisma/migrations/202609280001_waste_area_discovery/migration.sql';
const beforeRoot = resolve('..', '.superpowers/sdd/2026-09-28-waste-area-discovery/task-3-fix1-before');
const sourceId = `w3-fix1-${Date.now()}`;

interface WasteScheduleSnapshot {
  id: number;
  city: string;
  district: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: unknown;
  sourceId: string;
  sourceUrl: string | null;
  govCode: string | null;
  createdAt: string;
  updatedAt: string;
  syncedAt: string;
}

interface ProofEvidence {
  databaseName: string;
  beforeSnapshotPath: string;
  insertedId: number;
  baselineHadWasteStagedSchedule: boolean;
  migratedHasWasteStagedSchedule: boolean;
  migratedHasWasteGeneration: boolean;
  wasteScheduleDiscoveryStagedColumns: number;
  preservedLegacyMarkerRows: number;
}

function assertSafeDatabaseName(name: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(name) || !name.endsWith('_test') || name.length <= '_test'.length) {
    throw new Error('Dedicated localhost:3307 *_test MySQL database required');
  }
}

export function resolveBaselineSchemaPath(args = process.argv.slice(2), env = process.env): string {
  const inlineArg = args.find((arg) => arg.startsWith('--baseline-schema='));
  const argIndex = args.indexOf('--baseline-schema');
  const cliPath = inlineArg?.slice('--baseline-schema='.length) ?? (argIndex >= 0 ? args[argIndex + 1] : undefined);
  const configuredPath = cliPath || env.WASTE_BASELINE_SCHEMA_PATH;

  if (!configuredPath) {
    throw new Error('WASTE_BASELINE_SCHEMA_PATH or --baseline-schema is required for migration-proof');
  }

  const resolvedPath = resolve(configuredPath);
  try {
    const stat = statSync(resolvedPath);
    if (!stat.isFile()) {
      throw new Error('not-file');
    }
  } catch {
    throw new Error('Baseline schema path must be a readable regular file');
  }

  return resolvedPath;
}

function runChecked(command: string, args: string[], env: Record<string, string | undefined>): void {
  const result = spawnSync(command, args, { stdio: 'inherit', env });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} failed with exit code ${result.status ?? 1}`);
  }
}

function buildServerMetadataUrl(rawUrl: string): string {
  const metadataUrl = new URL(rawUrl);
  metadataUrl.pathname = '/mysql';
  return metadataUrl.toString();
}

async function databaseExists(prisma: PrismaClient, name: string): Promise<boolean> {
  assertSafeDatabaseName(name);
  const rows = await prisma.$queryRaw<Array<{ schemaName: string }>>`
    SELECT SCHEMA_NAME AS schemaName
    FROM INFORMATION_SCHEMA.SCHEMATA
    WHERE SCHEMA_NAME = ${name}
  `;

  return rows.some((row) => row.schemaName === name);
}

function buildUrlForDatabase(rawUrl: string, name: string): string {
  assertSafeDatabaseName(name);
  const next = new URL(rawUrl);
  next.pathname = `/${encodeURIComponent(name)}`;
  return assertLocalTestDatabaseUrl(next.toString());
}

async function chooseDatabaseName(prisma: PrismaClient, requestedDatabaseName: string): Promise<string> {
  assertSafeDatabaseName(requestedDatabaseName);
  if (!(await databaseExists(prisma, requestedDatabaseName))) {
    return requestedDatabaseName;
  }

  const timestamp = Date.now().toString(36);
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const candidate = `ilsangkit_waste_migration_${timestamp}_${attempt}_test`;
    if (!(await databaseExists(prisma, candidate))) {
      return candidate;
    }
  }

  throw new Error('Unable to choose an unused waste migration test database');
}

async function createDatabase(prisma: PrismaClient, name: string): Promise<void> {
  assertSafeDatabaseName(name);
  await prisma.$executeRawUnsafe(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
}

async function tableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND table_name = ${tableName}
  `;

  return Number(rows[0]?.count ?? 0) === 1;
}

function normalizeSnapshot(row: {
  id: number;
  city: string;
  district: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: unknown;
  sourceId: string;
  sourceUrl: string | null;
  govCode: string | null;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}): WasteScheduleSnapshot {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    syncedAt: row.syncedAt.toISOString(),
  };
}

async function main(): Promise<void> {
  process.env.NODE_ENV = 'test';
  const baselineSchemaPath = resolveBaselineSchemaPath();
  const rawUrl = assertLocalTestDatabaseUrl(process.env.HOUSING_TEST_DATABASE_URL);
  const requestedDatabaseName = decodeURIComponent(new URL(rawUrl).pathname.slice(1));

  const metadataPrisma = new PrismaClient({
    datasources: {
      db: {
        url: buildServerMetadataUrl(rawUrl),
      },
    },
  });
  const databaseName = await chooseDatabaseName(metadataPrisma, requestedDatabaseName);
  const proofUrl = buildUrlForDatabase(rawUrl, databaseName);
  const evidenceDir = resolve(beforeRoot, databaseName);
  const beforeSnapshotPath = resolve(evidenceDir, 'before-waste-schedule.json');
  const evidencePath = resolve(evidenceDir, 'migration-proof-evidence.json');

  try {
    await createDatabase(metadataPrisma, databaseName);
  } finally {
    await metadataPrisma.$disconnect();
  }

  const proofEnv = {
    ...process.env,
    DATABASE_URL: proofUrl,
    NODE_ENV: 'test',
  };

  runChecked('node_modules/.bin/prisma', ['db', 'push', '--schema', baselineSchemaPath, '--skip-generate'], proofEnv);

  const baselinePrisma = new PrismaClient({
    datasources: {
      db: {
        url: proofUrl,
      },
    },
  });
  let before: WasteScheduleSnapshot;
  let insertedId: number;
  let baselineHadWasteStagedSchedule: boolean;

  try {
    baselineHadWasteStagedSchedule = await tableExists(baselinePrisma, 'WasteStagedSchedule');
    const inserted = await baselinePrisma.wasteSchedule.create({
      data: {
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동+역삼2동',
        emissionPlace: '내 집 앞',
        details: {
          food: '월/수/금',
          recycle: ['화', '목'],
          note: 'pre migration snapshot',
        },
        sourceId,
        sourceUrl: 'https://example.test/waste/fix1',
        govCode: '3220000',
      },
    });
    insertedId = inserted.id;
    before = normalizeSnapshot(await baselinePrisma.wasteSchedule.findUniqueOrThrow({ where: { id: insertedId } }));

    await mkdir(evidenceDir, { recursive: true });
    await writeFile(beforeSnapshotPath, `${JSON.stringify(before, null, 2)}\n`);
  } finally {
    await baselinePrisma.$disconnect();
  }

  runChecked(
    'node_modules/.bin/prisma',
    ['db', 'execute', '--file', migrationPath, '--schema', 'prisma/schema.prisma'],
    proofEnv,
  );

  const migratedPrisma = new PrismaClient({
    datasources: {
      db: {
        url: proofUrl,
      },
    },
  });

  try {
    const after = normalizeSnapshot(await migratedPrisma.wasteSchedule.findUniqueOrThrow({ where: { id: insertedId } }));
    const migratedHasWasteStagedSchedule = await tableExists(migratedPrisma, 'WasteStagedSchedule');
    const migratedHasWasteGeneration = await tableExists(migratedPrisma, 'WasteGeneration');
    const discoveryColumns = await migratedPrisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'WasteSchedule'
        AND column_name = 'discoveryStaged'
    `;
    const markers = await migratedPrisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) AS count
      FROM WasteStagedSchedule
      WHERE scheduleId = ${insertedId}
    `;

    if (JSON.stringify(after) !== JSON.stringify(before)) {
      throw new Error('WasteSchedule row changed across additive migration');
    }
    if (baselineHadWasteStagedSchedule) {
      throw new Error('Baseline schema unexpectedly contained WasteStagedSchedule');
    }
    if (!migratedHasWasteStagedSchedule || !migratedHasWasteGeneration) {
      throw new Error('Migration did not create required W3 tables');
    }
    if (Number(discoveryColumns[0]?.count ?? 0) !== 0) {
      throw new Error('WasteSchedule.discoveryStaged scalar exists after migration');
    }
    if (Number(markers[0]?.count ?? 0) !== 0) {
      throw new Error('Preserved legacy source unexpectedly has a staged marker');
    }

    const evidence: ProofEvidence = {
      databaseName,
      beforeSnapshotPath,
      insertedId,
      baselineHadWasteStagedSchedule,
      migratedHasWasteStagedSchedule,
      migratedHasWasteGeneration,
      wasteScheduleDiscoveryStagedColumns: Number(discoveryColumns[0]?.count ?? 0),
      preservedLegacyMarkerRows: Number(markers[0]?.count ?? 0),
    };

    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
    console.info(`migration-proof database=${databaseName}`);
    console.info(`migration-proof beforeSnapshot=${beforeSnapshotPath}`);
    console.info(`migration-proof insertedId=${insertedId}`);
  } finally {
    await migratedPrisma.$disconnect();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
