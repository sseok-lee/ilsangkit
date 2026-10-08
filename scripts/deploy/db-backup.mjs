import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  statfsSync,
  writeFileSync,
  createReadStream,
  createWriteStream,
} from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../..')
const backendRequire = createRequire(join(repoRoot, 'backend/package.json'))

const BACKUP_FORMAT = 1
const LEDGER_TABLE = '_prisma_migrations'
const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const MYSQL_BIN = process.env.MYSQL_BIN || 'mysql'
const MYSQLDUMP_BIN = process.env.MYSQLDUMP_BIN || 'mysqldump'
const MAX_CAPTURE_BYTES = 1024 * 1024
const KILL_AFTER_MS = 1_000

export function backupClosure(changedTables, foreignKeys) {
  const result = []
  const queued = []
  const seen = new Set()
  for (const table of changedTables ?? []) enqueue(table)
  for (let index = 0; index < queued.length; index += 1) {
    const table = queued[index]
    for (const fk of foreignKeys ?? []) {
      const child = fk.child ?? fk.table ?? fk.tableName ?? fk.childTable
      const parent = fk.parent ?? fk.referencedTable ?? fk.referencedTableName ?? fk.parentTable
      if (child === table && parent) enqueue(parent)
    }
  }
  return result

  function enqueue(table) {
    if (!table || seen.has(table)) return
    seen.add(table)
    queued.push(table)
    result.push(table)
  }
}

