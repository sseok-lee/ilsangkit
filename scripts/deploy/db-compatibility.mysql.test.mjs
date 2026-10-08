import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { cpSync, mkdtempSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { runCompatibility } from './db-compatibility.mjs'

const TEST_PATH = 'scripts/deploy/fixtures/db-application-compatibility.mjs'
const FUTURE_MIGRATION = '202610090001_compat_two_step'

test('runCompatibility proves real before partial after and current schema stages on separate MySQL fixtures', async () => {
  const root = mkdtempSync(join(tmpdir(), 'db-compat-mysql-'))
  const candidateBackendDir = join(root, 'backend')
  cpSync('backend/prisma', join(candidateBackendDir, 'prisma'), { recursive: true, dereference: true })
  await writeFutureMigration(candidateBackendDir)

  const observed = []
  const fakeRunner = async (command, args, options = {}) => {
    if (command === process.execPath && args[0] === '--test') {
      const stage = ['before', 'partial:1', 'after', 'current-final'][observed.length]
      observed.push({
        stage,
        columns: queryDatabase(options.env.DATABASE_URL, `SELECT COLUMN_NAME AS columnName
          FROM INFORMATION_SCHEMA.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE()
            AND TABLE_NAME = 'AffiliateBanner'
            AND COLUMN_NAME IN ('compatOne', 'compatTwo')
          ORDER BY COLUMN_NAME`),
        ledger: queryDatabase(options.env.DATABASE_URL, `SELECT migration_name AS migrationName
          FROM _prisma_migrations
          WHERE migration_name = '${FUTURE_MIGRATION}'`),
      })
    }
    return { code: 0, stdout: '', stderr: '' }
  }

  const result = await runCompatibility({
    repoRoot: root,
    workDir: join(root, 'work'),
    candidateBackendDir,
    candidateSha: 'c'.repeat(40),
    bindCandidateHead: false,
    runId: '2002',
    runAttempt: '3',
    runner: fakeRunner,
    checkoutArchive: async ({ destination }) => mkdir(join(destination, 'backend'), { recursive: true }),
  })

  assert.deepEqual(result.futureRecords.map((record) => record.stage), ['before', 'partial:1', 'after', 'current-final'])
  assert.deepEqual(observed.map((entry) => entry.stage), ['before', 'partial:1', 'after', 'current-final'])
  assert.deepEqual(observed[0].columns, [])
  assert.deepEqual(observed[0].ledger, [])
  assert.deepEqual(observed[1].columns.map((row) => row.columnName), ['compatOne'])
  assert.deepEqual(observed[1].ledger, [])
  assert.deepEqual(observed[2].columns.map((row) => row.columnName), ['compatOne', 'compatTwo'])
  assert.equal(observed[2].ledger.length, 1)
  assert.deepEqual(observed[3].columns.map((row) => row.columnName), ['compatOne', 'compatTwo'])
  assert.equal(observed[3].ledger.length, 1)

  const futureEvidence = JSON.parse(await readFile(result.evidenceFile, 'utf8'))
  const preparationEvidence = JSON.parse(await readFile(result.preparationEvidenceFile, 'utf8'))
  assert.equal(futureEvidence.length, 4)
  assert.deepEqual(preparationEvidence, [])
})

async function writeFutureMigration(candidateBackendDir) {
  const migrationDir = join(candidateBackendDir, 'prisma', 'migrations', FUTURE_MIGRATION)
  await mkdir(migrationDir, { recursive: true })
  const sql = `SET SESSION lock_wait_timeout = 5;
ALTER TABLE AffiliateBanner ADD COLUMN compatOne VARCHAR(20) NULL;
ALTER TABLE AffiliateBanner ADD COLUMN compatTwo VARCHAR(20) NULL;
`
  await writeFile(join(migrationDir, 'migration.sql'), sql)
  await writeFile(join(migrationDir, 'policy.json'), `${JSON.stringify({
    sqlSha256: sha256(sql),
    creates: [],
    addsNullable: [
      { table: 'AffiliateBanner', column: 'compatOne' },
      { table: 'AffiliateBanner', column: 'compatTwo' },
    ],
    backupTables: ['AffiliateBanner'],
    previousCompatibleShas: ['d'.repeat(40)],
    compatibilityTests: [TEST_PATH],
    postconditions: [],
  }, null, 2)}\n`)
}

function queryDatabase(databaseUrl, sql) {
  const url = new URL(databaseUrl)
  const result = spawnSync('mysql', [
    '--protocol=TCP',
    `--host=${url.hostname}`,
    `--port=${url.port || '3306'}`,
    `--user=${decodeURIComponent(url.username)}`,
    '--default-character-set=utf8mb4',
    '--batch',
    '--raw',
    `--database=${decodeURIComponent(url.pathname.slice(1))}`,
    '--execute',
    sql,
  ], {
    env: { ...process.env, MYSQL_PWD: decodeURIComponent(url.password) },
    encoding: 'utf8',
  })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return parseTabular(result.stdout)
}

function parseTabular(output) {
  const lines = output.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) return []
  const headers = lines[0].split('\t')
  return lines.slice(1).map((line) => Object.fromEntries(line.split('\t').map((value, index) => [headers[index], value === 'NULL' ? null : value])))
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
