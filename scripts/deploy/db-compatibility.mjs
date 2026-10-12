#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { readMigrationFiles, splitSqlStatements } from './db-contract.mjs'
import { buildCompatibilityRequirements } from './db-schema.mjs'
import { createMysqlFixture } from './fixtures/db-mysql.mjs'

export const PREPARATION_PREVIOUS_SHA = 'cd32fcc04d1bf16ec472a69b683be06d1eda61ed'
const PREPARATION_POLICY_SHA = sha256('preparation-compatibility-v1')
const DEFAULT_TEST_PATH = 'scripts/deploy/fixtures/db-application-compatibility.mjs'
const MAX_CAPTURE_BYTES = 1024 * 1024
const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../..')

export function buildTestEnv({ backendDir, databaseUrl }, baseEnv = process.env) {
  const env = {}
  for (const key of ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'CI', 'NO_COLOR', 'NODE_OPTIONS', 'PRISMA_HIDE_UPDATE_MESSAGE']) {
    if (baseEnv[key] !== undefined) env[key] = baseEnv[key]
  }
  env.MIGRATION_COMPAT_BACKEND_DIR = backendDir
  env.DATABASE_URL = databaseUrl
  return env
}

export async function discoverCompatibilityRequirements({ prismaDir }) {
  return discoverCompatibilityPlan({ prismaDir }).requirements
}

export function discoverCompatibilityPlan({ prismaDir }) {
  const files = readMigrationFiles(prismaDir)
  const contractPath = join(prismaDir, 'migration-contract.json')
  const contract = JSON.parse(readFileSync(contractPath, 'utf8'))
  const frozenPrefixLength = contract.migrations.length
  const futureMigrations = files.slice(frozenPrefixLength).map((migration, offset) => ({
    ...migration,
    prefixLength: frozenPrefixLength + offset + 1,
  }))
  const requirements = futureMigrations.length > 0 ? buildCompatibilityRequirements(futureMigrations) : []
  return { files, frozenPrefixLength, futureMigrations, requirements }
}