export async function createBackup({ context, runtime = {}, tables = [], kind }) {
  if (!['migration', 'reconcile'].includes(kind)) throw new Error('BACKUP_KIND')
  const databaseUrl = await resolveDatabaseUrl(runtime, context)
  const database = decodeURIComponent(databaseUrl.pathname.slice(1))
  if (!database) throw new Error('BACKUP_DATABASE')
  const stateRoot = resolve(context?.stateRoot ?? join(process.cwd(), '.db-migrations'))
  const backupRoot = join(stateRoot, 'backups')
  mkdirSync(backupRoot, { recursive: true, mode: 0o700 })
  chmodSync(backupRoot, 0o700)
  const id = safeId(`${kind}-${context?.sha ?? 'unknown'}-${context?.runId ?? '0'}-${context?.runAttempt ?? '0'}-${randomUUID()}`)
  const backupDir = join(backupRoot, id)
  mkdirSync(backupDir, { mode: 0o700 })

  const deadline = createDeadline(context?.backupTimeoutMs ?? runtime.backupTimeoutMs ?? runtime.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const credential = await createMysqlDefaultsFile(databaseUrl, mkdtempSync(join(tmpdir(), 'db-backup-cred-')))
  runtime.onCredentialFile?.(credential.path)
  try {
    await verifyExpectedIdentity(runtime, databaseUrl, context?.expectedDb, deadline)
    const inventory = await readUnsupportedInventory(runtime, databaseUrl, deadline)
    if (Object.values(inventory).some((rows) => rows.length > 0)) {
      throw new Error(`BACKUP_UNSUPPORTED_OBJECTS:${JSON.stringify(inventory)}`)
    }

    const fkEdges = await readForeignKeyEdges(runtime, databaseUrl, deadline)
    const requestedTables = backupClosure(unique(tables), fkEdges)
    const tableMeta = await readTableMetadata(runtime, databaseUrl, deadline)
    const tableByName = new Map(tableMeta.map((table) => [table.name, table]))
    const missing = requestedTables.filter((table) => !tableByName.has(table))
    if (missing.length > 0) throw new Error(`BACKUP_TARGET_MISSING:${missing.join(',')}`)
    const nontransactional = requestedTables.filter((table) => tableByName.get(table)?.engine !== 'InnoDB')
    if (nontransactional.length > 0) throw new Error(`BACKUP_NONTRANSACTIONAL:${nontransactional.join(',')}`)
    ensureDiskSpace(runtime, backupDir, requestedTables.map((table) => tableByName.get(table)))

    const files = {
      schema: join(backupDir, 'schema.sql'),
      data: requestedTables.length === 0 ? null : join(backupDir, 'data.sql'),
      ledger: join(backupDir, 'ledger.json'),
      metadata: join(backupDir, 'metadata.json'),
      manifest: join(backupDir, 'manifest.json'),
    }

    await dumpSchema(runtime, credential.path, database, files.schema, deadline)
    if (files.data) await dumpData(runtime, credential.path, database, requestedTables, files.data, deadline)

    const [ledger, columns, foreignKeys] = await Promise.all([
      readLedger(runtime, databaseUrl, deadline),
      readColumns(runtime, databaseUrl, requestedTables, deadline),
      readForeignKeys(runtime, databaseUrl, requestedTables, deadline),
    ])
    await writeJson(files.ledger, ledger)
    const metadata = {
      format: BACKUP_FORMAT,
      database,
      tables: requestedTables,
      columns,
      foreignKeys,
    }
    await writeJson(files.metadata, metadata)

    const checksums = await checksumsFor(files)
    const manifest = {
      format: BACKUP_FORMAT,
      id,
      kind,
      sha: String(context?.sha ?? ''),
      runId: String(context?.runId ?? ''),
      runAttempt: String(context?.runAttempt ?? ''),
      createdAt: new Date().toISOString(),
      files: relativeFiles(backupDir, files),
      checksums,
    }
    await writeJson(files.manifest, manifest)
    checksums.manifest = await sha256File(files.manifest)

    return {
      format: BACKUP_FORMAT,
      id,
      kind,
      dir: backupDir,
      files,
      checksums,
      tables: requestedTables,
      context: { ...context, envPath: undefined, expectedDb: context?.expectedDb },
    }
  } catch (error) {
    throw sanitizeError(error)
  } finally {
    await credential.cleanup()
  }
}

export async function verifyBackup(backup) {
  const backupDir = resolve(backup.dir ?? dirname(backup.files?.manifest ?? ''))
  assertPrivateDirectory(backupDir, 'BACKUP_DIR_MODE')
  const required = ['schema', 'ledger', 'metadata', 'manifest']
  if (backup.files?.data) required.push('data')
  for (const name of required) {
    const filePath = backup.files?.[name]
    if (!filePath) throw new Error(`BACKUP_FILE_MISSING:${name}`)
    assertSafeBackupFile(backupDir, filePath, name)
    const expected = backup.checksums?.[name]
    if (!expected) throw new Error(`BACKUP_CHECKSUM_MISSING:${name}`)
    if (await sha256File(filePath) !== expected) throw new Error(`BACKUP_CHECKSUM:${name}`)
  }
  return { files: required }
}

export async function rehearseBackupRestore(backup, { restoreUrl = null } = {}) {
  await verifyBackup(backup)
  const dataPath = backup.files?.data
  if (!dataPath) return { restoredTables: [], orphans: [] }

  if (!restoreUrl) throw new Error('BACKUP_RESTORE_URL_REQUIRED')
  const baseUrl = new URL(restoreUrl)
  validateRestoreUrl(baseUrl)
  const sourceDb = decodeURIComponent(baseUrl.pathname.slice(1))
  const restoreDb = safeDbName(`${sourceDb}_restore_${randomUUID().replaceAll('-', '').slice(0, 12)}`)
  const restoreDatabaseUrl = new URL(baseUrl)
  restoreDatabaseUrl.pathname = `/${restoreDb}`
  validateRestoreUrl(restoreDatabaseUrl)
  const adminUrl = new URL(baseUrl)
  adminUrl.pathname = '/mysql'
  const metadata = JSON.parse(await readFile(backup.files.metadata, 'utf8'))
  const credentialRoot = mkdtempSync(join(tmpdir(), 'db-backup-restore-'))
  const adminCredential = await createMysqlDefaultsFile(adminUrl, credentialRoot)
  const restoreCredential = await createMysqlDefaultsFile(restoreDatabaseUrl, credentialRoot)
  try {
    await checkedRun(MYSQL_BIN, mysqlArgs(adminCredential.path, 'mysql', ['--execute', `CREATE DATABASE ${quoteIdentifier(restoreDb)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`]), {}, 'BACKUP_RESTORE_CREATE')
    await checkedRun(MYSQL_BIN, mysqlArgs(restoreCredential.path, restoreDb, ['--execute', 'SET FOREIGN_KEY_CHECKS=0']), {}, 'BACKUP_RESTORE_PREPARE')
    await restoreSql(restoreCredential.path, restoreDb, backup.files.schema)
    await restoreSql(restoreCredential.path, restoreDb, dataPath)
    await checkedRun(MYSQL_BIN, mysqlArgs(restoreCredential.path, restoreDb, ['--execute', 'SET FOREIGN_KEY_CHECKS=1']), {}, 'BACKUP_RESTORE_FK_ENABLE')

    const runtime = { databaseUrl: restoreDatabaseUrl.toString() }
    const restoredColumns = await readColumns(runtime, restoreDatabaseUrl, metadata.tables)
    compareColumns(metadata.columns, restoredColumns)
    const orphans = await findOrphans(runtime, restoreDatabaseUrl, metadata.foreignKeys)
    if (orphans.length > 0) throw new Error(`BACKUP_RESTORE_ORPHANS:${JSON.stringify(orphans)}`)
    return { restoredTables: metadata.tables, orphans }
  } finally {
    await runCommand(MYSQL_BIN, mysqlArgs(adminCredential.path, 'mysql', ['--execute', `DROP DATABASE IF EXISTS ${quoteIdentifier(restoreDb)}`]), { timeoutMs: DEFAULT_TIMEOUT_MS })
    await adminCredential.cleanup()
    await restoreCredential.cleanup()
    rmSync(credentialRoot, { recursive: true, force: true })
  }
}

export async function createMysqlDefaultsFile(databaseUrl, directory) {
  const url = databaseUrl instanceof URL ? databaseUrl : new URL(databaseUrl)
  mkdirSync(directory, { recursive: true, mode: 0o700 })
  chmodSync(directory, 0o700)
  const filePath = join(directory, `mysql-${randomUUID()}.cnf`)
  const contents = [
    '[client]',
    `user=${optionValue(decodeURIComponent(url.username))}`,
    `password=${optionValue(decodeURIComponent(url.password))}`,
    `host=${optionValue(url.hostname)}`,
    `port=${optionValue(url.port || '3306')}`,
    'default-character-set=utf8mb4',
    '',
  ].join('\n')
  writeFileSync(filePath, contents, { mode: 0o600 })
  chmodSync(filePath, 0o600)
  return {
    path: filePath,
    async cleanup() {
      rmSync(filePath, { force: true })
      try { rmSync(directory, { recursive: true, force: true }) } catch {}
    },
  }
}

async function dumpSchema(runtime, defaultsFile, database, outputPath, deadline) {
  const args = dumpArgs(defaultsFile, ['--no-data', '--routines=false', '--events=false', '--triggers=false', database])
  await runDump(runtime, args, outputPath, 'BACKUP_SCHEMA_DUMP_FAILED', deadline)
}

async function dumpData(runtime, defaultsFile, database, tables, outputPath, deadline) {
  const args = dumpArgs(defaultsFile, ['--single-transaction', '--quick', '--skip-lock-tables', database, ...tables])
  await runDump(runtime, args, outputPath, 'BACKUP_DUMP_FAILED', deadline)
}

async function runDump(runtime, args, outputPath, errorCode, deadline) {
  if (runtime.run) {
    const result = await run(runtime, MYSQLDUMP_BIN, args, { timeoutMs: remainingMs(deadline) })
    if (result.code !== 0) throw new Error(`${errorCode}:${sanitizeOutput(result.stderr || result.stdout)}`)
    await writeFile(outputPath, result.stdout ?? '', { mode: 0o600 })
    chmodSync(outputPath, 0o600)
    await sha256File(outputPath)
    return
  }
  const result = await runCommandToFile(MYSQLDUMP_BIN, args, outputPath, { timeoutMs: remainingMs(deadline) })
  if (result.code !== 0) throw new Error(`${errorCode}:${sanitizeOutput(result.stderr || result.stdout)}`)
}

async function restoreSql(defaultsFile, database, sqlPath) {
  await checkedRun(MYSQL_BIN, mysqlArgs(defaultsFile, database), { stdinFile: sqlPath }, 'BACKUP_RESTORE_IMPORT')
}

function dumpArgs(defaultsFile, tail) {
  return [
    `--defaults-extra-file=${defaultsFile}`,
    '--protocol=TCP',
    '--no-tablespaces',
    '--set-gtid-purged=OFF',
    ...tail,
  ]
}

function mysqlArgs(defaultsFile, database, tail = []) {
  return [
    `--defaults-extra-file=${defaultsFile}`,
    '--protocol=TCP',
    `--database=${database}`,
    ...tail,
  ]
}

async function verifyExpectedIdentity(runtime, databaseUrl, expectedDb, deadline = null) {
  if (!expectedDb) return
  const rows = await query(runtime, databaseUrl, 'SELECT DATABASE() AS databaseName, @@server_uuid AS serverUuid', deadline)
  const actual = rows[0] ?? {}
  const actualDatabase = actual.databaseName ?? actual['DATABASE()'] ?? decodeURIComponent(databaseUrl.pathname.slice(1))
  const actualServerUuid = actual.serverUuid ?? actual['@@server_uuid'] ?? null
  if (expectedDb.database && expectedDb.database !== actualDatabase) throw new Error('BACKUP_DB_IDENTITY')
  if (expectedDb.serverUuid && expectedDb.serverUuid !== actualServerUuid) throw new Error('BACKUP_DB_IDENTITY')
}

async function readTableMetadata(runtime, databaseUrl, deadline = null) {
  return (await query(runtime, databaseUrl, `SELECT table_name AS name,
            engine,
            COALESCE(data_length, 0) + COALESCE(index_length, 0) AS bytes
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_type = 'BASE TABLE'
        AND table_name <> '${LEDGER_TABLE}'
      ORDER BY table_name`, deadline)).map((row) => ({
    name: row.name,
    engine: row.engine ?? row.ENGINE,
    bytes: Number(row.bytes ?? 0),
  }))
}

async function readUnsupportedInventory(runtime, databaseUrl, deadline = null) {
  const [views, triggers, routines, events] = await Promise.all([
    query(runtime, databaseUrl, 'SELECT table_name AS name FROM information_schema.views WHERE table_schema = DATABASE() ORDER BY table_name', deadline),
    query(runtime, databaseUrl, 'SELECT trigger_name AS name FROM information_schema.triggers WHERE trigger_schema = DATABASE() ORDER BY trigger_name', deadline),
    query(runtime, databaseUrl, 'SELECT routine_name AS name FROM information_schema.routines WHERE routine_schema = DATABASE() ORDER BY routine_name', deadline),
    query(runtime, databaseUrl, 'SELECT event_name AS name FROM information_schema.events WHERE event_schema = DATABASE() ORDER BY event_name', deadline),
  ])
  return { views, triggers, routines, events }
}

async function readLedger(runtime, databaseUrl, deadline = null) {
  const exists = await query(runtime, databaseUrl, `SELECT table_name AS name
       FROM information_schema.tables
      WHERE table_schema = DATABASE()
        AND table_name = '${LEDGER_TABLE}'`, deadline)
  if (exists.length === 0) return []
  return query(runtime, databaseUrl, `SELECT id,
            migration_name AS migrationName,
            checksum,
            finished_at AS finishedAt,
            rolled_back_at AS rolledBackAt
       FROM ${quoteIdentifier(LEDGER_TABLE)}
      ORDER BY started_at, migration_name, id`, deadline)
}

async function readColumns(runtime, databaseUrl, tables, deadline = null) {
  if (tables.length === 0) return []
  const tableList = sqlStringList(tables)
  return (await query(runtime, databaseUrl, `SELECT table_name AS tableName,
            column_name AS name,
            ordinal_position AS ordinalPosition,
            column_type AS columnType,
            is_nullable AS nullable,
            column_default AS columnDefault,
            extra,
            character_set_name AS characterSet,
            collation_name AS collation
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name IN (${tableList})
      ORDER BY table_name, ordinal_position`, deadline)).map((row) => ({
    table: row.tableName,
    name: row.name,
    ordinal: Number(row.ordinalPosition),
    type: row.columnType,
    nullable: row.nullable === 'YES',
    default: row.columnDefault,
    extra: row.extra,
    characterSet: row.characterSet,
    collation: row.collation,
  }))
}

async function readForeignKeyEdges(runtime, databaseUrl, deadline = null) {
  return (await query(runtime, databaseUrl, `SELECT table_name AS child,
            referenced_table_name AS parent
       FROM information_schema.key_column_usage
      WHERE table_schema = DATABASE()
        AND referenced_table_name IS NOT NULL
      ORDER BY table_name, constraint_name, ordinal_position`, deadline)).map((row) => ({
    child: row.child ?? row.tableName,
    parent: row.parent ?? row.referencedTableName,
  }))
}

async function readForeignKeys(runtime, databaseUrl, tables, deadline = null) {
  if (tables.length === 0) return []
  const tableList = sqlStringList(tables)
  const rows = await query(runtime, databaseUrl, `SELECT kcu.table_name AS tableName,
            kcu.constraint_name AS constraintName,
            kcu.ordinal_position AS ordinalPosition,
            kcu.column_name AS columnName,
            kcu.referenced_table_name AS referencedTableName,
            kcu.referenced_column_name AS referencedColumnName
       FROM information_schema.key_column_usage kcu
      WHERE kcu.table_schema = DATABASE()
        AND kcu.referenced_table_name IS NOT NULL
        AND kcu.table_name IN (${tableList})
      ORDER BY kcu.table_name, kcu.constraint_name, kcu.ordinal_position`, deadline)
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
      })
    }
    grouped.get(key).columns.push(row.columnName)
    grouped.get(key).referencedColumns.push(row.referencedColumnName)
  }
  return [...grouped.values()]
}

