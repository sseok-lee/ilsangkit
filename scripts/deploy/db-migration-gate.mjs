import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { chmod, lstat, mkdir, open, readdir, readFile, realpath, rename, rm } from 'node:fs/promises'
import { basename, dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { classifyHistory, readMigrationFiles, validateExpansion } from './db-contract.mjs'
import { createDbRuntime, readDbSnapshot, verifyEvidenceManifest, verifySchema } from './db-schema.mjs'
import { createBackup, verifyBackup } from './db-backup.mjs'

const FORMAT = 1
const DEFAULT_STATE_ROOT = '/home/project2/run/db-migrations'
const MIGRATE_TIMEOUT_MS = 5 * 60 * 1000
const CHILD_KILL_GRACE_MS = 5 * 1000
const currentFile = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(currentFile), '../..')

export async function writeAttempt(stateRoot, attempt) {
  const root = await ensureSecureDirectory(stateRoot || DEFAULT_STATE_ROOT, 'STATE_ROOT')
  const id = safeId(attempt?.id, 'ATTEMPT_ID')
  const attemptsDir = await ensureSecureDirectory(join(root, 'attempts'), 'ATTEMPTS_DIR')
  assertPathContained(root, attemptsDir, 'ATTEMPTS_DIR_ESCAPE')

  const target = join(attemptsDir, `${id}.json`)
  assertPathContained(attemptsDir, target, 'ATTEMPT_PATH_ESCAPE')
  const previous = await readExistingAttemptForTransition(target, id)
  const next = previous
    ? normalizeAttemptTransition(previous, attempt)
    : normalizeAttemptForWrite(attempt)
  const temp = join(attemptsDir, `.${id}.${process.pid}.${randomUUID()}.tmp`)
  const handle = await open(temp, 'wx', 0o600)
  try {
    await handle.writeFile(`${JSON.stringify(next, null, 2)}\n`)
    await handle.sync()
  } finally {
    await handle.close()
  }

  try {
    await rename(temp, target)
    await fsyncDirectory(attemptsDir)
  } catch (error) {
    await rm(temp, { force: true }).catch(() => {})
    throw error
  }
}

export async function readAttempts(stateRoot) {
  const root = await secureExistingStateRootForRead(stateRoot || DEFAULT_STATE_ROOT)
  if (!root) return []
  const attemptsDir = join(root, 'attempts')
  if (!existsSync(attemptsDir)) return []
  await assertNoSymlinkPathComponents(attemptsDir, 'ATTEMPTS_DIR')
  const attemptsReal = await realpath(attemptsDir)
  assertPathContained(root, attemptsReal, 'ATTEMPTS_DIR_ESCAPE')
  const names = (await readdir(attemptsDir)).filter((name) => name.endsWith('.json')).sort()
  const attempts = []
  for (const name of names) {
    const id = name.slice(0, -'.json'.length)
    safeId(id, 'ATTEMPT_PATH')
    const fullPath = join(attemptsReal, name)
    const info = await lstat(fullPath)
    if (info.isSymbolicLink()) throw new Error(`ATTEMPT_SYMLINK:${name}`)
    if (!info.isFile()) throw new Error(`ATTEMPT_NOT_FILE:${name}`)
    let parsed
    try {
      parsed = JSON.parse(await readFile(fullPath, 'utf8'))
    } catch (error) {
      throw new Error(`ATTEMPT_CORRUPT:${name}`)
    }
    const attempt = normalizeAttemptForRead(parsed)
    if (attempt.id !== id) throw new Error(`ATTEMPT_PATH_MISMATCH:${name}`)
    attempts.push(attempt)
  }
  return attempts
}

