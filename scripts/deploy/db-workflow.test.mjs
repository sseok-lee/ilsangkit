import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'
import { assertTestRun, evidenceArtifactName } from './db-workflow.mjs'

const sha = 'a'.repeat(40)
const repository = 'owner/ilsangkit'
const valid = () => ({
  id: 123, run_attempt: 2, head_sha: sha, head_branch: 'main', event: 'push',
  status: 'completed', conclusion: 'success', name: 'Test', path: '.github/workflows/test.yml',
  repository: { full_name: repository }, head_repository: { full_name: repository },
})

test('maintenance accepts only the exact successful main push Test run and attempt', () => {
  assert.deepEqual(assertTestRun(valid(), { repository, sha, runId: '123' }), { sha, runId: '123', runAttempt: '2', artifactName: evidenceArtifactName(sha, '2') })
  for (const change of [
    { id: 124 }, { run_attempt: 0 }, { head_sha: 'b'.repeat(40) }, { head_branch: 'develop' },
    { event: 'pull_request' }, { conclusion: 'failure' }, { status: 'in_progress' },
    { path: '.github/workflows/other.yml' }, { name: 'Other' },
    { repository: { full_name: 'foreign/repo' } }, { head_repository: { full_name: 'foreign/repo' } },
  ]) assert.throws(() => assertTestRun({ ...valid(), ...change }, { repository, sha, runId: '123' }))
  assert.throws(() => assertTestRun(valid(), { repository, sha, runId: '123', runAttempt: '1' }))
  assert.throws(() => evidenceArtifactName('../escape', '2'))
})

test('all migration MySQL rehearsals are mandatory in Test before evidence upload', () => {
  const source = readFileSync('.github/workflows/test.yml', 'utf8')
  assert.match(source, /test-migrations:/)
  for (const name of ['baseline', 'schema', 'backup', 'migration-gate', 'maintenance', 'compatibility']) {
    assert.match(source, new RegExp(`db-${name}\\.mysql\\.test\\.mjs`))
  }
  assert.match(source, /db-evidence\.mjs build/)
  assert.match(source, /db-compatibility\.mjs/)
  assert.match(source, /MIGRATION_TEST_ADMIN_URL:/)
  assert.match(source, /db-evidence-\$\{\{ github\.sha \}\}-\$\{\{ github\.run_attempt \}\}/)
  assert.doesNotMatch(source, /continue-on-error:\s*true|paths-ignore:/)
  assert.match(source, /filter\([^\n]*mysql\.test\.mjs/)
})

test('maintenance has fixed operations, shared lock and exact cross-run artifact provenance', () => {
  const source = readFileSync('.github/workflows/db-maintenance.yml', 'utf8')
  assert.match(source, /options: \[audit, reconcile, recover\]/)
  assert.match(source, /group: cafe24-db/)
  assert.match(source, /cancel-in-progress: false/)
  assert.match(source, /actions: read/)
  assert.match(source, /contents: read/)
  for (const required of ['run-id:', 'repository:', 'github-token:', 'db-workflow.mjs', 'db-evidence.mjs verify', 'fixed-deploy.lock']) assert.ok(source.includes(required), required)
  assert.doesNotMatch(source, /continue-on-error|pm2|nginx|db push|migrate dev|sql_input|database_url:/)
  assert.match(source, /sourceTestRunAttempt|TEST_RUN_ATTEMPT/)
  for (const file of ['.github/workflows/test.yml', '.github/workflows/db-maintenance.yml']) {
    const parsed = spawnSync('python3', ['-c', 'import sys,yaml; yaml.safe_load(open(sys.argv[1]))', file], { encoding: 'utf8' })
    assert.equal(parsed.status, 0, parsed.stderr)
  }
})


test('initial active app checkpoint follows successful reconcile and binds local and public release', () => {
  const source = readFileSync('.github/workflows/db-maintenance.yml', 'utf8')
  const maintain = source.indexOf('node scripts/deploy/db-maintenance.mjs "$DB_OPERATION"')
  const initialize = source.indexOf('node scripts/deploy/db-active-app.mjs init-active')
  assert.ok(maintain >= 0 && initialize > maintain)
  assert.match(source, /if \[ "\$DB_OPERATION" = reconcile \]; then/)
  assert.match(source, /127\.0\.0\.1:8000\/api\/internal\/release-readiness/)
  assert.match(source, /https:\/\/ilsangkit\.co\.kr\/api\/health/)
  assert.match(source, /init-active "\$DB_STATE_ROOT" "\$TESTED_SHA"/)
})
