import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const EXPECTED_FAULT_EXIT_CODE = 10;
const TARGET_TYPE = 'apt-rent';
const TARGET_CITY = '서울특별시';
const CHECK_NAME = 'RealEstateBuildingSummaryV2_buildingKey_hex_chk';
const EXPECTED_BUILDING_KEY_CHECK = "REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$', 'c')";
const DRIFTED_BUILDING_KEY_CHECK = "REGEXP_LIKE(buildingKey, '^[a-f0-9]{64}$')";
const LOCK_RELEASE_DELAY_MS = 1_500;
const TX_TIMEOUT_MS = 1_000;

export type DatabaseFaultKind = 'invalid-check' | 'city-timeout';

type PrismaClientLike = {
  $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $disconnect(): Promise<void>;
  $transaction<T>(fn: (tx: Pick<PrismaClientLike, '$queryRawUnsafe' | '$executeRawUnsafe'>) => Promise<T>, options?: unknown): Promise<T>;
};

export type DatabaseFaultDigest = {
  realEstateBuildingSummaryV2: string;
  realEstateSummaryState: string;
  realEstateBuildingSummary?: string;
  aptRentTransaction?: string;
};

export type DatabaseFaultReport = {
  kind: DatabaseFaultKind;
  expectedFault: boolean;
  injectedReason: string;
  detectedReason: string;
  beforeDigest: DatabaseFaultDigest;
  afterDigest: DatabaseFaultDigest;
  preserved: boolean;
  target?: {
    type: string;
    city: string;
  };
  failureClass?: string;
  timings?: {
    lockReleaseDelayMs?: number;
    transactionTimeoutMs?: number;
    refreshElapsedMs?: number;
  };
};

export type RunDatabaseFaultOptions = {
  kind: DatabaseFaultKind;
  databaseUrl?: string;
  reportOut?: string;
  lockReleaseDelayMs?: number;
  transactionTimeoutMs?: number;
};

function parseArgs(argv: string[]): { kind?: string; reportOut?: string } {
  const parsed: { kind?: string; reportOut?: string } = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--kind') parsed.kind = argv[index + 1];
    else if (arg.startsWith('--kind=')) parsed.kind = arg.slice('--kind='.length);
    else if (arg === '--report-out') parsed.reportOut = argv[index + 1];
    else if (arg.startsWith('--report-out=')) parsed.reportOut = arg.slice('--report-out='.length);
    else if (!arg.startsWith('-') && parsed.kind === undefined) parsed.kind = arg;
  }
  return parsed;
}

function assertDatabaseFaultKind(value: string | undefined): DatabaseFaultKind {
  if (value === 'invalid-check' || value === 'city-timeout') return value;
  throw new Error('Expected --kind invalid-check or --kind city-timeout');
}

export function assertC3TestDatabaseUrl(rawUrl: string | undefined): string {
  if (!rawUrl) throw new Error('C3_TEST_DATABASE_URL is required');
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('C3_TEST_DATABASE_URL must be a valid MySQL URL');
  }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
  const isLocalHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost';
  if (
    parsed.protocol !== 'mysql:'
    || !isLocalHost
    || parsed.port !== '3307'
    || !databaseName.endsWith('_test')
    || databaseName.length <= '_test'.length
  ) {
    throw new Error('Dedicated localhost:3307 *_test MySQL database required');
  }
  return rawUrl;
}

async function loadPrismaClient(databaseUrl: string): Promise<PrismaClientLike> {
  const { PrismaClient } = await import('@prisma/client');
  return new PrismaClient({ datasources: { db: { url: databaseUrl } }, log: ['error'] }) as PrismaClientLike;
}

async function tableExists(prisma: PrismaClientLike, tableName: string): Promise<boolean> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*) AS count
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    tableName,
  );
  return Number(rows[0]?.count ?? 0) > 0;
}

function normalizeValue(value: unknown): unknown {
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('hex');
  if (value && typeof value === 'object' && 'toString' in value) {
    const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
    if (ctor === 'Decimal') return String(value);
  }
  return value;
}

function stableDigest(rows: Array<Record<string, unknown>>): string {
  const normalized = rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizeValue(value)]),
  ));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
}