export async function runMigrationGate(context, deps = createMigrationGateDeps(context)) {
  validateContext(context)
  const resolvedDeps = {
    preflight: deps.preflight,
    backup: deps.backup,
    beforeApply: deps.beforeApply ?? (async () => {}),
    persist: deps.persist ?? ((attempt) => writeAttempt(context.stateRoot, attempt)),
    migrate: deps.migrate,
    postcheck: deps.postcheck,
  }

  const preflight = await resolvedDeps.preflight(context)
  const pending = preflight.pending ?? []
  const attemptBase = preflight.attemptBase ?? {}

  if (pending.length === 0) {
    const postcheck = await resolvedDeps.postcheck(context, { pending, attempt: null })
    return { db: 'verified', applied: postcheck?.applied ?? [] }
  }

  const backup = await resolvedDeps.backup(context, pending)
  await resolvedDeps.beforeApply(context, { pending, backup, attemptBase })
  const applying = buildAttempt(context, attemptBase, pending, backup, 'applying')
  await resolvedDeps.persist(applying)

  let migrateResult
  try {
    migrateResult = await resolvedDeps.migrate(context, applying, {
      recordProcess: (processInfo) => resolvedDeps.persist({ ...applying, process: processInfo }),
    })
  } catch (error) {
    await resolvedDeps.persist(failedAttempt(applying, error, migrateResult))
    throw error
  }

  let postcheck
  try {
    postcheck = await resolvedDeps.postcheck(context, { pending, attempt: applying, migrate: migrateResult })
  } catch (error) {
    await resolvedDeps.persist(failedAttempt(applying, error, migrateResult))
    throw error
  }

  const verified = {
    ...applying,
    phase: 'verified',
    verifiedAt: new Date().toISOString(),
    migrate: summarizeMigrateResult(migrateResult),
  }
  await resolvedDeps.persist(verified)
  return { db: 'verified', applied: postcheck?.applied ?? pending.map((migration) => migration.name) }
}

export function createMigrationGateDeps(context) {
  return {
    preflight: preflightMigrationGate,
    backup: backupMigrationGate,
    beforeApply: async () => {},
    persist: (attempt) => writeAttempt(context.stateRoot, attempt),
    migrate: migrateDeploy,
    postcheck: postcheckMigrationGate,
  }
}

export async function preflightMigrationGate(context) {
  context = normalizeContextWithBaseline(context)
  validateContext(context)
  assertNoUnresolvedAttempts(await readAttempts(context.stateRoot))
  const activeState = readActiveDeploymentState(context)
  assertActiveReadiness(context, activeState)
  const databaseUrl = resolveDatabaseUrl(context)
  const backendDir = resolveBackendDir(context)
  const prismaDir = resolve(context.prismaDir ?? join(backendDir, 'prisma'))
  const runtime = createDbRuntime({ backendDir, databaseUrl })
  try {
    const snapshot = await readDbSnapshot(runtime)
    assertIdentity(snapshot.identity, context.expectedDb)

    const files = readMigrationFiles(prismaDir)
    const history = classifyHistory(files, snapshot.ledger, {
      allowBaselineGaps: context.allowBaselineGaps === true,
      frozenMigrations: context.frozenMigrations,
    })
    const manifest = verifyEvidenceManifest({
      manifestPath: evidenceManifestPath(context),
      sha: context.sha,
      runId: context.runId,
      runAttempt: context.runAttempt,
      prismaDir,
    })
    const pending = files.filter((file) => history.pending.includes(file.name))
    const policies = pending.map((migration) => readAndValidatePolicy(migration, context))
    assertCompatibility(policies, { ...context, actualActiveSha: context.actualActiveSha ?? activeState?.sha })

    await verifySchema({ runtime, evidenceDir: context.evidenceDir, prefixLength: history.prefixLength })

    return {
      pending,
      attemptBase: {
        id: attemptId(context),
        identity: snapshot.identity,
        history,
        evidence: {
          manifestPath: evidenceManifestPath(context),
          manifestSha256: sha256(readFileSync(evidenceManifestPath(context))),
          prefixes: manifest.prefixes?.length ?? 0,
        },
        policies: policies.map(({ migration, policy }) => ({
          migration: migration.name,
          sqlSha256: policy.sqlSha256,
          creates: policy.creates ?? [],
          addsNullable: policy.addsNullable ?? [],
          backupTables: policy.backupTables ?? [],
          previousCompatibleShas: policy.previousCompatibleShas ?? [],
          compatibilityTests: policy.compatibilityTests ?? [],
          postconditions: normalizePolicyPostconditions(policy.postconditions ?? [], migration.name),
        })),
      },
    }
  } finally {
    await runtime.close()
  }
}

export async function backupMigrationGate(context, pending) {
  const policies = pending.map((migration) => readPolicyFile(migration))
  const tables = unique(policies.flatMap((policy) => policy.backupTables ?? []))
  const backup = await createBackup({
    context,
    runtime: { databaseUrl: resolveDatabaseUrl(context) },
    tables,
    kind: 'migration',
  })
  await verifyBackup(backup)
  return backup
}

