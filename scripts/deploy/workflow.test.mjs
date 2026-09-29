import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8')
const sync = readFileSync('.github/workflows/sync-real-estate.yml', 'utf8')

test('deploy workflow is pinned to tested SHA and uses release commands instead of mutable production writes', () => {
  assert.match(deploy, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
  assert.doesNotMatch(deploy, /db push --accept-data-loss/)
  assert.doesNotMatch(deploy, /rm -rf \/home\/project2\/(backend\/dist|frontend\/\.output\/server)/)
  assert.doesNotMatch(deploy, /KILL\s+/)
  assert.match(deploy, /node "\$RELEASE_SCRIPT" deploy --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.doesNotMatch(deploy, /node "\$RELEASE_SCRIPT" prepare --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.doesNotMatch(deploy, /node "\$RELEASE_SCRIPT" check --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.doesNotMatch(deploy, /node "\$RELEASE_SCRIPT" switch --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.match(deploy, /inventory business probes are required/)
  assert.doesNotMatch(deploy, /__FILLED_FROM_INVENTORY__|__SUMMARY_RUN_ID__/)
  assert.match(deploy, /node "\$RELEASE_SCRIPT" reconcile --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
})

test('scheduled sync resolves the active backend once before running writers', () => {
  assert.match(sync, /ACTIVE_BACKEND_LINK="\$\{ILSK_ACTIVE_BACKEND_LINK:-\/home\/project2\/backend\}"/)
  assert.match(sync, /ACTIVE_BACKEND_DIR="\$\(cd "\$ACTIVE_BACKEND_LINK" && pwd -P\)"/)
  assert.match(sync, /node "\$ACTIVE_BACKEND_DIR\/dist\/scripts\/\$\{SCRIPT\}\.js"/)
  assert.doesNotMatch(sync, /cd \/home\/project2\/backend\n/)
})


test('workflow YAML files parse with a real YAML parser', () => {
  for (const file of ['.github/workflows/deploy.yml', '.github/workflows/sync-real-estate.yml']) {
    const result = spawnSync('python3', ['-c', 'import sys, yaml; yaml.safe_load(open(sys.argv[1], encoding="utf-8"))', file], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${file} failed YAML parse: ${result.stderr}`)
  }
})

test('normal deploy workflow uses DB-backed readiness inputs instead of full B3 source validation', () => {
  assert.doesNotMatch(deploy, /verifyRealEstateSummaryV2/)
  assert.doesNotMatch(deploy, /prepareRealEstateSummaryV2/)
  assert.match(deploy, /summaryReady|summaryReadiness|release-readiness/)
})

test('deploy workflow supplies runtime config, public proxy probes, and hashed assets from inventory/artifact', () => {
  assert.match(deploy, /backendEnvFile/)
  assert.match(deploy, /realEstateWriteLockDir/)
  assert.match(deploy, /sitemapDir/)
  assert.match(deploy, /publicSmokeProbes/)
  assert.doesNotMatch(deploy, /publicSmokeProbes:\s*inventory\.publicSmokeProbes \|\| probes/)
  assert.match(deploy, /hashedAssets/)
  assert.match(deploy, /_nuxt/)
  assert.match(deploy, /activePointers/)
})
