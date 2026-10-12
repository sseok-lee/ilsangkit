import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { mkdir, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  assertNoUnresolvedAttempts,
  buildMigrationGateContextFromEnv,
  deployMigrationGate,
  evaluatePolicyPostconditions,
  readAttempts,
  migrateDeploy,
  normalizePolicyPostconditions,
  runMigrationGate,
  verifyMigrationGate,
  writeAttempt,
} from './db-migration-gate.mjs'

const MIGRATION = { name: '202610090001_add_nullable', checksum: 'a'.repeat(64), sqlPath: '/fixture/migration.sql' }

function context(overrides = {}) {
  const root = mkdtempSync(join(tmpdir(), 'db-gate-'))
  return {
    backendDir: '/fixture/backend',
    stateRoot: join(root, 'state'),
    evidenceDir: join(root, 'evidence'),
    sha: 'f'.repeat(40),
    runId: '100',
    runAttempt: '2',
    expectedDb: { database: 'ilsangkit_migration_test_gate', serverUuid: 'test-server' },
    ...overrides,
  }
}

test('pending-free gate only preflights and postchecks', async () => {
  const events = []
  const result = await runMigrationGate(context(), {
    preflight: async () => {
      events.push('preflight')
      return { pending: [], attemptBase: { id: 'attempt-empty', identity: { database: 'db', serverUuid: 'server' } } }
    },
    backup: async () => events.push('backup'),
    persist: async () => events.push('persist'),
    migrate: async () => events.push('migrate'),
    postcheck: async () => {
      events.push('postcheck')
      return { applied: [] }
    },
  })

  assert.deepEqual(result, { db: 'verified', applied: [] })
  assert.deepEqual(events, ['preflight', 'postcheck'])
})

test('backup failure prevents the Prisma call', async () => {
  const events = []
  const deps = {
    preflight: async () => ({ pending: [MIGRATION], attemptBase: { id: 'attempt-backup', identity: { database: 'db', serverUuid: 'server' } } }),
    backup: async () => { events.push('backup'); throw new Error('BACKUP_FAILED') },
    persist: async () => events.push('persist'),
    migrate: async () => events.push('migrate'),
    postcheck: async () => events.push('postcheck'),
  }

  await assert.rejects(runMigrationGate(context(), deps), /BACKUP_FAILED/)
  assert.deepEqual(events, ['backup'])
})

test('beforeApply failure after backup prevents durable attempt and Prisma call', async () => {
  const events = []
  await assert.rejects(runMigrationGate(context(), {
    preflight: async () => ({ pending: [MIGRATION], attemptBase: { id: 'attempt-before-apply', identity: { database: 'db', serverUuid: 'server' } } }),
    backup: async () => { events.push('backup'); return { id: 'backup-before-apply' } },
    beforeApply: async () => { events.push('beforeApply'); throw new Error('STALE_MAIN') },
    persist: async () => events.push('persist'),
    migrate: async () => events.push('migrate'),
    postcheck: async () => events.push('postcheck'),
  }), /STALE_MAIN/)
  assert.deepEqual(events, ['backup', 'beforeApply'])
})

test('pending gate persists applying before migrate and verified after postcheck', async () => {
  const events = []
  const attempts = []
  const result = await runMigrationGate(context(), {
    preflight: async () => {
      events.push('preflight')
      return { pending: [MIGRATION], attemptBase: { id: 'attempt-success', identity: { database: 'db', serverUuid: 'server' } } }
    },
    backup: async (_context, pending) => {
      events.push(`backup:${pending.map((migration) => migration.name).join(',')}`)
      return { id: 'backup-1' }
    },
    persist: async (attempt) => {
      events.push(`persist:${attempt.phase}`)
      attempts.push(structuredClone(attempt))
    },
    migrate: async () => events.push('migrate'),
    postcheck: async () => {
      events.push('postcheck')
      return { applied: [MIGRATION.name] }
    },
  })

  assert.deepEqual(result, { db: 'verified', applied: [MIGRATION.name] })
  assert.deepEqual(events, [
    'preflight',
    `backup:${MIGRATION.name}`,
    'persist:applying',
    'migrate',
    'postcheck',
    'persist:verified',
  ])
  assert.equal(attempts[0].phase, 'applying')
  assert.equal(attempts[0].backupId, 'backup-1')
  assert.deepEqual(attempts[0].pending, [MIGRATION])
  assert.equal(attempts[1].phase, 'verified')
})

