import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  PREPARATION_PREVIOUS_SHA,
  buildTestEnv,
  discoverCompatibilityRequirements,
  runCompatibility,
} from './db-compatibility.mjs'

import { validatePreparationCompatibility } from './db-schema.mjs'

const TEST_PATH = 'scripts/deploy/fixtures/db-application-compatibility.mjs'

test('buildTestEnv passes only backend dir and isolated database URL from sensitive process env', () => {
  const env = buildTestEnv({ backendDir: '/backend-old', databaseUrl: 'mysql://root:secret@127.0.0.1:13317/db' }, {
    PATH: '/bin',
    HOME: '/tmp/home',
    GITHUB_TOKEN: 'secret-token',
    DATABASE_URL: 'mysql://prod:secret@example/prod',
    AWS_SECRET_ACCESS_KEY: 'secret',
  })

  assert.equal(env.MIGRATION_COMPAT_BACKEND_DIR, '/backend-old')
  assert.equal(env.DATABASE_URL, 'mysql://root:secret@127.0.0.1:13317/db')
  assert.equal(env.PATH, '/bin')
  assert.equal(env.HOME, '/tmp/home')
  assert.equal(env.GITHUB_TOKEN, undefined)
  assert.equal(env.AWS_SECRET_ACCESS_KEY, undefined)
})


test('application compatibility fixture refuses non-isolated database URLs before loading backend code', () => {
  const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('NODE_TEST')))
  const result = spawnSync(process.execPath, ['--test', TEST_PATH], {
    cwd: process.cwd(),
    env: {
      ...childEnv,
      MIGRATION_COMPAT_BACKEND_DIR: '/tmp/not-used-before-url-guard',
      DATABASE_URL: 'mysql://prod:secret@example.com/ilsangkit',
    },
    encoding: 'utf8',
  })

  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}\n${result.stderr}`, /DATABASE_URL_LOOPBACK/)
})

test('discovers future policy requirements with DDL-prefix stages and rejects missing future policy', async () => {
  const root = await createPrismaFixture({ withPolicy: true })

  const requirements = await discoverCompatibilityRequirements({ prismaDir: join(root, 'backend', 'prisma') })
  assert.equal(requirements.length, 1)
  assert.equal(requirements[0].migrationName, '202610090001_future')
  assert.equal(requirements[0].previousCompatibleSha, 'a'.repeat(40))
  assert.equal(requirements[0].testPath, TEST_PATH)
  assert.deepEqual(requirements[0].stages, ['before', 'partial:1', 'after', 'current-final'])
  assert.match(requirements[0].policySha256, /^[a-f0-9]{64}$/)

  const missingPolicy = await createPrismaFixture({ withPolicy: false })
  await assert.rejects(
    () => discoverCompatibilityRequirements({ prismaDir: join(missingPolicy, 'backend', 'prisma') }),
    /COMPATIBILITY_POLICY_REQUIRED:202610090001_future/,
  )
})

test('runCompatibility uses distinct staged fixtures, app roles, test checksums, and redacted evidence', async () => {
  const root = await createPrismaFixture({ withPolicy: true })
  const candidateBackendDir = join(root, 'backend')
  const workDir = join(root, 'work')
  const calls = []
  const stageUrls = new Map()
  const fakeRunner = async (command, args, options = {}) => {
    calls.push({ command, args, cwd: options.cwd, env: options.env })
    return { code: 0, stdout: `${command} ${args.join(' ')}`, stderr: '' }
  }
  const fakeCheckout = async ({ sha, destination }) => {
    calls.push({ checkout: sha, destination })
    await mkdir(join(destination, 'backend'), { recursive: true })
  }
  const fixtureFactory = async (label) => ({
    url: `mysql://root:fixture-secret@127.0.0.1:13317/${label}`,
    async applyCompatibilityStage({ stage }) {
      stageUrls.set(stage, this.url)
      return { schemaSha256: createHash('sha256').update(`${stage}:${this.url}`).digest('hex'), migrationLedgered: stage === 'after' || stage === 'current-final' }
    },
    close: async () => {},
  })

  const result = await runCompatibility({
    repoRoot: root,
    workDir,
    candidateBackendDir,
    candidateSha: 'b'.repeat(40),
    bindCandidateHead: false,
    runId: '1001',
    runAttempt: '2',
    runner: fakeRunner,
    checkoutArchive: fakeCheckout,
    fixtureFactory,
  })

  assert.deepEqual(result.records.map((record) => record.stage), ['before', 'partial:1', 'after', 'current-final'])
  assert.deepEqual(result.records.map((record) => record.appRole), ['previous', 'previous', 'previous', 'candidate'])
  assert.equal(new Set(result.records.map((record) => record.stageSchemaSha256)).size, 4)
  assert.equal(new Set(stageUrls.values()).size, 4)
  assert.equal(result.records.every((record) => /^[a-f0-9]{64}$/.test(record.testSha256)), true)
  assert.ok(calls.some((call) => call.checkout === 'a'.repeat(40)))
  assert.ok(calls.some((call) => call.command === 'npm' && call.args.join(' ') === 'ci'))
  assert.ok(calls.some((call) => call.command === 'npm' && call.args.join(' ') === 'run db:generate'))
  assert.ok(calls.some((call) => call.command === 'npm' && call.args.join(' ') === 'run build'))

  const nodeTestCalls = calls.filter((call) => call.command === process.execPath && call.args[0] === '--test')
  assert.equal(nodeTestCalls.length, 4)
  assert.equal(new Set(nodeTestCalls.map((call) => call.env.DATABASE_URL)).size, 4)
  assert.equal(nodeTestCalls[0].env.MIGRATION_COMPAT_BACKEND_DIR.endsWith('/backend'), true)
  for (const call of nodeTestCalls) assert.equal(call.env.GITHUB_TOKEN, undefined)

  const evidence = await readFile(result.evidenceFile, 'utf8')
  assert.doesNotMatch(evidence, /fixture-secret|mysql:\/\//)
  assert.deepEqual(JSON.parse(evidence), result.records)
})


