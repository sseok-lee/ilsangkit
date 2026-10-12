import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { assertPreparationCompatibilityPresent } from './db-evidence.mjs'
import { tmpdir } from 'node:os'

import {
  assertIntrospectionSupported,
  buildCompatibilityRequirements,
  compareStructure,
  createDbRuntime,
  validateCompatibilityEvidence,
  verifyEvidenceManifest,
} from './db-schema.mjs'

test('ngram parser participates in structural equality', () => {
  const expected = { indexes: [{ table: 'Toilet', name: 'search', columns: ['name'], parser: 'ngram' }] }
  const actual = { indexes: [{ table: 'Toilet', name: 'search', columns: ['name'], parser: null }] }

  const comparison = compareStructure(expected, actual)

  assert.equal(comparison.equal, false)
  assert.match(comparison.differences.join('\n'), /indexes/)
})

test('structural equality ignores dynamic table counters but keeps meaningful column and constraint detail', () => {
  const expected = {
    tables: [{ name: 'Article', collation: 'utf8mb4_unicode_ci', autoIncrement: 1 }],
    columns: [{ table: 'Article', name: 'title', type: 'varchar(191)', nullable: false, default: null, collation: 'utf8mb4_unicode_ci' }],
    foreignKeys: [{ table: 'Article', name: 'Article_authorId_fkey', columns: ['authorId'], referencedTable: 'User', referencedColumns: ['id'], updateRule: 'CASCADE', deleteRule: 'RESTRICT' }],
  }
  const actual = {
    tables: [{ name: 'Article', collation: 'utf8mb4_unicode_ci', autoIncrement: 12 }],
    columns: [{ table: 'Article', name: 'title', type: 'varchar(255)', nullable: false, default: null, collation: 'utf8mb4_unicode_ci' }],
    foreignKeys: [{ table: 'Article', name: 'Article_authorId_fkey', columns: ['authorId'], referencedTable: 'User', referencedColumns: ['id'], updateRule: 'CASCADE', deleteRule: 'RESTRICT' }],
  }

  const comparison = compareStructure(expected, actual)

  assert.equal(comparison.equal, false)
  assert.match(comparison.differences.join('\n'), /columns/)
  assert.doesNotMatch(comparison.differences.join('\n'), /autoIncrement/)
})


