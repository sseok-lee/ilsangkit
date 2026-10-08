import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'

import { createMysqlFixture } from './fixtures/db-mysql.mjs'
import { readMigrationFiles } from './db-contract.mjs'
import { createDbRuntime, readDbSnapshot } from './db-schema.mjs'
import { readAttempts, writeAttempt } from './db-migration-gate.mjs'
import { auditDatabase, recoverAttempt, reconcileDatabase } from './db-maintenance.mjs'

test('reconcile preserves original user and ledger rows', async (t) => {
  const db = await createMysqlFixture(t, 'reconcile')
  const seeded = await db.seedLegacyShape()

  const audit = await auditDatabase(seeded.auditContext)
  const auditDoc = JSON.parse(readFileSync(join(seeded.context.stateRoot, 'audits', `${audit.auditId}.json`), 'utf8'))

  assert.equal(audit.equal, true)
  assert.match(auditDoc.prerequisites.mysqlVersion, /mysql/i)
  assert.match(auditDoc.prerequisites.mysqldumpVersion, /mysqldump/i)
  assert.equal(auditDoc.prerequisites.processPrivilege, true)
  assert.ok(auditDoc.prerequisites.disk.availableBytes >= auditDoc.prerequisites.disk.minimumFreeBytes)
  assert.ok(auditDoc.prerequisites.disk.minimumFreeBytes >= 128 * 1024 * 1024)
  assert.deepEqual(audit.missing.map((migration) => migration.name), seeded.expectedMissing)

  await reconcileDatabase(seeded.context, audit.auditId)

  assert.deepEqual(await db.readOriginalRows(), seeded.originalRows)
  assert.deepEqual(await db.readOriginalLedgerRows(), seeded.originalLedgerRows)
  assert.equal((await db.prisma(['migrate', 'status'])).code, 0)
  const baseline = JSON.parse(readFileSync(join(seeded.context.stateRoot, 'baseline.json'), 'utf8'))
  assert.equal(baseline.format, 1)
  assert.equal(baseline.status, 'verified')
  assert.deepEqual(baseline.identity, seeded.context.expectedDb)
})

test('reconcile rejects stale audit after structure drift', async (t) => {
  const db = await createMysqlFixture(t, 'drift')
  const seeded = await db.seedLegacyShape()
  const audit = await auditDatabase(seeded.auditContext)

  await db.exec('ALTER TABLE AffiliateBanner ADD COLUMN forbiddenDrift TEXT NULL')

  await assert.rejects(
    () => reconcileDatabase(seeded.context, audit.auditId),
    /RECONCILE_STRUCTURE/,
  )
})

test('reconcile resumes only already resolved frozen audit rows', async (t) => {
  const db = await createMysqlFixture(t, 'resume')
  const seeded = await db.seedLegacyShape()
  const audit = await auditDatabase(seeded.auditContext)
  const firstMissing = audit.missing[0].name

  const resolved = await db.prisma(['migrate', 'resolve', '--applied', firstMissing])
  assert.equal(resolved.code, 0, resolved.stderr || resolved.stdout)

  await reconcileDatabase(seeded.context, audit.auditId)

  assert.deepEqual(await db.readOriginalRows(), seeded.originalRows)
  assert.deepEqual(await db.readOriginalLedgerRows(), seeded.originalLedgerRows)
  assert.equal((await db.prisma(['migrate', 'status'])).code, 0)
})



test('reconcile rejects resumed frozen audit rows with changed checksum or rollback state', async (t) => {
  const db = await createMysqlFixture(t, 'resume-mutated')
  const seeded = await db.seedLegacyShape()
  const audit = await auditDatabase(seeded.auditContext)
  const firstMissing = audit.missing[0].name

  const resolved = await db.prisma(['migrate', 'resolve', '--applied', firstMissing])
  assert.equal(resolved.code, 0, resolved.stderr || resolved.stdout)
  await db.exec(`UPDATE _prisma_migrations SET checksum = 'changed-checksum' WHERE migration_name = "${firstMissing}"`)

  await assert.rejects(
    () => reconcileDatabase(seeded.context, audit.auditId),
    new RegExp(`RECONCILE_MISSING_CHANGED:${firstMissing}`),
  )
})

test('reconcile rejects duplicate ledger rows before baseline write', async (t) => {
  const db = await createMysqlFixture(t, 'duplicate-ledger')
  const seeded = await db.seedLegacyShape()
  const audit = await auditDatabase(seeded.auditContext)
  const duplicate = seeded.originalLedgerRows[0]

  await db.exec(`
    INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
    VALUES ('duplicate-ledger-row', '${duplicate.checksum}', CURRENT_TIMESTAMP(3), '${duplicate.migrationName}', NULL, NULL, CURRENT_TIMESTAMP(3), 1)
  `)

  await assert.rejects(
    () => reconcileDatabase(seeded.context, audit.auditId),
    new RegExp(`RECONCILE_LEDGER_DUPLICATE:${duplicate.migrationName}`),
  )
})