test('runCompatibility writes frozen-only preparation records separately from future evidence', async () => {
  const root = await createPrismaFixture({ withPolicy: false, withFuture: false })
  const result = await runCompatibility({
    repoRoot: root,
    workDir: join(root, 'work-prep'),
    candidateBackendDir: join(root, 'backend'),
    candidateSha: 'b'.repeat(40),
    bindCandidateHead: false,
    runId: '1001',
    runAttempt: '2',
    previousShas: [PREPARATION_PREVIOUS_SHA],
    testPaths: [TEST_PATH],
    runner: async () => ({ code: 0, stdout: '', stderr: '' }),
    checkoutArchive: async ({ destination }) => mkdir(join(destination, 'backend'), { recursive: true }),
    fixtureFactory: async (label) => ({
      url: `mysql://root:fixture-secret@127.0.0.1:13317/${label}`,
      applyCompatibilityStage: async ({ stage }) => ({ schemaSha256: sha256(stage) }),
      close: async () => {},
    }),
  })

  assert.equal(validatePreparationCompatibility({ preparationCompatibility: result.preparationRecords, candidateSha: 'b'.repeat(40), runId: '1001', runAttempt: '2' }).status, 'verified')
  assert.deepEqual(result.futureRecords, [])
  assert.deepEqual(result.preparationRecords.map((record) => record.stage), ['previous-prod', 'candidate'])
  assert.deepEqual(JSON.parse(await readFile(result.evidenceFile, 'utf8')), [])
  assert.deepEqual(JSON.parse(await readFile(result.preparationEvidenceFile, 'utf8')).map((record) => record.stage), ['previous-prod', 'candidate'])
})

