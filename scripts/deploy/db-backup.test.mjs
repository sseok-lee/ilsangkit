import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  backupClosure,
  createBackup,
  createMysqlDefaultsFile,
  verifyBackup,
  rehearseBackupRestore,
  runTimedCommand,
} from './db-backup.mjs'

test('backupClosure includes transitive parents required for restoration', () => {
  const fks = [
    { child: 'Child', parent: 'Parent' },
    { child: 'Parent', parent: 'Root' },
  ]
  assert.deepEqual(backupClosure(['Child'], fks), ['Child', 'Parent', 'Root'])
  assert.deepEqual(backupClosure([], fks), [])
})

test('backupClosure handles cyclic FKs and duplicates deterministically', () => {
  const fks = [
    { child: 'LineItem', parent: 'Order' },
    { child: 'LineItem', parent: 'Order' },
    { child: 'Order', parent: 'Account' },
    { child: 'Account', parent: 'LineItem' },
    { child: 'Order', parent: 'Tenant' },
  ]
  assert.deepEqual(backupClosure(['LineItem', 'LineItem'], fks), [
    'LineItem',
    'Order',
    'Account',
    'Tenant',
  ])
})

test('backupClosure distinguishes new-table-only changes from existing data backups', () => {
  assert.deepEqual(backupClosure([], [
    { child: 'NewChild', parent: 'ExistingParent' },
  ]), [])
})

test('createMysqlDefaultsFile writes a private option file and escapes special password bytes', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'db-backup-unit-'))
  t.after(async () => {
    await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }))
  })
  const databaseUrl = new URL('mysql://user:p%40ss%0A%22quote%22%5Cslash@127.0.0.1:13317/app')
  const credential = await createMysqlDefaultsFile(databaseUrl, root)
  t.after(async () => credential.cleanup())

  const mode = (await stat(credential.path)).mode & 0o777
  assert.equal(mode, 0o600)
  const contents = await readFile(credential.path, 'utf8')
  assert.match(contents, /user="user"/)
  assert.match(contents, /password="p@ss\\n\\"quote\\"\\\\slash"/)
  assert.doesNotMatch(contents, /p@ss\n"quote"\\slash/)
})

test('runTimedCommand escalates to SIGKILL when a child ignores SIGTERM', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'db-backup-timeout-'))
  const script = join(root, 'ignore-term.mjs')
  await writeFile(script, 'process.on(\'SIGTERM\', () => {}); setInterval(() => {}, 1000)\n')
  const started = Date.now()
  const result = await runTimedCommand(process.execPath, [script], { timeoutMs: 50, killAfterMs: 50 })
  t.after(async () => {
    await import('node:fs/promises').then(({ rm }) => rm(root, { recursive: true, force: true }))
  })
  assert.equal(result.code, 124)
  assert.ok(Date.now() - started < 2_000)
})

test('createBackup can read DATABASE_URL from a dotenv file without putting secrets in argv', async (t) => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-dotenv-'))
  const envPath = join(stateRoot, '.env')
  const previous = process.env.DATABASE_URL
  delete process.env.DATABASE_URL
  t.after(() => {
    if (previous === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
  })
  await writeFile(envPath, 'DATABASE_URL=mysql://root:s3cr3t@127.0.0.1:13317/example\n')
  const calls = []
  await createBackup({
    context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1', envPath },
    runtime: fakeRuntime({ calls, databaseUrl: null }),
    tables: [],
    kind: 'migration',
  })
  assert.equal(calls.flatMap((call) => call.args).some((arg) => String(arg).includes('s3cr3t')), false)
})

test('createBackup returned backup object does not serialize source credentials', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-secret-return-'))
  const backup = await createBackup({
    context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
    runtime: fakeRuntime({ databaseUrl: 'mysql://root:secret-canary@127.0.0.1:13317/example' }),
    tables: [],
    kind: 'migration',
  })
  assert.doesNotMatch(JSON.stringify(backup), /secret-canary|mysql:\/\//)
})

test('createBackup uses runtime getDatabaseUrl and rejects source identity mismatch before dump', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-identity-'))
  const calls = []
  await assert.rejects(
    () => createBackup({
      context: {
        stateRoot,
        sha: 'abc123',
        runId: '7',
        runAttempt: '1',
        expectedDb: { database: 'expected_db', serverUuid: 'expected-server' },
      },
      runtime: fakeRuntime({
        calls,
        databaseUrl: null,
        getDatabaseUrl: () => 'mysql://root:p@127.0.0.1:13317/actual_db',
        identity: { databaseName: 'actual_db', serverUuid: 'actual-server' },
        tables: [{ name: 'Child', engine: 'InnoDB', bytes: 1 }],
      }),
      tables: ['Child'],
      kind: 'migration',
    }),
    /BACKUP_DB_IDENTITY/,
  )
  assert.equal(calls.length, 0)
})

test('createBackup does not create a data dump for new-table-only changes', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-new-only-'))
  const calls = []
  const backup = await createBackup({
    context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
    runtime: fakeRuntime({ calls }),
    tables: [],
    kind: 'migration',
  })

  assert.ok(existsSync(backup.files.schema))
  assert.equal((await stat(backup.dir)).mode & 0o777, 0o700)
  assert.equal((await stat(backup.files.schema)).mode & 0o777, 0o600)
  assert.equal((await stat(backup.files.ledger)).mode & 0o777, 0o600)
  assert.equal(backup.files.data, null)
  assert.equal(calls.some((call) => call.command === 'mysqldump' && call.args.includes('--single-transaction')), false)
})

