import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readMigrationFiles, splitSqlStatements } from './db-contract.mjs'

const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../..')
const repoBackendDir = join(repoRoot, 'backend')
const LEDGER_TABLE = '_prisma_migrations'
const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1'])
const PRISMA_TIMEOUT_MS = 5 * 60 * 1000
const UNORDERED_ARRAY_KEYS = new Set(['tables', 'columns', 'indexes', 'foreignKeys', 'checks', 'createTables', 'views', 'triggers', 'routines', 'events'])
const PREPARATION_PREVIOUS_PROD_SHA = 'cd32fcc04d1bf16ec472a69b683be06d1eda61ed'

export function createDbRuntime({ backendDir, databaseUrl }) {
  if (!backendDir || !databaseUrl) throw new Error('DB_RUNTIME_CONFIG')
  const parsedUrl = new URL(databaseUrl)
  const localPrismaCli = resolve(backendDir, 'node_modules/prisma/build/index.js')
  const prismaCli = existsSync(localPrismaCli)
    ? localPrismaCli
    : join(repoBackendDir, 'node_modules/prisma/build/index.js')
  const { PrismaClient } = loadPrismaClient(backendDir)
  const client = new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
  let closed = false

  const runtime = {
    async query(sql, ...values) {
      if (closed) throw new Error('DB_RUNTIME_CLOSED')
      return normalizePrismaRows(await client.$queryRawUnsafe(sql, ...values))
    },
    async exec(sql) {
      if (closed) throw new Error('DB_RUNTIME_CLOSED')
      return mysql(parsedUrl, sql)
    },
    async runPrisma(args, options = {}) {
      if (closed) throw new Error('DB_RUNTIME_CLOSED')
      return run(process.execPath, [prismaCli, ...args], {
        cwd: backendDir,
        env: buildPrismaEnv(databaseUrl, options.env ?? {}),
        timeoutMs: options.timeoutMs,
        logPath: options.logPath,
        killGraceMs: options.killGraceMs,
      })
    },
    async close() {
      await client.$disconnect()
      closed = true
    },
  }
  Object.defineProperty(runtime, 'getDatabaseUrl', {
    value: () => databaseUrl,
    enumerable: false,
  })
  return runtime
}

export async function readDbSnapshot(runtime) {
  const [identityRows, ledger, structure] = await Promise.all([
    runtime.query('SELECT DATABASE() AS databaseName, @@server_uuid AS serverUuid'),
    readLedger(runtime),
    readStructure(runtime),
  ])
  const identity = {
    database: identityRows[0]?.databaseName ?? '',
    serverUuid: identityRows[0]?.serverUuid ?? '',
  }

  return {
    identity,
    ledger,
    structure,
    fingerprint: sha256(stableJson(normalizeStructure(structure))),
  }
}

export function compareStructure(expected, actual) {
  const normalizedExpected = normalizeStructure(expected)
  const normalizedActual = normalizeStructure(actual)
  if (stableJson(normalizedExpected) === stableJson(normalizedActual)) {
    return { equal: true, differences: [] }
  }

  const differences = []
  const keys = [...new Set([...Object.keys(normalizedExpected), ...Object.keys(normalizedActual)])].sort()
  for (const key of keys) {
    if (stableJson(normalizedExpected[key]) !== stableJson(normalizedActual[key])) {
      differences.push(`${key}: expected ${stableJson(normalizedExpected[key])} actual ${stableJson(normalizedActual[key])}`)
    }
  }
  return { equal: false, differences }
}

