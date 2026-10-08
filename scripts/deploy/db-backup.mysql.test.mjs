import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { backupClosure, createBackup, rehearseBackupRestore, verifyBackup } from './db-backup.mjs'
import { createMysqlFixture } from './fixtures/db-mysql.mjs'

test('creates a restorable data backup for target tables and transitive FK parents', async (t) => {
  const db = await createMysqlFixture(t, 'backup_fk')
  await db.exec(`
    CREATE TABLE Root (
      id INT PRIMARY KEY,
      label ENUM('one','two') NOT NULL
    ) ENGINE=InnoDB;
    CREATE TABLE Parent (
      id INT PRIMARY KEY,
      root_id INT NOT NULL,
      name VARCHAR(40) NULL,
      CONSTRAINT fk_parent_root FOREIGN KEY (root_id) REFERENCES Root(id)
    ) ENGINE=InnoDB;
    CREATE TABLE Child (
      id INT PRIMARY KEY,
      parent_id INT NOT NULL,
      note VARCHAR(40) NULL,
      CONSTRAINT fk_child_parent FOREIGN KEY (parent_id) REFERENCES Parent(id)
    ) ENGINE=InnoDB;
    INSERT INTO Root VALUES (1, 'one');
    INSERT INTO Parent VALUES (10, 1, NULL);
    INSERT INTO Child VALUES (100, 10, 'kept');
  `)
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-mysql-'))
  const tables = backupClosure(['Child'], [
    { child: 'Child', parent: 'Parent' },
    { child: 'Parent', parent: 'Root' },
  ])

  const backup = await createBackup({
    context: { stateRoot, sha: 'cafebabe', runId: '42', runAttempt: '1' },
    runtime: { databaseUrl: db.url, query: db.query, exec: db.exec },
    tables,
    kind: 'migration',
  })

  assert.ok(existsSync(backup.files.schema))
  assert.ok(existsSync(backup.files.data))
  assert.ok(existsSync(backup.files.ledger))
  assert.deepEqual(backup.tables, ['Child', 'Parent', 'Root'])

  const dataDump = await readFile(backup.files.data, 'utf8')
  assert.match(dataDump, /INSERT INTO [`"]?Child[`"]?/)
  assert.match(dataDump, /INSERT INTO [`"]?Parent[`"]?/)
  assert.match(dataDump, /INSERT INTO [`"]?Root[`"]?/)

  await verifyBackup(backup)
  const verification = await rehearseBackupRestore(backup, { restoreUrl: db.url })
  assert.equal(verification.orphans.length, 0)
  assert.equal(verification.restoredTables.sort().join(','), 'Child,Parent,Root')
})

test('rehearses restore from a large streamed dump without SQL argv payloads', async (t) => {
  const db = await createMysqlFixture(t, 'backup_large')
  await db.exec(`
    CREATE TABLE LargePayload (
      id INT PRIMARY KEY,
      body MEDIUMTEXT NOT NULL
    ) ENGINE=InnoDB;
    INSERT INTO LargePayload VALUES (1, REPEAT('x', 2500000));
  `)
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-large-'))
  const backup = await createBackup({
    context: { stateRoot, sha: 'feedface', runId: '43', runAttempt: '1' },
    runtime: { databaseUrl: db.url, query: db.query, exec: db.exec },
    tables: ['LargePayload'],
    kind: 'migration',
  })

  await verifyBackup(backup)
  const verification = await rehearseBackupRestore(backup, { restoreUrl: db.url })
  assert.deepEqual(verification.restoredTables, ['LargePayload'])
})

test('blocks unsupported objects instead of creating an incomplete backup', async (t) => {
  const db = await createMysqlFixture(t, 'backup_view')
  await db.exec(`
    CREATE TABLE SourceTable (id INT PRIMARY KEY) ENGINE=InnoDB;
    CREATE VIEW UnsupportedView AS SELECT id FROM SourceTable;
  `)
  const stateRoot = await mkdtemp(join(tmpdir(), 'db-backup-view-'))
  await assert.rejects(
    () => createBackup({
      context: { stateRoot, sha: 'cafebabe', runId: '42', runAttempt: '1' },
      runtime: { databaseUrl: db.url, query: db.query, exec: db.exec },
      tables: ['SourceTable'],
      kind: 'migration',
    }),
    /BACKUP_UNSUPPORTED_OBJECTS/,
  )
})
