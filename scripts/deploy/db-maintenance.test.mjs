import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { auditDatabase, recoverAttempt, reconcileDatabase } from './db-maintenance.mjs'

test('audit context allows only reviewed production DB or explicit fixture prefix for unknown UUID', async () => {
  const context = {
    backendDir: '/tmp/backend',
    stateRoot: mkdtempSync(join(tmpdir(), 'db-maintenance-state-')),
    evidenceDir: '/tmp/evidence',
    sha: 'a'.repeat(40),
    runId: '1',
    runAttempt: '1',
    expectedDatabase: 'wrongdb',
    expectedServerUuid: null,
    databaseUrl: 'mysql://user:pass@127.0.0.1:3306/wrongdb',
  }

  await assert.rejects(() => auditDatabase(context), /AUDIT_DATABASE/)
})

test('CLI rejects arbitrary SQL and requires IDs for reconcile and recover', async () => {
  const script = new URL('./db-maintenance.mjs', import.meta.url).pathname
  const { spawnSync } = await import('node:child_process')

  assert.equal(spawnSync(process.execPath, [script, 'audit', '--sql', 'SELECT 1'], { encoding: 'utf8' }).status, 2)
  assert.equal(spawnSync(process.execPath, [script, 'reconcile'], { encoding: 'utf8' }).status, 2)
  assert.equal(spawnSync(process.execPath, [script, 'recover'], { encoding: 'utf8' }).status, 2)
})



test('CLI parses dotenv env files with export/comments and reports fixed error codes', async () => {
  const script = new URL('./db-maintenance.mjs', import.meta.url).pathname
  const { spawnSync } = await import('node:child_process')
  const root = mkdtempSync(join(tmpdir(), 'db-maintenance-cli-env-'))
  const envFile = join(root, '.env')
  writeFileSync(envFile, 'export DATABASE_URL="mysql://user:secret@127.0.0.1:3306/not_ilsangkit" # reviewed parser case\n')

  const result = spawnSync(process.execPath, [script, 'audit'], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DB_BACKEND_DIR: join(root, 'backend'),
      DB_ENV_FILE: envFile,
      DB_STATE_ROOT: join(root, 'state'),
      MIGRATION_EVIDENCE_DIR: join(root, 'evidence'),
      TESTED_SHA: 'b'.repeat(40),
      TEST_RUN_ID: '1',
      TEST_RUN_ATTEMPT: '1',
    },
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /^CLI_DATABASE\n$/)
  assert.doesNotMatch(result.stderr, /secret|mysql:\/\//)
})

test('recover requires reviewed recovery metadata and proof that the DB operation ended', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-maintenance-recovery-'))
  const backendDir = join(root, 'backend')
  const recoveryDir = join(backendDir, 'prisma', 'recovery', 'reviewed')
  mkdirSync(recoveryDir, { recursive: true })
  writeFileSync(join(recoveryDir, 'recovery.json'), JSON.stringify({
    format: 1,
    id: 'reviewed',
    targetSha: 'b'.repeat(40),
    targetAttemptId: 'attempt-one',
    migrationName: '202610090001_future',
    checksum: 'c'.repeat(64),
    beforeFingerprint: 'a'.repeat(64),
    outcome: 'applied',
    targetPrefixLength: 7,
    backupTables: [],
    postconditions: [],
  }, null, 2))

  const stateRoot = join(root, 'state')
  mkdirSync(join(stateRoot, 'attempts'), { recursive: true })
  writeFileSync(join(stateRoot, 'attempts', 'attempt-one.json'), JSON.stringify({
    format: 1,
    id: 'attempt-one',
    sha: 'b'.repeat(40),
    runId: '1',
    runAttempt: '1',
    identity: { database: 'ilsangkit_migration_test_recovery', serverUuid: 'uuid' },
    pending: [{ name: '202610090001_future', checksum: 'c'.repeat(64), sqlPath: '/tmp/migration.sql' }],
    backupId: 'backup-one',
    phase: 'unknown',
    recovery: null,
    process: {},
  }, null, 2))

  await assert.rejects(
    () => recoverAttempt({
      backendDir,
      stateRoot,
      evidenceDir: join(root, 'evidence'),
      sha: 'b'.repeat(40),
      runId: '1',
      runAttempt: '1',
      expectedDb: { database: 'ilsangkit_migration_test_recovery', serverUuid: 'uuid' },
      databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_recovery',
    }, 'reviewed'),
    /RECOVERY_PROCESS_PROOF/,
  )
})