export async function buildEvidence({ prismaDir, outputDir, sha, runId, runAttempt, fixtureFactory, compatibilityEvidence = [], preparationCompatibility = [] }) {
  if (!fixtureFactory) throw new Error('FIXTURE_FACTORY_REQUIRED')
  mkdirSync(outputDir, { recursive: true })

  const migrations = readMigrationFiles(prismaDir)
  const frozenPrefixLength = readFrozenPrefixLength(prismaDir, migrations)
  const compatibility = validateCompatibilityEvidence({
    migrations,
    frozenPrefixLength,
    compatibilityEvidence,
    candidateSha: sha,
    runId,
    runAttempt,
  })
  const preparationCompatibilityResult = validatePreparationCompatibility({
    preparationCompatibility,
    candidateSha: sha,
    runId,
    runAttempt,
  })
  const prefixLengths = []
  for (let prefixLength = Math.max(1, frozenPrefixLength || 1); prefixLength <= migrations.length; prefixLength += 1) {
    prefixLengths.push(prefixLength)
  }
  const manifest = {
    format: 1,
    sha,
    activeSha: sha,
    sourceTestRunId: runId,
    sourceTestRunAttempt: runAttempt,
    generatedAt: new Date().toISOString(),
    policy: {
      frozenPrefixLength,
      generatedPrefixLengths: prefixLengths,
      futureMigrationNames: migrations.slice(frozenPrefixLength).map((migration) => migration.name),
    },
    migrations: migrations.map((migration) => ({
      name: migration.name,
      checksum: migration.checksum,
      sqlPath: normalizeRepoPath(migration.sqlPath),
    })),
    mysql: null,
    introspection: { allowedUnsupported: [] },
    compatibility,
    preparationCompatibility: preparationCompatibilityResult,
    prefixes: [],
    finalDatamodelDiff: null,
  }

  for (const prefixLength of prefixLengths) {
    const fixture = await fixtureFactory(`prefix-${String(prefixLength).padStart(4, '0')}`)
    const runtime = createDbRuntime({ backendDir: fixture.backendDir, databaseUrl: fixture.url })
    try {
      await replayPrefix(fixture, migrations.slice(0, prefixLength))
      const snapshot = await readDbSnapshot(runtime)
      if (hasUnknownInventory(snapshot.structure)) throw new Error('UNSUPPORTED_INVENTORY')
      const prefixDir = join(outputDir, 'prefixes', String(prefixLength).padStart(4, '0'))
      mkdirSync(prefixDir, { recursive: true })

      const logDir = privateLogDir(outputDir, 'build', String(prefixLength).padStart(4, '0'))
      const pulled = await runtime.runPrisma(['db', 'pull', '--schema', fixture.schemaPath, '--print'], {
        timeoutMs: PRISMA_TIMEOUT_MS,
        logPath: join(logDir, 'db-pull.json'),
      })
      if (pulled.code !== 0) throw new Error(`PRISMA_DB_PULL:${pulled.code}:${sanitizePrismaOutput(pulled.stderr || pulled.stdout)}`)
      assertIntrospectionSupported({
        stdout: pulled.stdout,
        stderr: pulled.stderr,
        inventoriedNgram: snapshot.structure.indexes
          .filter((index) => index.parser === 'ngram')
          .map((index) => ({ table: index.table, index: index.name, columns: index.columns, parser: index.parser })),
        inventoriedChecks: snapshot.structure.checks,
      })

      const schemaPath = join(prefixDir, 'schema.prisma')
      const structurePath = join(prefixDir, 'structure.json')
      writeFileSync(schemaPath, pulled.stdout)
      writeFileSync(structurePath, `${JSON.stringify(snapshot.structure, null, 2)}\n`)

      if (!manifest.mysql) {
        manifest.mysql = await readMysqlMetadata(runtime, snapshot.structure)
        manifest.introspection.allowedUnsupported = [
          ...manifest.mysql.ngram.map((entry) => ({
            kind: 'mysql-fulltext-ngram-parser',
            ...entry,
          })),
          ...manifest.mysql.checks.map((entry) => ({
            kind: 'mysql-check-constraint',
            ...entry,
          })),
        ]
      }

      manifest.prefixes.push({
        prefixLength,
        migrationName: migrations[prefixLength - 1].name,
        schemaPath: normalizeEvidencePath(outputDir, schemaPath),
        schemaSha256: sha256(readFileSync(schemaPath)),
        structurePath: normalizeEvidencePath(outputDir, structurePath),
        structureSha256: sha256(readFileSync(structurePath)),
        fingerprint: snapshot.fingerprint,
      })

      if (prefixLength === migrations.length) {
        const diff = await runtime.runPrisma([
          'migrate',
          'diff',
          '--from-schema-datasource',
          fixture.schemaPath,
          '--to-schema-datamodel',
          fixture.schemaPath,
          '--exit-code',
        ], {
          timeoutMs: PRISMA_TIMEOUT_MS,
          logPath: join(logDir, 'migrate-diff.json'),
        })
        manifest.finalDatamodelDiff = {
          exitCode: diff.code,
          stdoutSha256: sha256(diff.stdout),
          stderrSha256: sha256(diff.stderr),
        }
        if (diff.code !== 0) throw new Error(`PRISMA_DIFF:${diff.code}`)
      }
    } finally {
      await runtime.close()
      if (typeof fixture.close === 'function') await fixture.close()
    }
  }

  writeFileSync(join(outputDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 })
}

export function validateCompatibilityEvidence({
  migrations,
  frozenPrefixLength,
  compatibilityEvidence = [],
  candidateSha,
  runId,
  runAttempt,
}) {
  const futureMigrations = migrations.slice(frozenPrefixLength).map((migration, offset) => ({
    ...migration,
    prefixLength: frozenPrefixLength + offset + 1,
  }))
  if (futureMigrations.length === 0) {
    return { status: 'not-applicable', requirements: [], results: [] }
  }
  if (!Array.isArray(compatibilityEvidence) || compatibilityEvidence.length === 0) {
    throw new Error('COMPATIBILITY_EVIDENCE_REQUIRED')
  }

  const requirements = buildCompatibilityRequirements(futureMigrations)
  const requiredKeys = new Set()
  for (const requirement of requirements) {
    for (const stage of requirement.stages) {
      requiredKeys.add(compatibilityKey({ ...requirement, stage }))
    }
  }
  const covered = new Set()
  const requirementByKey = new Map(requirements.map((requirement) => [compatibilityRequirementKey(requirement), requirement]))
  const results = compatibilityEvidence.map((entry) => {
    const requirement = requirementByKey.get(compatibilityRequirementKey(entry))
    if (!requirement) throw new Error('COMPATIBILITY_MIGRATION')
    if (entry.policySha256 !== requirement.policySha256) throw new Error('COMPATIBILITY_POLICY_CHECKSUM')
    if (entry.exitCode !== 0) throw new Error('COMPATIBILITY_EXIT')
    if (entry.candidateSha !== candidateSha) throw new Error('COMPATIBILITY_CANDIDATE_SHA')
    if (entry.sourceTestRunId !== runId) throw new Error('COMPATIBILITY_RUN_ID')
    if (entry.sourceTestRunAttempt !== runAttempt) throw new Error('COMPATIBILITY_RUN_ATTEMPT')
    if (!requirement.stages.includes(entry.stage)) throw new Error('COMPATIBILITY_STAGE')
    if (!requirement.previousCompatibleSha || entry.previousCompatibleSha !== requirement.previousCompatibleSha) throw new Error('COMPATIBILITY_SHA')
    if (entry.testPath !== requirement.testPath) throw new Error('COMPATIBILITY_TEST_PATH')
    if (typeof entry.command !== 'string' || entry.command.trim() === '') throw new Error('COMPATIBILITY_COMMAND')
    if (!/^[a-f0-9]{64}$/i.test(entry.stdoutSha256 ?? '')) throw new Error('COMPATIBILITY_STDOUT')
    if (!/^[a-f0-9]{64}$/i.test(entry.stderrSha256 ?? '')) throw new Error('COMPATIBILITY_STDERR')
    const key = compatibilityKey(entry)
    if (!requiredKeys.has(key)) throw new Error('COMPATIBILITY_UNDECLARED')
    covered.add(key)
    return {
      migrationName: entry.migrationName,
      policySha256: entry.policySha256,
      previousCompatibleSha: entry.previousCompatibleSha,
      testPath: entry.testPath,
      stage: entry.stage,
      candidateSha: entry.candidateSha,
      sourceTestRunId: entry.sourceTestRunId,
      sourceTestRunAttempt: entry.sourceTestRunAttempt,
      command: entry.command,
      exitCode: entry.exitCode,
      stdoutSha256: entry.stdoutSha256,
      stderrSha256: entry.stderrSha256,
    }
  }).sort((a, b) => compatibilityKey(a).localeCompare(compatibilityKey(b)))

  for (const key of requiredKeys) {
    if (!covered.has(key)) throw new Error('COMPATIBILITY_EVIDENCE_REQUIRED')
  }
  return { status: 'verified', requirements, results }
}