export async function runCompatibility(options = {}) {
  const root = resolve(options.repoRoot ?? repoRoot)
  const workDir = resolve(options.workDir ?? process.env.MIGRATION_COMPAT_WORK_DIR ?? await mkdtemp(join(tmpdir(), 'db-compatibility-')))
  const sourceCandidateBackendDir = resolve(options.candidateBackendDir ?? process.env.MIGRATION_COMPAT_BACKEND_DIR ?? join(root, 'backend'))
  const candidateSha = options.candidateSha ?? process.env.GITHUB_SHA ?? (await gitOutput(['rev-parse', 'HEAD'], { cwd: root })).trim()
  assertFullSha(candidateSha)
  if (options.bindCandidateHead !== false) await assertCandidateHead({ root, candidateSha })
  const runId = String(options.runId ?? process.env.GITHUB_RUN_ID ?? process.env.RUN_ID ?? '')
  const runAttempt = String(options.runAttempt ?? process.env.GITHUB_RUN_ATTEMPT ?? process.env.ATTEMPT ?? '')
  if (!runId) throw new Error('COMPAT_RUN_ID')
  if (!runAttempt) throw new Error('COMPAT_RUN_ATTEMPT')
  const runner = options.runner ?? runCommand
  const checkoutArchive = options.checkoutArchive ?? checkoutGitArchive
  const fixtureFactory = options.fixtureFactory ?? defaultFixtureFactory
  const outputFile = resolve(options.outputFile ?? process.env.COMPATIBILITY_EVIDENCE_FILE ?? join(workDir, 'compatibility-evidence.json'))
  const preparationOutputFile = resolve(options.preparationOutputFile ?? process.env.PREPARATION_COMPATIBILITY_FILE ?? join(workDir, 'preparation-compatibility-evidence.json'))
  mkdirSync(workDir, { recursive: true, mode: 0o700 })
  mkdirSync(dirname(outputFile), { recursive: true, mode: 0o700 })
  mkdirSync(dirname(preparationOutputFile), { recursive: true, mode: 0o700 })

  const candidateBackendDir = options.copyCandidateBackend === false
    ? sourceCandidateBackendDir
    : copyCandidateBackendForBuild({ sourceBackendDir: sourceCandidateBackendDir, workDir })
  const plan = options.compatibilityPlan ?? discoverCompatibilityPlan({ prismaDir: options.prismaDir ?? join(candidateBackendDir, 'prisma') })
  const migrationFiles = options.migrationFiles ?? plan.files ?? []
  const futureMigrations = options.futureMigrations ?? plan.futureMigrations ?? []
  const policyRequirements = options.requirements ?? plan.requirements ?? []
  const hasFutureRequirements = policyRequirements.length > 0
  const requirements = hasFutureRequirements
    ? policyRequirements
    : buildPreparationRequirements(options.previousShas ?? [PREPARATION_PREVIOUS_SHA], options.testPaths ?? [DEFAULT_TEST_PATH])
  const migrationByName = new Map(futureMigrations.map((migration) => [migration.name, migration]))
  const previousShas = [...new Set(requirements.map((requirement) => requirement.previousCompatibleSha))]
  for (const sha of previousShas) assertFullSha(sha)

  const buildDatabaseUrl = options.buildDatabaseUrl ?? 'mysql://root@127.0.0.1:3306/ilsangkit_migration_test_build'
  const previousBackends = new Map()
  for (const previousSha of previousShas) {
    const checkoutDir = join(workDir, 'checkouts', previousSha)
    await checkoutArchive({ repoRoot: root, sha: previousSha, destination: checkoutDir, runner })
    const backendDir = join(checkoutDir, 'backend')
    await prepareBackend({ backendDir, databaseUrl: buildDatabaseUrl, runner })
    previousBackends.set(previousSha, backendDir)
  }

  await prepareBackend({ backendDir: candidateBackendDir, databaseUrl: buildDatabaseUrl, runner })

  const records = []
  for (const requirement of requirements) {
    const migration = migrationByName.get(requirement.migrationName) ?? null
    const stages = requirement.stages ?? ['current-final']
    for (const stage of stages) {
      const appRole = stage === 'current-final' || stage === 'candidate' ? 'candidate' : 'previous'
      const backendDir = appRole === 'candidate' ? candidateBackendDir : previousBackends.get(requirement.previousCompatibleSha)
      if (!backendDir) throw new Error('COMPAT_PREVIOUS_BACKEND')
      records.push(await runStageCompatibilityTest({
        requirement,
        migration,
        migrationFiles,
        stage,
        appRole,
        backendDir,
        testPath: resolveTestPath(root, requirement.testPath),
        candidateSha,
        runId,
        runAttempt,
        runner,
        fixtureFactory,
      }))
    }
  }

  const futureRecords = hasFutureRequirements ? records : []
  const preparationRecords = hasFutureRequirements ? [] : records
  await writeFile(outputFile, `${JSON.stringify(futureRecords, null, 2)}\n`, { mode: 0o600 })
  await writeFile(preparationOutputFile, `${JSON.stringify(preparationRecords, null, 2)}\n`, { mode: 0o600 })
  return { status: 'verified', records, futureRecords, preparationRecords, evidenceFile: outputFile, preparationEvidenceFile: preparationOutputFile, workDir }
}

function buildPreparationRequirements(previousShas, testPaths) {
  return previousShas.flatMap((previousCompatibleSha) => {
    assertFullSha(previousCompatibleSha)
    return testPaths.map((testPath) => ({
      migrationName: 'preparation-release',
      policySha256: PREPARATION_POLICY_SHA,
      previousCompatibleSha,
      testPath,
      stages: ['previous-prod', 'candidate'],
    }))
  })
}


function copyCandidateBackendForBuild({ sourceBackendDir, workDir }) {
  const destination = join(workDir, 'candidate-backend')
  rmSync(destination, { recursive: true, force: true })
  cpSync(sourceBackendDir, destination, {
    recursive: true,
    dereference: true,
    filter(source) {
      const name = basename(source)
      return name !== 'node_modules' && name !== 'dist' && name !== '.env' && name !== '.env.local'
    },
  })
  return destination
}

async function prepareBackend({ backendDir, databaseUrl, runner }) {
  for (const args of [['ci'], ['run', 'db:generate'], ['run', 'build']]) {
    const result = await runner('npm', args, {
      cwd: backendDir,
      env: buildTestEnv({ backendDir, databaseUrl }),
      timeoutMs: args[0] === 'ci' ? 10 * 60 * 1000 : 5 * 60 * 1000,
    })
    if (result.code !== 0) throw new Error(`COMPAT_COMMAND:npm:${args.join('-')}`)
  }
}

async function runStageCompatibilityTest({ requirement, migration, migrationFiles, stage, appRole, backendDir, testPath, candidateSha, runId, runAttempt, runner, fixtureFactory }) {
  const fixture = await fixtureFactory(`compat-${safeStageLabel(requirement.migrationName)}-${safeStageLabel(stage)}`)
  try {
    const stageState = await prepareFixtureForStage({ fixture, migration, migrationFiles, stage })
    return await runCompatibilityTest({
      requirement,
      stage,
      appRole,
      backendDir,
      testPath,
      databaseUrl: fixture.url,
      candidateSha,
      runId,
      runAttempt,
      runner,
      stageState,
    })
  } finally {
    if (typeof fixture.close === 'function') await fixture.close()
  }
}

