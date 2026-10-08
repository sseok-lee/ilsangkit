import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { assertCandidateFresh, assertWorkflowRunPayload, runDatabaseGateFromEnv, verifyEvidenceManifestBinding } from './fixed-db.mjs'

import * as activeHelper from './db-active-app.mjs'
import * as schemaModule from './db-schema.mjs'

const sha = 'a'.repeat(40)
const old = 'b'.repeat(40)

test('freshness requires current main and a forward move from the active full SHA', async () => {
  const calls = []
  const request = async (url, options) => {
    calls.push({ url, options })
    return { ok: true, json: async () => url.includes('/compare/') ? { status: 'ahead' } : { object: { sha } } }
  }
  await assertCandidateFresh({ sha, activeSha: old, repository: 'owner/repo', token: 'canary', request })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].options.headers.Authorization, 'Bearer canary')
  for (const [main, relation] of [[old, 'ahead'], [sha, 'behind'], [sha, 'diverged']]) {
    await assert.rejects(() => assertCandidateFresh({ sha, activeSha: old, repository: 'owner/repo', token: 'canary', request: async url => ({ ok: true, json: async () => url.includes('/compare/') ? { status: relation } : { object: { sha: main } } }) }), error => error.code === 'STALE_CANDIDATE' && error.exitCode === 78)
  }
  await assert.rejects(() => assertCandidateFresh({ sha, activeSha: old, repository: 'owner/repo', token: 'canary', request: async () => ({ ok: false }) }), /MAIN_HEAD_UNAVAILABLE/)
})

