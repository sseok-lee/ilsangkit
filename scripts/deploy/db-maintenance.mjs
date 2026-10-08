import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash, randomUUID } from 'node:crypto'
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statfsSync,
  writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { classifyHistory, readMigrationFiles } from './db-contract.mjs'
import { createDbRuntime, compareStructure, readDbSnapshot, verifySchema } from './db-schema.mjs'
import { createBackup, verifyBackup } from './db-backup.mjs'
import { readAttempts, writeAttempt } from './db-migration-gate.mjs'

const FORMAT = 1
const DEFAULT_STATE_ROOT = '/home/project2/run/db-migrations'
const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../..')
const backendRequire = createRequire(join(repoRoot, 'backend/package.json'))
const dotenv = backendRequire('dotenv')

export async function auditDatabase(context) {
  validateAuditContext(context)
  const backendDir = resolve(context.backendDir)
  const prismaDir = resolve(context.prismaDir ?? join(backendDir, 'prisma'))
  const runtime = createDbRuntime({ backendDir, databaseUrl: resolveDatabaseUrl(context) })
  try {
    const snapshot = await readDbSnapshot(runtime)
    assertAuditIdentity(snapshot.identity, context)
    const prerequisites = await auditRuntimePrerequisites(context, runtime)
    const files = readMigrationFiles(prismaDir)
    const history = classifyHistory(files, snapshot.ledger, { allowBaselineGaps: true })
    const expectedStructure = readEvidenceStructure(context.evidenceDir, files.length)
    const comparison = compareStructure(expectedStructure, snapshot.structure)
    const missing = files.filter((file) => history.pending.includes(file.name) && files.indexOf(file) < files.length)
    const auditId = safeId(`audit-${context.sha.slice(0, 12)}-${context.runId}-${context.runAttempt}-${randomUUID().slice(0, 8)}`, 'AUDIT_ID')
    const audit = {
      format: FORMAT,
      auditId,
      sha: context.sha,
      runId: context.runId,
      runAttempt: context.runAttempt,
      identity: snapshot.identity,
      fingerprint: snapshot.fingerprint,
      equal: comparison.equal,
      differences: comparison.differences,
      files: files.map((file) => ({ name: file.name, checksum: file.checksum })),
      history,
      ledger: snapshot.ledger,
      missing: missing.map((file) => ({ name: file.name, checksum: file.checksum, sqlPath: file.sqlPath })),
      structureSha256: sha256(JSON.stringify(snapshot.structure)),
      prerequisites,
      createdAt: new Date().toISOString(),
    }
    writePrivateJson(auditPath(context.stateRoot, auditId), audit)
    return {
      auditId,
      equal: comparison.equal,
      missing: audit.missing,
      fingerprint: snapshot.fingerprint,
    }
  } finally {
    await runtime.close()
  }
}

