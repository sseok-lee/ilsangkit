import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8')
const sync = readFileSync('.github/workflows/sync-real-estate.yml', 'utf8')
const regen = readFileSync('.github/workflows/regen-sitemaps.yml', 'utf8')

test('deploy workflow is pinned to tested SHA and uses release commands instead of mutable production writes', () => {
  assert.match(deploy, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
  assert.doesNotMatch(deploy, /db push --accept-data-loss/)
  assert.doesNotMatch(deploy, /rm -rf \/home\/project2\/(backend\/dist|frontend\/\.output\/server)/)
  assert.doesNotMatch(deploy, /KILL\s+/)
  assert.match(deploy, /node "\$RELEASE_SCRIPT" deploy --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.doesNotMatch(deploy, /node "\$RELEASE_SCRIPT" prepare --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.doesNotMatch(deploy, /node "\$RELEASE_SCRIPT" check --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.doesNotMatch(deploy, /node "\$RELEASE_SCRIPT" switch --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.match(deploy, /deployment-state\.mjs/)
  assert.doesNotMatch(deploy, /__FILLED_FROM_INVENTORY__|__SUMMARY_RUN_ID__/)
  assert.match(deploy, /node "\$RELEASE_SCRIPT" reconcile --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
})

test('failed pre-switch deploy can resume only the identified staged release through Actions', () => {
  assert.match(deploy, /workflow_dispatch:/)
  assert.match(deploy, /test "\$RELEASE_ID" = 'address-f80a26c09cb5'/)
  assert.match(deploy, /manifest\.commitSha !== candidateCommit \|\| manifest\.workflowSha !== candidateCommit/)
  assert.match(deploy, /inventory\.active\?\.releaseId !== activeReleaseId/)
  assert.match(deploy, /node "\$CONTROLLER" resume --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.match(deploy, /node "\$CONTROLLER" reconcile --inventory "\$INVENTORY" --manifest "\$MANIFEST"/)
  assert.match(deploy, /deploy_required=false/)
})

test('scheduled sync resolves the active backend once before running writers', () => {
  assert.match(sync, /ACTIVE_BACKEND_LINK="\$\{ILSK_ACTIVE_BACKEND_LINK:-\/home\/project2\/backend\}"/)
  assert.match(sync, /ACTIVE_BACKEND_DIR="\$\(cd "\$ACTIVE_BACKEND_LINK" && pwd -P\)"/)
  assert.match(sync, /run_backend_node_timed 20m "\$ACTIVE_BACKEND_DIR\/dist\/scripts\/\$\{SCRIPT\}\.js"/)
  assert.doesNotMatch(sync, /cd \/home\/project2\/backend\n/)
})

test('scheduled sync binds release runtime before node script calls', () => {
  assert.match(sync, /ACTIVE_RELEASE_ROOT="\$\(dirname "\$ACTIVE_BACKEND_DIR"\)"/)
  assert.match(sync, /SYNC_RUNTIME_SCRIPT="\$ACTIVE_RELEASE_ROOT\/scripts\/deploy\/sync-runtime\.mjs"/)
  assert.doesNotMatch(sync, /SYNC_RUNTIME_SCRIPT="\/home\/project2\/deploy\/scripts\/sync-runtime\.mjs"/)
  assert.doesNotMatch(sync, /release-inbox/)
  assert.match(sync, /node "\$SYNC_RUNTIME_SCRIPT" print --active-backend-link "\$ACTIVE_BACKEND_LINK" --inventory "\$INVENTORY"/)
  assert.match(sync, /node "\$SYNC_RUNTIME_SCRIPT" run --active-backend-link "\$ACTIVE_BACKEND_LINK" --inventory "\$INVENTORY" -- node "\$@"/)
  assert.match(sync, /current-backend is active but sync runtime helper was not found/)
  assert.doesNotMatch(sync, /SITEMAP_REGEN_BASE="http:\/\/127\.0\.0\.1:3000"\n\s*set \+x\n\s*export SITEMAP_REGEN_TOKEN[\s\S]*node "\$ACTIVE_BACKEND_DIR\/dist\/scripts\/generateSitemaps\.js"/)
})

test('sitemap generation workflows use active release runtime with a 20 minute generation budget', () => {
  assert.match(sync, /run_backend_node_timed 20m "\$ACTIVE_BACKEND_DIR\/dist\/scripts\/generateSitemaps\.js"/)
  assert.doesNotMatch(sync, /timeout --kill-after=30s 10m node "\$ACTIVE_BACKEND_DIR\/dist\/scripts\/generateSitemaps\.js"/)

  assert.doesNotMatch(regen, /SYNC_RUNTIME_SCRIPT="\/home\/project2\/deploy\/scripts\/sync-runtime\.mjs"/)
  assert.match(regen, /command_timeout: 25m/)
  assert.match(regen, /ACTIVE_BACKEND_LINK="\$\{ILSK_ACTIVE_BACKEND_LINK:-\/home\/project2\/backend\}"/)
  assert.match(regen, /ACTIVE_BACKEND_DIR="\$\(cd "\$ACTIVE_BACKEND_LINK" && pwd -P\)"/)
  assert.match(regen, /ACTIVE_RELEASE_ROOT="\$\(dirname "\$ACTIVE_BACKEND_DIR"\)"/)
  assert.match(regen, /SYNC_RUNTIME_SCRIPT="\$ACTIVE_RELEASE_ROOT\/scripts\/deploy\/sync-runtime\.mjs"/)
  assert.match(regen, /node "\$SYNC_RUNTIME_SCRIPT" print --active-backend-link "\$ACTIVE_BACKEND_LINK" --inventory "\$INVENTORY"/)
  assert.match(regen, /node "\$SYNC_RUNTIME_SCRIPT" run --active-backend-link "\$ACTIVE_BACKEND_LINK" --inventory "\$INVENTORY" -- node "\$@"/)
  assert.match(regen, /current-backend is active but sync runtime helper was not found/)
  assert.match(regen, /run_backend_node_timed 20m "\$ACTIVE_BACKEND_DIR\/dist\/scripts\/generateSitemaps\.js"/)
  assert.doesNotMatch(regen, /cd \/home\/project2\/backend/)
  assert.doesNotMatch(regen, /SITEMAP_REGEN_BASE="http:\/\/127\.0\.0\.1:3000"[\s\S]*node dist\/scripts\/generateSitemaps\.js/)
  assert.doesNotMatch(regen, /timeout --kill-after=30s 10m node dist\/scripts\/generateSitemaps\.js/)
})


test('workflow YAML files parse with a real YAML parser', () => {
  for (const file of ['.github/workflows/deploy.yml', '.github/workflows/sync-real-estate.yml', '.github/workflows/regen-sitemaps.yml']) {
    const result = spawnSync('python3', ['-c', 'import sys, yaml; yaml.safe_load(open(sys.argv[1], encoding="utf-8"))', file], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${file} failed YAML parse: ${result.stderr}`)
  }
})

test('normal deploy workflow uses DB-backed readiness inputs instead of full B3 source validation', () => {
  assert.doesNotMatch(deploy, /verifyRealEstateSummaryV2/)
  assert.doesNotMatch(deploy, /prepareRealEstateSummaryV2/)
  assert.match(deploy, /summaryReady|summaryReadiness|release-readiness/)
})

test('deploy workflow binds runtime/probes from actual active state and packages its helpers', () => {
  assert.match(deploy, /node "\$INBOX\/scripts\/deploy\/deployment-state\.mjs" "\$INVENTORY" "\$MANIFEST" "\$HASHED_ASSETS" "\$INBOX\/readiness\.json"/)
  assert.match(deploy, /cp scripts\/deploy\/release\.mjs scripts\/deploy\/deployment-state\.mjs scripts\/deploy\/sync-runtime\.mjs/)
  assert.match(deploy, /hashed-assets\.json/)
  assert.match(deploy, /_nuxt/)
})