test('create table normalization treats redundant charset before equivalent collation as formatting', () => {
  const expected = {
    createTables: [{
      table: 'CharsetThing',
      sql: 'CREATE TABLE `CharsetThing` (\n  `name` varchar(191) COLLATE utf8mb4_unicode_ci DEFAULT NULL\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    }],
    columns: [{ table: 'CharsetThing', name: 'name', characterSet: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }],
  }
  const actualEquivalent = {
    createTables: [{
      table: 'CharsetThing',
      sql: 'CREATE TABLE `CharsetThing` (\n  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    }],
    columns: [{ table: 'CharsetThing', name: 'name', characterSet: 'utf8mb4', collation: 'utf8mb4_unicode_ci' }],
  }
  const actualDrift = {
    createTables: [{
      table: 'CharsetThing',
      sql: 'CREATE TABLE `CharsetThing` (\n  `name` varchar(191) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci',
    }],
    columns: [{ table: 'CharsetThing', name: 'name', characterSet: 'utf8mb4', collation: 'utf8mb4_bin' }],
  }

  assert.equal(compareStructure(expected, actualEquivalent).equal, true)
  assert.equal(compareStructure(expected, actualDrift).equal, false)
})

test('unknown inventory objects are structural differences unless explicitly equal', () => {
  const comparison = compareStructure(
    { inventory: { views: [], triggers: [], routines: [], events: [] } },
    { inventory: { views: [{ name: 'HiddenView' }], triggers: [], routines: [], events: [] } },
  )

  assert.equal(comparison.equal, false)
  assert.match(comparison.differences.join('\n'), /inventory/)
})

test('composite index and foreign key column order participates in structural equality', () => {
  const expected = {
    indexes: [{ table: 'Thing', name: 'Thing_a_b_idx', columns: ['a', 'b'], parser: null }],
    foreignKeys: [{ table: 'Thing', name: 'Thing_parent_fkey', columns: ['parentA', 'parentB'], referencedTable: 'Parent', referencedColumns: ['a', 'b'] }],
  }
  const actual = {
    indexes: [{ table: 'Thing', name: 'Thing_a_b_idx', columns: ['b', 'a'], parser: null }],
    foreignKeys: [{ table: 'Thing', name: 'Thing_parent_fkey', columns: ['parentB', 'parentA'], referencedTable: 'Parent', referencedColumns: ['b', 'a'] }],
  }

  const comparison = compareStructure(expected, actual)

  assert.equal(comparison.equal, false)
  assert.match(comparison.differences.join('\n'), /foreignKeys|indexes/)
})

test('evidence manifest validation rejects mismatched run identity and checksum drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-manifest-'))
  const manifestPath = join(root, 'manifest.json')
  mkdirSync(join(root, 'prefixes', '0001'), { recursive: true })
  writeFileSync(join(root, 'prefixes', '0001', 'schema.prisma'), 'datasource db { provider = "mysql" url = env("DATABASE_URL") }\n')
  writeFileSync(join(root, 'prefixes', '0001', 'structure.json'), '{"tables":[]}\n')
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'abc123',
    sourceTestRunId: 'run-1',
    sourceTestRunAttempt: '1',
    migrations: [],
    prefixes: [
      {
        prefixLength: 1,
        schemaPath: 'prefixes/0001/schema.prisma',
        schemaSha256: '0'.repeat(64),
        structurePath: 'prefixes/0001/structure.json',
        structureSha256: '1'.repeat(64),
      },
    ],
  }, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({
      manifestPath,
      sha: 'abc123',
      runId: 'run-2',
      runAttempt: '1',
    }),
    /EVIDENCE_RUN_ID/,
  )
  assert.throws(
    () => verifyEvidenceManifest({
      manifestPath,
      sha: 'abc123',
      runId: 'run-1',
      runAttempt: '1',
    }),
    /EVIDENCE_SCHEMA_CHECKSUM/,
  )
})




test('evidence manifest validation rejects symlinked artifact path segments before hashing', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-symlink-'))
  const outside = mkdtempSync(join(tmpdir(), 'db-evidence-outside-'))
  mkdirSync(join(root, 'prefixes'), { recursive: true })
  mkdirSync(join(outside, '0001'), { recursive: true })
  writeFileSync(join(outside, '0001', 'schema.prisma'), 'datasource db { provider = "mysql" url = env("DATABASE_URL") }\n')
  writeFileSync(join(outside, '0001', 'structure.json'), '{"tables":[]}\n')
  symlinkSync(join(outside, '0001'), join(root, 'prefixes', '0001'))
  const schema = readFileSync(join(outside, '0001', 'schema.prisma'))
  const structure = readFileSync(join(outside, '0001', 'structure.json'))
  const manifestPath = join(root, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'abc123',
    activeSha: 'abc123',
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { futureMigrationNames: [] },
    prefixes: [{
      schemaPath: 'prefixes/0001/schema.prisma',
      schemaSha256: createHash('sha256').update(schema).digest('hex'),
      structurePath: 'prefixes/0001/structure.json',
      structureSha256: createHash('sha256').update(structure).digest('hex'),
    }],
    compatibility: { status: 'not-applicable', requirements: [], results: [] },
  }, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({ manifestPath, sha: 'abc123', runId: '1001', runAttempt: '1' }),
    /EVIDENCE_PATH/,
  )
})