test('recover binds reviewed targetSha to original attempt, not current candidate SHA', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-maintenance-target-sha-'))
  const backendDir = join(root, 'backend')
  const recoveryDir = join(backendDir, 'prisma', 'recovery', 'reviewed')
  mkdirSync(recoveryDir, { recursive: true })
  writeFileSync(join(recoveryDir, 'recovery.json'), JSON.stringify({
    format: 1,
    id: 'reviewed',
    targetSha: 'c'.repeat(40),
    targetAttemptId: 'attempt-one',
    migrationName: '202610090001_future',
    checksum: 'd'.repeat(64),
    beforeFingerprint: 'a'.repeat(64),
    outcome: 'applied',
    targetPrefixLength: 7,
    backupTables: [],
    postconditions: [],
  }, null, 2))

  const stateRoot = join(root, 'state')
  mkdirSync(join(stateRoot, 'attempts'), { recursive: true })
  writeFileSync(join(stateRoot, 'attempts', 'attempt-one.json'), JSON.stringify({
    format: 1,
    id: 'attempt-one',
    sha: 'b'.repeat(40),
    runId: '1',
    runAttempt: '1',
    identity: { database: 'ilsangkit_migration_test_recovery', serverUuid: 'uuid' },
    pending: [{ name: '202610090001_future', checksum: 'd'.repeat(64), sqlPath: '/tmp/migration.sql' }],
    backupId: 'backup-one',
    phase: 'unknown',
    recovery: null,
    process: { pid: 99999999 },
  }, null, 2))

  await assert.rejects(
    () => recoverAttempt({
      backendDir,
      stateRoot,
      evidenceDir: join(root, 'evidence'),
      sha: 'e'.repeat(40),
      runId: '2',
      runAttempt: '1',
      expectedDb: { database: 'ilsangkit_migration_test_recovery', serverUuid: 'uuid' },
      databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_recovery',
    }, 'reviewed'),
    /RECOVERY_TARGET_SHA/,
  )
})


test('recover requires a reviewed 64-hex beforeFingerprint', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-maintenance-fingerprint-'))
  const backendDir = join(root, 'backend')
  const recoveryDir = join(backendDir, 'prisma', 'recovery', 'reviewed')
  mkdirSync(recoveryDir, { recursive: true })
  writeFileSync(join(recoveryDir, 'recovery.json'), JSON.stringify({
    format: 1,
    id: 'reviewed',
    targetSha: 'b'.repeat(40),
    targetAttemptId: 'attempt-one',
    migrationName: '202610090001_future',
    checksum: 'c'.repeat(64),
    outcome: 'applied',
    targetPrefixLength: 7,
    backupTables: [],
    postconditions: [],
  }, null, 2))

  await assert.rejects(
    () => recoverAttempt({
      backendDir,
      stateRoot: join(root, 'state'),
      evidenceDir: join(root, 'evidence'),
      sha: 'b'.repeat(40),
      runId: '1',
      runAttempt: '1',
      expectedDb: { database: 'ilsangkit_migration_test_recovery', serverUuid: 'uuid' },
      databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_recovery',
    }, 'reviewed'),
    /RECOVERY_FINGERPRINT/,
  )
})

test('recover reads recovery JSON only from backend prisma recovery and rejects symlinked JSON', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-maintenance-recovery-path-'))
  const backendDir = join(root, 'backend')
  const recoveryDir = join(backendDir, 'prisma', 'recovery', 'reviewed')
  const outside = join(root, 'outside')
  mkdirSync(recoveryDir, { recursive: true })
  mkdirSync(outside, { recursive: true })
  writeFileSync(join(outside, 'recovery.json'), JSON.stringify({ format: 1, id: 'reviewed' }))
  symlinkSync(join(outside, 'recovery.json'), join(recoveryDir, 'recovery.json'))

  await assert.rejects(
    () => recoverAttempt({
      backendDir,
      stateRoot: join(root, 'state'),
      evidenceDir: join(root, 'evidence'),
      sha: 'b'.repeat(40),
      runId: '1',
      runAttempt: '1',
      expectedDb: { database: 'ilsangkit_migration_test_recovery', serverUuid: 'uuid' },
      databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_recovery',
    }, 'reviewed'),
    /RECOVERY_PATH_SYMLINK/,
  )
})

test('reconcile rejects symlinked audits path components under private state root', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-maintenance-audit-symlink-'))
  const stateRoot = join(root, 'state')
  const outsideAudits = join(root, 'outside-audits')
  mkdirSync(stateRoot, { recursive: true })
  mkdirSync(outsideAudits, { recursive: true })
  symlinkSync(outsideAudits, join(stateRoot, 'audits'))
  writeFileSync(join(outsideAudits, 'audit-one.json'), JSON.stringify({ format: 1 }))

  await assert.rejects(
    () => reconcileDatabase({
      backendDir: join(root, 'backend'),
      stateRoot,
      evidenceDir: join(root, 'evidence'),
      sha: 'b'.repeat(40),
      runId: '1',
      runAttempt: '1',
      expectedDb: { database: 'ilsangkit_migration_test_reconcile', serverUuid: 'uuid' },
      databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_reconcile',
    }, 'audit-one'),
    /AUDIT_PATH_SYMLINK/,
  )
})