export async function reconcileDatabase(context, auditId) {
  validateDbContext(context)
  const audit = readAudit(context.stateRoot, auditId)
  if (audit.sha !== context.sha) throw new Error('RECONCILE_SHA')
  if (audit.runId !== context.runId || audit.runAttempt !== context.runAttempt) throw new Error('RECONCILE_RUN')
  if (!audit.equal) throw new Error('RECONCILE_AUDIT_NOT_EQUAL')

  const backendDir = resolve(context.backendDir)
  const prismaDir = resolve(context.prismaDir ?? join(backendDir, 'prisma'))
  const runtime = createDbRuntime({ backendDir, databaseUrl: resolveDatabaseUrl(context) })
  try {
    const snapshot = await readDbSnapshot(runtime)
    assertDbIdentity(snapshot.identity, context.expectedDb)
    assertSameIdentity(snapshot.identity, audit.identity, 'RECONCILE_IDENTITY')
    if (snapshot.fingerprint !== audit.fingerprint) throw new Error('RECONCILE_STRUCTURE')

    const files = readMigrationFiles(prismaDir)
    assertNoDuplicateLedger(snapshot.ledger, 'RECONCILE_LEDGER_DUPLICATE')
    const currentByName = new Map(snapshot.ledger.map((row) => [row.migrationName, row]))
    assertOriginalLedgerPreserved(audit.ledger, currentByName)
    assertResolvedMissingRows(audit.missing, currentByName)
    const allowed = new Set([...audit.ledger.map((row) => row.migrationName), ...audit.missing.map((row) => row.name)])
    for (const row of snapshot.ledger) {
      if (!allowed.has(row.migrationName)) throw new Error(`RECONCILE_LEDGER_UNEXPECTED:${row.migrationName}`)
    }

    const missingRemaining = audit.missing.filter((migration) => !currentByName.has(migration.name))
    assertOnlyFrozenMissing(files, audit.missing)

    const backup = await createBackup({ context, runtime, tables: [], kind: 'reconcile' })
    await verifyBackup(backup)

    for (const migration of missingRemaining) {
      const result = await runtime.runPrisma([
        'migrate',
        'resolve',
        '--applied',
        migration.name,
        '--schema',
        join(prismaDir, 'schema.prisma'),
      ], { timeoutMs: context.migrateTimeoutMs ?? 5 * 60 * 1000 })
      if (result.code !== 0) throw new Error(`RECONCILE_RESOLVE:${migration.name}`)
    }

    const status = await runtime.runPrisma(['migrate', 'status', '--schema', join(prismaDir, 'schema.prisma')], {
      timeoutMs: context.migrateTimeoutMs ?? 5 * 60 * 1000,
    })
    if (status.code !== 0) throw new Error(`RECONCILE_STATUS:${status.code}`)
    const finalSnapshot = await readDbSnapshot(runtime)
    assertDbIdentity(finalSnapshot.identity, context.expectedDb)
    if (finalSnapshot.fingerprint !== audit.fingerprint) throw new Error('RECONCILE_STRUCTURE')
    assertNoDuplicateLedger(finalSnapshot.ledger, 'RECONCILE_LEDGER_DUPLICATE')
    const finalByName = new Map(finalSnapshot.ledger.map((row) => [row.migrationName, row]))
    assertOriginalLedgerPreserved(audit.ledger, finalByName)
    assertResolvedMissingRows(audit.missing, finalByName)
    const finalHistory = classifyHistory(files, finalSnapshot.ledger)
    if (finalHistory.pending.length > 0 || finalHistory.applied.length !== files.length) throw new Error('RECONCILE_HISTORY')
    await verifySchema({ runtime, evidenceDir: context.evidenceDir, prefixLength: files.length })

    const baseline = {
      format: FORMAT,
      baselineId: safeId(`baseline-${context.sha.slice(0, 12)}-${context.runId}-${context.runAttempt}`, 'BASELINE_ID'),
      auditId,
      sha: context.sha,
      runId: context.runId,
      runAttempt: context.runAttempt,
      identity: finalSnapshot.identity,
      fingerprint: finalSnapshot.fingerprint,
      status: 'verified',
      backupId: backup.id,
      resolved: missingRemaining.map((migration) => migration.name),
      verifiedAt: new Date().toISOString(),
    }
    writePrivateJson(join(resolve(context.stateRoot), 'baseline.json'), baseline, { allowVerifiedBaselineIdempotency: true })
    return { baselineId: baseline.baselineId, status: 'verified' }
  } finally {
    await runtime.close()
  }
}