async function prepareFixtureForStage({ fixture, migration, migrationFiles, stage }) {
  if (typeof fixture.applyCompatibilityStage === 'function') {
    return fixture.applyCompatibilityStage({ migration, migrationFiles, stage })
  }

  if (!migration) {
    const deploy = await fixture.prisma(['migrate', 'deploy'])
    if (deploy.code !== 0) throw new Error(`COMPAT_FIXTURE_MIGRATE:${deploy.code}`)
    return readStageState({ fixture, migration, stage })
  }

  syncFixtureMigrations(fixture, migrationFiles)
  const beforePrefixLength = migration.prefixLength - 1
  if (stage === 'before') {
    await deployPrefix({ fixture, migrationFiles, prefixLength: beforePrefixLength })
  } else if (stage.startsWith('partial:')) {
    await deployPrefix({ fixture, migrationFiles, prefixLength: beforePrefixLength })
    const count = Number(stage.slice('partial:'.length))
    if (!Number.isInteger(count) || count < 1) throw new Error('COMPAT_STAGE')
    await execMigrationStatements({ fixture, migration, count })
  } else if (stage === 'after') {
    await deployPrefix({ fixture, migrationFiles, prefixLength: migration.prefixLength })
  } else if (stage === 'current-final') {
    await deployPrefix({ fixture, migrationFiles, prefixLength: migrationFiles.length })
  } else {
    throw new Error('COMPAT_STAGE')
  }
  return readStageState({ fixture, migration, stage })
}

function syncFixtureMigrations(fixture, migrationFiles) {
  const migrationsDir = join(fixture.prismaDir, 'migrations')
  mkdirSync(migrationsDir, { recursive: true })
  for (const file of migrationFiles) {
    const destination = join(migrationsDir, file.name)
    if (!existsSync(destination)) cpSync(dirname(file.sqlPath), destination, { recursive: true, dereference: true })
  }
}

async function deployPrefix({ fixture, migrationFiles, prefixLength }) {
  const keep = new Set(migrationFiles.slice(0, prefixLength).map((file) => file.name))
  const migrationsDir = join(fixture.prismaDir, 'migrations')
  for (const entry of readdirSync(migrationsDir, { withFileTypes: true })) {
    if (entry.isDirectory() && !keep.has(entry.name)) rmSync(join(migrationsDir, entry.name), { recursive: true, force: true })
  }
  const deploy = await fixture.prisma(['migrate', 'deploy'])
  if (deploy.code !== 0) throw new Error(`COMPAT_FIXTURE_MIGRATE:${deploy.code}`)
}

async function execMigrationStatements({ fixture, migration, count }) {
  const statements = ddlStatements(readFileSync(migration.sqlPath, 'utf8'))
  if (count >= statements.length) throw new Error('COMPAT_STAGE')
  for (const statement of statements.slice(0, count)) {
    const result = await fixture.exec(statement)
    if (result.code !== 0) throw new Error(`COMPAT_FIXTURE_DDL:${migration.name}`)
  }
}

function ddlStatements(sql) {
  return splitSqlStatements(sql).filter((statement) => !/^SET\s+SESSION\s+lock_wait_timeout\s*=/i.test(statement))
}

async function readStageState({ fixture, migration, stage }) {
  if (!fixture.query) return { stage, schemaSha256: sha256(stage) }
  const columns = await fixture.query(`SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME, ORDINAL_POSITION`)
  const ledger = migration ? await fixture.query(`SELECT migration_name AS migrationName
    FROM _prisma_migrations
    WHERE migration_name = '${escapeSqlLiteral(migration.name)}'`) : []
  return {
    stage,
    schemaSha256: sha256(JSON.stringify(columns)),
    migrationLedgered: ledger.length > 0,
  }
}

