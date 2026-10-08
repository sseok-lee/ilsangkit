import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { createMysqlFixture } from './fixtures/db-mysql.mjs'
import { buildEvidence, createDbRuntime, readDbSnapshot, verifySchema } from './db-schema.mjs'

test('readDbSnapshot captures ngram parsers, checks, and unknown inventory', async (t) => {
  const db = await createMysqlFixture(t, 'schema-snapshot')
  await db.exec(`
    CREATE TABLE ParentThing (
      id INT NOT NULL,
      CONSTRAINT ParentThing_chk CHECK (id > 0),
      PRIMARY KEY (id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE TABLE ChildThing (
      id INT NOT NULL,
      parentId INT NOT NULL,
      body TEXT NULL,
      FULLTEXT KEY ChildThing_body_idx (body) WITH PARSER ngram,
      CONSTRAINT ChildThing_parentId_fkey FOREIGN KEY (parentId) REFERENCES ParentThing(id) ON DELETE CASCADE ON UPDATE RESTRICT,
      PRIMARY KEY (id)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    CREATE VIEW ChildThingNames AS SELECT id FROM ChildThing;
  `)

  const runtime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const snapshot = await readDbSnapshot(runtime)
  await runtime.close()

  assert.equal(snapshot.identity.database.startsWith('ilsangkit_migration_test_'), true)
  assert.equal(snapshot.structure.indexes.find((index) => index.name === 'ChildThing_body_idx').parser, 'ngram')
  assert.equal(snapshot.structure.checks.find((check) => check.name === 'ParentThing_chk').expression.includes('`id` > 0'), true)
  assert.deepEqual(snapshot.structure.inventory.views, [{ name: 'ChildThingNames' }])
})

test('verifySchema compares actual structure against generated evidence and fails on drift', async (t) => {
  const db = await createMysqlFixture(t, 'schema-verify')
  await db.prisma(['migrate', 'deploy'])
  const runtime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const snapshot = await readDbSnapshot(runtime)
  const evidenceDir = mkdtempSync(join(tmpdir(), 'db-schema-evidence-'))
  mkdirSync(join(evidenceDir, 'prefixes', '0006'), { recursive: true })
  writeFileSync(join(evidenceDir, 'prefixes', '0006', 'structure.json'), `${JSON.stringify(snapshot.structure, null, 2)}\n`)
  writeFileSync(join(evidenceDir, 'prefixes', '0006', 'schema.prisma'), readFileSync(db.schemaPath, 'utf8'))

  await verifySchema({ runtime, evidenceDir, prefixLength: 6 })

  await db.exec('ALTER TABLE AffiliateBanner ADD COLUMN driftNote TEXT NULL')
  await assert.rejects(
    () => verifySchema({ runtime, evidenceDir, prefixLength: 6 }),
    /SCHEMA_STRUCTURE/,
  )
  await runtime.close()
})



test('verifySchema rejects datamodel drift even when supplied structure matches the live database', async (t) => {
  const db = await createMysqlFixture(t, 'schema-diff')
  await db.prisma(['migrate', 'deploy'])
  const originalSchema = readFileSync(db.schemaPath, 'utf8')
  await db.exec('ALTER TABLE AffiliateBanner ADD COLUMN datamodelOnlyDrift TEXT NULL')
  const runtime = createDbRuntime({ backendDir: db.backendDir, databaseUrl: db.url })
  const snapshot = await readDbSnapshot(runtime)
  const evidenceDir = mkdtempSync(join(tmpdir(), 'db-schema-diff-evidence-'))
  mkdirSync(join(evidenceDir, 'prefixes', '0006'), { recursive: true })
  writeFileSync(join(evidenceDir, 'prefixes', '0006', 'structure.json'), `${JSON.stringify(snapshot.structure, null, 2)}\n`)
  writeFileSync(join(evidenceDir, 'prefixes', '0006', 'schema.prisma'), originalSchema)

  await assert.rejects(
    () => verifySchema({ runtime, evidenceDir, prefixLength: 6 }),
    /SCHEMA_DATAMODEL_DIFF/,
  )
  await runtime.close()
})

test('buildEvidence writes prefix artifacts and rejects product schema drift without migration replay', async (t) => {
  const outputDir = mkdtempSync(join(tmpdir(), 'db-build-evidence-'))

  await buildEvidence({
    prismaDir: join(process.cwd(), 'backend/prisma'),
    outputDir,
    sha: 'task3sha',
    runId: '1001',
    runAttempt: '1',
    fixtureFactory: (label) => createMysqlFixture(t, label),
  })

  const manifest = JSON.parse(readFileSync(join(outputDir, 'manifest.json'), 'utf8'))
  assert.equal(manifest.sha, 'task3sha')
  assert.equal(manifest.activeSha, 'task3sha')
  assert.equal(manifest.sourceTestRunId, '1001')
  assert.equal(manifest.sourceTestRunAttempt, '1')
  assert.deepEqual(manifest.policy.generatedPrefixLengths, [6])
  assert.equal(manifest.prefixes.length, 1)
  assert.equal(manifest.prefixes[0].prefixLength, manifest.migrations.length)
  assert.equal(manifest.compatibility.status, 'not-applicable')
  assert.equal(manifest.preparationCompatibility.status, 'not-provided')
  assert.equal(existsSync(join(outputDir, 'private-logs')), false)
  assert.equal(manifest.mysql.checks.length > 0, true)
  assert.equal(manifest.introspection.allowedUnsupported.some((entry) => entry.kind === 'mysql-check-constraint'), true)
  assert.equal(manifest.finalDatamodelDiff.exitCode, 0)
  assert.match(readFileSync(join(outputDir, manifest.prefixes.at(-1).schemaPath), 'utf8'), /model AffiliateBanner/)

  const driftFixtureFactory = async () => {
    const fixture = await createMysqlFixture(t, 'drift-schema-only')
    writeFileSync(
      fixture.schemaPath,
      `${readFileSync(fixture.schemaPath, 'utf8')}\nmodel DriftOnly {\n  id Int @id @default(autoincrement())\n}\n`,
    )
    return fixture
  }
  await assert.rejects(
    () => buildEvidence({
      prismaDir: join(process.cwd(), 'backend/prisma'),
      outputDir: mkdtempSync(join(tmpdir(), 'db-build-evidence-drift-')),
      sha: 'driftsha',
      runId: '1002',
      runAttempt: '1',
      fixtureFactory: driftFixtureFactory,
    }),
    /PRISMA_DIFF/,
  )
})