async function digestQuery(prisma: PrismaClientLike, query: string, ...values: unknown[]): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(query, ...values);
  return stableDigest(rows);
}

async function readDigest(prisma: PrismaClientLike, includeCityScope: boolean): Promise<DatabaseFaultDigest> {
  const digest: DatabaseFaultDigest = {
    realEstateBuildingSummaryV2: await digestQuery(
      prisma,
      `SELECT * FROM RealEstateBuildingSummaryV2 ORDER BY type, buildingKey, id`,
    ),
    realEstateSummaryState: await digestQuery(
      prisma,
      `SELECT id, status, runId, sourceFingerprint, CAST(report AS CHAR) AS report, validatedAt, updatedAt
       FROM RealEstateSummaryState ORDER BY id`,
    ),
  };
  if (includeCityScope) {
    if (await tableExists(prisma, 'RealEstateBuildingSummary')) {
      digest.realEstateBuildingSummary = await digestQuery(
        prisma,
        `SELECT * FROM RealEstateBuildingSummary WHERE type = ? AND city = ? ORDER BY id`,
        TARGET_TYPE,
        TARGET_CITY,
      );
    }
    if (await tableExists(prisma, 'AptRentTransaction')) {
      digest.aptRentTransaction = await digestQuery(
        prisma,
        `SELECT * FROM AptRentTransaction WHERE city = ? ORDER BY id`,
        TARGET_CITY,
      );
    }
  }
  return digest;
}

function digestsEqual(left: DatabaseFaultDigest, right: DatabaseFaultDigest): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function ensureSummaryTables(prisma: PrismaClientLike): Promise<void> {
  const { SUMMARY_V2_TABLES } = await import('./applyReleaseSchema.js');
  for (const table of SUMMARY_V2_TABLES) {
    if ((table.name === 'RealEstateBuildingSummaryV2' || table.name === 'RealEstateSummaryState') && table.createSql) {
      if (!await tableExists(prisma, table.name)) {
        await prisma.$executeRawUnsafe(table.createSql);
      }
    }
  }
}

async function restoreBuildingKeyCheck(prisma: PrismaClientLike): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE RealEstateBuildingSummaryV2 DROP CHECK ${CHECK_NAME}`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE RealEstateBuildingSummaryV2 ADD CONSTRAINT ${CHECK_NAME} CHECK (${EXPECTED_BUILDING_KEY_CHECK})`,
  );
}

async function injectDriftedBuildingKeyCheck(prisma: PrismaClientLike): Promise<void> {
  await prisma.$executeRawUnsafe(`ALTER TABLE RealEstateBuildingSummaryV2 DROP CHECK ${CHECK_NAME}`);
  await prisma.$executeRawUnsafe(
    `ALTER TABLE RealEstateBuildingSummaryV2 ADD CONSTRAINT ${CHECK_NAME} CHECK (${DRIFTED_BUILDING_KEY_CHECK})`,
  );
}

async function readBuildingKeyCheckClause(prisma: PrismaClientLike): Promise<string> {
  const rows = await prisma.$queryRawUnsafe<Array<{ CHECK_CLAUSE: string }>>(
    `SELECT CHECK_CLAUSE
     FROM INFORMATION_SCHEMA.CHECK_CONSTRAINTS
     WHERE CONSTRAINT_SCHEMA = DATABASE() AND CONSTRAINT_NAME = ?`,
    CHECK_NAME,
  );
  const clause = rows[0]?.CHECK_CLAUSE;
  if (!clause) throw new Error(`${CHECK_NAME} was not restored`);
  return clause;
}