async function runCompatibilityTest({ requirement, stage, appRole, backendDir, testPath, databaseUrl, candidateSha, runId, runAttempt, runner, stageState }) {
  if (!existsSync(testPath) || !statSync(testPath).isFile()) throw new Error('COMPAT_TEST_PATH')
  const args = ['--test', testPath]
  const result = await runner(process.execPath, args, {
    cwd: repoRoot,
    env: buildTestEnv({ backendDir, databaseUrl }),
    timeoutMs: 5 * 60 * 1000,
  })
  if (result.code !== 0) throw new Error(`COMPAT_TEST_EXIT:${appRole}:${stage}`)
  const command = `node --test ${requirement.testPath}`
  return {
    migrationName: requirement.migrationName,
    policySha256: requirement.policySha256,
    previousCompatibleSha: requirement.previousCompatibleSha,
    ...(requirement.migrationName === 'preparation-release' ? { previousProdSha: requirement.previousCompatibleSha } : {}),
    testPath: requirement.testPath,
    testSha256: sha256(readFileSync(testPath)),
    stage,
    appRole,
    appBackendSha256: sha256(backendDir),
    candidateSha,
    sourceTestRunId: runId,
    sourceTestRunAttempt: runAttempt,
    command,
    exitCode: result.code,
    stdoutSha256: sha256(result.stdout ?? ''),
    stderrSha256: sha256(result.stderr ?? ''),
    stageSchemaSha256: stageState.schemaSha256,
    migrationLedgered: stageState.migrationLedgered ?? null,
  }
}

function safeStageLabel(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 32) || 'stage'
}

function escapeSqlLiteral(value) {
  return String(value).replaceAll("'", "''")
}

async function assertCandidateHead({ root, candidateSha }) {
  if (!existsSync(join(root, '.git'))) return
  const head = (await gitOutput(['rev-parse', 'HEAD'], { cwd: root })).trim()
  if (head !== candidateSha) throw new Error('COMPAT_CANDIDATE_HEAD')
}

export async function checkoutGitArchive({ repoRoot: root, sha, destination, runner = runCommand }) {
  assertFullSha(sha)
  rmSync(destination, { recursive: true, force: true })
  mkdirSync(destination, { recursive: true, mode: 0o700 })
  const archivePath = join(dirname(destination), `${sha}.tar`)
  const verify = await runner('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: root, timeoutMs: 60_000 })
  if (verify.code !== 0 || verify.stdout.trim() !== sha) throw new Error('COMPAT_GIT_SHA')
  const archive = await runner('git', ['archive', '--format=tar', '--output', archivePath, sha], { cwd: root, timeoutMs: 60_000 })
  if (archive.code !== 0) throw new Error('COMPAT_GIT_ARCHIVE')
  const untar = await runner('tar', ['-xf', archivePath, '-C', destination], { cwd: root, timeoutMs: 60_000 })
  rmSync(archivePath, { force: true })
  if (untar.code !== 0) throw new Error('COMPAT_GIT_ARCHIVE')
}

async function defaultFixtureFactory(label) {
  const cleanups = []
  const t = { after(cleanup) { cleanups.push(cleanup) } }
  const fixture = await createMysqlFixture(t, label)
  return {
    ...fixture,
    async close() {
      for (const cleanup of cleanups.reverse()) await cleanup()
    },
  }
}

function resolveTestPath(root, testPath) {
  const candidate = resolve(root, testPath)
  if (existsSync(candidate)) return candidate
  return resolve(repoRoot, testPath)
}

function assertFullSha(value) {
  if (!/^[a-f0-9]{40}$/i.test(String(value))) throw new Error('COMPAT_SHA')
}

async function gitOutput(args, options) {
  const result = await runCommand('git', args, options)
  if (result.code !== 0) throw new Error('COMPAT_GIT')
  return result.stdout
}

function runCommand(command, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: options.env ?? process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    const timeout = setTimeout(() => child.kill('SIGTERM'), options.timeoutMs ?? 5 * 60 * 1000)
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout = appendBounded(stdout, chunk) })
    child.stderr.on('data', (chunk) => { stderr = appendBounded(stderr, chunk) })
    child.on('error', (error) => {
      clearTimeout(timeout)
      resolvePromise({ code: 127, stdout, stderr: appendBounded(stderr, error.message) })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timeout)
      resolvePromise({ code: signal ? 124 : (code ?? 1), stdout, stderr })
    })
  })
}

function appendBounded(current, chunk) {
  const next = `${current}${chunk}`
  if (next.length <= MAX_CAPTURE_BYTES) return next
  return next.slice(0, MAX_CAPTURE_BYTES)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function main() {
  try {
    if (!process.env.MIGRATION_COMPAT_WORK_DIR) throw new Error('MIGRATION_COMPAT_WORK_DIR_REQUIRED')
    if (!process.env.MIGRATION_TEST_ADMIN_URL) throw new Error('MIGRATION_TEST_ADMIN_URL_REQUIRED')
    const result = await runCompatibility()
    process.stdout.write(`${JSON.stringify({ status: result.status, evidenceFile: result.evidenceFile, preparationEvidenceFile: result.preparationEvidenceFile, futureRecords: result.futureRecords.length, preparationRecords: result.preparationRecords.length, records: result.records.length })}\n`)
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  await main()
}