test('manifest consumer rejects incomplete or stale compatibility evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-compat-manifest-'))
  const manifestPath = join(root, 'manifest.json')
  const requirement = {
    migrationName: '202610090001_future',
    policySha256: 'e'.repeat(64),
    previousCompatibleSha: 'a'.repeat(40),
    testPath: 'backend/__tests__/compat/future.test.mjs',
    stages: ['before', 'partial:1', 'after', 'current-final'],
  }
  const resultFor = (stage, candidateSha = 'd'.repeat(40)) => ({
    migrationName: requirement.migrationName,
    policySha256: requirement.policySha256,
    previousCompatibleSha: requirement.previousCompatibleSha,
    testPath: requirement.testPath,
    stage,
    candidateSha,
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    command: 'node --test backend/__tests__/compat/future.test.mjs',
    exitCode: 0,
    stdoutSha256: 'b'.repeat(64),
    stderrSha256: 'c'.repeat(64),
  })
  const baseManifest = {
    format: 1,
    sha: 'd'.repeat(40),
    activeSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { futureMigrationNames: ['202610090001_future'] },
    prefixes: [],
    compatibility: {
      status: 'verified',
      requirements: [requirement],
      results: [resultFor('before')],
    },
  }
  writeFileSync(manifestPath, JSON.stringify(baseManifest, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({ manifestPath, sha: 'd'.repeat(40), runId: '1001', runAttempt: '1' }),
    /EVIDENCE_COMPATIBILITY/,
  )

  baseManifest.compatibility.results = [
    resultFor('before'),
    resultFor('partial:1'),
    resultFor('after'),
    resultFor('current-final', 'f'.repeat(40)),
  ]
  writeFileSync(manifestPath, JSON.stringify(baseManifest, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({ manifestPath, sha: 'd'.repeat(40), runId: '1001', runAttempt: '1' }),
    /EVIDENCE_COMPATIBILITY/,
  )
})

test('db evidence CLI verifies manifest identity without requiring database URL input', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-cli-'))
  const manifestPath = join(root, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'abc123',
    activeSha: 'abc123',
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { futureMigrationNames: [] },
    prefixes: [],
    compatibility: { status: 'not-applicable', requirements: [], results: [] },
  }, null, 2))

  const result = spawnSync(process.execPath, ['scripts/deploy/db-evidence.mjs', 'verify'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MIGRATION_EVIDENCE_DIR: root,
      TESTED_SHA: 'abc123',
      TEST_RUN_ID: '1001',
      TEST_RUN_ATTEMPT: '1',
      DATABASE_URL: 'mysql://user:secret@127.0.0.1:3306/ignored',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(JSON.parse(result.stdout), {
    status: 'verified',
    manifestPath,
    prefixes: 0,
    sha: 'abc123',
  })
  assert.doesNotMatch(result.stderr + result.stdout, /secret/)
})

test('runPrisma filters GitHub tokens from child env and private logs', async (t) => {
  const root = mkdtempSync(join(tmpdir(), 'db-runtime-env-'))
  const prismaBin = join(root, 'node_modules', 'prisma', 'build')
  mkdirSync(prismaBin, { recursive: true })
  const cliPath = join(prismaBin, 'index.js')
  writeFileSync(cliPath, `#!/usr/bin/env node
process.stdout.write(JSON.stringify({
  argv: process.argv.slice(2),
  githubToken: process.env.GITHUB_TOKEN || null,
  ghToken: process.env.GH_TOKEN || null,
  migrationGithubToken: process.env.MIGRATION_GITHUB_TOKEN || null,
  databaseUrl: process.env.DATABASE_URL || null,
  custom: process.env.CUSTOM_ALLOWED || null
}))
`)
  chmodSync(cliPath, 0o755)

  const previous = {
    GITHUB_TOKEN: process.env.GITHUB_TOKEN,
    GH_TOKEN: process.env.GH_TOKEN,
    MIGRATION_GITHUB_TOKEN: process.env.MIGRATION_GITHUB_TOKEN,
  }
  t.after(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  })
  process.env.GITHUB_TOKEN = 'process-secret'
  process.env.GH_TOKEN = 'process-gh-secret'
  process.env.MIGRATION_GITHUB_TOKEN = 'process-migration-secret'

  const runtime = createDbRuntime({ backendDir: root, databaseUrl: 'mysql://user:pass@127.0.0.1:3306/appdb' })
  const logPath = join(root, 'private', 'prisma-log.json')
  const result = await runtime.runPrisma(['probe'], {
    env: {
      CUSTOM_ALLOWED: 'custom-value',
      GITHUB_TOKEN: 'override-secret',
    },
    logPath,
  })
  await runtime.close()

  assert.equal(result.code, 0)
  const childEnv = JSON.parse(result.stdout)
  assert.deepEqual(childEnv, {
    argv: ['probe'],
    githubToken: null,
    ghToken: null,
    migrationGithubToken: null,
    databaseUrl: 'mysql://user:pass@127.0.0.1:3306/appdb',
    custom: 'custom-value',
  })
  assert.doesNotMatch(readFileSync(logPath, 'utf8'), /secret/)
})