export async function migrateDeploy(context, _attempt = null, hooks = {}) {
  const backendDir = resolveBackendDir(context)
  const prismaCli = join(backendDir, 'node_modules/prisma/build/index.js')
  const command = process.execPath
  const args = [prismaCli, 'migrate', 'deploy', '--schema', join(backendDir, 'prisma/schema.prisma')]
  const startedAt = new Date().toISOString()
  const result = await runChild(command, args, {
    cwd: backendDir,
    env: buildPrismaEnv(resolveDatabaseUrl(context)),
    timeoutMs: context.migrateTimeoutMs ?? MIGRATE_TIMEOUT_MS,
    onProcess: hooks.recordProcess,
  })
  result.process.command = command
  result.process.args = ['<node>', '<prisma>', 'migrate', 'deploy', '--schema', '<schema>']
  result.process.startedAt = startedAt
  if (result.code !== 0) {
    const error = new Error(`MIGRATE_DEPLOY:${result.code}`)
    error.process = result.process
    error.output = sanitizeOutput(result.stderr || result.stdout)
    throw error
  }
  return result
}

export async function postcheckMigrationGate(context, gateState = {}) {
  const databaseUrl = resolveDatabaseUrl(context)
  const backendDir = resolveBackendDir(context)
  const prismaDir = resolve(context.prismaDir ?? join(backendDir, 'prisma'))
  const runtime = createDbRuntime({ backendDir, databaseUrl })
  try {
    const status = await runtime.runPrisma(['migrate', 'status', '--schema', join(prismaDir, 'schema.prisma')], {
      timeoutMs: context.migrateTimeoutMs ?? MIGRATE_TIMEOUT_MS,
    })
    if (status.code !== 0) throw new Error(`PRISMA_STATUS:${status.code}`)
    const snapshot = await readDbSnapshot(runtime)
    assertIdentity(snapshot.identity, context.expectedDb)
    const files = readMigrationFiles(prismaDir)
    const history = classifyHistory(files, snapshot.ledger)
    if (history.pending.length > 0) throw new Error(`PENDING_AFTER_MIGRATE:${history.pending.join(',')}`)
    const postconditions = (gateState.pending ?? []).flatMap((migration) => {
      const policy = readPolicyFile(migration)
      return normalizePolicyPostconditions(policy.postconditions ?? [], migration.name)
    })
    evaluatePolicyPostconditions(snapshot.structure, postconditions)
    await verifySchema({ runtime, evidenceDir: context.evidenceDir, prefixLength: files.length })
    return { applied: files.map((migration) => migration.name), postconditions }
  } finally {
    await runtime.close()
  }
}

export async function deployMigrationGate(context) {
  return runMigrationGate(context)
}

export async function verifyMigrationGate(context, deps = createMigrationGateDeps(context)) {
  validateContext(normalizeContextWithBaseline(context))
  const preflight = await deps.preflight(context)
  const pending = preflight.pending ?? []
  if (pending.length > 0) throw new Error(`VERIFY_PENDING:${pending.map((migration) => migration.name).join(',')}`)
  const postcheck = await deps.postcheck(context, { pending, attempt: null })
  return { db: 'verified', applied: postcheck?.applied ?? [] }
}

export function buildMigrationGateContextFromEnv(env = process.env) {
  const stateRoot = env.DB_GATE_STATE_ROOT ?? env.MIGRATION_STATE_ROOT ?? DEFAULT_STATE_ROOT
  const baseline = readBaselineFile(stateRoot, env.DB_GATE_BASELINE_PATH)
  const databaseUrl = env.DATABASE_URL
  const databaseFromUrl = databaseUrl ? new URL(databaseUrl).pathname.slice(1) : ''
  const expectedDb = baseline?.identity ?? {
    database: env.DB_GATE_DATABASE ?? env.EXPECTED_DATABASE ?? databaseFromUrl,
    serverUuid: env.DB_GATE_SERVER_UUID ?? env.EXPECTED_SERVER_UUID,
  }
  const context = {
    backendDir: env.DB_GATE_BACKEND_DIR ?? env.BACKEND_DIR ?? join(repoRoot, 'backend'),
    prismaDir: env.DB_GATE_PRISMA_DIR,
    stateRoot,
    evidenceDir: env.DB_GATE_EVIDENCE_DIR ?? env.MIGRATION_EVIDENCE_DIR,
    evidenceManifestPath: env.DB_GATE_EVIDENCE_MANIFEST,
    sha: env.DB_GATE_SHA ?? env.GITHUB_SHA ?? env.SHA,
    runId: env.DB_GATE_RUN_ID ?? env.GITHUB_RUN_ID,
    runAttempt: env.DB_GATE_RUN_ATTEMPT ?? env.GITHUB_RUN_ATTEMPT,
    expectedDb,
    databaseUrl,
    baselinePath: env.DB_GATE_BASELINE_PATH,
    activeAppPath: env.DB_GATE_ACTIVE_APP_PATH ?? join(resolve(stateRoot), 'active-app.json'),
    readinessPath: env.DB_GATE_READINESS_PATH ?? join(resolve(stateRoot), 'active-readiness.json'),
    actualActiveSha: env.DB_GATE_ACTIVE_SHA,
  }
  if (!context.evidenceDir) throw new Error('DB_CONTEXT_evidenceDir')
  if (!baseline?.identity?.serverUuid) throw new Error('BASELINE_REQUIRED')
  const activeState = readActiveDeploymentState(context)
  assertActiveReadiness(context, activeState)
  context.actualActiveSha = context.actualActiveSha ?? activeState.sha
  validateContext(context)
  return context
}