test('migrate failure records failed attempt without claiming rollback', async () => {
  const attempts = []

  await assert.rejects(runMigrationGate(context(), {
    preflight: async () => ({ pending: [MIGRATION], attemptBase: { id: 'attempt-failed', identity: { database: 'db', serverUuid: 'server' } } }),
    backup: async () => ({ id: 'backup-2' }),
    persist: async (attempt) => attempts.push(structuredClone(attempt)),
    migrate: async () => { throw new Error('MIGRATE_DEPLOY_FAILED') },
    postcheck: async () => { throw new Error('POSTCHECK_SHOULD_NOT_RUN') },
  }), /MIGRATE_DEPLOY_FAILED/)

  assert.deepEqual(attempts.map((attempt) => attempt.phase), ['applying', 'failed'])
  assert.equal(attempts[1].recovery, null)
  assert.match(attempts[1].failure.message, /MIGRATE_DEPLOY_FAILED/)
  assert.equal(attempts[1].process, null)
})

test('verified persist failure leaves the applying record unresolved', async () => {
  const attempts = []

  await assert.rejects(runMigrationGate(context(), {
    preflight: async () => ({ pending: [MIGRATION], attemptBase: { id: 'attempt-verified-fail', identity: { database: 'db', serverUuid: 'server' } } }),
    backup: async () => ({ id: 'backup-3' }),
    persist: async (attempt) => {
      attempts.push(structuredClone(attempt))
      if (attempt.phase === 'verified') throw new Error('PERSIST_VERIFIED_FAILED')
    },
    migrate: async () => {},
    postcheck: async () => ({ applied: [MIGRATION.name] }),
  }), /PERSIST_VERIFIED_FAILED/)

  assert.deepEqual(attempts.map((attempt) => attempt.phase), ['applying', 'verified'])
})

test('writeAttempt stores 0600 attempts atomically and refuses overwrite or unsafe ids', async () => {
  const stateRoot = context().stateRoot
  const attempt = {
    format: 1,
    id: 'attempt-1',
    sha: 'f'.repeat(40),
    runId: '100',
    runAttempt: '2',
    identity: { database: 'db', serverUuid: 'server' },
    pending: [MIGRATION],
    backupId: 'backup-1',
    phase: 'applying',
    recovery: null,
    process: { pid: 123, command: 'node', startedAt: '2026-10-08T00:00:00.000Z' },
  }

  await writeAttempt(stateRoot, attempt)

  const attempts = await readAttempts(stateRoot)
  assert.deepEqual(attempts, [attempt])
  assert.equal((statSync(stateRoot).mode & 0o777), 0o700)
  const attemptPath = join(stateRoot, 'attempts', `${attempt.id}.json`)
  assert.equal((statSync(attemptPath).mode & 0o777), 0o600)
  assert.deepEqual(JSON.parse(await readFile(attemptPath, 'utf8')), attempt)
  await assert.rejects(() => writeAttempt(stateRoot, attempt), /ATTEMPT_EXISTS/)
  await assert.rejects(() => writeAttempt(stateRoot, { ...attempt, id: '../bad' }), /ATTEMPT_ID/)
})