test('runPrisma hard-kills process group after timeout when child ignores SIGTERM', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-runtime-timeout-'))
  const prismaBin = join(root, 'node_modules', 'prisma', 'build')
  mkdirSync(prismaBin, { recursive: true })
  const cliPath = join(prismaBin, 'index.js')
  writeFileSync(cliPath, `#!/usr/bin/env node
process.on('SIGTERM', () => {})
setInterval(() => {}, 1000)
`)
  chmodSync(cliPath, 0o755)

  const runtime = createDbRuntime({ backendDir: root, databaseUrl: 'mysql://user:pass@127.0.0.1:3306/appdb' })
  const started = Date.now()
  const result = await runtime.runPrisma(['hang'], { timeoutMs: 50, killGraceMs: 50 })
  await runtime.close()

  assert.equal(result.code, 124)
  assert.equal(Date.now() - started < 2000, true)
})

test('runtime exposes database URL only through a non-enumerable accessor', async () => {
  const runtime = createDbRuntime({ backendDir: mkdtempSync(join(tmpdir(), 'db-runtime-url-')), databaseUrl: 'mysql://user:pass@127.0.0.1:3306/appdb' })

  assert.equal(runtime.getDatabaseUrl(), 'mysql://user:pass@127.0.0.1:3306/appdb')
  assert.equal(Object.keys(runtime).includes('getDatabaseUrl'), false)
  assert.doesNotMatch(JSON.stringify(runtime), /pass/)

  await runtime.close()
})

test('future migrations require complete policy-bound compatibility evidence', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-compat-policy-'))
  const migrationDir = join(root, 'migrations', '202610090001_future')
  const testPath = join(root, 'compat', 'old-new.test.mjs')
  mkdirSync(migrationDir, { recursive: true })
  mkdirSync(join(root, 'compat'), { recursive: true })
  writeFileSync(testPath, 'export {}\n')
  const policy = {
    previousCompatibleShas: ['a'.repeat(40)],
    compatibilityTests: [testPath],
  }
  writeFileSync(join(migrationDir, 'policy.json'), JSON.stringify(policy, null, 2))
  writeFileSync(join(migrationDir, 'migration.sql'), `SET SESSION lock_wait_timeout = 5;
CREATE TABLE One (id INT NULL);
CREATE TABLE Two (id INT NULL);
`)
  const migrations = [
    { name: '0_legacy_baseline', sqlPath: join(root, 'migrations', '0_legacy_baseline', 'migration.sql') },
    { name: '202610090001_future', sqlPath: join(migrationDir, 'migration.sql') },
  ]

  assert.throws(
    () => validateCompatibilityEvidence({
      migrations,
      frozenPrefixLength: 1,
      compatibilityEvidence: [],
      candidateSha: 'd'.repeat(40),
      runId: '1001',
      runAttempt: '1',
    }),
    /COMPATIBILITY_EVIDENCE_REQUIRED/,
  )
  assert.throws(
    () => validateCompatibilityEvidence({
      migrations,
      frozenPrefixLength: 1,
      candidateSha: 'd'.repeat(40),
      runId: '1001',
      runAttempt: '1',
      compatibilityEvidence: [
        {
          migrationName: '202610090001_future',
          policySha256: '0'.repeat(64),
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'before',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
      ],
    }),
    /COMPATIBILITY_POLICY_CHECKSUM/,
  )

  const policySha256 = createHash('sha256').update(JSON.stringify(policy, null, 2)).digest('hex')
  assert.deepEqual(
    validateCompatibilityEvidence({
      migrations,
      frozenPrefixLength: 1,
      candidateSha: 'd'.repeat(40),
      runId: '1001',
      runAttempt: '1',
      compatibilityEvidence: [
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'before',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'partial:1',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'after',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'current-final',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
      ],
    }),
    {
      status: 'verified',
      requirements: [
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stages: ['before', 'partial:1', 'after', 'current-final'],
        },
      ],
      results: [
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'after',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'before',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'current-final',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        },
        {
          migrationName: '202610090001_future',
          policySha256,
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stage: 'partial:1',
          candidateSha: 'd'.repeat(40),
          sourceTestRunId: '1001',
          sourceTestRunAttempt: '1',
          command: 'node --test compat/old-new.test.mjs',
          exitCode: 0,
          stdoutSha256: 'b'.repeat(64),
          stderrSha256: 'c'.repeat(64),
        }
      ],
    },
  )
})