async function runInvalidCheck(prisma: PrismaClientLike): Promise<DatabaseFaultReport> {
  const { SchemaDriftError, applyReleaseSchema, createPrismaSchemaDatabase, normalizeCheckClause } = await import('./applyReleaseSchema.js');
  await ensureSummaryTables(prisma);
  const beforeDigest = await readDigest(prisma, false);
  let detectedReason = '';

  try {
    await injectDriftedBuildingKeyCheck(prisma);
    try {
      await applyReleaseSchema(createPrismaSchemaDatabase(prisma as never));
    } catch (error) {
      if (error instanceof SchemaDriftError || (error instanceof Error && /drift/i.test(error.message))) {
        detectedReason = error instanceof Error ? error.message : String(error);
      } else {
        throw error;
      }
    }
    if (!detectedReason) {
      throw new Error('C1 schema verifier did not detect the injected CHECK drift');
    }
  } finally {
    await restoreBuildingKeyCheck(prisma);
  }

  const restoredClause = await readBuildingKeyCheckClause(prisma);
  if (normalizeCheckClause(restoredClause) !== normalizeCheckClause(EXPECTED_BUILDING_KEY_CHECK)) {
    throw new Error(`${CHECK_NAME} was not restored to the expected CHECK clause`);
  }
  const afterDigest = await readDigest(prisma, false);
  const preserved = digestsEqual(beforeDigest, afterDigest);
  if (!preserved) throw new Error('invalid-check fault changed table data while restoring CHECK constraint');

  return {
    kind: 'invalid-check',
    expectedFault: true,
    injectedReason: `${CHECK_NAME} temporarily changed to ${DRIFTED_BUILDING_KEY_CHECK}`,
    detectedReason,
    beforeDigest,
    afterDigest,
    preserved,
    failureClass: 'schema-drift',
  };
}

async function findTargetV2RowId(prisma: PrismaClientLike): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
    `SELECT id FROM RealEstateBuildingSummaryV2 WHERE type = ? AND city = ? ORDER BY id LIMIT 1`,
    TARGET_TYPE,
    TARGET_CITY,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error(`Missing ${TARGET_TYPE}/${TARGET_CITY} RealEstateBuildingSummaryV2 row for city-timeout rehearsal`);
  return Number(id);
}

type HeldLock = {
  release(): Promise<void>;
};

async function holdV2CityRowLock(lockPrisma: PrismaClientLike, id: number): Promise<HeldLock> {
  let releaseTransaction!: () => void;
  let acquired!: () => void;
  let rejected!: (error: unknown) => void;
  let released = false;
  const releasePromise = new Promise<void>((resolve) => {
    releaseTransaction = resolve;
  });
  const acquiredPromise = new Promise<void>((resolve, reject) => {
    acquired = resolve;
    rejected = reject;
  });
  const transaction = lockPrisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe('SET SESSION innodb_lock_wait_timeout = 5');
      await tx.$queryRawUnsafe('SELECT id FROM RealEstateBuildingSummaryV2 WHERE id = ? FOR UPDATE', id);
      acquired();
      await releasePromise;
    },
    { timeout: 10_000, maxWait: 5_000 },
  ).catch((error: unknown) => {
    if (!released) rejected(error);
    else throw error;
  });

  await acquiredPromise;

  return {
    release: async () => {
      if (released) return;
      released = true;
      releaseTransaction();
      await transaction;
    },
  };
}

function failedBatchReason(result: { batches: Array<{ type: string; city: string; status: string; error?: string }> }): string {
  const failed = result.batches.find((batch) => batch.type === TARGET_TYPE && batch.city === TARGET_CITY && batch.status === 'failed');
  return failed?.error ?? '';
}