export function assertNoUnresolvedAttempts(attempts) {
  const unresolved = attempts.filter((attempt) => isUnresolvedAttempt(attempt))
  if (unresolved.length > 0) {
    throw new Error(`UNRESOLVED_ATTEMPT:${unresolved.map((attempt) => attempt.id).join(',')}`)
  }
}

function isUnresolvedAttempt(attempt) {
  if (attempt.phase === 'verified' || attempt.phase === 'recovered') return false
  return attempt.recovery == null
}

function buildAttempt(context, attemptBase, pending, backup, phase) {
  return {
    format: FORMAT,
    id: safeId(attemptBase.id ?? attemptId(context), 'ATTEMPT_ID'),
    sha: context.sha,
    runId: context.runId,
    runAttempt: context.runAttempt,
    identity: attemptBase.identity ?? context.expectedDb,
    pending,
    backupId: backup.id ?? backup.backupId,
    phase,
    recovery: null,
    process: null,
    createdAt: new Date().toISOString(),
    ...attemptBase,
  }
}

function failedAttempt(applying, error, migrateResult) {
  return {
    ...applying,
    phase: 'failed',
    failedAt: new Date().toISOString(),
    recovery: null,
    process: error.process ?? migrateResult?.process ?? null,
    failure: {
      message: sanitizeOutput(error.message),
      output: sanitizeOutput(error.output ?? ''),
      timeoutDoesNotImplyRollback: true,
    },
  }
}

function normalizeAttemptForWrite(attempt) {
  if (attempt?.format !== FORMAT) throw new Error('ATTEMPT_FORMAT')
  safeId(attempt.id, 'ATTEMPT_ID')
  if (!['applying', 'verified', 'failed', 'unknown', 'recovered'].includes(attempt.phase)) throw new Error('ATTEMPT_PHASE')
  return attempt
}

async function readExistingAttemptForTransition(target, id) {
  if (!existsSync(target)) return null
  const info = await lstat(target)
  if (info.isSymbolicLink()) throw new Error(`ATTEMPT_SYMLINK:${id}.json`)
  if (!info.isFile()) throw new Error(`ATTEMPT_NOT_FILE:${id}.json`)
  let parsed
  try {
    parsed = JSON.parse(await readFile(target, 'utf8'))
  } catch {
    throw new Error(`ATTEMPT_CORRUPT:${id}.json`)
  }
  const previous = normalizeAttemptForRead(parsed)
  if (previous.id !== id) throw new Error(`ATTEMPT_PATH_MISMATCH:${id}.json`)
  return previous
}

function normalizeAttemptForRead(attempt) {
  const normalized = normalizeAttemptForWrite(attempt)
  if (typeof normalized.sha !== 'string' || !/^[0-9a-f]{40}$/i.test(normalized.sha)) throw new Error('ATTEMPT_SHA')
  if (typeof normalized.runId !== 'string' || normalized.runId.length === 0) throw new Error('ATTEMPT_RUN_ID')
  if (typeof normalized.runAttempt !== 'string' || normalized.runAttempt.length === 0) throw new Error('ATTEMPT_RUN_ATTEMPT')
  if (!normalized.identity?.database || !normalized.identity?.serverUuid) throw new Error('ATTEMPT_IDENTITY')
  if (!Array.isArray(normalized.pending)) throw new Error('ATTEMPT_PENDING')
  if (!Object.hasOwn(normalized, 'recovery')) throw new Error('ATTEMPT_RECOVERY')
  return normalized
}