async function findOrphans(runtime, databaseUrl, foreignKeys) {
  const orphans = []
  for (const fk of foreignKeys) {
    const nullableCheck = fk.columns.map((column) => `c.${quoteIdentifier(column)} IS NOT NULL`).join(' AND ')
    const joinCheck = fk.columns.map((column, index) => `c.${quoteIdentifier(column)} <=> p.${quoteIdentifier(fk.referencedColumns[index])}`).join(' AND ')
    const parentMissing = fk.referencedColumns.map((column) => `p.${quoteIdentifier(column)} IS NULL`).join(' AND ')
    const sql = `SELECT COUNT(*) AS orphanCount
       FROM ${quoteIdentifier(fk.table)} c
       LEFT JOIN ${quoteIdentifier(fk.referencedTable)} p ON ${joinCheck}
      WHERE ${nullableCheck || '1=1'} AND ${parentMissing || '1=0'}`
    const rows = await query(runtime, databaseUrl, sql)
    const count = Number(rows[0]?.orphanCount ?? rows[0]?.['COUNT(*)'] ?? 0)
    if (count > 0) orphans.push({ table: fk.table, constraint: fk.name, count })
  }
  return orphans
}

function compareColumns(expected, actual) {
  const normalize = (rows) => rows.map((row) => JSON.stringify(row)).sort()
  assertArrayEqual(normalize(expected), normalize(actual), 'BACKUP_RESTORE_COLUMNS')
}