export function assertIntrospectionSupported({ stdout, stderr, inventoriedNgram, inventoriedChecks = [] }) {
  const combined = `${stdout}\n${stderr}`
  if (/Unsupported\s*\(/i.test(combined)) throw new Error('PRISMA_PULL_UNSUPPORTED')
  const warningLines = combined.split(/\r?\n/)
    .filter((line) => /\b(warning|unsupported|not supported|could not)\b/i.test(line))
    .filter((line) => !/^\s*\/\/ \*\*\* WARNING \*\*\*\s*$/i.test(line))
  const unapproved = warningLines.filter((line) => !isApprovedNgramWarning(line, inventoriedNgram) && !isApprovedCheckWarning(line, inventoriedChecks))
  if (unapproved.length > 0) throw new Error(`PRISMA_PULL_WARNING:${unapproved.map((line) => line.trim()).join(' | ')}`)
}


export function validatePreparationCompatibility({ preparationCompatibility = [], candidateSha, runId, runAttempt }) {
  if (!Array.isArray(preparationCompatibility) || preparationCompatibility.length === 0) {
    return { status: 'not-provided', results: [] }
  }
  const coveredStages = new Set()
  const results = preparationCompatibility.map((entry) => {
    if (!['previous-prod', 'candidate'].includes(entry.stage)) throw new Error('PREPARATION_COMPATIBILITY_STAGE')
    if (entry.candidateSha !== candidateSha) throw new Error('PREPARATION_COMPATIBILITY_CANDIDATE_SHA')
    if (entry.sourceTestRunId !== runId) throw new Error('PREPARATION_COMPATIBILITY_RUN_ID')
    if (entry.sourceTestRunAttempt !== runAttempt) throw new Error('PREPARATION_COMPATIBILITY_RUN_ATTEMPT')
    if (entry.previousProdSha !== PREPARATION_PREVIOUS_PROD_SHA) throw new Error('PREPARATION_COMPATIBILITY_PREVIOUS_SHA')
    if (entry.exitCode !== 0) throw new Error('PREPARATION_COMPATIBILITY_EXIT')
    if (typeof entry.command !== 'string' || entry.command.trim() === '') throw new Error('PREPARATION_COMPATIBILITY_COMMAND')
    if (!/^[a-f0-9]{64}$/i.test(entry.stdoutSha256 ?? '')) throw new Error('PREPARATION_COMPATIBILITY_STDOUT')
    if (!/^[a-f0-9]{64}$/i.test(entry.stderrSha256 ?? '')) throw new Error('PREPARATION_COMPATIBILITY_STDERR')
    coveredStages.add(entry.stage)
    return {
      stage: entry.stage,
      previousProdSha: entry.previousProdSha ?? null,
      candidateSha: entry.candidateSha,
      sourceTestRunId: entry.sourceTestRunId,
      sourceTestRunAttempt: entry.sourceTestRunAttempt,
      testPath: entry.testPath ?? null,
      command: entry.command,
      exitCode: entry.exitCode,
      stdoutSha256: entry.stdoutSha256,
      stderrSha256: entry.stderrSha256,
    }
  }).sort((a, b) => a.stage.localeCompare(b.stage))
  for (const stage of ['previous-prod', 'candidate']) {
    if (!coveredStages.has(stage)) throw new Error('PREPARATION_COMPATIBILITY_REQUIRED')
  }
  return { status: 'verified', results }
}

export async function verifySchema({ runtime, evidenceDir, prefixLength }) {
  const paddedPrefix = String(prefixLength).padStart(4, '0')
  const prefixDir = join(evidenceDir, 'prefixes', paddedPrefix)
  const structurePath = join(prefixDir, 'structure.json')
  const schemaPath = join(prefixDir, 'schema.prisma')
  if (!existsSync(structurePath)) throw new Error('EVIDENCE_STRUCTURE_MISSING')
  const expected = JSON.parse(readFileSync(structurePath, 'utf8'))
  const actual = (await readDbSnapshot(runtime)).structure
  const comparison = compareStructure(expected, actual)
  if (!comparison.equal) {
    throw new Error(`SCHEMA_STRUCTURE:${comparison.differences.join('; ')}`)
  }
  if (!existsSync(schemaPath)) throw new Error('EVIDENCE_SCHEMA_MISSING')
  const diff = await runtime.runPrisma([
    'migrate',
    'diff',
    '--from-schema-datasource',
    schemaPath,
    '--to-schema-datamodel',
    schemaPath,
    '--exit-code',
  ], {
    timeoutMs: PRISMA_TIMEOUT_MS,
    logPath: join(privateLogDir(evidenceDir, 'verify', paddedPrefix), 'migrate-diff.json'),
  })
  if (diff.code !== 0) throw new Error(`SCHEMA_DATAMODEL_DIFF:${diff.code}`)
}

export function verifyEvidenceManifest({ manifestPath, sha, runId, runAttempt, prismaDir = null }) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.format !== 1) throw new Error('EVIDENCE_FORMAT')
  if (manifest.sha !== sha) throw new Error('EVIDENCE_SHA')
  if (manifest.activeSha !== undefined && manifest.activeSha !== sha) throw new Error('EVIDENCE_ACTIVE_SHA')
  if (manifest.sourceTestRunId !== runId) throw new Error('EVIDENCE_RUN_ID')
  if (manifest.sourceTestRunAttempt !== runAttempt) throw new Error('EVIDENCE_RUN_ATTEMPT')

  const root = dirname(manifestPath)
  for (const prefix of manifest.prefixes ?? []) {
    verifyManifestFile(root, prefix.schemaPath, prefix.schemaSha256, 'EVIDENCE_SCHEMA_CHECKSUM')
    verifyManifestFile(root, prefix.structurePath, prefix.structureSha256, 'EVIDENCE_STRUCTURE_CHECKSUM')
  }
  if (prismaDir) verifyManifestBoundToPrismaDir(manifest, prismaDir)
  verifyManifestCompatibility(manifest)
  verifyManifestPreparationCompatibility(manifest)
  return manifest
}