function normalizeAttemptTransition(previous, nextAttempt) {
  const next = normalizeAttemptForRead(nextAttempt)
  assertSameAttemptIdentity(previous, next)
  const allowed = (
    (previous.phase === 'applying' && ['verified', 'failed', 'unknown', 'recovered'].includes(next.phase)) ||
    (previous.phase === 'applying' && next.phase === 'applying' && previous.process == null && next.process != null) ||
    (previous.phase === 'failed' && next.phase === 'recovered') ||
    (previous.phase === 'unknown' && ['recovered', 'failed'].includes(next.phase))
  )
  if (!allowed) throw new Error(`ATTEMPT_EXISTS:${next.id}`)
  return {
    ...previous,
    ...next,
    createdAt: previous.createdAt ?? next.createdAt,
    backupId: previous.backupId ?? next.backupId,
    pending: previous.pending,
    identity: previous.identity,
    process: next.process ?? previous.process ?? null,
    previousPhase: previous.phase,
    phaseUpdatedAt: new Date().toISOString(),
  }
}

function assertSameAttemptIdentity(previous, next) {
  const keys = ['id', 'sha', 'runId', 'runAttempt', 'backupId']
  for (const key of keys) {
    if ((previous[key] ?? null) !== (next[key] ?? null)) throw new Error(`ATTEMPT_IMMUTABLE_${key}`)
  }
  if (JSON.stringify(previous.identity) !== JSON.stringify(next.identity)) throw new Error('ATTEMPT_IMMUTABLE_identity')
  if (JSON.stringify(previous.pending) !== JSON.stringify(next.pending)) throw new Error('ATTEMPT_IMMUTABLE_pending')
}



async function ensureSecureDirectory(path, code) {
  const resolved = resolve(path)
  await assertNoSymlinkPathComponents(resolved, code)
  await mkdir(resolved, { recursive: true, mode: 0o700 })
  await assertNoSymlinkPathComponents(resolved, code)
  const info = await lstat(resolved)
  if (!info.isDirectory()) throw new Error(`${code}_NOT_DIRECTORY`)
  await chmod(resolved, 0o700)
  return realpath(resolved)
}

async function secureExistingStateRootForRead(path) {
  const resolved = resolve(path)
  if (!existsSync(resolved)) return null
  await assertNoSymlinkPathComponents(resolved, 'STATE_ROOT')
  const info = await lstat(resolved)
  if (!info.isDirectory()) throw new Error('STATE_ROOT_NOT_DIRECTORY')
  return realpath(resolved)
}

async function assertNoSymlinkPathComponents(path, code) {
  const resolved = resolve(path)
  const parsed = parse(resolved)
  let current = parsed.root
  const rest = resolved.slice(parsed.root.length).split(sep).filter(Boolean)
  for (const part of rest) {
    current = join(current, part)
    try {
      const info = await lstat(current)
      if (info.isSymbolicLink() && !isAllowedSystemSymlink(current)) throw new Error(`${code}_SYMLINK`)
    } catch (error) {
      if (error.code === 'ENOENT') return
      throw error
    }
  }
}

function assertTrustedJsonPath(stateRoot, filePath, code) {
  const resolvedRoot = resolve(stateRoot || DEFAULT_STATE_ROOT)
  const resolvedFile = resolve(filePath)
  if (!existsSync(resolvedFile)) return
  assertNoSymlinkPathComponentsSync(resolvedFile, code)
  const info = lstatSync(resolvedFile)
  if (info.isSymbolicLink()) throw new Error(`${code}_SYMLINK`)
  if (!info.isFile()) throw new Error(`${code}_NOT_FILE`)
  const realRoot = realpathSync(resolvedRoot)
  const realFile = realpathSync(resolvedFile)
  assertPathContained(realRoot, realFile, `${code}_ESCAPE`)
}

function assertNoSymlinkPathComponentsSync(path, code) {
  const resolved = resolve(path)
  const parsed = parse(resolved)
  let current = parsed.root
  const rest = resolved.slice(parsed.root.length).split(sep).filter(Boolean)
  for (const part of rest) {
    current = join(current, part)
    if (!existsSync(current)) return
    if (lstatSync(current).isSymbolicLink() && !isAllowedSystemSymlink(current)) throw new Error(`${code}_SYMLINK`)
  }
}


function isAllowedSystemSymlink(path) {
  return path === '/var' || path === '/tmp'
}

function assertPathContained(root, child, code) {
  const resolvedRoot = resolve(root)
  const resolvedChild = resolve(child)
  const rel = relative(resolvedRoot, resolvedChild)
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return
  throw new Error(code)
}