function assertArrayEqual(expected, actual, code) {
  if (expected.length !== actual.length || expected.some((value, index) => value !== actual[index])) {
    throw new Error(code)
  }
}

function assertPrivateDirectory(directory, code) {
  const stat = lstatSync(directory)
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o777) !== 0o700) throw new Error(code)
}

function assertSafeBackupFile(root, filePath, name) {
  const rootReal = realpathSync(root)
  const fileReal = realpathSync(filePath)
  if (fileReal !== rootReal && !fileReal.startsWith(`${rootReal}/`)) throw new Error(`BACKUP_PATH:${name}`)
  const stat = lstatSync(filePath)
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`BACKUP_FILE_TYPE:${name}`)
  if ((stat.mode & 0o777) !== 0o600) throw new Error(`BACKUP_FILE_MODE:${name}`)
}

function validateRestoreUrl(databaseUrl) {
  const database = decodeURIComponent(databaseUrl.pathname.slice(1))
  const loopback = new Set(['127.0.0.1', 'localhost', '::1'])
  if (databaseUrl.protocol !== 'mysql:' || !loopback.has(databaseUrl.hostname)) throw new Error('BACKUP_RESTORE_URL')
  if (!database.startsWith('ilsangkit_migration_test_')) throw new Error('BACKUP_RESTORE_DATABASE')
}

