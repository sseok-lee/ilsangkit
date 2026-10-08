#!/usr/bin/env node
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const deployDir = dirname(currentFile)
const FULL_SHA = /^[a-f0-9]{40}$/
const REPO = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/

export async function assertCandidateFresh({ sha, activeSha = null, repository, token, request = fetch }) {
  assertFullSha(sha, 'DEPLOY_SHA')
  if (activeSha != null) assertFullSha(activeSha, 'ACTIVE_SHA')
  if (!REPO.test(repository ?? '')) throw new Error('GITHUB_REPOSITORY')
  if (!token) throw new Error('GITHUB_TOKEN')
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  const main = await request(`https://api.github.com/repos/${repository}/git/ref/heads/main`, { headers, signal: timeoutSignal() })
  if (!main.ok) throw new Error('MAIN_HEAD_UNAVAILABLE')
  const mainSha = (await main.json())?.object?.sha
  if (mainSha !== sha) throw staleError('main has advanced')

  if (activeSha && activeSha !== sha) {
    const comparison = await request(`https://api.github.com/repos/${repository}/compare/${activeSha}...${sha}`, { headers, signal: timeoutSignal() })
    if (!comparison.ok) throw new Error('MAIN_HEAD_UNAVAILABLE')
    const relation = (await comparison.json())?.status
    if (relation !== 'ahead') throw staleError(`candidate is not ahead of active app: ${relation}`)
  }
  return { status: 'fresh', sha }
}

export async function readActiveApp(stateRoot, readiness = null) {
  const active = await activeAppModule()
  return active.readActiveApp(stateRoot, readiness)
}

export async function publishActiveApp(stateRoot, fullSha, readiness) {
  const active = await activeAppModule()
  return active.publishActiveApp(stateRoot, fullSha, readiness)
}

export async function copyActiveReadinessIntoStateRoot(stateRoot, sourcePath) {
  const active = await activeAppModule()
  return active.copyActiveReadinessIntoStateRoot(stateRoot, sourcePath)
}

export function assertWorkflowRunPayload(run, { repository, sha, runId, runAttempt } = {}) {
  if (!REPO.test(repository ?? '')) throw new Error('TEST_RUN_INPUT')
  assertFullSha(sha, 'TESTED_SHA')
  if (!/^[1-9][0-9]*$/.test(String(runId ?? ''))) throw new Error('TEST_RUN_INPUT')
  if (runAttempt !== undefined && !/^[1-9][0-9]*$/.test(String(runAttempt))) throw new Error('TEST_RUN_INPUT')
  if (String(run?.id) !== String(runId) || String(run?.run_attempt) !== String(runAttempt ?? run?.run_attempt) ||
      run?.head_sha !== sha || run?.head_branch !== 'main' || run?.event !== 'push' ||
      run?.status !== 'completed' || run?.conclusion !== 'success' || run?.name !== 'Test' ||
      run?.path !== '.github/workflows/test.yml' || run?.repository?.full_name !== repository ||
      run?.head_repository?.full_name !== repository) {
    throw new Error('TEST_RUN_PROVENANCE')
  }
  return { sha, runId: String(run.id), runAttempt: String(run.run_attempt), artifactName: `db-evidence-${sha}-${run.run_attempt}` }
}

export async function verifyEvidenceManifestBinding({ manifestPath, sha, runId, runAttempt, schemaModule = null }) {
  assertFullSha(sha, 'TESTED_SHA')
  const schema = schemaModule ?? await deployModule('db-schema.mjs')
  return schema.verifyEvidenceManifest({ manifestPath, sha, runId: String(runId), runAttempt: String(runAttempt) })
}

export async function runDatabaseGateFromEnv(phase, env = process.env, deps = {}) {
  const token = env.FIXED_GITHUB_TOKEN ?? env.GITHUB_TOKEN
  const repository = env.GITHUB_REPOSITORY
  const gateEnv = await buildGateEnv(env)
  delete process.env.GITHUB_TOKEN
  delete process.env.GH_TOKEN
  delete process.env.FIXED_GITHUB_TOKEN
  const gate = deps.gateModule ?? await deployModule('db-migration-gate.mjs')
  const context = gate.buildMigrationGateContextFromEnv(gateEnv)
  if (phase === 'verify') return gate.verifyMigrationGate(context, deps.gateDeps)
  if (phase === 'deploy') {
    const gateDeps = deps.gateDeps ?? gate.createMigrationGateDeps(context)
    gateDeps.beforeApply = deps.beforeApply ?? (() => assertCandidateFresh({ sha: context.sha, activeSha: context.actualActiveSha ?? null, repository, token }))
    return gate.runMigrationGate(context, gateDeps)
  }
  throw new Error('DB_PHASE')
}

