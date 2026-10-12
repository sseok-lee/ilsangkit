import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { assertNoUnresolvedAttempts, readAttempts, runMigrationGate } from './db-migration-gate.mjs'
import { createMysqlFixture } from './fixtures/db-mysql.mjs'

const currentFile = fileURLToPath(import.meta.url)
const deployDir = dirname(currentFile)

test('failed migration can leave partial DDL and failed Prisma ledger evidence', async (t) => {
  const db = await createMysqlFixture(t, 'gate-partial')
  assert.equal((await db.prisma(['migrate', 'deploy'])).code, 0)
  addMigration(db, '202610090001_gate_partial_failure', `
    SET SESSION lock_wait_timeout = 5;
    ALTER TABLE \`AffiliateBanner\` ADD COLUMN \`gatePartialColumn\` VARCHAR(191) NULL;
    SELECT * FROM \`GateMissingTable\`;
  `)

  const result = await db.prisma(['migrate', 'deploy'])
  assert.notEqual(result.code, 0)

  const columns = await db.query(
    `SELECT column_name AS columnName
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = "AffiliateBanner"
        AND column_name = "gatePartialColumn"`,
  )
  assert.deepEqual(columns.map((row) => row.columnName), ['gatePartialColumn'])

  const ledger = await db.query(
    `SELECT migration_name AS migrationName, finished_at AS finishedAt, rolled_back_at AS rolledBackAt
       FROM _prisma_migrations
      WHERE migration_name = "202610090001_gate_partial_failure"`,
  )
  assert.equal(ledger.length, 1)
  assert.equal(ledger[0].finishedAt, null)
  assert.equal(ledger[0].rolledBackAt, null)
})

test('SET SESSION lock_wait_timeout bounds a real metadata lock wait', async (t) => {
  const db = await createMysqlFixture(t, 'gate-lock')
  assert.equal((await db.prisma(['migrate', 'deploy'])).code, 0)
  addMigration(db, '202610090001_gate_lock_wait', `
    SET SESSION lock_wait_timeout = 5;
    ALTER TABLE \`AffiliateBanner\` ADD COLUMN \`gateLockedColumn\` INTEGER NULL;
  `)

  const locker = holdMetadataLock(db.url, 'AffiliateBanner', 12)
  t.after(async () => {
    if (!locker.closed) {
      locker.child.kill('SIGTERM')
      await locker.done
    }
  })
  await locker.ready

  const started = Date.now()
  const result = await db.prisma(['migrate', 'deploy'])
  const elapsedMs = Date.now() - started
  locker.release()
  await locker.done

  assert.notEqual(result.code, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /Lock wait timeout exceeded/i)
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /advisory/i)
  assert.ok(elapsedMs >= 4000, `expected lock wait around 5s, got ${elapsedMs}ms`)
  assert.ok(elapsedMs < 15000, `lock wait should be bounded, got ${elapsedMs}ms`)

  const columns = await db.query(
    `SELECT column_name AS columnName
       FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = "AffiliateBanner"
        AND column_name = "gateLockedColumn"`,
  )
  assert.deepEqual(columns, [])
})