export async function recoverAttempt(context, recoveryId) {
  validateDbContext(context)
  const recovery = readRecovery(context, recoveryId)
  const attempts = await readAttempts(context.stateRoot)
  const attempt = attempts.find((candidate) => candidate.id === recovery.targetAttemptId)
  if (!attempt) throw new Error('RECOVERY_ATTEMPT')
  if (!recovery.targetSha || recovery.targetSha !== attempt.sha) throw new Error('RECOVERY_TARGET_SHA')
  if (attempt.recovery != null || attempt.phase === 'verified' || attempt.phase === 'recovered') throw new Error('RECOVERY_ATTEMPT_STATE')
  assertOriginalProcessEnded(attempt)

  const backendDir = resolve(context.backendDir)
  const prismaDir = resolve(context.prismaDir ?? join(backendDir, 'prisma'))
  const runtime = createDbRuntime({ backendDir, databaseUrl: resolveDatabaseUrl(context) })
  try {
    await assertProcessPrivilege(runtime)
    await assertNoActiveDbOperations(runtime, context.expectedDb.database)

    const pending = attempt.pending?.find((migration) => migration.name === recovery.migrationName && migration.checksum === recovery.checksum)
    if (!pending) throw new Error('RECOVERY_MIGRATION')
    const snapshot = await readDbSnapshot(runtime)
    assertDbIdentity(snapshot.identity, context.expectedDb)
    if (recovery.beforeFingerprint !== snapshot.fingerprint) throw new Error('RECOVERY_FINGERPRINT')
    assertNoSqlReleasedIfNoProcess(attempt, snapshot.ledger, recovery)
    const ledgerBefore = snapshot.ledger

    if (recovery.backup) await verifyBackup(recovery.backup)
    const backup = await createBackup({ context, runtime, tables: recovery.backupTables ?? [], kind: 'migration' })
    await verifyBackup(backup)

    if (recovery.sqlFile) {
      await assertNoActiveDbOperations(runtime, context.expectedDb.database)
      const sqlPath = resolveRecoveryFile(context, recoveryId, recovery.sqlFile)
      if (sha256(readFileSync(sqlPath)) !== recovery.sqlSha256) throw new Error('RECOVERY_SQL_CHECKSUM')
      const execute = await runtime.runPrisma(['db', 'execute', '--file', sqlPath, '--schema', join(prismaDir, 'schema.prisma')], {
        timeoutMs: context.migrateTimeoutMs ?? 5 * 60 * 1000,
      })
      if (execute.code !== 0) throw new Error(`RECOVERY_SQL:${execute.code}`)
    }

    await assertRecoveryPostconditions(runtime, recovery.postconditions ?? [])
    await assertNoActiveDbOperations(runtime, context.expectedDb.database)
    const resolveArgs = recovery.outcome === 'reverted'
      ? ['migrate', 'resolve', '--rolled-back', recovery.migrationName, '--schema', join(prismaDir, 'schema.prisma')]
      : ['migrate', 'resolve', '--applied', recovery.migrationName, '--schema', join(prismaDir, 'schema.prisma')]
    const resolveResult = await runtime.runPrisma(resolveArgs, { timeoutMs: context.migrateTimeoutMs ?? 5 * 60 * 1000 })
    if (resolveResult.code !== 0) throw new Error(`RECOVERY_RESOLVE:${resolveResult.code}`)
    const finalSnapshot = await readDbSnapshot(runtime)
    assertDbIdentity(finalSnapshot.identity, context.expectedDb)
    assertRecoveryLedger(ledgerBefore, finalSnapshot.ledger, recovery)
    await verifySchema({ runtime, evidenceDir: context.evidenceDir, prefixLength: recovery.targetPrefixLength })

    const recovered = {
      ...attempt,
      phase: 'recovered',
      recovery: { outcome: recovery.outcome, evidenceId: recovery.id },
      recoveryBackupId: backup.id,
      recoveredAt: new Date().toISOString(),
    }
    await writeAttempt(context.stateRoot, recovered)
    return { status: 'recovered', outcome: recovery.outcome }
  } finally {
    await runtime.close()
  }
}