function isPermittedLoopbackTestContext(context) {
  if (!context?.expectedDb?.database || !/^ilsangkit_migration_test[\w-]*$/.test(context.expectedDb.database)) return false
  const raw = context.databaseUrl ?? process.env.DATABASE_URL
  if (!raw) return false
  try {
    const parsed = new URL(raw)
    return ['127.0.0.1', 'localhost', '::1'].includes(parsed.hostname) && parsed.pathname.slice(1) === context.expectedDb.database
  } catch {
    return false
  }
}

function isSafeIdentifier(value) {
  return typeof value === 'string' && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value)
}

function normalizeContextWithBaseline(context) {
  if (!context || typeof context !== 'object') throw new Error('DB_CONTEXT')
  const baseline = readBaselineFile(context.stateRoot, context.baselinePath)
  if (!baseline) {
    if (context.allowMissingBaseline === true && isPermittedLoopbackTestContext(context)) return context
    throw new Error('BASELINE_REQUIRED')
  }
  if (!baseline.identity?.database || !baseline.identity?.serverUuid) throw new Error('BASELINE_IDENTITY')
  if (context.expectedDb) assertIdentity(context.expectedDb, baseline.identity)
  return {
    ...context,
    expectedDb: baseline.identity,
    baseline,
  }
}

function readBaselineFile(stateRoot, explicitPath) {
  const baselinePath = explicitPath ?? (stateRoot ? join(resolve(stateRoot), 'baseline.json') : null)
  if (!baselinePath || !existsSync(baselinePath)) return null
  assertTrustedJsonPath(stateRoot, baselinePath, 'BASELINE_PATH')
  const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
  if (baseline.format !== FORMAT || baseline.status !== 'verified') throw new Error('BASELINE_STATUS')
  return baseline
}

function readActiveDeploymentState(context) {
  const activePath = context.activeAppPath ?? join(resolve(context.stateRoot), 'active-app.json')
  if (!existsSync(activePath)) {
    if (context.allowMissingActiveState === true && isPermittedLoopbackTestContext(context)) return null
    throw new Error('ACTIVE_APP_REQUIRED')
  }
  assertTrustedJsonPath(context.stateRoot, activePath, 'ACTIVE_APP_PATH')
  const active = JSON.parse(readFileSync(activePath, 'utf8'))
  const sha = active.fullSha
  if (!/^[0-9a-f]{40}$/i.test(sha ?? '')) throw new Error('ACTIVE_APP_SHA')
  const expectedReleaseId = `fixed-${sha.slice(0, 12)}`
  if (active.releaseId !== expectedReleaseId) throw new Error('ACTIVE_APP_RELEASE')
  return { ...active, sha }
}

function assertActiveReadiness(context, activeState) {
  const readinessPath = context.readinessPath ?? join(resolve(context.stateRoot), 'active-readiness.json')
  if (!existsSync(readinessPath)) {
    if (context.allowMissingActiveState === true && isPermittedLoopbackTestContext(context)) return
    throw new Error('ACTIVE_READINESS_REQUIRED')
  }
  assertTrustedJsonPath(context.stateRoot, readinessPath, 'ACTIVE_READINESS_PATH')
  const readiness = JSON.parse(readFileSync(readinessPath, 'utf8'))
  if (readiness.ready !== true || readiness.db?.ok === false) throw new Error('ACTIVE_READINESS_NOT_READY')
  if (!activeState) throw new Error('ACTIVE_APP_REQUIRED')
  if (readiness.releaseId !== activeState.releaseId) throw new Error('ACTIVE_READINESS_RELEASE')
}

function validateContext(context) {
  if (!context || typeof context !== 'object') throw new Error('DB_CONTEXT')
  for (const key of ['backendDir', 'stateRoot', 'evidenceDir', 'sha', 'runId', 'runAttempt']) {
    if (!context[key]) throw new Error(`DB_CONTEXT_${key}`)
  }
  if (!/^[0-9a-f]{40}$/i.test(context.sha)) throw new Error('DB_CONTEXT_SHA')
  if (!context.expectedDb?.database || !context.expectedDb?.serverUuid) throw new Error('DB_CONTEXT_IDENTITY')
}

function safeId(value, code) {
  const id = String(value ?? '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]{0,159}$/.test(id) || id === '.' || id === '..') {
    throw new Error(code)
  }
  return id
}

function attemptId(context) {
  return safeId(`${context.sha}-${context.runId}-${context.runAttempt}`, 'ATTEMPT_ID')
}