test('killed real gate between postcheck and verified leaves applying attempt and blocks new SHA', async () => {
  const stateRoot = mkdtempSync(join(tmpdir(), 'db-gate-kill-'))
  const scriptPath = join(stateRoot, 'child.mjs')
  const markerPath = join(stateRoot, 'postcheck-entered')
  writeFileSync(scriptPath, `
    import { runMigrationGate } from ${JSON.stringify(join(deployDir, 'db-migration-gate.mjs'))};
    await runMigrationGate({
      backendDir: '/fixture/backend',
      stateRoot: ${JSON.stringify(stateRoot)},
      evidenceDir: '/fixture/evidence',
      sha: '${'c'.repeat(40)}',
      runId: '200',
      runAttempt: '1',
      expectedDb: { database: 'ilsangkit_migration_test_gate', serverUuid: 'test-server' },
    }, {
      preflight: async () => ({
        pending: [{ name: '202610090001_killed', checksum: '${'d'.repeat(64)}', sqlPath: '/fixture/migration.sql' }],
        attemptBase: { id: 'killed-attempt', identity: { database: 'ilsangkit_migration_test_gate', serverUuid: 'test-server' } },
      }),
      backup: async () => ({ id: 'backup-killed' }),
      migrate: async (_context, _attempt, hooks) => {
        await hooks.recordProcess({ pid: process.pid, command: 'node', startedAt: new Date().toISOString(), exitCode: null, signal: null });
        return { code: 0, stdout: '', stderr: '', process: { pid: process.pid, command: 'node', exitCode: 0, signal: null } };
      },
      postcheck: async () => {
        await import('node:fs').then(({ writeFileSync }) => writeFileSync(${JSON.stringify(markerPath)}, String(process.pid)));
        setInterval(() => {}, 1000);
        await new Promise(() => {});
      },
    });
  `)

  const child = spawn(process.execPath, [scriptPath], {
    stdio: ['ignore', 'ignore', 'pipe'],
  })
  let stderr = ''
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  await waitForFile(markerPath)
  child.kill('SIGTERM')
  await new Promise((resolve) => child.once('close', resolve))

  assert.equal(stderr, '')
  const attempts = await readAttempts(stateRoot)
  assert.equal(attempts.length, 1)
  assert.equal(attempts[0].phase, 'applying')
  assert.equal(attempts[0].process.pid, Number(readFileSync(markerPath, 'utf8')))
  assert.throws(() => assertNoUnresolvedAttempts(attempts), /UNRESOLVED_ATTEMPT:killed-attempt/)

  await assert.rejects(runMigrationGate({
    backendDir: '/fixture/backend',
    stateRoot,
    evidenceDir: '/fixture/evidence',
    sha: 'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee',
    runId: '201',
    runAttempt: '1',
    expectedDb: { database: 'ilsangkit_migration_test_gate', serverUuid: 'test-server' },
  }, {
    preflight: async (context) => {
      assertNoUnresolvedAttempts(await readAttempts(context.stateRoot))
      return { pending: [] }
    },
    backup: async () => ({ id: 'unused' }),
    migrate: async () => {},
    postcheck: async () => ({ applied: [] }),
  }), /UNRESOLVED_ATTEMPT:killed-attempt/)
})

function addMigration(db, name, sql) {
  const dir = join(db.prismaDir, 'migrations', name)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'migration.sql'), `${sql.trim()}\n`)
}

function holdMetadataLock(databaseUrl, tableName, seconds) {
  const parsed = new URL(databaseUrl)
  const escapedTable = tableName.replaceAll('`', '``')
  const child = spawn('mysql', [
    '--protocol=TCP',
    `--host=${parsed.hostname}`,
    `--port=${parsed.port || '3306'}`,
    `--user=${decodeURIComponent(parsed.username)}`,
    `--database=${decodeURIComponent(parsed.pathname.slice(1))}`,
    '--batch',
    '--raw',
    '--execute',
    `START TRANSACTION; SELECT * FROM \`${escapedTable}\` LIMIT 1; SELECT SLEEP(${Number(seconds)}); COMMIT;`,
  ], {
    env: {
      ...process.env,
      MYSQL_PWD: decodeURIComponent(parsed.password),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stderr = ''
  let closed = false
  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk) => { stderr += chunk })
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, 1000)
    child.once('exit', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`metadata lock exited before rehearsal: ${code}:${stderr}`))
    })
    child.once('error', reject)
  })
  const done = new Promise((resolve) => {
    child.on('close', () => {
      closed = true
      resolve()
    })
  })
  return {
    child,
    ready,
    done,
    release() {
      if (!closed) child.kill('SIGTERM')
    },
    get closed() { return closed },
  }
}

async function waitForFile(path) {
  await waitFor(() => {
    try {
      readFileSync(path)
      return true
    } catch {
      return false
    }
  }, 5000, () => `file not written: ${path}`)
}

async function waitFor(predicate, timeoutMs, message) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(typeof message === 'function' ? message() : message)
}
