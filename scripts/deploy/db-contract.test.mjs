import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  assertMatchingTargets,
  classifyHistory,
  readMigrationFiles,
  validateExpansion,
} from './db-contract.mjs'

const SHA_A = 'a'.repeat(64)
const SHA_B = 'b'.repeat(64)
const SHA_C = 'c'.repeat(64)

function row(name, checksum, overrides = {}) {
  return {
    id: `${name}-id`,
    migrationName: name,
    checksum,
    finishedAt: '2026-10-08T00:00:00.000Z',
    rolledBackAt: null,
    ...overrides,
  }
}

function files() {
  return [
    { name: '0_base', checksum: SHA_A, sqlPath: '/fixture/0_base/migration.sql' },
    { name: '1_add', checksum: SHA_B, sqlPath: '/fixture/1_add/migration.sql' },
    { name: '2_more', checksum: SHA_C, sqlPath: '/fixture/2_more/migration.sql' },
  ]
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function policyFor(sql, overrides = {}) {
  return {
    sqlSha256: sha256(sql),
    creates: [],
    addsNullable: [],
    backupTables: [],
    previousCompatibleShas: [],
    compatibilityTests: [],
    postconditions: [],
    ...overrides,
  }
}

test('classifyHistory accepts only a verified applied prefix', () => {
  const migrationFiles = files()

  assert.deepEqual(
    classifyHistory(migrationFiles, [row('0_base', SHA_A)]),
    { applied: ['0_base'], pending: ['1_add', '2_more'], prefixLength: 1 },
  )
  assert.deepEqual(
    classifyHistory(migrationFiles, [
      row('0_base', SHA_A),
      row('1_add', SHA_B),
      row('2_more', SHA_C),
    ]),
    { applied: ['0_base', '1_add', '2_more'], pending: [], prefixLength: 3 },
  )

  assert.throws(
    () => classifyHistory(migrationFiles, [row('0_base', SHA_C)]),
    /CHECKSUM/,
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [row('0_base', SHA_A, { finishedAt: null })]),
    /UNFINISHED/,
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [row('9_unknown', SHA_A)]),
    /UNKNOWN_MIGRATION/,
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [row('1_add', SHA_B)]),
    /HISTORY_GAP/,
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [row('0_base', SHA_A), row('0_base', SHA_A, { id: 'duplicate' })]),
    /DUPLICATE/,
  )
})

test('classifyHistory ignores resolved rolled-back rows but rejects unresolved failures', () => {
  const migrationFiles = files()

  assert.deepEqual(
    classifyHistory(migrationFiles, [
      row('0_base', SHA_A, { rolledBackAt: '2026-10-08T00:01:00.000Z' }),
      row('0_base', SHA_A, { id: 'reapply' }),
      row('1_add', SHA_B),
    ]),
    { applied: ['0_base', '1_add'], pending: ['2_more'], prefixLength: 2 },
  )

  assert.deepEqual(
    classifyHistory(migrationFiles, [
      row('0_base', SHA_A),
      row('1_add', SHA_B, { finishedAt: null, rolledBackAt: '2026-10-08T00:01:00.000Z' }),
    ]),
    { applied: ['0_base'], pending: ['1_add', '2_more'], prefixLength: 1 },
  )

  assert.deepEqual(
    classifyHistory(migrationFiles, [
      row('0_base', SHA_A),
      row('1_add', SHA_B),
      row('1_add', SHA_B, { id: 'reverted-after-success', finishedAt: null, rolledBackAt: '2026-10-08T00:01:00.000Z' }),
    ]),
    { applied: ['0_base', '1_add'], pending: ['2_more'], prefixLength: 2 },
  )

  assert.throws(
    () => classifyHistory(migrationFiles, [
      row('0_base', SHA_A),
      row('1_add', SHA_B, { finishedAt: null }),
    ]),
    /UNFINISHED/,
  )
})