test('writeAttempt rejects symlinked state paths without writing outside', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-gate-symlink-'))
  const outside = mkdtempSync(join(tmpdir(), 'db-gate-outside-'))
  const linkedStateRoot = join(root, 'state-link')
  symlinkSync(outside, linkedStateRoot, 'dir')
  const attempt = {
    format: 1,
    id: 'attempt-symlink',
    sha: 'f'.repeat(40),
    runId: '100',
    runAttempt: '2',
    identity: { database: 'db', serverUuid: 'server' },
    pending: [MIGRATION],
    backupId: 'backup-1',
    phase: 'applying',
    recovery: null,
    process: null,
  }

  await assert.rejects(() => writeAttempt(linkedStateRoot, attempt), /STATE_ROOT_SYMLINK/)
  assert.equal(existsSync(join(outside, 'attempts', 'attempt-symlink.json')), false)

  const stateRoot = join(root, 'state')
  mkdirSync(stateRoot, { recursive: true })
  symlinkSync(outside, join(stateRoot, 'attempts'), 'dir')
  await assert.rejects(() => writeAttempt(stateRoot, { ...attempt, id: 'attempt-symlink-attempts' }), /ATTEMPTS_DIR_SYMLINK/)
  assert.equal(existsSync(join(outside, 'attempt-symlink-attempts.json')), false)
})

test('writeAttempt allows validated same-attempt phase transitions without arbitrary overwrite', async () => {
  const stateRoot = context().stateRoot
  const applying = {
    format: 1,
    id: 'attempt-transition',
    sha: 'f'.repeat(40),
    runId: '100',
    runAttempt: '2',
    identity: { database: 'db', serverUuid: 'server' },
    pending: [MIGRATION],
    backupId: 'backup-1',
    phase: 'applying',
    recovery: null,
    process: null,
  }

  await writeAttempt(stateRoot, applying)
  await writeAttempt(stateRoot, { ...applying, process: { pid: 321, command: 'node', startedAt: '2026-10-08T00:00:01.000Z' } })
  await writeAttempt(stateRoot, { ...applying, phase: 'verified', verifiedAt: '2026-10-08T00:00:02.000Z' })

  const attempts = await readAttempts(stateRoot)
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].phase, 'verified')
  assert.equal(attempts[0].process.pid, 321)
  assert.deepEqual(attempts[0].pending, [MIGRATION])
  await assert.rejects(() => writeAttempt(stateRoot, { ...applying, phase: 'applying', id: 'attempt-transition' }), /ATTEMPT_EXISTS/)
  await assert.rejects(() => writeAttempt(stateRoot, { ...applying, phase: 'failed', backupId: 'other-backup' }), /ATTEMPT_IMMUTABLE_backupId/)
})

test('readAttempts fails closed on corrupt records and symlinks', async () => {
  const stateRoot = context().stateRoot
  await mkdir(join(stateRoot, 'attempts'), { recursive: true, mode: 0o700 })
  writeFileSync(join(stateRoot, 'attempts', 'bad.json'), '{not-json')
  await assert.rejects(() => readAttempts(stateRoot), /ATTEMPT_CORRUPT:bad\.json/)

  const symlinkRoot = context().stateRoot
  await mkdir(join(symlinkRoot, 'attempts'), { recursive: true, mode: 0o700 })
  writeFileSync(join(symlinkRoot, 'real.json'), '{}')
  symlinkSync(join(symlinkRoot, 'real.json'), join(symlinkRoot, 'attempts', 'link.json'))
  await assert.rejects(() => readAttempts(symlinkRoot), /ATTEMPT_SYMLINK:link\.json/)

  const malformedRoot = context().stateRoot
  await mkdir(join(malformedRoot, 'attempts'), { recursive: true, mode: 0o700 })
  writeFileSync(join(malformedRoot, 'attempts', 'malformed.json'), JSON.stringify({ format: 1, id: 'malformed', phase: 'weird' }))
  await assert.rejects(() => readAttempts(malformedRoot), /ATTEMPT_PHASE/)
})