test('manifest compatibility requirements can be rebound to actual prisma migration files', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-prisma-bind-'))
  const prismaDir = join(root, 'prisma')
  const frozenDir = join(prismaDir, 'migrations', '0_legacy_baseline')
  const futureDir = join(prismaDir, 'migrations', '202610090001_future')
  mkdirSync(frozenDir, { recursive: true })
  mkdirSync(futureDir, { recursive: true })
  const frozenSql = 'CREATE TABLE FrozenThing (id INT NULL);\n'
  const futureSql = 'SET SESSION lock_wait_timeout = 5;\nCREATE TABLE One (id INT NULL);\nCREATE TABLE Two (id INT NULL);\n'
  writeFileSync(join(frozenDir, 'migration.sql'), frozenSql)
  writeFileSync(join(futureDir, 'migration.sql'), futureSql)
  writeFileSync(join(prismaDir, 'migration-contract.json'), JSON.stringify({
    format: 1,
    migrations: [{ name: '0_legacy_baseline', checksum: createHash('sha256').update(frozenSql).digest('hex') }],
  }, null, 2))
  const testPath = join(root, 'compat.test.mjs')
  writeFileSync(testPath, 'export {}\n')
  const policyRaw = JSON.stringify({
    previousCompatibleShas: ['a'.repeat(40)],
    compatibilityTests: [testPath],
  }, null, 2)
  writeFileSync(join(futureDir, 'policy.json'), policyRaw)
  const manifestPath = join(root, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'd'.repeat(40),
    activeSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { frozenPrefixLength: 1, futureMigrationNames: ['202610090001_future'] },
    migrations: [
      { name: '0_legacy_baseline', checksum: createHash('sha256').update(frozenSql).digest('hex'), sqlPath: 'prisma/migrations/0_legacy_baseline/migration.sql' },
      { name: '202610090001_future', checksum: createHash('sha256').update(futureSql).digest('hex'), sqlPath: 'prisma/migrations/202610090001_future/migration.sql' },
    ],
    prefixes: [],
    compatibility: {
      status: 'verified',
      requirements: [
        {
          migrationName: '202610090001_future',
          policySha256: '0'.repeat(64),
          previousCompatibleSha: 'a'.repeat(40),
          testPath,
          stages: ['before', 'after', 'current-final'],
        },
      ],
      results: [],
    },
  }, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({ manifestPath, sha: 'd'.repeat(40), runId: '1001', runAttempt: '1', prismaDir }),
    /EVIDENCE_COMPATIBILITY/,
  )
})