function resolveBackendDir(context) {
  return resolve(context.backendDir)
}

function resolveDatabaseUrl(context) {
  const raw = context.databaseUrl ?? process.env.DATABASE_URL
  if (!raw) throw new Error('DATABASE_URL_REQUIRED')
  return raw
}

function evidenceManifestPath(context) {
  return resolve(context.evidenceManifestPath ?? join(context.evidenceDir, 'manifest.json'))
}

function assertIdentity(actual, expected) {
  if (actual.database !== expected.database) throw new Error('DB_IDENTITY_DATABASE')
  if (actual.serverUuid !== expected.serverUuid) throw new Error('DB_IDENTITY_SERVER')
}


export function normalizePolicyPostconditions(postconditions = [], migrationName = 'unknown') {
  if (!Array.isArray(postconditions)) throw new Error(`POLICY_POSTCONDITIONS:${migrationName}`)
  return postconditions.map((condition) => {
    if (condition?.type === 'table-exists') {
      if (!isSafeIdentifier(condition.table)) throw new Error(`POLICY_POSTCONDITION_TABLE:${migrationName}`)
      return { type: 'table-exists', table: condition.table }
    }
    if (condition?.type === 'nullable-column') {
      if (!isSafeIdentifier(condition.table) || !isSafeIdentifier(condition.column)) throw new Error(`POLICY_POSTCONDITION_COLUMN:${migrationName}`)
      return { type: 'nullable-column', table: condition.table, column: condition.column }
    }
    throw new Error(`POLICY_POSTCONDITION_UNKNOWN:${migrationName}`)
  })
}

export function evaluatePolicyPostconditions(structure, postconditions = []) {
  const tables = new Set((structure?.tables ?? []).map((table) => table.name))
  for (const condition of postconditions) {
    if (condition.type === 'table-exists') {
      if (!tables.has(condition.table)) throw new Error(`POSTCONDITION_TABLE:${condition.table}`)
      continue
    }
    if (condition.type === 'nullable-column') {
      const column = (structure?.columns ?? []).find((candidate) => candidate.table === condition.table && candidate.name === condition.column)
      if (!column || column.nullable !== true) throw new Error(`POSTCONDITION_NULLABLE_COLUMN:${condition.table}.${condition.column}`)
      continue
    }
    throw new Error(`POSTCONDITION_UNKNOWN:${condition.type}`)
  }
}

function readAndValidatePolicy(migration, context) {
  const policy = readPolicyFile(migration)
  const sql = readFileSync(migration.sqlPath, 'utf8')
  validateExpansion(sql, policy)
  normalizePolicyPostconditions(policy.postconditions ?? [], migration.name)
  return { migration, policy }
}

function readPolicyFile(migration) {
  const policyPath = join(dirname(migration.sqlPath), 'policy.json')
  if (!existsSync(policyPath)) throw new Error(`POLICY_MISSING:${migration.name}`)
  return JSON.parse(readFileSync(policyPath, 'utf8'))
}

function assertCompatibility(policies, context) {
  const activeSha = context.actualActiveSha ?? context.activeSha
  for (const { migration, policy } of policies) {
    const shas = policy.previousCompatibleShas ?? []
    if (shas.length > 0 && (!activeSha || !shas.includes(activeSha))) {
      throw new Error(`POLICY_COMPATIBILITY:${migration.name}`)
    }
  }
}

function buildPrismaEnv(databaseUrl) {
  const allowed = ['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL', 'LC_CTYPE', 'NODE_OPTIONS', 'CI', 'NO_COLOR', 'PRISMA_HIDE_UPDATE_MESSAGE']
  const env = {}
  for (const key of allowed) {
    if (process.env[key] !== undefined) env[key] = process.env[key]
  }
  env.DATABASE_URL = databaseUrl
  return env
}

const SQL_CHILD_WRAPPER = `
const { spawn } = require('node:child_process');
const command = process.env.GATE_CHILD_COMMAND;
const args = JSON.parse(process.env.GATE_CHILD_ARGS || '[]');
const env = { ...process.env };
delete env.GATE_CHILD_COMMAND;
delete env.GATE_CHILD_ARGS;
let buffer = '';
let launched = false;
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  if (launched) return;
  buffer += chunk;
  if (!buffer.includes('GO\\n')) return;
  launched = true;
  const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], env });
  child.stdout.pipe(process.stdout);
  child.stderr.pipe(process.stderr);
  child.on('error', (error) => {
    console.error(error.message);
    process.exit(127);
  });
  child.on('close', (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
});
process.stdin.on('end', () => {
  if (!launched) process.exit(125);
});
`