test('runMigrationGate default filesystem persist records successful same-id transition', async () => {
  const ctx = context()
  const result = await runMigrationGate(ctx, {
    preflight: async () => ({ pending: [MIGRATION], attemptBase: { id: 'attempt-fs-success', identity: { database: 'db', serverUuid: 'server' } } }),
    backup: async () => ({ id: 'backup-fs-success' }),
    migrate: async (_ctx, _attempt, hooks) => {
      await hooks.recordProcess({ pid: 456, command: 'node', startedAt: '2026-10-08T00:00:00.000Z', exitCode: null, signal: null })
      return { code: 0, stdout: 'ok', stderr: '', process: { pid: 456, command: 'node', exitCode: 0, signal: null } }
    },
    postcheck: async () => ({ applied: [MIGRATION.name] }),
  })

  assert.deepEqual(result, { db: 'verified', applied: [MIGRATION.name] })
  const attempts = await readAttempts(ctx.stateRoot)
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].phase, 'verified')
  assert.equal(attempts[0].process.pid, 456)
})

test('runMigrationGate default filesystem persist records failed postcheck unresolved', async () => {
  const ctx = context()
  await assert.rejects(runMigrationGate(ctx, {
    preflight: async () => ({ pending: [MIGRATION], attemptBase: { id: 'attempt-fs-failed', identity: { database: 'db', serverUuid: 'server' } } }),
    backup: async () => ({ id: 'backup-fs-failed' }),
    migrate: async () => ({ code: 0, stdout: '', stderr: '', process: { pid: 789, command: 'node', exitCode: 0, signal: null } }),
    postcheck: async () => { throw new Error('POSTCHECK_FAILED') },
  }), /POSTCHECK_FAILED/)

  const attempts = await readAttempts(ctx.stateRoot)
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].phase, 'failed')
  assert.equal(attempts[0].failure.timeoutDoesNotImplyRollback, true)
  assert.throws(() => assertNoUnresolvedAttempts(attempts), /UNRESOLVED_ATTEMPT:attempt-fs-failed/)
})

test('unresolved attempts block every SHA until recovered or verified', () => {
  const applying = { id: 'old-applying', sha: '0'.repeat(40), phase: 'applying', recovery: null }
  const failed = { id: 'old-failed', sha: '1'.repeat(40), phase: 'failed', recovery: null }
  const unknown = { id: 'old-unknown', sha: '2'.repeat(40), phase: 'unknown', recovery: null }

  assert.throws(() => assertNoUnresolvedAttempts([applying]), /UNRESOLVED_ATTEMPT:old-applying/)
  assert.throws(() => assertNoUnresolvedAttempts([failed]), /UNRESOLVED_ATTEMPT:old-failed/)
  assert.throws(() => assertNoUnresolvedAttempts([unknown]), /UNRESOLVED_ATTEMPT:old-unknown/)
  assert.doesNotThrow(() => assertNoUnresolvedAttempts([
    { ...failed, recovery: { outcome: 'applied', evidenceId: 'evidence-1' } },
    { id: 'verified', sha: '3'.repeat(40), phase: 'verified', recovery: null },
    { id: 'recovered', sha: '4'.repeat(40), phase: 'recovered', recovery: { outcome: 'reverted', evidenceId: 'evidence-2' } },
  ]))
})



test('missing baseline fails closed unless explicit loopback fixture escape is set', async () => {
  await assert.rejects(verifyMigrationGate(context(), {
    preflight: async () => ({ pending: [] }),
    postcheck: async () => ({ applied: [] }),
  }), /BASELINE_REQUIRED/)

  const ctx = context({
    databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_gate',
    allowMissingBaseline: true,
    allowMissingActiveState: true,
  })
  const result = await verifyMigrationGate(ctx, {
    preflight: async () => ({ pending: [] }),
    postcheck: async () => ({ applied: [] }),
  })
  assert.deepEqual(result, { db: 'verified', applied: [] })

  await assert.rejects(verifyMigrationGate(context({
    databaseUrl: 'mysql://user:pass@127.0.0.1:3306/not_a_test_db',
    allowMissingBaseline: true,
    allowMissingActiveState: true,
  }), {
    preflight: async () => ({ pending: [] }),
    postcheck: async () => ({ applied: [] }),
  }), /BASELINE_REQUIRED/)
})