test('classifyHistory audit gaps are limited to exact frozen migration identities', () => {
  const frozen0 = { name: '0_frozen', checksum: SHA_A, sqlPath: '/fixture/0/migration.sql' }
  const frozen1 = { name: '1_frozen', checksum: SHA_B, sqlPath: '/fixture/1/migration.sql' }
  const frozen2 = { name: '2_frozen', checksum: SHA_C, sqlPath: '/fixture/2/migration.sql' }
  const future0 = { name: '3_future', checksum: 'd'.repeat(64), sqlPath: '/fixture/3/migration.sql' }
  const future1 = { name: '4_future', checksum: 'e'.repeat(64), sqlPath: '/fixture/4/migration.sql' }
  const migrationFiles = [frozen0, frozen1, frozen2, future0, future1]
  const frozenMigrations = [frozen0, frozen1, frozen2].map(({ name, checksum }) => ({ name, checksum }))

  assert.deepEqual(
    classifyHistory(migrationFiles, [
      row('0_frozen', SHA_A),
      row('2_frozen', SHA_C),
      row('3_future', 'd'.repeat(64)),
    ], { allowBaselineGaps: true, frozenMigrations }),
    { applied: ['0_frozen', '2_frozen', '3_future'], pending: ['1_frozen', '4_future'], prefixLength: 1 },
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [
      row('0_frozen', SHA_A),
      row('2_frozen', SHA_C),
      row('4_future', 'e'.repeat(64)),
    ], { allowBaselineGaps: true, frozenMigrations }),
    /HISTORY_GAP/,
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [
      row('0_frozen', SHA_A),
      row('2_frozen', SHA_C),
    ], { allowBaselineGaps: true, frozenMigrations: [{ name: '1_frozen', checksum: SHA_A }] }),
    /HISTORY_GAP/,
  )
  assert.throws(
    () => classifyHistory(migrationFiles, [
      row('0_frozen', SHA_A),
      row('2_frozen', SHA_C),
    ], { allowBaselineGaps: false, frozenMigrations }),
    /HISTORY_GAP/,
  )
})

test('classifyHistory default audit mode permits only the repository frozen contract identities', () => {
  const frozen = [
    { name: '0_legacy_baseline', checksum: 'b038be2447a9fcea458672c86bf28ba3d28b689eb8684b8eb124ee477435e9fc', sqlPath: '/fixture/0/migration.sql' },
    { name: '202609280001_waste_area_discovery', checksum: 'c8a8814183fa044e2d1e44b1722106a61a5e966da303aa3d29ea1b8f266df70c', sqlPath: '/fixture/1/migration.sql' },
    { name: '202609290001_real_estate_public_url_registry', checksum: '257783a19b2a4a029c4de62fd501027fdb3a12377ba2eb9374e982d7aa1af312', sqlPath: '/fixture/2/migration.sql' },
    { name: '202610060001_affiliate_banners', checksum: 'e2f42f1b718366b426382ffffb74799ea54d818555bd45842fb4598b9a0ad5dc', sqlPath: '/fixture/3/migration.sql' },
    { name: '202610070001_affiliate_disclosures', checksum: 'ca4606fadcfdcf3b2c53625945fa2d6ac7b9ce701742398b8661670d9b3aa33d', sqlPath: '/fixture/4/migration.sql' },
    { name: '202610080001_affiliate_banner_expiration', checksum: 'd1f127bd13485902b53d04b5e4e1dd9b6ad288e4703875c69d76b622add64b35', sqlPath: '/fixture/5/migration.sql' },
  ]
  const future = { name: '202610090001_future', checksum: SHA_A, sqlPath: '/fixture/6/migration.sql' }

  assert.deepEqual(
    classifyHistory([...frozen, future], [
      row(frozen[0].name, frozen[0].checksum),
      row(frozen[3].name, frozen[3].checksum),
      row(frozen[4].name, frozen[4].checksum),
      row(frozen[5].name, frozen[5].checksum),
      row(future.name, SHA_A),
    ], { allowBaselineGaps: true }),
    {
      applied: [frozen[0].name, frozen[3].name, frozen[4].name, frozen[5].name, future.name],
      pending: [frozen[1].name, frozen[2].name],
      prefixLength: 1,
    },
  )
  assert.throws(
    () => classifyHistory([...frozen, { name: '202610090001_future', checksum: SHA_A, sqlPath: '/fixture/6/migration.sql' }, { name: '202610100001_future', checksum: SHA_B, sqlPath: '/fixture/7/migration.sql' }], [
      row('202610100001_future', SHA_B),
    ], { allowBaselineGaps: true }),
    /HISTORY_GAP/,
  )
})