async function readLedger(runtime) {
  const exists = await runtime.query(
    `SELECT table_name AS tableName
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = '${LEDGER_TABLE}'`,
  )
  if (exists.length === 0) return []
  const rows = await runtime.query(
    `SELECT id,
            migration_name AS migrationName,
            checksum,
            finished_at AS finishedAt,
            rolled_back_at AS rolledBackAt
       FROM ${quoteIdentifier(LEDGER_TABLE)}
      ORDER BY started_at, migration_name, id`,
  )
  return rows.map((row) => ({
    id: row.id,
    migrationName: row.migrationName,
    checksum: row.checksum,
    finishedAt: row.finishedAt,
    rolledBackAt: row.rolledBackAt,
  }))
}

async function readStructure(runtime) {
  const tables = (await runtime.query(
    `SELECT table_name AS name,
            engine,
            table_collation AS collation,
            auto_increment AS autoIncrement,
            table_comment AS comment
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        AND table_name <> '${LEDGER_TABLE}'
      ORDER BY table_name`,
  )).map((row) => ({
    name: row.name,
    engine: row.engine,
    collation: row.collation,
    autoIncrement: row.autoIncrement == null ? null : Number(row.autoIncrement),
    comment: row.comment,
  }))

  const tableNames = tables.map((table) => table.name)
  const [columns, indexes, foreignKeys, checks, createTables, inventory] = await Promise.all([
    readColumns(runtime),
    readIndexes(runtime, tableNames),
    readForeignKeys(runtime),
    readChecks(runtime),
    readCreateTables(runtime, tableNames),
    readInventory(runtime),
  ])

  return { tables, columns, indexes, foreignKeys, checks, createTables, inventory }
}

async function readColumns(runtime) {
  return (await runtime.query(
    `SELECT table_name AS tableName,
            column_name AS name,
            ordinal_position AS ordinalPosition,
            column_type AS columnType,
            is_nullable AS nullable,
            column_default AS columnDefault,
            extra,
            character_set_name AS characterSet,
            collation_name AS collation,
            generation_expression AS generationExpression
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name <> '${LEDGER_TABLE}'
      ORDER BY table_name, ordinal_position`,
  )).map((row) => ({
    table: row.tableName,
    name: row.name,
    ordinal: Number(row.ordinalPosition),
    type: row.columnType,
    nullable: row.nullable === 'YES',
    default: row.columnDefault,
    extra: row.extra,
    characterSet: row.characterSet,
    collation: row.collation,
    generationExpression: row.generationExpression,
  }))
}

async function readIndexes(runtime, tableNames) {
  const parserByTableIndex = await readIndexParsers(runtime, tableNames)
  const rows = await runtime.query(
    `SELECT table_name AS tableName,
            index_name AS indexName,
            non_unique AS nonUnique,
            seq_in_index AS seqInIndex,
            column_name AS columnName,
            sub_part AS subPart,
            collation,
            index_type AS indexType,
            nullable
       FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name <> '${LEDGER_TABLE}'
      ORDER BY table_name, index_name, seq_in_index`,
  )
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.tableName}\0${row.indexName}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        table: row.tableName,
        name: row.indexName,
        unique: row.nonUnique === '0',
        type: row.indexType,
        columns: [],
        subParts: [],
        order: [],
        nullable: [],
        parser: parserByTableIndex.get(key) ?? null,
      })
    }
    const index = grouped.get(key)
    index.columns.push(row.columnName)
    index.subParts.push(row.subPart == null ? null : Number(row.subPart))
    index.order.push(row.collation)
    index.nullable.push(row.nullable)
  }
  return [...grouped.values()].sort(compareNamed)
}