function runChild(command, args, options) {
  return new Promise((resolvePromise) => {
    const wrapperEnv = {
      ...options.env,
      GATE_CHILD_COMMAND: command,
      GATE_CHILD_ARGS: JSON.stringify(args),
    }
    const child = spawn(process.execPath, ['-e', SQL_CHILD_WRAPPER], {
      cwd: options.cwd,
      env: wrapperEnv,
      detached: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    let settled = false
    let timeout = null
    let killTimer = null
    const processInfo = {
      pid: child.pid,
      command: basename(command),
      spawnfile: command,
      args: [],
      launcher: 'node-stdin-release-wrapper',
      processGroupId: child.pid,
      detached: true,
      startedAt: new Date().toISOString(),
      releasedAt: null,
      exitCode: null,
      signal: null,
      timedOut: false,
      exitedAt: null,
    }
    const startTimeout = () => {
      timeout = setTimeout(() => {
        if (settled) return
        processInfo.timedOut = true
        terminateProcess(processInfo, child, 'SIGTERM')
        killTimer = setTimeout(() => {
          if (settled) return
          processInfo.escalated = true
          terminateProcess(processInfo, child, 'SIGKILL')
        }, options.killGraceMs ?? CHILD_KILL_GRACE_MS)
      }, options.timeoutMs ?? MIGRATE_TIMEOUT_MS)
    }
    const releaseSql = async () => {
      try {
        await options.onProcess?.(processInfo)
        if (settled) return
        processInfo.releasedAt = new Date().toISOString()
        child.stdin.write('GO\n')
        child.stdin.end()
        startTimeout()
      } catch (error) {
        processInfo.processRecordError = sanitizeOutput(error.message)
        terminateProcess(processInfo, child, 'SIGTERM')
      }
    }
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', (chunk) => { stdout += chunk })
    child.stderr.on('data', (chunk) => { stderr += chunk })
    child.on('error', (error) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      processInfo.exitCode = 127
      processInfo.exitedAt = new Date().toISOString()
      resolvePromise({ code: 127, stdout, stderr: `${stderr}${error.message}`, process: processInfo })
    })
    child.on('close', (code, signal) => {
      if (settled) return
      settled = true
      if (timeout) clearTimeout(timeout)
      if (killTimer) clearTimeout(killTimer)
      processInfo.exitCode = signal ? 124 : (code ?? 1)
      processInfo.signal = signal
      processInfo.exitedAt = new Date().toISOString()
      resolvePromise({ code: processInfo.exitCode, stdout, stderr, process: processInfo })
    })
    releaseSql()
  })
}

function terminateProcess(processInfo, child, signal) {
  try {
    if (processInfo.processGroupId) {
      process.kill(-processInfo.processGroupId, signal)
      processInfo.terminationSignal = signal
      processInfo.terminationTarget = 'process-group'
      return
    }
  } catch {
    // Fall through to direct child termination for platforms or states without a live process group.
  }
  child.kill(signal)
  processInfo.terminationSignal = signal
  processInfo.terminationTarget = 'child'
}

async function fsyncDirectory(path) {
  const handle = await open(path, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

function summarizeMigrateResult(result) {
  if (!result) return null
  return {
    code: result.code,
    process: result.process ?? null,
    stdoutSha256: sha256(result.stdout ?? ''),
    stderrSha256: sha256(result.stderr ?? ''),
  }
}

function sanitizeOutput(value) {
  return String(value ?? '')
    .replace(/mysql:\/\/[^@\s]+@/g, 'mysql://<redacted>@')
    .replace(/--password=[^\s]+/g, '--password=<redacted>')
    .replace(/(TOKEN|SECRET|PASSWORD|PRIVATE_KEY)=\S+/gi, '$1=<redacted>')
    .slice(0, 500)
}

function unique(values) {
  const result = []
  const seen = new Set()
  for (const value of values ?? []) {
    if (!value || seen.has(value)) continue
    seen.add(value)
    result.push(value)
  }
  return result
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const [command] = argv
  if (!['deploy', 'verify'].includes(command)) throw new Error('usage: db-migration-gate.mjs <deploy|verify>')
  const context = buildMigrationGateContextFromEnv(env)
  const result = command === 'deploy'
    ? await deployMigrationGate(context)
    : await verifyMigrationGate(context)
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.stderr.write(`${sanitizeOutput(error.message)}\n`)
    process.exitCode = 1
  })
}