function validateAuditContext(context) {
  validateCommonContext(context)
  if (!context.expectedDatabase) throw new Error('AUDIT_DATABASE')
  const db = String(context.expectedDatabase)
  const fixture = db.startsWith('ilsangkit_migration_test_')
  if (context.expectedServerUuid == null && db !== 'ilsangkit' && !fixture) throw new Error('AUDIT_DATABASE')
}

function validateDbContext(context) {
  validateCommonContext(context)
  if (!context.expectedDb?.database || !context.expectedDb?.serverUuid) throw new Error('DB_CONTEXT_IDENTITY')
}

function validateCommonContext(context) {
  if (!context || typeof context !== 'object') throw new Error('DB_CONTEXT')
  for (const key of ['backendDir', 'stateRoot', 'evidenceDir', 'sha', 'runId', 'runAttempt']) {
    if (!context[key]) throw new Error(`DB_CONTEXT_${key}`)
  }
  if (!/^[0-9a-f]{40}$/i.test(context.sha)) throw new Error('DB_CONTEXT_SHA')
}

function assertAuditIdentity(identity, context) {
  if (identity.database !== context.expectedDatabase) throw new Error('AUDIT_IDENTITY')
  if (context.expectedServerUuid && identity.serverUuid !== context.expectedServerUuid) throw new Error('AUDIT_IDENTITY')
}

function assertDbIdentity(identity, expectedDb) {
  if (identity.database !== expectedDb.database) throw new Error('DB_IDENTITY')
  if (identity.serverUuid !== expectedDb.serverUuid) throw new Error('DB_IDENTITY')
}

function assertSameIdentity(actual, expected, code) {
  if (actual.database !== expected.database || actual.serverUuid !== expected.serverUuid) throw new Error(code)
}

function assertOriginalLedgerPreserved(originalRows, currentByName) {
  for (const original of originalRows) {
    const current = currentByName.get(original.migrationName)
    if (!current) throw new Error(`RECONCILE_LEDGER_MISSING:${original.migrationName}`)
    if (current.checksum !== original.checksum || current.finishedAt == null || current.rolledBackAt !== original.rolledBackAt) {
      throw new Error(`RECONCILE_LEDGER_CHANGED:${original.migrationName}`)
    }
  }
}

function assertResolvedMissingRows(missingRows, currentByName) {
  for (const missing of missingRows) {
    const current = currentByName.get(missing.name)
    if (!current) continue
    if (current.checksum !== missing.checksum || current.finishedAt == null || current.rolledBackAt != null) {
      throw new Error(`RECONCILE_MISSING_CHANGED:${missing.name}`)
    }
  }
}

function assertNoDuplicateLedger(rows, code) {
  const seen = new Set()
  for (const row of rows) {
    if (seen.has(row.migrationName)) throw new Error(`${code}:${row.migrationName}`)
    seen.add(row.migrationName)
  }
}

function assertOnlyFrozenMissing(files, missing) {
  const frozen = new Set(files.slice(0, 6).map((file) => `${file.name}:${file.checksum}`))
  for (const migration of missing) {
    if (!frozen.has(`${migration.name}:${migration.checksum}`)) throw new Error(`RECONCILE_NON_FROZEN:${migration.name}`)
  }
}

function readEvidenceStructure(evidenceDir, prefixLength) {
  return JSON.parse(readFileSync(join(evidenceDir, 'prefixes', String(prefixLength).padStart(4, '0'), 'structure.json'), 'utf8'))
}

function readAudit(stateRoot, auditId) {
  const audit = readPrivateJson(auditPath(stateRoot, auditId), 'AUDIT_PATH')
  if (audit.format !== FORMAT) throw new Error('AUDIT_FORMAT')
  return audit
}

function auditPath(stateRoot, auditId) {
  const root = resolve(stateRoot || DEFAULT_STATE_ROOT)
  const auditsDir = join(root, 'audits')
  const id = safeId(auditId, 'AUDIT_ID')
  return join(auditsDir, `${id}.json`)
}