async function readIndexParsers(runtime, tableNames) {
  const result = new Map()
  for (const tableName of tableNames) {
    const rows = await runtime.query(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`)
    const createSql = showCreateSql(rows[0])
    const lines = createSql.split('\n')
    for (const line of lines) {
      const match = line.match(/(?:FULLTEXT\s+)?KEY\s+`([^`]+)`[\s\S]*?\bWITH\s+PARSER\s+`?([A-Za-z0-9_]+)`?/i)
      if (match) result.set(`${tableName}\0${match[1]}`, match[2])
      const versionedMatch = line.match(/(?:FULLTEXT\s+)?KEY\s+`([^`]+)`[\s\S]*?\/\*![0-9]+\s+WITH\s+PARSER\s+`?([A-Za-z0-9_]+)`?\s+\*\//i)
      if (versionedMatch) result.set(`${tableName}\0${versionedMatch[1]}`, versionedMatch[2])
    }
  }
  return result
}

async function readForeignKeys(runtime) {
  const rows = await runtime.query(
    `SELECT kcu.table_name AS tableName,
            kcu.constraint_name AS constraintName,
            kcu.ordinal_position AS ordinalPosition,
            kcu.column_name AS columnName,
            kcu.referenced_table_name AS referencedTableName,
            kcu.referenced_column_name AS referencedColumnName,
            rc.update_rule AS updateRule,
            rc.delete_rule AS deleteRule
       FROM information_schema.key_column_usage kcu
       JOIN information_schema.referential_constraints rc
         ON rc.constraint_schema = kcu.constraint_schema
        AND rc.constraint_name = kcu.constraint_name
        AND rc.table_name = kcu.table_name
      WHERE kcu.table_schema = DATABASE()
        AND kcu.referenced_table_name IS NOT NULL
        AND kcu.table_name <> '${LEDGER_TABLE}'
      ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position`,
  )
  const grouped = new Map()
  for (const row of rows) {
    const key = `${row.tableName}\0${row.constraintName}`
    if (!grouped.has(key)) {
      grouped.set(key, {
        table: row.tableName,
        name: row.constraintName,
        columns: [],
        referencedTable: row.referencedTableName,
        referencedColumns: [],
        updateRule: row.updateRule,
        deleteRule: row.deleteRule,
      })
    }
    grouped.get(key).columns.push(row.columnName)
    grouped.get(key).referencedColumns.push(row.referencedColumnName)
  }
  return [...grouped.values()].sort(compareNamed)
}

async function readChecks(runtime) {
  return (await runtime.query(
    `SELECT tc.table_name AS tableName,
            tc.constraint_name AS constraintName,
            cc.check_clause AS checkClause
       FROM information_schema.table_constraints tc
       JOIN information_schema.check_constraints cc
         ON cc.constraint_schema = tc.constraint_schema
        AND cc.constraint_name = tc.constraint_name
      WHERE tc.table_schema = DATABASE()
        AND tc.constraint_type = 'CHECK'
        AND tc.table_name <> '${LEDGER_TABLE}'
      ORDER BY tc.table_name, tc.constraint_name`,
  )).map((row) => ({
    table: row.tableName,
    name: row.constraintName,
    expression: row.checkClause,
  }))
}

async function readCreateTables(runtime, tableNames) {
  const createTables = []
  for (const tableName of tableNames) {
    const row = (await runtime.query(`SHOW CREATE TABLE ${quoteIdentifier(tableName)}`))[0]
    createTables.push({
      table: tableName,
      sql: normalizeCreateTableSql(showCreateSql(row)),
    })
  }
  return createTables.sort((a, b) => a.table.localeCompare(b.table))
}

async function readInventory(runtime) {
  const [views, triggers, routines, events] = await Promise.all([
    runtime.query(
      `SELECT table_name AS name
         FROM information_schema.views
        WHERE table_schema = DATABASE()
        ORDER BY table_name`,
    ),
    runtime.query(
      `SELECT trigger_name AS name, event_manipulation AS event, event_object_table AS tableName, action_timing AS timing
         FROM information_schema.triggers
        WHERE trigger_schema = DATABASE()
        ORDER BY trigger_name`,
    ),
    runtime.query(
      `SELECT routine_name AS name, routine_type AS type
         FROM information_schema.routines
        WHERE routine_schema = DATABASE()
        ORDER BY routine_name`,
    ),
    runtime.query(
      `SELECT event_name AS name, status
         FROM information_schema.events
        WHERE event_schema = DATABASE()
        ORDER BY event_name`,
    ),
  ])
  return {
    views: views.map((row) => ({ name: row.name })),
    triggers: triggers.map((row) => ({ name: row.name, event: row.event, table: row.tableName, timing: row.timing })),
    routines: routines.map((row) => ({ name: row.name, type: row.type })),
    events: events.map((row) => ({ name: row.name, status: row.status })),
  }
}

async function replayPrefix(fixture, migrations) {
  for (const migration of migrations) {
    const sql = readFileSync(migration.sqlPath, 'utf8')
    const result = await fixture.exec(sql)
    if (result.code !== 0) throw new Error(`MIGRATION_REPLAY:${migration.name}`)
  }
}

function loadPrismaClient(backendDir) {
  const localPackage = join(backendDir, 'package.json')
  const packagePath = existsSync(localPackage) ? localPackage : join(repoBackendDir, 'package.json')
  const requireFromBackend = createRequire(packagePath)
  return requireFromBackend('@prisma/client')
}

function readFrozenPrefixLength(prismaDir, migrations) {
  const contractPath = join(prismaDir, 'migration-contract.json')
  if (!existsSync(contractPath)) return 0
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  if (contract.format !== 1 || !Array.isArray(contract.migrations)) throw new Error('CONTRACT_FORMAT')
  if (contract.migrations.length > migrations.length) throw new Error('CONTRACT_PREFIX')
  for (let index = 0; index < contract.migrations.length; index += 1) {
    if (contract.migrations[index].name !== migrations[index].name) throw new Error('CONTRACT_PREFIX')
  }
  return contract.migrations.length
}

function buildPrismaEnv(databaseUrl, overrides) {
  const env = buildBaseEnv()
  env.DATABASE_URL = databaseUrl
  for (const [key, value] of Object.entries(overrides)) {
    if (isDeniedEnvKey(key)) continue
    if (value == null) continue
    env[key] = String(value)
  }
  return env
}

function buildBaseEnv() {
  const allowedBase = [
    'PATH',
    'HOME',
    'TMPDIR',
    'TMP',
    'TEMP',
    'LANG',
    'LC_ALL',
    'LC_CTYPE',
    'NODE_OPTIONS',
    'CI',
    'NO_COLOR',
    'PRISMA_HIDE_UPDATE_MESSAGE',
  ]
  const env = {}
  for (const key of allowedBase) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  return env
}

function isDeniedEnvKey(key) {
  return key === 'GITHUB_TOKEN'
    || key === 'GH_TOKEN'
    || key === 'MIGRATION_GITHUB_TOKEN'
    || /TOKEN|SECRET|PASSWORD|PRIVATE_KEY/i.test(key)
}

async function readMysqlMetadata(runtime, structure) {
  const rows = await runtime.query('SELECT VERSION() AS version, @@ngram_token_size AS ngramTokenSize')
  const ngram = structure.indexes
    .filter((index) => index.parser === 'ngram')
    .map((index) => ({ table: index.table, index: index.name, columns: index.columns, parser: index.parser }))
    .sort((a, b) => `${a.table}.${a.index}`.localeCompare(`${b.table}.${b.index}`))
  return {
    version: rows[0]?.version ?? '',
    ngramTokenSize: rows[0]?.ngramTokenSize ?? null,
    ngram,
    checks: (structure.checks ?? [])
      .map((check) => ({ table: check.table, name: check.name, expressionSha256: sha256(check.expression ?? '') }))
      .sort((a, b) => `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`)),
  }
}

function normalizeStructure(value) {
  return normalizeOrdered(normalizeCreateTableEntries(stripDynamic(value)), null)
}

function normalizeCreateTableEntries(value) {
  if (Array.isArray(value)) return value.map(normalizeCreateTableEntries)
  if (!value || typeof value !== 'object') return value
  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'createTables' && Array.isArray(child)) {
      result[key] = child.map((entry) => ({
        ...entry,
        sql: typeof entry?.sql === 'string' ? normalizeCreateTableSql(entry.sql) : entry?.sql,
      }))
    } else {
      result[key] = normalizeCreateTableEntries(child)
    }
  }
  return result
}

function stripDynamic(value) {
  if (Array.isArray(value)) return value.map(stripDynamic)
  if (!value || typeof value !== 'object') return value
  const result = {}
  for (const [key, child] of Object.entries(value)) {
    if (key === 'autoIncrement') continue
    result[key] = stripDynamic(child)
  }
  return result
}

function normalizeOrdered(value, key) {
  if (Array.isArray(value)) {
    const normalized = value.map((entry) => normalizeOrdered(entry, null))
    return UNORDERED_ARRAY_KEYS.has(key)
      ? normalized.sort((a, b) => stableJson(a).localeCompare(stableJson(b)))
      : normalized
  }
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.keys(value).sort().map((childKey) => [childKey, normalizeOrdered(value[childKey], childKey)]))
}

function stableJson(value) {
  return JSON.stringify(normalizeOrdered(value, null))
}

function hasUnknownInventory(structure) {
  const inventory = structure.inventory ?? {}
  return ['views', 'triggers', 'routines', 'events'].some((key) => (inventory[key] ?? []).length > 0)
}

function verifyManifestFile(root, relativePath, expectedHash, errorCode) {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath)) throw new Error('EVIDENCE_PATH')
  const fullPath = safeEvidenceFilePath(root, relativePath)
  if (sha256(readFileSync(fullPath)) !== expectedHash) throw new Error(errorCode)
}


function safeEvidenceFilePath(root, relativePath) {
  if (typeof relativePath !== 'string' || isAbsolute(relativePath)) throw new Error('EVIDENCE_PATH')
  const rootPath = resolve(root)
  const rootStats = lstatSync(rootPath)
  if (rootStats.isSymbolicLink()) throw new Error('EVIDENCE_PATH')
  const realRoot = realpathSync(rootPath)
  let current = rootPath
  for (const segment of relativePath.split(/[\\/]/)) {
    if (!segment || segment === '.' || segment === '..') throw new Error('EVIDENCE_PATH')
    current = join(current, segment)
    if (!existsSync(current)) throw new Error('EVIDENCE_FILE_MISSING')
    if (lstatSync(current).isSymbolicLink()) throw new Error('EVIDENCE_PATH')
  }
  const realFile = realpathSync(current)
  const rel = relative(realRoot, realFile)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('EVIDENCE_PATH')
  return current
}

function normalizeEvidencePath(root, filePath) {
  const rel = relative(root, filePath)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('EVIDENCE_PATH')
  return rel
}

function isSafeRelativePath(value) {
  if (typeof value !== 'string' || value === '' || isAbsolute(value)) return false
  const normalized = value.replaceAll('\\', '/')
  return !normalized.split('/').includes('..')
}

export function buildCompatibilityRequirements(futureMigrations, { verifyTestFiles = true } = {}) {
  const requirements = []
  for (const [offset, migration] of futureMigrations.entries()) {
    const policyPath = join(dirname(migration.sqlPath), 'policy.json')
    if (!existsSync(policyPath)) throw new Error(`COMPATIBILITY_POLICY_REQUIRED:${migration.name}`)
    const policyRaw = readFileSync(policyPath, 'utf8')
    const policy = JSON.parse(policyRaw)
    const policySha256 = sha256(policyRaw)
    if (!Array.isArray(policy.previousCompatibleShas) || policy.previousCompatibleShas.length === 0) {
      throw new Error(`COMPATIBILITY_POLICY_PREVIOUS:${migration.name}`)
    }
    if (!Array.isArray(policy.compatibilityTests) || policy.compatibilityTests.length === 0) {
      throw new Error(`COMPATIBILITY_POLICY_TESTS:${migration.name}`)
    }
    const ddlCount = compatibilityDdlCount(migration.sqlPath)
    const stages = [
      'before',
      ...Array.from({ length: Math.max(0, ddlCount - 1) }, (_, index) => `partial:${index + 1}`),
      'after',
      'current-final',
    ]
    for (const previousCompatibleSha of policy.previousCompatibleShas) {
      if (!/^[a-f0-9]{40,64}$/i.test(previousCompatibleSha)) throw new Error('COMPATIBILITY_SHA')
      for (const testPath of policy.compatibilityTests) {
        const resolvedTest = resolve(testPath)
        if (typeof testPath !== 'string') throw new Error('COMPATIBILITY_TEST_PATH')
        if (verifyTestFiles && (!existsSync(resolvedTest) || !statSync(resolvedTest).isFile())) {
          throw new Error('COMPATIBILITY_TEST_PATH')
        }
        requirements.push({
          migrationName: migration.name,
          policySha256,
          previousCompatibleSha,
          testPath,
          stages,
        })
      }
    }
  }
  return requirements.sort((a, b) => `${a.migrationName}.${a.previousCompatibleSha}.${a.testPath}`.localeCompare(`${b.migrationName}.${b.previousCompatibleSha}.${b.testPath}`))
}


function compatibilityDdlCount(sqlPath) {
  return splitSqlStatements(readFileSync(sqlPath, 'utf8'))
    .filter((statement) => !/^SET\s+SESSION\s+lock_wait_timeout\s*=/i.test(statement))
    .length
}

function compatibilityKey(entry) {
  return `${entry.migrationName}\0${entry.previousCompatibleSha}\0${entry.testPath}\0${entry.stage}`
}

function compatibilityRequirementKey(entry) {
  return `${entry.migrationName}\0${entry.previousCompatibleSha}\0${entry.testPath}`
}


function verifyManifestBoundToPrismaDir(manifest, prismaDir) {
  const files = readMigrationFiles(prismaDir)
  const manifestMigrations = manifest.migrations ?? []
  if (manifestMigrations.length !== files.length) throw new Error('EVIDENCE_MIGRATIONS')
  for (let index = 0; index < files.length; index += 1) {
    if (manifestMigrations[index].name !== files[index].name) throw new Error('EVIDENCE_MIGRATIONS')
    if (manifestMigrations[index].checksum !== files[index].checksum) throw new Error('EVIDENCE_MIGRATIONS')
  }
  const frozenPrefixLength = readFrozenPrefixLength(prismaDir, files)
  if (manifest.policy?.frozenPrefixLength !== frozenPrefixLength) throw new Error('EVIDENCE_FROZEN_PREFIX')
  const futureMigrations = files.slice(frozenPrefixLength).map((migration, offset) => ({
    ...migration,
    prefixLength: frozenPrefixLength + offset + 1,
  }))
  const actualFutureNames = futureMigrations.map((migration) => migration.name)
  if (stableJson(manifest.policy?.futureMigrationNames ?? []) !== stableJson(actualFutureNames)) throw new Error('EVIDENCE_COMPATIBILITY')
  if (actualFutureNames.length > 0) {
    const expectedRequirements = buildCompatibilityRequirements(futureMigrations, { verifyTestFiles: false })
    if (stableJson(manifest.compatibility?.requirements ?? []) !== stableJson(expectedRequirements)) throw new Error('EVIDENCE_COMPATIBILITY')
  }
}

function verifyManifestCompatibility(manifest) {
  const futureNames = manifest.policy?.futureMigrationNames ?? []
  const compatibility = manifest.compatibility ?? {}
  if (futureNames.length === 0) return
  if (compatibility.status !== 'verified') throw new Error('EVIDENCE_COMPATIBILITY')
  const requiredKeys = new Set()
  for (const requirement of compatibility.requirements ?? []) {
    for (const stage of requirement.stages ?? []) {
      requiredKeys.add(compatibilityKey({ ...requirement, stage }))
    }
  }
  if (requiredKeys.size === 0) throw new Error('EVIDENCE_COMPATIBILITY')
  const requirementByKey = new Map((compatibility.requirements ?? []).map((requirement) => [compatibilityRequirementKey(requirement), requirement]))
  const resultKeys = new Set()
  for (const result of compatibility.results ?? []) {
    const requirement = requirementByKey.get(compatibilityRequirementKey(result))
    if (!requirement) throw new Error('EVIDENCE_COMPATIBILITY')
    if (result.policySha256 !== requirement.policySha256) throw new Error('EVIDENCE_COMPATIBILITY')
    if (!Array.isArray(requirement.stages) || !requirement.stages.includes(result.stage)) throw new Error('EVIDENCE_COMPATIBILITY')
    if (result.candidateSha !== (manifest.activeSha ?? manifest.sha)) throw new Error('EVIDENCE_COMPATIBILITY')
    if (result.sourceTestRunId !== manifest.sourceTestRunId) throw new Error('EVIDENCE_COMPATIBILITY')
    if (result.sourceTestRunAttempt !== manifest.sourceTestRunAttempt) throw new Error('EVIDENCE_COMPATIBILITY')
    if (result.exitCode !== 0) throw new Error('EVIDENCE_COMPATIBILITY')
    if (!/^[a-f0-9]{64}$/i.test(result.stdoutSha256 ?? '')) throw new Error('EVIDENCE_COMPATIBILITY')
    if (!/^[a-f0-9]{64}$/i.test(result.stderrSha256 ?? '')) throw new Error('EVIDENCE_COMPATIBILITY')
    resultKeys.add(compatibilityKey(result))
  }
  for (const key of requiredKeys) {
    if (!resultKeys.has(key)) throw new Error('EVIDENCE_COMPATIBILITY')
  }
}


function verifyManifestPreparationCompatibility(manifest) {
  const preparation = manifest.preparationCompatibility
  if (!preparation || preparation.status === 'not-provided') return
  if (preparation.status !== 'verified') throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
  const stages = new Set()
  for (const result of preparation.results ?? []) {
    if (!['previous-prod', 'candidate'].includes(result.stage)) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (result.candidateSha !== (manifest.activeSha ?? manifest.sha)) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (result.sourceTestRunId !== manifest.sourceTestRunId) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (result.sourceTestRunAttempt !== manifest.sourceTestRunAttempt) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (result.previousProdSha !== PREPARATION_PREVIOUS_PROD_SHA) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (result.exitCode !== 0) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (!/^[a-f0-9]{64}$/i.test(result.stdoutSha256 ?? '')) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    if (!/^[a-f0-9]{64}$/i.test(result.stderrSha256 ?? '')) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
    stages.add(result.stage)
  }
  for (const stage of ['previous-prod', 'candidate']) {
    if (!stages.has(stage)) throw new Error('EVIDENCE_PREPARATION_COMPATIBILITY')
  }
}

function privateLogDir(publicDir, scope, id) {
  return join(dirname(resolve(publicDir)), '.private-db-logs', basename(resolve(publicDir)), scope, id)
}

function isApprovedNgramWarning(line, inventoriedNgram) {
  if (!/ngram|fulltext|parser/i.test(line)) return false
  return Array.isArray(inventoriedNgram) && inventoriedNgram.length > 0
}

function isApprovedCheckWarning(line, inventoriedChecks) {
  if (!/check constraints?/i.test(line)) return false
  return Array.isArray(inventoriedChecks) && inventoriedChecks.length > 0
}

function normalizeRepoPath(filePath) {
  const abs = resolve(filePath)
  const rel = relative(repoRoot, abs)
  return rel.startsWith('..') || isAbsolute(rel) ? abs : rel
}

function normalizeCreateTableSql(sql) {
  return sql
    .replace(/\s+AUTO_INCREMENT=\d+/ig, '')
    .replace(/\s+CHARACTER\s+SET\s+([A-Za-z0-9_]+)(\s+COLLATE\s+([A-Za-z0-9_]+))/ig, (match, charset, collateClause, collation) => {
      return charset.toLowerCase() === charsetFromCollation(collation)
        ? collateClause
        : match
    })
}

function charsetFromCollation(collation) {
  const value = String(collation).toLowerCase()
  const firstUnderscore = value.indexOf('_')
  return firstUnderscore === -1 ? value : value.slice(0, firstUnderscore)
}

function showCreateSql(row) {
  if (!row) return ''
  return row['Create Table'] ?? row.f1 ?? Object.values(row)[1] ?? ''
}

function compareNamed(a, b) {
  return `${a.table}.${a.name}`.localeCompare(`${b.table}.${b.name}`)
}

function quoteIdentifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``
}

function mysql(databaseUrl, sql, flags = []) {
  validateMysqlUrl(databaseUrl)
  const args = [
    '--protocol=TCP',
    `--host=${databaseUrl.hostname}`,
    `--port=${databaseUrl.port || '3306'}`,
    `--user=${decodeURIComponent(databaseUrl.username)}`,
    '--default-character-set=utf8mb4',
    ...flags,
  ]
  if (databaseUrl.pathname && databaseUrl.pathname !== '/') {
    args.push(`--database=${decodeURIComponent(databaseUrl.pathname.slice(1))}`)
  }
  args.push('--execute', sql)
  return run('mysql', args, {
    env: {
      ...buildBaseEnv(),
      MYSQL_PWD: decodeURIComponent(databaseUrl.password),
    },
  })
}

function validateMysqlUrl(databaseUrl) {
  if (databaseUrl.protocol !== 'mysql:') throw new Error('DATABASE_URL_PROTOCOL')
  if (!LOOPBACK_HOSTS.has(databaseUrl.hostname)) return
}

function run(command, args, options) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: true,
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => {
      stdout += chunk
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
    })
    let timedOut = false
    let settled = false
    let killTimer = null
    const finish = (result) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      writeRunLog(options.logPath, result.stdout, result.stderr)
      resolvePromise(result)
    }
    const signalProcessGroup = (signal) => {
      try {
        if (child.pid) process.kill(-child.pid, signal)
      } catch {
        try { child.kill(signal) } catch {}
      }
    }
    const timeout = options.timeoutMs
      ? setTimeout(() => {
        timedOut = true
        signalProcessGroup('SIGTERM')
        killTimer = setTimeout(() => {
          signalProcessGroup('SIGKILL')
          finish({ code: 124, stdout, stderr })
        }, options.killGraceMs ?? 2000)
      }, options.timeoutMs)
      : null
    child.on('error', (error) => {
      finish({ code: 127, stdout, stderr: `${stderr}${error.message}` })
    })
    child.on('close', (code) => {
      finish({ code: timedOut ? 124 : code ?? 1, stdout, stderr })
    })
  })
}

function normalizePrismaRows(rows) {
  return rows.map((row) => Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, normalizePrismaValue(value)]),
  ))
}

function normalizePrismaValue(value) {
  if (value == null) return null
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Buffer.isBuffer(value)) return value.toString('utf8')
  return value
}

function writeRunLog(logPath, stdout, stderr) {
  if (!logPath) return
  mkdirSync(dirname(logPath), { recursive: true })
  writeFileSync(logPath, JSON.stringify({ stdout, stderr }, null, 2), { mode: 0o600 })
}

function sanitizeMysqlOutput(output) {
  return String(output)
    .replace(/mysql:\/\/[^@\s]+@/g, 'mysql://<redacted>@')
    .replace(/--password=[^\s]+/g, '--password=<redacted>')
    .replace(/using a password on the command line interface can be insecure\.?/gi, '')
    .trim()
}

function sanitizePrismaOutput(output) {
  return String(output)
    .replace(/mysql:\/\/[^@\s]+@/g, 'mysql://<redacted>@')
    .slice(0, 500)
    .trim()
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