test('recover rolls back partial DDL with reviewed SQL and updates same attempt id', async (t) => {
  const db = await createMysqlFixture(t, 'recover-partial')
  assert.equal((await db.prisma(['migrate', 'deploy'])).code, 0)

  const runtime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const baseSnapshot = await readDbSnapshot(runtime)
  await runtime.close()
  const baseFiles = readMigrationFiles(db.prismaDir)
  const evidenceDir = join(db.root, 'evidence-recovery')
  const basePrefixDir = join(evidenceDir, 'prefixes', String(baseFiles.length).padStart(4, '0'))
  mkdirSync(basePrefixDir, { recursive: true })
  writeFileSync(join(basePrefixDir, 'structure.json'), `${JSON.stringify(baseSnapshot.structure, null, 2)}\n`)
  writeFileSync(join(basePrefixDir, 'schema.prisma'), readFileSync(db.schemaPath, 'utf8'))

  const migrationName = '202610090001_recovery_partial'
  addMigration(db, migrationName, [
    'ALTER TABLE `AffiliateBanner` ADD COLUMN `recoverNullable` VARCHAR(191) NULL;',
    'SELECT * FROM `RecoveryMissingTable`;',
  ].join('\n'))
  const migration = readMigrationFiles(db.prismaDir).find((file) => file.name === migrationName)
  const deploy = await db.prisma(['migrate', 'deploy'])
  assert.notEqual(deploy.code, 0)

  const partialRuntime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const partialSnapshot = await readDbSnapshot(partialRuntime)
  await partialRuntime.close()

  const stateRoot = join(db.root, 'state-recovery')
  const attempt = {
    format: 1,
    id: 'attempt-recovery-partial',
    sha: 'b'.repeat(40),
    runId: '77',
    runAttempt: '1',
    identity: baseSnapshot.identity,
    pending: [{ name: migration.name, checksum: migration.checksum, sqlPath: migration.sqlPath }],
    backupId: 'backup-before-recovery',
    phase: 'failed',
    recovery: null,
    process: { pid: 99999999, processGroupId: 99999998, command: 'node', startedAt: new Date().toISOString() },
  }
  await writeAttempt(stateRoot, attempt)

  const recoveryId = 'reviewed-partial'
  const recoveryDir = join(db.backendDir, 'prisma', 'recovery', recoveryId)
  mkdirSync(recoveryDir, { recursive: true })
  const sql = 'ALTER TABLE `AffiliateBanner` DROP COLUMN `recoverNullable`;\n'
  writeFileSync(join(recoveryDir, 'revert.sql'), sql)
  writeFileSync(join(recoveryDir, 'recovery.json'), JSON.stringify({
    format: 1,
    id: recoveryId,
    targetSha: attempt.sha,
    targetAttemptId: attempt.id,
    migrationName,
    checksum: migration.checksum,
    beforeFingerprint: partialSnapshot.fingerprint,
    outcome: 'reverted',
    targetPrefixLength: baseFiles.length,
    sqlFile: 'revert.sql',
    sqlSha256: sha256(sql),
    backupTables: ['AffiliateBanner'],
    postconditions: [{ query: 'SELECT COUNT(*) AS value FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = "AffiliateBanner" AND column_name = "recoverNullable"', equals: '0' }],
  }, null, 2))

  const result = await recoverAttempt({
    backendDir: db.backendDir,
    prismaDir: db.prismaDir,
    stateRoot,
    evidenceDir,
    sha: 'c'.repeat(40),
    runId: '78',
    runAttempt: '1',
    expectedDb: baseSnapshot.identity,
    databaseUrl: db.url,
  }, recoveryId)

  assert.deepEqual(result, { status: 'recovered', outcome: 'reverted' })
  const attempts = await readAttempts(stateRoot)
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].id, attempt.id)
  assert.equal(attempts[0].phase, 'recovered')
  assert.deepEqual(attempts[0].recovery, { outcome: 'reverted', evidenceId: recoveryId })

  const ledger = await db.query(`SELECT rolled_back_at AS rolledBackAt FROM _prisma_migrations WHERE migration_name = "${migrationName}"`)
  assert.equal(ledger.length, 1)
  assert.notEqual(ledger[0].rolledBackAt, null)
})