function writePrivateJson(path, value, options = {}) {
  const dir = dirname(path)
  assertNoSymlinkPathComponentsSync(dir, 'PRIVATE_DIR')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  assertNoSymlinkPathComponentsSync(dir, 'PRIVATE_DIR')
  chmodSync(dir, 0o700)
  if (existsSync(path)) {
    assertNoSymlink(path, 'PRIVATE_FILE')
    const existing = JSON.parse(readFileSync(path, 'utf8'))
    if (options.allowVerifiedBaselineIdempotency && isSameVerifiedBaseline(existing, value)) return
    throw new Error('PRIVATE_FILE_EXISTS')
  }
  const temp = join(dir, `.${safeId(value.auditId ?? value.baselineId ?? value.id ?? randomUUID(), 'PRIVATE_ID')}.${process.pid}.${randomUUID()}.tmp`)
  const fd = openSync(temp, 'wx', 0o600)
  try {
    writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`)
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
  try {
    renameSync(temp, path)
    chmodSync(path, 0o600)
    const dirFd = openSync(dir, 'r')
    try {
      fsyncSync(dirFd)
    } finally {
      closeSync(dirFd)
    }
  } catch (error) {
    rmSync(temp, { force: true })
    throw error
  }
}

function readPrivateJson(path, code) {
  assertTrustedPath(dirname(path), path, code)
  return JSON.parse(readFileSync(path, 'utf8'))
}

function assertTrustedPath(root, path, code) {
  assertNoSymlinkPathComponentsSync(root, code)
  assertNoSymlinkPathComponentsSync(path, code)
  if (!existsSync(path)) return
  if (lstatSync(path).isSymbolicLink()) throw new Error(`${code}_SYMLINK`)
  const realRoot = realpathSync(root)
  const realPath = realpathSync(path)
  const rel = relative(realRoot, realPath)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error(`${code}_ESCAPE`)
}

function assertNoSymlink(path, code) {
  if (!existsSync(path)) return
  if (lstatSync(path).isSymbolicLink()) throw new Error(`${code}_SYMLINK`)
}

function assertNoSymlinkPathComponentsSync(path, code) {
  const resolved = resolve(path)
  const parsed = parse(resolved)
  let current = parsed.root
  const rest = resolved.slice(parsed.root.length).split(sep).filter(Boolean)
  for (const part of rest) {
    current = join(current, part)
    if (!existsSync(current)) return
    if (lstatSync(current).isSymbolicLink() && !isAllowedSystemSymlink(current)) throw new Error(`${code}_SYMLINK`)
  }
}

function isAllowedSystemSymlink(path) {
  return path === '/var' || path === '/tmp'
}

function isSameVerifiedBaseline(existing, next) {
  return existing?.format === FORMAT
    && next?.format === FORMAT
    && existing.status === 'verified'
    && next.status === 'verified'
    && existing.baselineId === next.baselineId
    && existing.auditId === next.auditId
    && existing.sha === next.sha
    && existing.fingerprint === next.fingerprint
    && JSON.stringify(existing.identity) === JSON.stringify(next.identity)
}

function resolveDatabaseUrl(context) {
  if (!context.databaseUrl) throw new Error('DATABASE_URL_REQUIRED')
  return context.databaseUrl
}

function readRecovery(context, recoveryId) {
  const id = safeId(recoveryId, 'RECOVERY_ID')
  const recoveryPath = recoveryJsonPath(context, id)
  const recovery = readPrivateJson(recoveryPath, 'RECOVERY_PATH')
  if (recovery.format !== FORMAT || recovery.id !== id) throw new Error('RECOVERY_FORMAT')
  if (!/^[0-9a-f]{40}$/i.test(recovery.targetSha ?? '')) throw new Error('RECOVERY_TARGET_SHA')
  if (!/^[0-9a-f]{64}$/i.test(recovery.beforeFingerprint ?? '')) throw new Error('RECOVERY_FINGERPRINT')
  if (!['applied', 'reverted'].includes(recovery.outcome)) throw new Error('RECOVERY_OUTCOME')
  return recovery
}

function resolveRecoveryFile(context, recoveryId, fileName) {
  const id = safeId(recoveryId, 'RECOVERY_ID')
  if (typeof fileName !== 'string' || fileName === '' || isAbsolute(fileName) || fileName.split(/[\\/]/).includes('..')) {
    throw new Error('RECOVERY_PATH')
  }
  const root = recoveryRoot(context, id)
  const filePath = resolve(root, fileName)
  const rel = relative(root, filePath)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('RECOVERY_PATH')
  assertTrustedPath(root, filePath, 'RECOVERY_SQL_PATH')
  return filePath
}

function recoveryJsonPath(context, recoveryId) {
  const root = recoveryRoot(context, recoveryId)
  const recoveryPath = resolve(root, 'recovery.json')
  assertTrustedPath(root, recoveryPath, 'RECOVERY_PATH')
  return recoveryPath
}

function recoveryRoot(context, recoveryId) {
  const id = safeId(recoveryId, 'RECOVERY_ID')
  const root = resolve(context.backendDir, 'prisma', 'recovery', id)
  assertNoSymlinkPathComponentsSync(root, 'RECOVERY_ROOT')
  return root
}

function assertOriginalProcessEnded(attempt) {
  if (attempt.process == null) {
    if (attempt.phase === 'applying') return
    throw new Error('RECOVERY_PROCESS_PROOF')
  }
  const processGroupId = attempt.process.processGroupId
  const pid = attempt.process.pid
  if (!processGroupId && !pid) throw new Error('RECOVERY_PROCESS_PROOF')
  if (processGroupId) assertProcessNotLive(-Number(processGroupId))
  else assertProcessNotLive(Number(pid))
}

function assertProcessNotLive(pid) {
  try {
    process.kill(pid, 0)
    throw new Error('RECOVERY_PROCESS_ACTIVE')
  } catch (error) {
    if (error.message === 'RECOVERY_PROCESS_ACTIVE') throw error
    if (error.code !== 'ESRCH') throw error
  }
}


async function auditRuntimePrerequisites(context, runtime) {
  const mysqlVersion = readToolVersion('mysql', 'AUDIT_MYSQL_CLI')
  const mysqldumpVersion = readToolVersion('mysqldump', 'AUDIT_MYSQLDUMP_CLI')
  const grants = await readCurrentGrants(runtime)
  const hasProcess = grants.some(hasGlobalProcessPrivilege)
  if (!hasProcess) throw new Error('AUDIT_PROCESS_PRIVILEGE')
  const disk = await readDiskSpacePrerequisite(context, runtime)
  return {
    mysqlVersion,
    mysqldumpVersion,
    processPrivilege: true,
    disk,
  }
}

function readToolVersion(command, code) {
  const result = spawnSync(command, ['--version'], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(code)
  return safeToolVersion(result.stdout || result.stderr)
}

function safeToolVersion(output) {
  return String(output).split(/\r?\n/)[0].replace(/\s+/g, ' ').trim().slice(0, 240)
}

function hasGlobalProcessPrivilege(grant) {
  const normalized = String(grant).replace(/`/g, '').replace(/\s+/g, ' ').trim()
  if (!/\sON\s+\*\.\*\s/i.test(normalized)) return false
  return /GRANT\s+ALL PRIVILEGES\s+ON\s+\*\.\*/i.test(normalized)
    || /GRANT\s+[^;]*\bPROCESS\b[^;]*\s+ON\s+\*\.\*/i.test(normalized)
}