test('readMigrationFiles returns sorted SQL byte hashes and validates the frozen contract', () => {
  const prismaDir = mkdtempSync(join(tmpdir(), 'db-contract-prisma-'))
  const migrationsDir = join(prismaDir, 'migrations')
  mkdirSync(join(migrationsDir, '202610100001_second'), { recursive: true })
  mkdirSync(join(migrationsDir, '202610090001_first'), { recursive: true })

  writeFileSync(join(migrationsDir, '202610100001_second', 'migration.sql'), 'SELECT "second";\n')
  writeFileSync(join(migrationsDir, '202610090001_first', 'migration.sql'), 'SELECT "first";\r\n')
  assert.throws(() => readMigrationFiles(prismaDir), /CONTRACT_MISSING/)

  writeFileSync(join(prismaDir, 'migration-contract.json'), JSON.stringify({
    format: 1,
    migrations: [
      {
        name: '202610090001_first',
        checksum: sha256('SELECT "first";\r\n'),
        sqlPath: 'backend/prisma/migrations/202610090001_first/migration.sql',
      },
    ],
    ngram: [],
  }, null, 2))

  assert.deepEqual(readMigrationFiles(prismaDir), [
    {
      name: '202610090001_first',
      checksum: sha256('SELECT "first";\r\n'),
      sqlPath: join(migrationsDir, '202610090001_first', 'migration.sql'),
    },
    {
      name: '202610100001_second',
      checksum: sha256('SELECT "second";\n'),
      sqlPath: join(migrationsDir, '202610100001_second', 'migration.sql'),
    },
  ])

  writeFileSync(join(migrationsDir, '202610090001_first', 'migration.sql'), 'SELECT "tampered";\r\n')
  assert.throws(() => readMigrationFiles(prismaDir), /FROZEN_CHECKSUM/)
})

test('validateExpansion accepts create table and nullable add column after lock timeout setup', () => {
  const sql = `
    SET SESSION lock_wait_timeout = 5;
    CREATE TABLE \`NewThing\` (
      \`id\` INTEGER NOT NULL AUTO_INCREMENT,
      \`name\` VARCHAR(191) NULL DEFAULT NULL,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    ALTER TABLE \`ExistingThing\` ADD COLUMN \`memo\` TEXT NULL;
  `

  assert.deepEqual(
    validateExpansion(sql, policyFor(sql, {
      creates: ['NewThing'],
      addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
    })),
    { creates: ['NewThing'], addsNullable: [{ table: 'ExistingThing', column: 'memo' }] },
  )
})

test('validateExpansion tokenizes strings, comments, and semicolons without allowing hidden statements', () => {
  const sql = `
    SET SESSION lock_wait_timeout = 5;
    CREATE TABLE SafeLog (
      id INTEGER NOT NULL,
      note VARCHAR(191) NULL DEFAULT 'DROP TABLE x; it''s text',
      PRIMARY KEY (id)
    );
    -- ALTER TABLE Hidden ADD COLUMN bad INTEGER NULL;
    /* CREATE TABLE Hidden (id INTEGER); */
  `

  assert.deepEqual(validateExpansion(sql, policyFor(sql, { creates: ['SafeLog'] })), {
    creates: ['SafeLog'],
    addsNullable: [],
  })
})