test('verifyMigrationGate runs preflight unresolved and manifest checks before postcheck', async () => {
  const events = []
  const result = await verifyMigrationGate(context({ databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_gate', allowMissingBaseline: true, allowMissingActiveState: true }), {
    preflight: async () => {
      events.push('preflight')
      return { pending: [] }
    },
    postcheck: async () => {
      events.push('postcheck')
      return { applied: ['baseline'] }
    },
  })

  assert.deepEqual(result, { db: 'verified', applied: ['baseline'] })
  assert.deepEqual(events, ['preflight', 'postcheck'])

  await assert.rejects(verifyMigrationGate(context({ databaseUrl: 'mysql://user:pass@127.0.0.1:3306/ilsangkit_migration_test_gate', allowMissingBaseline: true, allowMissingActiveState: true }), {
    preflight: async () => ({ pending: [MIGRATION] }),
    postcheck: async () => { throw new Error('POSTCHECK_SHOULD_NOT_RUN') },
  }), /VERIFY_PENDING/)
})

test('CLI env context requires verified baseline UUID and active app SHA', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-gate-cli-'))
  const stateRoot = join(root, 'state')
  mkdirSync(stateRoot, { recursive: true })
  writeFileSync(join(stateRoot, 'baseline.json'), JSON.stringify({
    format: 1,
    status: 'verified',
    identity: { database: 'ilsangkit', serverUuid: 'server-from-baseline' },
  }))
  const activeSha = 'a'.repeat(40)
  writeFileSync(join(stateRoot, 'active-app.json'), JSON.stringify({ fullSha: activeSha, releaseId: `fixed-${activeSha.slice(0, 12)}` }))
  writeFileSync(join(stateRoot, 'active-readiness.json'), JSON.stringify({ ready: true, releaseId: `fixed-${activeSha.slice(0, 12)}`, db: { ok: true } }))

  const ctx = buildMigrationGateContextFromEnv({
    DB_GATE_BACKEND_DIR: '/fixture/backend',
    DB_GATE_STATE_ROOT: stateRoot,
    DB_GATE_EVIDENCE_DIR: '/fixture/evidence',
    DB_GATE_SHA: 'f'.repeat(40),
    DB_GATE_RUN_ID: '300',
    DB_GATE_RUN_ATTEMPT: '1',
    DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/ilsangkit',
  })

  assert.deepEqual(ctx.expectedDb, { database: 'ilsangkit', serverUuid: 'server-from-baseline' })
  assert.equal(ctx.stateRoot, stateRoot)
  assert.equal(ctx.actualActiveSha, activeSha)

  const badActiveRoot = mkdtempSync(join(tmpdir(), 'db-gate-cli-bad-active-'))
  mkdirSync(badActiveRoot, { recursive: true })
  writeFileSync(join(badActiveRoot, 'baseline.json'), JSON.stringify({
    format: 1,
    status: 'verified',
    identity: { database: 'ilsangkit', serverUuid: 'server-from-baseline' },
  }))
  writeFileSync(join(badActiveRoot, 'active-app.json'), JSON.stringify({ fullSha: activeSha, releaseId: 'release-a' }))
  writeFileSync(join(badActiveRoot, 'active-readiness.json'), JSON.stringify({ ready: true, releaseId: 'release-a', db: { ok: true } }))
  assert.throws(() => buildMigrationGateContextFromEnv({
    DB_GATE_BACKEND_DIR: '/fixture/backend',
    DB_GATE_STATE_ROOT: badActiveRoot,
    DB_GATE_EVIDENCE_DIR: '/fixture/evidence',
    DB_GATE_SHA: 'f'.repeat(40),
    DB_GATE_RUN_ID: '300',
    DB_GATE_RUN_ATTEMPT: '1',
    DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/ilsangkit',
  }), /ACTIVE_APP_RELEASE/)

  const missingRoot = mkdtempSync(join(tmpdir(), 'db-gate-cli-missing-'))
  assert.throws(() => buildMigrationGateContextFromEnv({
    DB_GATE_BACKEND_DIR: '/fixture/backend',
    DB_GATE_STATE_ROOT: missingRoot,
    DB_GATE_EVIDENCE_DIR: '/fixture/evidence',
    DB_GATE_SHA: 'f'.repeat(40),
    DB_GATE_RUN_ID: '300',
    DB_GATE_RUN_ATTEMPT: '1',
    DATABASE_URL: 'mysql://user:pass@127.0.0.1:3306/ilsangkit',
  }), /BASELINE_REQUIRED/)
})