async function runCityTimeout(databaseUrl: string, prisma: PrismaClientLike, lockReleaseDelayMs: number, transactionTimeoutMs: number): Promise<DatabaseFaultReport> {
  const targetRowId = await findTargetV2RowId(prisma);
  const beforeDigest = await readDigest(prisma, true);
  const lockPrisma = await loadPrismaClient(databaseUrl);
  let releaseTimer: ReturnType<typeof setTimeout> | undefined;
  let heldLock: HeldLock | undefined;
  const oldDatabaseUrl = process.env.DATABASE_URL;
  const oldNodeEnv = process.env.NODE_ENV;
  const oldBatchTimeout = process.env.SUMMARY_BATCH_TIMEOUT_MS;
  const oldBatchPause = process.env.SUMMARY_BATCH_PAUSE_MS;

  try {
    heldLock = await holdV2CityRowLock(lockPrisma, targetRowId);
    releaseTimer = setTimeout(() => {
      void heldLock?.release();
    }, lockReleaseDelayMs);

    process.env.DATABASE_URL = databaseUrl;
    process.env.NODE_ENV = 'test';
    process.env.SUMMARY_BATCH_TIMEOUT_MS = String(transactionTimeoutMs);
    process.env.SUMMARY_BATCH_PAUSE_MS = '0';
    const { refreshAddressSummaries } = await import('../services/realEstateSummaryService.js');
    const startedAt = Date.now();
    const result = await refreshAddressSummaries([TARGET_TYPE]);
    const refreshElapsedMs = Date.now() - startedAt;
    const detectedReason = failedBatchReason(result);
    if (!detectedReason || !/P2028|timeout|Transaction already closed|expired/i.test(detectedReason)) {
      throw new Error(`city-timeout did not produce the expected transaction timeout; batches=${JSON.stringify(result.batches)}`);
    }

    const afterDigest = await readDigest(prisma, true);
    const preserved = digestsEqual(beforeDigest, afterDigest);
    if (!preserved) throw new Error('city-timeout changed V2/source/legacy/state data despite failed city batch');

    return {
      kind: 'city-timeout',
      expectedFault: true,
      injectedReason: `held ${TARGET_TYPE}/${TARGET_CITY} V2 row lock for ${lockReleaseDelayMs}ms while refresh used ${transactionTimeoutMs}ms transaction timeout`,
      detectedReason,
      beforeDigest,
      afterDigest,
      preserved,
      target: { type: TARGET_TYPE, city: TARGET_CITY },
      failureClass: 'refresh-transaction-timeout',
      timings: { lockReleaseDelayMs, transactionTimeoutMs, refreshElapsedMs },
    };
  } finally {
    if (releaseTimer) clearTimeout(releaseTimer);
    await heldLock?.release();
    await lockPrisma.$disconnect();
    if (oldDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldDatabaseUrl;
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = oldNodeEnv;
    if (oldBatchTimeout === undefined) delete process.env.SUMMARY_BATCH_TIMEOUT_MS;
    else process.env.SUMMARY_BATCH_TIMEOUT_MS = oldBatchTimeout;
    if (oldBatchPause === undefined) delete process.env.SUMMARY_BATCH_PAUSE_MS;
    else process.env.SUMMARY_BATCH_PAUSE_MS = oldBatchPause;
  }
}

async function writeReport(reportOut: string | undefined, report: unknown): Promise<void> {
  if (!reportOut) return;
  const reportPath = resolve(reportOut);
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
}

export async function runDatabaseFaultRehearsal(options: RunDatabaseFaultOptions): Promise<DatabaseFaultReport> {
  const databaseUrl = assertC3TestDatabaseUrl(options.databaseUrl ?? process.env.C3_TEST_DATABASE_URL);
  process.env.DATABASE_URL = databaseUrl;
  const prisma = await loadPrismaClient(databaseUrl);
  try {
    const report = options.kind === 'invalid-check'
      ? await runInvalidCheck(prisma)
      : await runCityTimeout(
        databaseUrl,
        prisma,
        options.lockReleaseDelayMs ?? LOCK_RELEASE_DELAY_MS,
        options.transactionTimeoutMs ?? TX_TIMEOUT_MS,
      );
    await writeReport(options.reportOut, report);
    return report;
  } finally {
    await prisma.$disconnect();
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const kind = assertDatabaseFaultKind(args.kind);
  try {
    const report = await runDatabaseFaultRehearsal({ kind, reportOut: args.reportOut });
    console.error(`[C3:${kind}] expected database fault detected: ${report.detectedReason}`);
    process.exitCode = EXPECTED_FAULT_EXIT_CODE;
  } catch (error) {
    const report = {
      kind,
      expectedFault: false,
      injectedReason: 'database fault rehearsal failed before detecting the expected fault',
      detectedReason: error instanceof Error ? error.message : String(error),
      failureClass: 'unexpected-failure',
    };
    await writeReport(args.reportOut, report);
    console.error(`[C3:${kind}] unexpected failure: ${report.detectedReason}`);
    process.exitCode = 1;
  }
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  void main();
}