test('runCompatibility rejects non-full SHA and failed builds/tests', async () => {
  const root = await createPrismaFixture({ withPolicy: true })
  await assert.rejects(
    () => runCompatibility({
      repoRoot: root,
      workDir: join(root, 'work'),
      candidateBackendDir: join(root, 'backend'),
      candidateSha: 'b'.repeat(40),
      bindCandidateHead: false,
      runId: '1001',
      runAttempt: '2',
      previousShas: ['abc123'],
      runner: async () => ({ code: 0, stdout: '', stderr: '' }),
      checkoutArchive: async () => {},
      fixtureFactory: async () => ({ url: 'mysql://root:secret@127.0.0.1:13317/fixture', applyCompatibilityStage: async () => ({ schemaSha256: 'a'.repeat(64) }), close: async () => {} }),
      compatibilityPlan: { files: [], futureMigrations: [], requirements: [] },
    }),
    /COMPAT_SHA/,
  )

  await assert.rejects(
    () => runCompatibility({
      repoRoot: root,
      workDir: join(root, 'work2'),
      candidateBackendDir: join(root, 'backend'),
      candidateSha: 'b'.repeat(40),
      bindCandidateHead: false,
      runId: '1001',
      runAttempt: '2',
      runner: async (command, args) => ({ code: command === 'npm' && args[0] === 'ci' ? 1 : 0, stdout: 'bad', stderr: 'secret' }),
      checkoutArchive: async ({ destination }) => mkdir(join(destination, 'backend'), { recursive: true }),
      fixtureFactory: async () => ({ url: 'mysql://root:secret@127.0.0.1:13317/fixture', applyCompatibilityStage: async () => ({ schemaSha256: 'a'.repeat(64) }), close: async () => {} }),
    }),
    /COMPAT_COMMAND:npm:ci/,
  )

  await assert.rejects(
    () => runCompatibility({
      repoRoot: root,
      workDir: join(root, 'work3'),
      candidateBackendDir: join(root, 'backend'),
      candidateSha: 'b'.repeat(40),
      bindCandidateHead: false,
      runId: '1001',
      runAttempt: '2',
      runner: async (command) => ({ code: command === process.execPath ? 1 : 0, stdout: 'test failed', stderr: '' }),
      checkoutArchive: async ({ destination }) => mkdir(join(destination, 'backend'), { recursive: true }),
      fixtureFactory: async () => ({ url: 'mysql://root:secret@127.0.0.1:13317/fixture', applyCompatibilityStage: async () => ({ schemaSha256: 'a'.repeat(64) }), close: async () => {} }),
    }),
    /COMPAT_TEST_EXIT/,
  )
})

async function createPrismaFixture({ withPolicy, withFuture = true }) {
  const root = mkdtempSync(join(tmpdir(), 'db-compat-policy-'))
  const prismaDir = join(root, 'backend', 'prisma')
  const baselineDir = join(prismaDir, 'migrations', '0_legacy_baseline')
  const futureDir = join(prismaDir, 'migrations', '202610090001_future')
  await mkdir(baselineDir, { recursive: true })
  if (withFuture) await mkdir(futureDir, { recursive: true })
  const baselineSql = 'CREATE TABLE AffiliateBanner (id VARCHAR(36) PRIMARY KEY);\n'
  await writeFile(join(baselineDir, 'migration.sql'), baselineSql)
  await writeFile(join(prismaDir, 'migration-contract.json'), `${JSON.stringify({
    format: 1,
    migrations: [{ name: '0_legacy_baseline', checksum: sha256(baselineSql) }],
  }, null, 2)}\n`)
  const futureSql = `SET SESSION lock_wait_timeout = 5;
ALTER TABLE AffiliateBanner ADD COLUMN compatOne VARCHAR(20) NULL;
ALTER TABLE AffiliateBanner ADD COLUMN compatTwo VARCHAR(20) NULL;
`
  if (withFuture) await writeFile(join(futureDir, 'migration.sql'), futureSql)
  if (withFuture && withPolicy) {
    await writeFile(join(futureDir, 'policy.json'), `${JSON.stringify({
      sqlSha256: sha256(futureSql),
      creates: [],
      addsNullable: [
        { table: 'AffiliateBanner', column: 'compatOne' },
        { table: 'AffiliateBanner', column: 'compatTwo' },
      ],
      backupTables: ['AffiliateBanner'],
      previousCompatibleShas: ['a'.repeat(40)],
      compatibilityTests: [TEST_PATH],
      postconditions: [],
    }, null, 2)}\n`)
  }
  return root
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}