test('recover rejects stale fingerprint before backup or SQL and rejects symlinked reviewed SQL', async (t) => {
  const db = await createMysqlFixture(t, 'recover-guards')
  assert.equal((await db.prisma(['migrate', 'deploy'])).code, 0)

  const runtime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const baseSnapshot = await readDbSnapshot(runtime)
  await runtime.close()
  const baseFiles = readMigrationFiles(db.prismaDir)
  const evidenceDir = join(db.root, 'evidence-recovery-guards')
  const basePrefixDir = join(evidenceDir, 'prefixes', String(baseFiles.length).padStart(4, '0'))
  mkdirSync(basePrefixDir, { recursive: true })
  writeFileSync(join(basePrefixDir, 'structure.json'), `${JSON.stringify(baseSnapshot.structure, null, 2)}\n`)
  writeFileSync(join(basePrefixDir, 'schema.prisma'), readFileSync(db.schemaPath, 'utf8'))

  const migrationName = '202610090002_recovery_guards'
  addMigration(db, migrationName, [
    'ALTER TABLE `AffiliateBanner` ADD COLUMN `guardNullable` VARCHAR(191) NULL;',
    'SELECT * FROM `RecoveryMissingTable`;',
  ].join('\n'))
  const migration = readMigrationFiles(db.prismaDir).find((file) => file.name === migrationName)
  const deploy = await db.prisma(['migrate', 'deploy'])
  assert.notEqual(deploy.code, 0)

  const partialRuntime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const partialSnapshot = await readDbSnapshot(partialRuntime)
  await partialRuntime.close()

  const stateRoot = join(db.root, 'state-recovery-guards')
  const attempt = {
    format: 1,
    id: 'attempt-recovery-guards',
    sha: 'b'.repeat(40),
    runId: '88',
    runAttempt: '1',
    identity: baseSnapshot.identity,
    pending: [{ name: migration.name, checksum: migration.checksum, sqlPath: migration.sqlPath }],
    backupId: 'backup-before-recovery',
    phase: 'failed',
    recovery: null,
    process: { pid: 99999999, processGroupId: 99999998, command: 'node', startedAt: new Date().toISOString() },
  }
  await writeAttempt(stateRoot, attempt)

  const recoveryId = 'reviewed-guards'
  const recoveryDir = join(db.backendDir, 'prisma', 'recovery', recoveryId)
  mkdirSync(recoveryDir, { recursive: true })
  const outsideSql = join(db.root, 'outside-revert.sql')
  const sql = 'ALTER TABLE `AffiliateBanner` DROP COLUMN `guardNullable`;\n'
  writeFileSync(outsideSql, sql)
  symlinkSync(outsideSql, join(recoveryDir, 'revert.sql'))

  const recovery = {
    format: 1,
    id: recoveryId,
    targetSha: attempt.sha,
    targetAttemptId: attempt.id,
    migrationName,
    checksum: migration.checksum,
    beforeFingerprint: '0'.repeat(64),
    outcome: 'reverted',
    targetPrefixLength: baseFiles.length,
    sqlFile: 'revert.sql',
    sqlSha256: sha256(sql),
    backupTables: ['AffiliateBanner'],
    postconditions: [],
  }
  writeFileSync(join(recoveryDir, 'recovery.json'), JSON.stringify(recovery, null, 2))

  await assert.rejects(
    () => recoverAttempt({
      backendDir: db.backendDir,
      prismaDir: db.prismaDir,
      stateRoot,
      evidenceDir,
      sha: 'c'.repeat(40),
      runId: '89',
      runAttempt: '1',
      expectedDb: baseSnapshot.identity,
      databaseUrl: db.url,
    }, recoveryId),
    /RECOVERY_FINGERPRINT/,
  )

  writeFileSync(join(recoveryDir, 'recovery.json'), JSON.stringify({
    ...recovery,
    beforeFingerprint: partialSnapshot.fingerprint,
  }, null, 2))

  await assert.rejects(
    () => recoverAttempt({
      backendDir: db.backendDir,
      prismaDir: db.prismaDir,
      stateRoot,
      evidenceDir,
      sha: 'c'.repeat(40),
      runId: '89',
      runAttempt: '1',
      expectedDb: baseSnapshot.identity,
      databaseUrl: db.url,
    }, recoveryId),
    /RECOVERY_SQL_PATH_SYMLINK/,
  )
})

test('audit rejects unknown UUID for unreviewed production database name', async (t) => {
  const db = await createMysqlFixture(t, 'unknown-uuid')
  const seeded = await db.seedLegacyShape()

  await assert.rejects(
    () => auditDatabase({
      ...seeded.auditContext,
      expectedDatabase: 'ilsangkit_staging',
      expectedServerUuid: null,
    }),
    /AUDIT_DATABASE/,
  )
})

function addMigration(db, name, sql) {
  const dir = join(db.prismaDir, 'migrations', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'migration.sql'), `${sql.trim()}\n`)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