test('validateExpansion rejects unsupported or undeclared expansion SQL', () => {
  const valid = 'SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;'

  assert.throws(() => validateExpansion('ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', policyFor('ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
  })), /LOCK_WAIT_TIMEOUT/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 50; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', policyFor('SET SESSION lock_wait_timeout = 50; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
  })), /LOCK_WAIT_TIMEOUT/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; SET SESSION sql_log_bin = 0; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', policyFor('SET SESSION lock_wait_timeout = 5; SET SESSION sql_log_bin = 0; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
  })), /UNSUPPORTED_SQL/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; CREATE TABLE Copy LIKE Source;', policyFor('SET SESSION lock_wait_timeout = 5; CREATE TABLE Copy LIKE Source;', {
    creates: ['Copy'],
  })), /CREATE_TABLE_UNSUPPORTED/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; CREATE TEMPORARY TABLE TempThing (id INTEGER);', policyFor('SET SESSION lock_wait_timeout = 5; CREATE TEMPORARY TABLE TempThing (id INTEGER);', {
    creates: ['TempThing'],
  })), /CREATE_TABLE_UNSUPPORTED/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; CREATE TABLE Copy AS SELECT * FROM Source;', policyFor('SET SESSION lock_wait_timeout = 5; CREATE TABLE Copy AS SELECT * FROM Source;', {
    creates: ['Copy'],
  })), /CREATE_TABLE_UNSUPPORTED/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; CREATE TABLE IF NOT EXISTS MaybeNew (id INTEGER);', policyFor('SET SESSION lock_wait_timeout = 5; CREATE TABLE IF NOT EXISTS MaybeNew (id INTEGER);', {
    creates: ['MaybeNew'],
  })), /CREATE_TABLE_UNSUPPORTED/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; CREATE TABLE BadCheck (id INTEGER, CHECK (id > 0));', policyFor('SET SESSION lock_wait_timeout = 5; CREATE TABLE BadCheck (id INTEGER, CHECK (id > 0));', {
    creates: ['BadCheck'],
  })), /CREATE_TABLE_UNSUPPORTED/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NOT NULL;', policyFor('SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NOT NULL;', {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
  })), /ADD_COLUMN_NOT_NULL/)
  for (const definition of [
    'INTEGER NULL UNIQUE',
    'INTEGER NULL PRIMARY KEY',
    'INTEGER NULL AUTO_INCREMENT',
    'INTEGER NULL REFERENCES Parent(id)',
    'INTEGER NULL GENERATED ALWAYS AS (1) STORED',
    'INTEGER NULL CHECK (memo > 0)',
  ]) {
    const sql = `SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo ${definition};`
    assert.throws(() => validateExpansion(sql, policyFor(sql, {
      addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
    })), /ADD_COLUMN_UNSUPPORTED|ADD_COLUMN_NOT_NULL/)
  }
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN a TEXT NULL, ADD COLUMN b TEXT NULL;', policyFor('SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN a TEXT NULL, ADD COLUMN b TEXT NULL;', {
    addsNullable: [{ table: 'ExistingThing', column: 'a' }, { table: 'ExistingThing', column: 'b' }],
  })), /ALTER_TABLE_UNSUPPORTED/)
  assert.throws(() => validateExpansion('/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */; SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', policyFor('/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */; SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;', {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
  })), /EXECUTABLE_COMMENT/)
  assert.throws(() => validateExpansion('DELIMITER //\nSET SESSION lock_wait_timeout = 5;//', policyFor('DELIMITER //\nSET SESSION lock_wait_timeout = 5;//')), /DELIMITER/)
  assert.throws(() => validateExpansion("SET SESSION lock_wait_timeout = 5; CREATE TABLE Bad (note TEXT DEFAULT 'open);", policyFor("SET SESSION lock_wait_timeout = 5; CREATE TABLE Bad (note TEXT DEFAULT 'open);", {
    creates: ['Bad'],
  })), /UNTERMINATED_STRING/)
  assert.throws(() => validateExpansion("SET SESSION lock_wait_timeout = 5; CREATE TABLE Bad (note TEXT DEFAULT 'it\\'s ambiguous');", policyFor("SET SESSION lock_wait_timeout = 5; CREATE TABLE Bad (note TEXT DEFAULT 'it\\'s ambiguous');", {
    creates: ['Bad'],
  })), /BACKSLASH_ESCAPE/)
  assert.throws(() => validateExpansion('SET SESSION lock_wait_timeout = 5; CREATE TABLE Bad (note TEXT DEFAULT "ansi ambiguous; DROP TABLE x");', policyFor('SET SESSION lock_wait_timeout = 5; CREATE TABLE Bad (note TEXT DEFAULT "ansi ambiguous; DROP TABLE x");', {
    creates: ['Bad'],
  })), /ANSI_QUOTES/)
  assert.throws(() => validateExpansion(valid, policyFor(valid, {
    addsNullable: [{ table: 'OtherThing', column: 'memo' }],
  })), /TARGET_MISMATCH/)
  assert.throws(() => validateExpansion(`${valid} DROP TABLE OtherThing;`, policyFor(`${valid} DROP TABLE OtherThing;`, {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
  })), /UNSUPPORTED_SQL/)
  assert.throws(() => validateExpansion(`${valid}`, { ...policyFor(valid), sqlSha256: SHA_A }), /SQL_CHECKSUM/)
})

test('validateExpansion requires declared compatibility test files to exist', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-contract-policy-'))
  const existingTest = join(root, 'compat.test.mjs')
  writeFileSync(existingTest, 'export {}\n')
  const sql = 'SET SESSION lock_wait_timeout = 5; ALTER TABLE ExistingThing ADD COLUMN memo TEXT NULL;'

  assert.deepEqual(validateExpansion(sql, policyFor(sql, {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
    compatibilityTests: [existingTest],
  })).addsNullable, [{ table: 'ExistingThing', column: 'memo' }])

  assert.throws(() => validateExpansion(sql, policyFor(sql, {
    addsNullable: [{ table: 'ExistingThing', column: 'memo' }],
    compatibilityTests: [join(root, 'missing.test.mjs')],
  })), /COMPATIBILITY_TEST/)
})

test('assertMatchingTargets compares canonical creates and nullable column targets', () => {
  assert.doesNotThrow(() => assertMatchingTargets(
    { creates: ['B', 'A'], addsNullable: [{ table: 'T', column: 'b' }, { table: 'T', column: 'a' }] },
    { creates: ['A', 'B'], addsNullable: [{ table: 'T', column: 'a' }, { table: 'T', column: 'b' }] },
  ))
  assert.throws(() => assertMatchingTargets(
    { creates: ['A'], addsNullable: [{ table: 'T', column: 'a' }] },
    { creates: ['A'], addsNullable: [{ table: 'T', column: 'b' }] },
  ), /TARGET_MISMATCH/)
})