function ensureDiskSpace(runtime, backupDir, tables) {
  const usage = tables.reduce((sum, table) => sum + Number(table?.bytes ?? 0), 0)
  const statfs = runtime.statfs ? runtime.statfs(backupDir) : statfsSync(backupDir)
  const free = Number(statfs.bavail ?? statfs.blocks ?? 0) * Number(statfs.bsize ?? 0)
  const required = Math.max(1024 * 1024, usage * 3)
  if (free < required) throw new Error(`BACKUP_ENOSPC:required=${required}:free=${free}`)
}

async function query(runtime, databaseUrl, sql, deadline = null) {
  if (runtime.query) return runtime.query(sql)
  const result = await runCommand(MYSQL_BIN, mysqlDirectArgs(databaseUrl, ['--batch', '--raw', '--execute', sql]), {
    timeoutMs: deadline ? remainingMs(deadline) : (runtime.timeoutMs ?? DEFAULT_TIMEOUT_MS),
    env: mysqlPasswordEnv(databaseUrl),
  })
  if (result.code !== 0) throw new Error(`MYSQL_QUERY:${sanitizeOutput(result.stderr || result.stdout)}`)
  return parseTabular(result.stdout)
}

async function run(runtime, command, args, options = {}) {
  if (runtime.run) return runtime.run(command, args, options)
  return runCommand(command, args, options)
}