test('workflow run and evidence manifest provenance are bound to exact Test attempt', async () => {
  const run = {
    id: 123,
    run_attempt: 4,
    head_sha: sha,
    head_branch: 'main',
    event: 'push',
    status: 'completed',
    conclusion: 'success',
    name: 'Test',
    path: '.github/workflows/test.yml',
    repository: { full_name: 'owner/repo' },
    head_repository: { full_name: 'owner/repo' },
  }
  assert.deepEqual(assertWorkflowRunPayload(run, { repository: 'owner/repo', sha, runId: '123', runAttempt: '4' }), {
    sha,
    runId: '123',
    runAttempt: '4',
    artifactName: `db-evidence-${sha}-4`,
  })
  for (const patch of [
    { head_branch: 'develop' }, { event: 'pull_request' }, { conclusion: 'failure' },
    { path: '.github/workflows/other.yml' }, { repository: { full_name: 'evil/repo' } },
    { head_repository: { full_name: 'evil/repo' } }, { run_attempt: 5 },
  ]) assert.throws(() => assertWorkflowRunPayload({ ...run, ...patch }, { repository: 'owner/repo', sha, runId: '123', runAttempt: '4' }), /TEST_RUN_PROVENANCE/)

  const dir = mkdtempSync(join(tmpdir(), 'fixed-db-evidence-'))
  try {
    mkdirSync(join(dir, 'prefixes/0001'), { recursive: true })
    writeFileSync(join(dir, 'prefixes/0001/schema.prisma'), 'schema\n')
    writeFileSync(join(dir, 'prefixes/0001/structure.json'), '{}\n')
    const manifestPath = join(dir, 'manifest.json')
    const manifest = {
      format: 1,
      sha,
      activeSha: sha,
      sourceTestRunId: '123',
      sourceTestRunAttempt: '4',
      compatibility: { status: 'not-applicable', requirements: [], results: [] },
      preparationCompatibility: { status: 'not-provided', results: [] },
      prefixes: [{ schemaPath: 'prefixes/0001/schema.prisma', schemaSha256: sha256('schema\n'), structurePath: 'prefixes/0001/structure.json', structureSha256: sha256('{}\n') }],
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
    assert.equal((await verifyEvidenceManifestBinding({ manifestPath, sha, runId: '123', runAttempt: '4', schemaModule })).sha, sha)
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, sourceTestRunAttempt: '5' }, null, 2))
    await assert.rejects(() => verifyEvidenceManifestBinding({ manifestPath, sha, runId: '123', runAttempt: '4', schemaModule }), /EVIDENCE_RUN_ATTEMPT/)
    writeFileSync(manifestPath, JSON.stringify({ ...manifest, prefixes: [{ ...manifest.prefixes[0], structureSha256: '0'.repeat(64) }] }, null, 2))
    await assert.rejects(() => verifyEvidenceManifestBinding({ manifestPath, sha, runId: '123', runAttempt: '4', schemaModule }), /EVIDENCE_STRUCTURE_CHECKSUM/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('active app helper is strict about missing state, readiness match, private writes, and symlink roots', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-db-state-'))
  try {
    const readiness = { ready: true, db: { ok: true }, releaseId: `fixed-${old.slice(0, 12)}` }
    assert.throws(() => activeHelper.readActiveApp(dir), /ACTIVE_APP_REQUIRED/)
    activeHelper.publishActiveApp(dir, old, readiness)
    assert.equal(activeHelper.readActiveApp(dir, readiness).fullSha, old)
    assert.throws(() => activeHelper.readActiveApp(dir, { ...readiness, releaseId: 'wrong' }), /ACTIVE_APP_READINESS/)
    assert.throws(() => activeHelper.publishActiveApp(dir, sha, readiness), /ACTIVE_APP_READINESS/)
    assert.equal(JSON.parse(readFileSync(join(dir, 'active-app.json'))).fullSha, old)
    const outside = join(dir, 'outside')
    mkdirSync(outside)
    symlinkSync(outside, join(dir, 'linked'))
    assert.throws(() => activeHelper.publishActiveApp(join(dir, 'linked'), sha, { ...readiness, releaseId: `fixed-${sha.slice(0, 12)}` }), /STATE_PATH_SYMLINK/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('database deploy gate builds context from env, clears token env, and performs beforeApply freshness immediately before migrate', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-db-gate-'))
  try {
    const backend = join(dir, 'backend')
    mkdirSync(backend, { recursive: true })
    installFakeDotenv(backend)
    writeFileSync(join(backend, 'package.json'), JSON.stringify({ dependencies: { dotenv: '^16.0.0' } }))
    writeFileSync(join(backend, '.env'), 'DATABASE_URL=mysql://user:secret@127.0.0.1:3306/ilsangkit_migration_test_gate\n')
    const calls = []
    const context = { sha, actualActiveSha: old }
    const gateModule = {
      buildMigrationGateContextFromEnv(env) {
        calls.push(['context', env.DB_GATE_BACKEND_DIR, env.DATABASE_URL])
        assert.equal(process.env.GITHUB_TOKEN, undefined)
        assert.equal(process.env.FIXED_GITHUB_TOKEN, undefined)
        return context
      },
      createMigrationGateDeps() {
        return { beforeApply: async () => { throw new Error('not replaced') } }
      },
      async runMigrationGate(received, deps) {
        calls.push(['run', received])
        await deps.beforeApply()
        calls.push(['after-beforeApply'])
        return { db: 'verified', applied: [] }
      },
    }
    let requested = []
    const request = async (url) => {
      requested.push(url)
      return { ok: true, json: async () => url.includes('/compare/') ? { status: 'ahead' } : { object: { sha } } }
    }
    process.env.GITHUB_TOKEN = 'should-be-deleted'
    process.env.FIXED_GITHUB_TOKEN = 'should-also-delete'
    const result = await runDatabaseGateFromEnv('deploy', {
      DB_GATE_BACKEND_DIR: backend,
      DB_GATE_STATE_ROOT: dir,
      DB_GATE_EVIDENCE_DIR: join(dir, 'evidence'),
      DB_GATE_SHA: sha,
      DB_GATE_RUN_ID: '123',
      DB_GATE_RUN_ATTEMPT: '4',
      GITHUB_REPOSITORY: 'owner/repo',
      FIXED_GITHUB_TOKEN: 'canary',
    }, {
      gateModule,
      beforeApply: () => assertCandidateFresh({ sha, activeSha: old, repository: 'owner/repo', token: 'canary', request }),
    })
    assert.deepEqual(result, { db: 'verified', applied: [] })
    assert.equal(process.env.GITHUB_TOKEN, undefined)
    assert.equal(process.env.FIXED_GITHUB_TOKEN, undefined)
    assert.equal(calls[0][1], backend)
    assert.equal(calls[0][2], 'mysql://user:secret@127.0.0.1:3306/ilsangkit_migration_test_gate')
    assert.deepEqual(calls.map(call => call[0]), ['context', 'run', 'after-beforeApply'])
    assert.equal(requested.length, 2)
  } finally {
    delete process.env.GITHUB_TOKEN
    delete process.env.FIXED_GITHUB_TOKEN
    rmSync(dir, { recursive: true, force: true })
  }
})


test('database deploy gate captures token from real process env before clearing and keeps gate env sanitized', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-db-process-env-'))
  const originalFetch = globalThis.fetch
  try {
    const backend = join(dir, 'backend')
    mkdirSync(backend, { recursive: true })
    installFakeDotenv(backend)
    writeFileSync(join(backend, 'package.json'), JSON.stringify({ dependencies: { dotenv: '^16.0.0' } }))
    writeFileSync(join(backend, '.env'), 'DATABASE_URL=mysql://user:secret@127.0.0.1:3306/ilsangkit_migration_test_gate\n')
    process.env.DB_GATE_BACKEND_DIR = backend
    process.env.DB_GATE_STATE_ROOT = dir
    process.env.DB_GATE_EVIDENCE_DIR = join(dir, 'evidence')
    process.env.DB_GATE_SHA = sha
    process.env.DB_GATE_RUN_ID = '123'
    process.env.DB_GATE_RUN_ATTEMPT = '4'
    process.env.GITHUB_REPOSITORY = 'owner/repo'
    process.env.FIXED_GITHUB_TOKEN = 'real-process-token'
    const requested = []
    globalThis.fetch = async (url, options) => {
      requested.push({ url, auth: options.headers.Authorization })
      return { ok: true, json: async () => url.includes('/compare/') ? { status: 'ahead' } : { object: { sha } } }
    }
    const gateModule = {
      buildMigrationGateContextFromEnv(env) {
        assert.equal(env.FIXED_GITHUB_TOKEN, undefined)
        assert.equal(env.GITHUB_TOKEN, undefined)
        assert.equal(env.DATABASE_URL, 'mysql://user:secret@127.0.0.1:3306/ilsangkit_migration_test_gate')
        return { sha, actualActiveSha: old }
      },
      createMigrationGateDeps() { return {} },
      async runMigrationGate(_context, deps) {
        await deps.beforeApply()
        return { db: 'verified', applied: [] }
      },
    }
    await runDatabaseGateFromEnv('deploy', process.env, { gateModule })
    assert.deepEqual(requested.map(call => call.auth), ['Bearer real-process-token', 'Bearer real-process-token'])
    assert.equal(process.env.FIXED_GITHUB_TOKEN, undefined)
  } finally {
    globalThis.fetch = originalFetch
    for (const key of ['DB_GATE_BACKEND_DIR', 'DB_GATE_STATE_ROOT', 'DB_GATE_EVIDENCE_DIR', 'DB_GATE_SHA', 'DB_GATE_RUN_ID', 'DB_GATE_RUN_ATTEMPT', 'GITHUB_REPOSITORY', 'FIXED_GITHUB_TOKEN', 'GITHUB_TOKEN', 'GH_TOKEN']) delete process.env[key]
    rmSync(dir, { recursive: true, force: true })
  }
})

test('database verify gate delegates to verifyMigrationGate so postcheck failures fail closed', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-db-verify-'))
  try {
    const backend = join(dir, 'backend')
    mkdirSync(backend, { recursive: true })
    installFakeDotenv(backend)
    writeFileSync(join(backend, 'package.json'), JSON.stringify({ dependencies: { dotenv: '^16.0.0' } }))
    writeFileSync(join(backend, '.env'), 'DATABASE_URL=mysql://user:secret@127.0.0.1:3306/ilsangkit_migration_test_gate\n')
    await assert.rejects(() => runDatabaseGateFromEnv('verify', {
      DB_GATE_BACKEND_DIR: backend,
      DB_GATE_STATE_ROOT: dir,
      DB_GATE_EVIDENCE_DIR: join(dir, 'evidence'),
      DB_GATE_SHA: sha,
      DB_GATE_RUN_ID: '123',
      DB_GATE_RUN_ATTEMPT: '4',
    }, {
      gateModule: {
        buildMigrationGateContextFromEnv: () => ({ sha }),
        verifyMigrationGate: async () => { throw new Error('POSTCHECK_FAILED') },
      },
    }), /POSTCHECK_FAILED/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

function installFakeDotenv(backend) {
  const dir = join(backend, 'node_modules/dotenv')
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'index.js'), `exports.parse = (buffer) => Object.fromEntries(String(buffer).split(/\\r?\\n/).filter(Boolean).map((line) => line.split('=')))\n`)
}

function sha256(value) { return createHash('sha256').update(value).digest('hex') }