test('migrateDeploy records process identity before releasing Prisma SQL', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-gate-wrapper-'))
  const backendDir = join(root, 'backend')
  const prismaBuildDir = join(backendDir, 'node_modules/prisma/build')
  mkdirSync(prismaBuildDir, { recursive: true })
  const markerPath = join(root, 'prisma-ran')
  writeFileSync(join(backendDir, 'schema.prisma'), '')
  writeFileSync(join(prismaBuildDir, 'index.js'), `
    await import('node:fs').then(({ writeFileSync }) => writeFileSync(${JSON.stringify(markerPath)}, 'ran'));
    process.exit(0);
  `)
  const ctx = context({ backendDir, databaseUrl: 'mysql://user:pass@127.0.0.1:3306/db' })

  await assert.rejects(migrateDeploy(ctx, null, {
    recordProcess: async (processInfo) => {
      assert.equal(processInfo.detached, true)
      assert.equal(processInfo.processGroupId, processInfo.pid)
      throw new Error('PROCESS_PERSIST_FAILED')
    },
  }), /MIGRATE_DEPLOY/)

  assert.throws(() => statSync(markerPath), /ENOENT/)
})

test('policy postconditions support only declarative table and nullable column checks', () => {
  const conditions = normalizePolicyPostconditions([
    { type: 'table-exists', table: 'NewTable' },
    { type: 'nullable-column', table: 'AffiliateBanner', column: 'newNullable' },
  ], 'migration-a')
  assert.deepEqual(conditions, [
    { type: 'table-exists', table: 'NewTable' },
    { type: 'nullable-column', table: 'AffiliateBanner', column: 'newNullable' },
  ])
  evaluatePolicyPostconditions({
    tables: [{ name: 'NewTable' }, { name: 'AffiliateBanner' }],
    columns: [{ table: 'AffiliateBanner', name: 'newNullable', nullable: true }],
  }, conditions)
  assert.throws(() => normalizePolicyPostconditions([{ type: 'sql', sql: 'SELECT 1' }], 'migration-a'), /POLICY_POSTCONDITION_UNKNOWN/)
  assert.throws(() => evaluatePolicyPostconditions({ tables: [], columns: [] }, conditions), /POSTCONDITION_TABLE:NewTable/)
  assert.throws(() => evaluatePolicyPostconditions({
    tables: [{ name: 'NewTable' }, { name: 'AffiliateBanner' }],
    columns: [{ table: 'AffiliateBanner', name: 'newNullable', nullable: false }],
  }, conditions), /POSTCONDITION_NULLABLE_COLUMN:AffiliateBanner\.newNullable/)
})

test('production deploy and verify handlers are exported', () => {
  assert.equal(typeof deployMigrationGate, 'function')
  assert.equal(typeof verifyMigrationGate, 'function')
  assert.equal(typeof buildMigrationGateContextFromEnv, 'function')
  assert.equal(typeof normalizePolicyPostconditions, 'function')
  assert.equal(typeof evaluatePolicyPostconditions, 'function')
})