async function readDiskSpacePrerequisite(context, runtime) {
  const stateRoot = resolve(context.stateRoot || DEFAULT_STATE_ROOT)
  mkdirSync(stateRoot, { recursive: true, mode: 0o700 })
  const rows = await runtime.query(
    `SELECT COALESCE(SUM(DATA_LENGTH + INDEX_LENGTH), 0) AS bytes
       FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()`,
  )
  const databaseBytes = Number(rows[0]?.bytes ?? 0)
  const minimumFreeBytes = Math.max(databaseBytes * 2, 128 * 1024 * 1024)
  const stats = statfsSync(stateRoot)
  const availableBytes = Number(stats.bavail) * Number(stats.bsize)
  if (!Number.isFinite(availableBytes) || availableBytes < minimumFreeBytes) throw new Error('AUDIT_DISK_SPACE')
  return { availableBytes, databaseBytes, minimumFreeBytes }
}

async function readCurrentGrants(runtime) {
  const rows = await runtime.query('SHOW GRANTS FOR CURRENT_USER()')
  return rows.map((row) => Object.values(row).join(' '))
}

async function assertProcessPrivilege(runtime) {
  const grants = await readCurrentGrants(runtime)
  if (!grants.some(hasGlobalProcessPrivilege)) throw new Error('RECOVERY_PROCESS_PRIVILEGE')
}