export async function loadWorkflowRun({ repository, runId, token, request = fetch }) {
  if (!REPO.test(repository ?? '') || !/^[1-9][0-9]*$/.test(String(runId ?? '')) || !token) throw new Error('TEST_RUN_INPUT')
  const response = await request(`https://api.github.com/repos/${repository}/actions/runs/${runId}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    signal: timeoutSignal(),
  })
  if (!response.ok) throw new Error('TEST_RUN_API')
  return response.json()
}

async function buildGateEnv(env) {
  const backendDir = env.DB_GATE_BACKEND_DIR
  if (!backendDir) throw new Error('DB_CONTEXT_backendDir')
  const databaseUrl = loadCandidateDatabaseUrl(backendDir)
  const { GITHUB_TOKEN, GH_TOKEN, FIXED_GITHUB_TOKEN, ACTIONS_TOKEN, ...safeEnv } = env
  return {
    ...safeEnv,
    DATABASE_URL: databaseUrl,
    DB_GATE_BACKEND_DIR: backendDir,
    DB_GATE_PRISMA_DIR: env.DB_GATE_PRISMA_DIR ?? join(backendDir, 'prisma'),
    DB_GATE_STATE_ROOT: env.DB_GATE_STATE_ROOT,
    DB_GATE_EVIDENCE_DIR: env.DB_GATE_EVIDENCE_DIR,
    DB_GATE_SHA: env.DB_GATE_SHA ?? env.DEPLOY_SHA,
    DB_GATE_RUN_ID: env.DB_GATE_RUN_ID ?? env.TEST_RUN_ID,
    DB_GATE_RUN_ATTEMPT: env.DB_GATE_RUN_ATTEMPT ?? env.TEST_RUN_ATTEMPT,
  }
}

function loadCandidateDatabaseUrl(backendDir) {
  const envPath = join(backendDir, '.env')
  if (!existsSync(envPath)) throw new Error('DATABASE_URL_MISSING')
  const require = createRequire(join(resolve(backendDir), 'package.json'))
  const dotenv = require('dotenv')
  const parsed = dotenv.parse(readFileSync(envPath))
  if (!parsed.DATABASE_URL) throw new Error('DATABASE_URL_MISSING')
  return parsed.DATABASE_URL
}

async function activeAppModule() {
  return deployModule('db-active-app.mjs')
}

async function deployModule(fileName) {
  const local = join(deployDir, fileName)
  if (existsSync(local)) return import(pathToFileURL(local).href)
  throw new Error(`DEPLOY_MODULE_MISSING:${fileName}`)
}

function assertFullSha(value, code) {
  if (!FULL_SHA.test(String(value ?? ''))) throw new Error(code)
}

function staleError(message) {
  const error = new Error(`STALE_CANDIDATE:${message}`)
  error.code = 'STALE_CANDIDATE'
  error.exitCode = 78
  return error
}

function timeoutSignal() {
  return AbortSignal.timeout ? AbortSignal.timeout(30_000) : undefined
}

async function main() {
  const command = process.argv[2]
  try {
    if (command === 'freshness') {
      const token = process.env.GITHUB_TOKEN || process.env.FIXED_GITHUB_TOKEN
      delete process.env.GITHUB_TOKEN
      delete process.env.GH_TOKEN
      delete process.env.FIXED_GITHUB_TOKEN
      const activeSha = process.env.ACTIVE_SHA || null
      const result = await assertCandidateFresh({ sha: process.env.DEPLOY_SHA, activeSha, repository: process.env.GITHUB_REPOSITORY, token })
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    if (command === 'verify-run') {
      const token = process.env.GITHUB_TOKEN || process.env.FIXED_GITHUB_TOKEN
      delete process.env.GITHUB_TOKEN
      delete process.env.GH_TOKEN
      delete process.env.FIXED_GITHUB_TOKEN
      const workflow = await deployModule('db-workflow.mjs')
      const run = await loadWorkflowRun({ repository: process.env.GITHUB_REPOSITORY, runId: process.env.TEST_RUN_ID, token })
      const result = workflow.assertTestRun(run, { repository: process.env.GITHUB_REPOSITORY, sha: process.env.TESTED_SHA || process.env.DEPLOY_SHA, runId: process.env.TEST_RUN_ID, runAttempt: process.env.TEST_RUN_ATTEMPT })
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    if (command === 'verify-evidence') {
      const result = await verifyEvidenceManifestBinding({ manifestPath: process.argv[3], sha: process.env.TESTED_SHA || process.env.DEPLOY_SHA, runId: process.env.TEST_RUN_ID, runAttempt: process.env.TEST_RUN_ATTEMPT })
      process.stdout.write(`${JSON.stringify({ status: 'verified', sha: result.activeSha ?? result.sha })}\n`)
      return
    }
    if (command === 'read-active') {
      const readiness = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')) : null
      process.stdout.write(`${JSON.stringify(await readActiveApp(process.argv[3], readiness))}\n`)
      return
    }
    if (command === 'publish-active') {
      const result = await publishActiveApp(process.argv[3], process.argv[4], JSON.parse(readFileSync(process.argv[5], 'utf8')))
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    if (command === 'copy-readiness') {
      const result = await copyActiveReadinessIntoStateRoot(process.argv[3], process.argv[4])
      process.stdout.write(`${JSON.stringify({ path: result })}\n`)
      return
    }
    if (command === 'gate') {
      const result = await runDatabaseGateFromEnv(process.argv[3])
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    throw new Error('FIXED_DB_COMMAND')
  } catch (error) {
    process.stderr.write(`${error.code || error.message}\n`)
    process.exitCode = error.exitCode || 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) await main()