test('manifest verification derives frozen prefix from actual migration contract and rejects inflation', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-frozen-prefix-'))
  const prismaDir = join(root, 'prisma')
  const frozenDir = join(prismaDir, 'migrations', '0_legacy_baseline')
  const futureDir = join(prismaDir, 'migrations', '202610090001_future')
  mkdirSync(frozenDir, { recursive: true })
  mkdirSync(futureDir, { recursive: true })
  const frozenSql = 'CREATE TABLE FrozenThing (id INT NULL);\n'
  const futureSql = 'SET SESSION lock_wait_timeout = 5;\nCREATE TABLE FutureThing (id INT NULL);\n'
  writeFileSync(join(frozenDir, 'migration.sql'), frozenSql)
  writeFileSync(join(futureDir, 'migration.sql'), futureSql)
  writeFileSync(join(prismaDir, 'migration-contract.json'), JSON.stringify({
    format: 1,
    migrations: [{ name: '0_legacy_baseline', checksum: createHash('sha256').update(frozenSql).digest('hex') }],
  }, null, 2))
  writeFileSync(join(futureDir, 'policy.json'), JSON.stringify({
    previousCompatibleShas: ['a'.repeat(40)],
    compatibilityTests: ['missing-in-prod.test.mjs'],
  }, null, 2))
  const manifestPath = join(root, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'd'.repeat(40),
    activeSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { frozenPrefixLength: 2, futureMigrationNames: [] },
    migrations: [
      { name: '0_legacy_baseline', checksum: createHash('sha256').update(frozenSql).digest('hex'), sqlPath: 'x' },
      { name: '202610090001_future', checksum: createHash('sha256').update(futureSql).digest('hex'), sqlPath: 'y' },
    ],
    prefixes: [],
    compatibility: { status: 'not-applicable', requirements: [], results: [] },
  }, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({ manifestPath, sha: 'd'.repeat(40), runId: '1001', runAttempt: '1', prismaDir }),
    /EVIDENCE_FROZEN_PREFIX/,
  )
})

test('prod manifest verification rebuilds compatibility requirements without requiring test files in artifact', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-prod-tests-'))
  const prismaDir = join(root, 'prisma')
  const frozenDir = join(prismaDir, 'migrations', '0_legacy_baseline')
  const futureDir = join(prismaDir, 'migrations', '202610090001_future')
  mkdirSync(frozenDir, { recursive: true })
  mkdirSync(futureDir, { recursive: true })
  const frozenSql = 'CREATE TABLE FrozenThing (id INT NULL);\n'
  const futureSql = 'SET SESSION lock_wait_timeout = 5;\nCREATE TABLE One (id INT NULL);\nCREATE TABLE Two (id INT NULL);\n'
  writeFileSync(join(frozenDir, 'migration.sql'), frozenSql)
  writeFileSync(join(futureDir, 'migration.sql'), futureSql)
  writeFileSync(join(prismaDir, 'migration-contract.json'), JSON.stringify({
    format: 1,
    migrations: [{ name: '0_legacy_baseline', checksum: createHash('sha256').update(frozenSql).digest('hex') }],
  }, null, 2))
  const missingTestPath = 'backend/__tests__/compat/missing-in-backend-tgz.test.mjs'
  const policyRaw = JSON.stringify({
    previousCompatibleShas: ['a'.repeat(40)],
    compatibilityTests: [missingTestPath],
  }, null, 2)
  writeFileSync(join(futureDir, 'policy.json'), policyRaw)
  const migrations = [
    { name: '0_legacy_baseline', checksum: createHash('sha256').update(frozenSql).digest('hex'), sqlPath: join(frozenDir, 'migration.sql') },
    { name: '202610090001_future', checksum: createHash('sha256').update(futureSql).digest('hex'), sqlPath: join(futureDir, 'migration.sql') },
  ]
  const requirements = buildCompatibilityRequirements([migrations[1]], { verifyTestFiles: false })
  const resultFor = (stage) => ({
    migrationName: '202610090001_future',
    policySha256: createHash('sha256').update(policyRaw).digest('hex'),
    previousCompatibleSha: 'a'.repeat(40),
    testPath: missingTestPath,
    stage,
    candidateSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    command: 'node --test missing-in-backend-tgz.test.mjs',
    exitCode: 0,
    stdoutSha256: 'b'.repeat(64),
    stderrSha256: 'c'.repeat(64),
  })
  const manifestPath = join(root, 'manifest.json')
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'd'.repeat(40),
    activeSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { frozenPrefixLength: 1, futureMigrationNames: ['202610090001_future'] },
    migrations: migrations.map((migration) => ({ name: migration.name, checksum: migration.checksum, sqlPath: migration.sqlPath })),
    prefixes: [],
    compatibility: { status: 'verified', requirements, results: requirements.flatMap((requirement) => requirement.stages.map(resultFor)) },
  }, null, 2))

  assert.doesNotThrow(
    () => verifyEvidenceManifest({ manifestPath, sha: 'd'.repeat(40), runId: '1001', runAttempt: '1', prismaDir }),
  )
})