async function assertNoActiveDbOperations(runtime, databaseName) {
  const rows = await runtime.query(
    `SELECT ID AS id, DB AS db, COMMAND AS command, INFO AS info
       FROM information_schema.processlist
      WHERE DB = ?
        AND ID <> CONNECTION_ID()`,
    databaseName,
  )
  const active = rows.filter((row) => String(row.command).toLowerCase() !== 'sleep')
  if (active.length > 0) throw new Error('RECOVERY_DB_OPERATION_ACTIVE')
}

function assertNoSqlReleasedIfNoProcess(attempt, ledger, recovery) {
  if (attempt.process != null) return
  if (attempt.phase !== 'applying') throw new Error('RECOVERY_PROCESS_PROOF')
  const row = ledger.find((candidate) => candidate.migrationName === recovery.migrationName)
  if (row) throw new Error('RECOVERY_SQL_RELEASED')
}

function assertRecoveryLedger(before, after, recovery) {
  const afterByName = new Map(after.map((row) => [row.migrationName, row]))
  for (const row of before) {
    if (row.migrationName === recovery.migrationName) continue
    const current = afterByName.get(row.migrationName)
    if (!current || current.checksum !== row.checksum || current.finishedAt !== row.finishedAt || current.rolledBackAt !== row.rolledBackAt) {
      throw new Error(`RECOVERY_LEDGER_CHANGED:${row.migrationName}`)
    }
  }
  const target = afterByName.get(recovery.migrationName)
  if (!target) throw new Error('RECOVERY_LEDGER_TARGET')
  if (target.checksum !== recovery.checksum) throw new Error('RECOVERY_LEDGER_CHECKSUM')
  if (recovery.outcome === 'applied' && target.finishedAt == null) throw new Error('RECOVERY_LEDGER_TARGET')
  if (recovery.outcome === 'reverted' && target.rolledBackAt == null) throw new Error('RECOVERY_LEDGER_TARGET')
}

async function assertRecoveryPostconditions(runtime, postconditions) {
  for (const condition of postconditions) {
    if (condition.query && condition.equals !== undefined) {
      const rows = await runtime.query(condition.query)
      const actual = rows[0]?.value ?? Object.values(rows[0] ?? {})[0] ?? null
      if (String(actual) !== String(condition.equals)) throw new Error('RECOVERY_POSTCONDITION')
    }
  }
}