async function checkedRun(command, args, options, code) {
  const result = await runCommand(command, args, { timeoutMs: DEFAULT_TIMEOUT_MS, ...options })
  if (result.code !== 0) throw new Error(`${code}:${sanitizeOutput(result.stderr || result.stdout)}`)
  return result
}

export function runTimedCommand(command, args, options = {}) {
  return runCommand(command, args, options)
}

function runCommand(command, args, options = {}) {
  return runProcess(command, args, options)
}

function runCommandToFile(command, args, outputPath, options = {}) {
  return runProcess(command, args, { ...options, stdoutFile: outputPath })
}

function runProcess(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timedOut = false
    let killTimer = null
    const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
    const timeout = setTimeout(() => {
      if (settled) return
      timedOut = true
      child.kill('SIGTERM')
      killTimer = setTimeout(() => {
        if (!settled) child.kill('SIGKILL')
      }, options.killAfterMs ?? KILL_AFTER_MS)
    }, timeoutMs)

    const outputTasks = []
    if (options.stdoutFile) {
      const hash = createHash('sha256')
      const out = createWriteStream(options.stdoutFile, { mode: 0o600 })
      child.stdout.on('data', (chunk) => hash.update(chunk))
      outputTasks.push(pipeline(child.stdout, out).then(() => ({ stdoutSha256: hash.digest('hex') })))
    } else {
      child.stdout.on('data', (chunk) => { stdout = appendBounded(stdout, chunk) })
    }
    child.stderr.on('data', (chunk) => { stderr = appendBounded(stderr, chunk) })

    if (options.stdinFile) {
      pipeline(createReadStream(options.stdinFile), child.stdin).catch(() => {})
    } else {
      child.stdin.end()
    }

    child.on('error', (error) => finish({ code: 127, stdout, stderr: appendBounded(stderr, error.message) }))
    child.on('close', async (code, signal) => {
      let stdoutSha256 = null
      try {
        const outputs = await Promise.all(outputTasks)
        stdoutSha256 = outputs[0]?.stdoutSha256 ?? null
      } catch (error) {
        finish({ code: 1, stdout, stderr: appendBounded(stderr, error.message) })
        return
      }
      if (options.stdoutFile) chmodSync(options.stdoutFile, 0o600)
      finish({ code: timedOut ? 124 : (signal ? 124 : (code ?? 1)), stdout, stderr, stdoutSha256 })
    })

    function finish(result) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      resolvePromise(result)
    }
  })
}

function appendBounded(current, chunk) {
  const next = `${current}${chunk}`
  if (next.length <= MAX_CAPTURE_BYTES) return next
  return next.slice(0, MAX_CAPTURE_BYTES)
}

function createDeadline(timeoutMs) {
  return { expiresAt: Date.now() + Number(timeoutMs ?? DEFAULT_TIMEOUT_MS) }
}

function remainingMs(deadline) {
  if (!deadline) return DEFAULT_TIMEOUT_MS
  const remaining = deadline.expiresAt - Date.now()
  if (remaining <= 0) throw new Error('BACKUP_TIMEOUT')
  return remaining
}