test('preparation compatibility binds the reviewed previous production SHA', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-prep-sha-'))
  const manifestPath = join(root, 'manifest.json')
  const resultFor = (stage, previousProdSha) => ({
    stage,
    previousProdSha,
    candidateSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    command: 'node --test prep.test.mjs',
    exitCode: 0,
    stdoutSha256: 'b'.repeat(64),
    stderrSha256: 'c'.repeat(64),
  })
  writeFileSync(manifestPath, JSON.stringify({
    format: 1,
    sha: 'd'.repeat(40),
    activeSha: 'd'.repeat(40),
    sourceTestRunId: '1001',
    sourceTestRunAttempt: '1',
    policy: { futureMigrationNames: [] },
    prefixes: [],
    compatibility: { status: 'not-applicable', requirements: [], results: [] },
    preparationCompatibility: {
      status: 'verified',
      results: [
        resultFor('previous-prod', 'bad'.padEnd(40, '0')),
        resultFor('candidate', 'cd32fcc04d1bf16ec472a69b683be06d1eda61ed'),
      ],
    },
  }, null, 2))

  assert.throws(
    () => verifyEvidenceManifest({ manifestPath, sha: 'd'.repeat(40), runId: '1001', runAttempt: '1' }),
    /EVIDENCE_PREPARATION_COMPATIBILITY/,
  )
})

test('db evidence CLI build requires current frozen preparation compatibility before fixture work', () => {
  const root = mkdtempSync(join(tmpdir(), 'db-evidence-build-prep-'))
  const result = spawnSync(process.execPath, ['scripts/deploy/db-evidence.mjs', 'build'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      MIGRATION_EVIDENCE_DIR: root,
      GITHUB_SHA: 'd'.repeat(40),
      RUN_ID: '1001',
      ATTEMPT: '1',
      MIGRATION_TEST_ADMIN_URL: 'mysql://root:secret@127.0.0.1:13317/mysql',
    },
    encoding: 'utf8',
  })

  assert.equal(result.status, 1)
  assert.match(result.stderr, /PREPARATION_COMPATIBILITY_REQUIRED/)
  assert.doesNotMatch(result.stderr + result.stdout, /secret/)
})

test('introspection output fails closed on unsupported fields and warnings', () => {
  assert.throws(
    () => assertIntrospectionSupported({
      stdout: 'model Bad {\n  field Unsupported("point")\n}\n',
      stderr: '',
      inventoriedNgram: [],
    }),
    /PRISMA_PULL_UNSUPPORTED/,
  )
  assert.throws(
    () => assertIntrospectionSupported({
      stdout: '',
      stderr: 'Warning: These constraints are not supported by Prisma Client.',
      inventoriedNgram: [],
    }),
    /PRISMA_PULL_WARNING/,
  )
})

test('future migration evidence does not require frozen-release preparation records', () => {
  const prismaDir = mkdtempSync(join(tmpdir(), 'db-evidence-future-prep-'))
  writeFileSync(join(prismaDir, 'migration-contract.json'), JSON.stringify({ format: 1, migrations: [{ name: '0_baseline', checksum: createHash('sha256').update('CREATE TABLE Thing (id INT);').digest('hex') }] }))
  for (const name of ['0_baseline', '202610090001_future']) {
    mkdirSync(join(prismaDir, 'migrations', name), { recursive: true })
    writeFileSync(join(prismaDir, 'migrations', name, 'migration.sql'), 'CREATE TABLE Thing (id INT);')
  }
  assert.doesNotThrow(() => assertPreparationCompatibilityPresent(prismaDir, []))
})