function safeId(value, code) {
  const id = String(value ?? '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(id) || id === '.' || id === '..') throw new Error(code)
  return id
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function main() {
  const [command, ...args] = process.argv.slice(2)
  if (!['audit', 'reconcile', 'recover'].includes(command)) return exitUsage()
  if (args.some((arg) => arg === '--sql' || arg === '--url' || arg === '--database-url' || arg === '--migration')) return exitUsage()
  const parsed = parseArgs(args)
  if (command === 'audit') {
    if (args.length !== 0) return exitUsage()
    const base = cliBaseContext(process.env)
    const result = await auditDatabase({
      ...base,
      expectedDatabase: 'ilsangkit',
      expectedServerUuid: null,
    })
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  if (command === 'reconcile') {
    const auditId = parsed.auditId || process.env.DB_AUDIT_ID
    if (!auditId || args.length > 2 || (args.length === 2 && args[0] !== '--audit-id')) return exitUsage()
    const base = cliBaseContext(process.env)
    const audit = readAudit(base.stateRoot, auditId)
    const result = await reconcileDatabase({
      ...base,
      expectedDb: audit.identity,
    }, auditId)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    return
  }
  if (command === 'recover') {
    const recoveryId = parsed.recoveryId || process.env.DB_RECOVERY_ID
    if (!recoveryId || args.length > 2 || (args.length === 2 && args[0] !== '--recovery-id')) return exitUsage()
    const base = cliBaseContext(process.env)
    const baseline = JSON.parse(readFileSync(join(base.stateRoot, 'baseline.json'), 'utf8'))
    if (baseline.format !== FORMAT || baseline.status !== 'verified') throw new Error('BASELINE_REQUIRED')
    const result = await recoverAttempt({
      ...base,
      expectedDb: baseline.identity,
    }, recoveryId)
    process.stdout.write(`${JSON.stringify(result)}\n`)
  }
}


function parseArgs(args) {
  const parsed = {}
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (flag === '--audit-id' && value) parsed.auditId = safeId(value, 'AUDIT_ID')
    else if (flag === '--recovery-id' && value) parsed.recoveryId = safeId(value, 'RECOVERY_ID')
    else return {}
  }
  return parsed
}

function cliBaseContext(env) {
  const backendDir = resolve(requiredEnv(env, 'DB_BACKEND_DIR'))
  const stateRoot = resolve(env.DB_STATE_ROOT || DEFAULT_STATE_ROOT)
  const evidenceDir = resolve(requiredEnv(env, 'MIGRATION_EVIDENCE_DIR'))
  const databaseUrl = readEnvDatabaseUrl(requiredEnv(env, 'DB_ENV_FILE'))
  const parsed = new URL(databaseUrl)
  if (parsed.protocol !== 'mysql:' || parsed.pathname !== '/ilsangkit') throw new Error('CLI_DATABASE')
  return {
    backendDir,
    prismaDir: join(backendDir, 'prisma'),
    stateRoot,
    evidenceDir,
    sha: requiredEnv(env, 'TESTED_SHA'),
    runId: requiredEnv(env, 'TEST_RUN_ID'),
    runAttempt: requiredEnv(env, 'TEST_RUN_ATTEMPT'),
    databaseUrl,
  }
}

function requiredEnv(env, key) {
  if (!env[key]) throw new Error(`${key}_REQUIRED`)
  return env[key]
}

function readEnvDatabaseUrl(envFile) {
  const parsed = dotenv.parse(readFileSync(resolve(envFile), 'utf8'))
  if (!parsed.DATABASE_URL) throw new Error('DATABASE_URL_REQUIRED')
  return parsed.DATABASE_URL
}

function exitUsage() {
  console.error('usage: node scripts/deploy/db-maintenance.mjs <audit|reconcile --audit-id ID|recover --recovery-id ID>')
  process.exitCode = 2
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  main().catch((error) => {
    console.error(publicErrorCode(error))
    process.exitCode = process.exitCode || 1
  })
}

function publicErrorCode(error) {
  const message = String(error?.message ?? '')
  const match = message.match(/^[A-Z][A-Z0-9_]*(?::[A-Za-z0-9_.-]+)?/)
  return match ? match[0] : 'DB_MAINTENANCE_FAILED'
}