test('createBackup fails before dumping when free space is insufficient', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-enospc-'))
  await assert.rejects(
    () => createBackup({
      context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
      runtime: fakeRuntime({
        tables: [{ name: 'Child', engine: 'InnoDB', bytes: 500_000 }],
        statfs: () => ({ bavail: 1, bsize: 4096 }),
      }),
      tables: ['Child'],
      kind: 'migration',
    }),
    /BACKUP_ENOSPC/,
  )
})

test('createBackup sanitizes dump failures and deletes temporary credential files', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-fail-'))
  const credentialPaths = []
  await assert.rejects(
    () => createBackup({
      context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
      runtime: fakeRuntime({
        tables: [{ name: 'Child', engine: 'InnoDB', bytes: 1 }],
        onCredentialFile: (path) => credentialPaths.push(path),
        run: async (command, args) => ({
          code: command === 'mysqldump' && args.includes('Child') ? 2 : 0,
          stdout: '',
          stderr: 'failed mysql://root:secret@127.0.0.1/db --password=secret',
        }),
      }),
      tables: ['Child'],
      kind: 'migration',
    }),
    (error) => {
      assert.match(error.message, /BACKUP_DUMP_FAILED/)
      assert.doesNotMatch(error.message, /secret/)
      return true
    },
  )
  assert.ok(credentialPaths.length > 0)
  assert.equal(credentialPaths.some((path) => existsSync(path)), false)
})

test('verifyBackup rejects checksum tampering', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-tamper-'))
  const backup = await createBackup({
    context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
    runtime: fakeRuntime(),
    tables: [],
    kind: 'reconcile',
  })
  backup.checksums.schema = '0'.repeat(64)
  await assert.rejects(() => verifyBackup(backup), /BACKUP_CHECKSUM/)
})

test('verifyBackup rejects missing checksums and unsafe file metadata without restoring', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-verify-'))
  const backup = await createBackup({
    context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
    runtime: fakeRuntime(),
    tables: [],
    kind: 'migration',
  })
  const withoutManifestChecksum = {
    ...backup,
    checksums: { ...backup.checksums, manifest: undefined },
  }
  await assert.rejects(() => verifyBackup(withoutManifestChecksum), /BACKUP_CHECKSUM_MISSING:manifest/)

  const escaped = {
    ...backup,
    files: { ...backup.files, schema: '/etc/hosts' },
    checksums: { ...backup.checksums, schema: '0'.repeat(64) },
  }
  await assert.rejects(() => verifyBackup(escaped), /BACKUP_PATH:schema|BACKUP_FILE_MODE:schema|BACKUP_CHECKSUM:schema/)
})

test('rehearseBackupRestore refuses non-fixture restore databases', async () => {
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-prod-guard-'))
  const backup = await createBackup({
    context: { stateRoot, sha: 'abc123', runId: '7', runAttempt: '1' },
    runtime: fakeRuntime({ tables: [{ name: 'Child', engine: 'InnoDB', bytes: 1 }] }),
    tables: ['Child'],
    kind: 'migration',
  })
  await assert.rejects(() => rehearseBackupRestore(backup), /BACKUP_RESTORE_URL_REQUIRED/)
  await assert.rejects(
    () => rehearseBackupRestore(backup, { restoreUrl: 'mysql://root:p@127.0.0.1:13317/production' }),
    /BACKUP_RESTORE_DATABASE/,
  )
})

function fakeRuntime(overrides = {}) {
  const databaseUrl = Object.hasOwn(overrides, 'databaseUrl') ? overrides.databaseUrl : 'mysql://root:p%40ss@127.0.0.1:13317/example'
  const tables = overrides.tables ?? []
  const calls = overrides.calls ?? []
  return {
    databaseUrl,
    dumpTimeoutMs: 1_000,
    statfs: overrides.statfs,
    onCredentialFile: overrides.onCredentialFile,
    getDatabaseUrl: overrides.getDatabaseUrl,
    async query(sql) {
      if (sql.includes('SELECT DATABASE() AS databaseName')) return [overrides.identity ?? { databaseName: 'example', serverUuid: 'test-server' }]
      if (sql.includes('information_schema.tables') && sql.includes('table_type = \'BASE TABLE\'')) {
        return tables.map((table) => ({
          name: table.name,
          engine: table.engine,
          bytes: String(table.bytes ?? 0),
        }))
      }
      if (sql.includes('information_schema.views')) return []
      if (sql.includes('information_schema.triggers')) return []
      if (sql.includes('information_schema.routines')) return []
      if (sql.includes('information_schema.events')) return []
      if (sql.includes('information_schema.columns')) return []
      if (sql.includes('information_schema.key_column_usage')) return []
      if (sql.includes('_prisma_migrations')) return []
      return []
    },
    async run(command, args) {
      calls.push({ command, args })
      if (overrides.run) return overrides.run(command, args)
      return { code: 0, stdout: '-- fake dump\n', stderr: '' }
    },
    async exec() {
      return { code: 0, stdout: '', stderr: '' }
    },
  }
}