async function resolveDatabaseUrl(runtime, context = {}) {
  loadDotenv(runtime.envPath ?? context.envPath)
  const raw = runtime.getDatabaseUrl ? await runtime.getDatabaseUrl() : (runtime.databaseUrl ?? runtime.url ?? process.env.DATABASE_URL)
  if (!raw) throw new Error('BACKUP_DATABASE_URL')
  const parsed = raw instanceof URL ? raw : new URL(raw)
  if (parsed.protocol !== 'mysql:') throw new Error('BACKUP_DATABASE_URL')
  return parsed
}

function loadDotenv(envPath) {
  const target = envPath ?? join(repoRoot, 'backend/.env')
  if (!target || !existsSync(target)) return
  try {
    const dotenv = backendRequire('dotenv')
    dotenv.config({ path: target, override: false, quiet: true })
  } catch {
    throw new Error('BACKUP_DOTENV_LOAD')
  }
}

function mysqlDirectArgs(databaseUrl, tail) {
  return [
    '--protocol=TCP',
    `--host=${databaseUrl.hostname}`,
    `--port=${databaseUrl.port || '3306'}`,
    `--user=${decodeURIComponent(databaseUrl.username)}`,
    '--default-character-set=utf8mb4',
    `--database=${decodeURIComponent(databaseUrl.pathname.slice(1))}`,
    ...tail,
  ]
}


function mysqlPasswordEnv(databaseUrl) {
  return {
    ...process.env,
    MYSQL_PWD: decodeURIComponent(databaseUrl.password),
  }
}

function optionValue(value) {
  return `"${String(value)
    .replaceAll('\\', '\\\\')
    .replaceAll('\n', '\\n')
    .replaceAll('\r', '\\r')
    .replaceAll('"', '\\"')}"`
}

async function writeJson(filePath, value) {
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(filePath, 0o600)
}

async function checksumsFor(files) {
  const checksums = {}
  for (const [name, filePath] of Object.entries(files)) {
    if (filePath && name !== 'manifest') checksums[name] = await sha256File(filePath)
  }
  return checksums
}

function relativeFiles(root, files) {
  return Object.fromEntries(Object.entries(files).map(([name, filePath]) => [name, filePath ? basename(filePath) : null]))
}

async function sha256File(filePath) {
  const hash = createHash('sha256')
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest('hex')
}

function unique(values) {
  const result = []
  const seen = new Set()
  for (const value of values ?? []) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function safeId(value) {
  const safe = String(value).replace(/[^A-Za-z0-9_.-]+/g, '-').slice(0, 160)
  if (!safe || safe === '.' || safe === '..') throw new Error('BACKUP_ID')
  return safe
}

function safeDbName(value) {
  const safe = String(value).replace(/[^A-Za-z0-9_]+/g, '_').slice(0, 64)
  if (!safe) throw new Error('BACKUP_RESTORE_DB')
  return safe
}

function quoteIdentifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``
}

function sqlStringList(values) {
  return values.map((value) => `'${String(value).replaceAll("'", "''")}'`).join(', ')
}

function sanitizeError(error) {
  if (!(error instanceof Error)) return error
  error.message = sanitizeOutput(error.message)
  return error
}

function sanitizeOutput(output) {
  return String(output)
    .replace(/mysql:\/\/[^@\s]+@/g, 'mysql://<redacted>@')
    .replace(/--password=[^\s]+/g, '--password=<redacted>')
    .replace(/password=([^\s]+)/gi, 'password=<redacted>')
    .replace(/using a password on the command line interface can be insecure\.?/gi, '')
    .trim()
}

function parseTabular(stdout) {
  const lines = stdout.trimEnd().split('\n')
  if (lines.length === 0 || lines[0] === '') return []
  const headers = lines[0].split('\t').map(unescapeMysql)
  return lines.slice(1).map((line) => {
    const values = line.split('\t').map(unescapeMysql)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? null]))
  })
}

function unescapeMysql(value) {
  if (value === 'NULL') return null
  return value
    .replaceAll('\\t', '\t')
    .replaceAll('\\n', '\n')
    .replaceAll('\\\\', '\\')
}
