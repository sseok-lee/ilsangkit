import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { fixedRuntime, updateEnvText, renderFixedNginx, selectReleaseProcesses, firstHashedAsset } from './fixed-runtime.mjs'

const sha = '0123456789abcdef0123456789abcdef01234567'
const readiness = {
  ready: true,
  releaseId: 'address-f80a26c09cb5',
  summary: { mode: 'address', runId: 'd82a31a2-a47f-4a2f-8d3a-42f6156556f8' },
  realEstateUrls: { mode: 'preserved', ready: true },
  db: { ok: true },
}

test('fixed runtime keeps the ready address summary and preserved URL policy', () => {
  const runtime = fixedRuntime(sha, readiness)
  assert.equal(runtime.id, 'fixed-0123456789ab')
  assert.equal(runtime.backend.REAL_ESTATE_SUMMARY_MODE, 'address')
  assert.equal(runtime.backend.REAL_ESTATE_URL_MODE, 'preserved')
  assert.equal(runtime.backend.REAL_ESTATE_SUMMARY_RUN_ID, readiness.summary.runId)
  assert.equal(runtime.backend.REAL_ESTATE_WRITE_LOCK_DIR, '/home/project2/run/real-estate-locks')
  assert.equal(runtime.backend.SITEMAP_DIR, '/home/project2/sitemaps')
  assert.equal(runtime.frontend.NUXT_INTERNAL_API_BASE, 'http://127.0.0.1:8000')
  assert.equal(runtime.frontend.SITEMAP_DIR, '/home/project2/sitemaps')
})

test('fixed runtime rejects stale or incompatible readiness before touching env files', () => {
  for (const bad of [
    { ...readiness, ready: false },
    { ...readiness, summary: { mode: 'compatibility', runId: readiness.summary.runId } },
    { ...readiness, summary: { mode: 'address', runId: '' } },
    { ...readiness, realEstateUrls: { mode: 'keyed', ready: true } },
    { ...readiness, db: { ok: false } },
  ]) assert.throws(() => fixedRuntime(sha, bad))
  assert.throws(() => fixedRuntime('not-a-sha', readiness))
})

test('env update preserves secrets and removes stale duplicate runtime keys', () => {
  const original = '# managed secrets\nDATABASE_URL="mysql://private@localhost/db"\nPORT=9000\nPORT=9001\n'
  const updated = updateEnvText(original, { PORT: '8000', ILSK_RELEASE_ID: 'fixed-0123456789ab' })
  assert.match(updated, /DATABASE_URL="mysql:\/\/private@localhost\/db"/)
  assert.equal(updated.match(/^PORT=/gm)?.length, 1)
  assert.match(updated, /^PORT=8000$/m)
  assert.match(updated, /^ILSK_RELEASE_ID=fixed-0123456789ab$/m)
  assert.throws(() => updateEnvText(original, { PORT: '8000\nEVIL=1' }))
})

test('nginx fixed upstreams use canonical ports and a build-specific cache key', () => {
  const rendered = renderFixedNginx('fixed-0123456789ab')
  assert.match(rendered, /ilsangkit_release_web \{ server 127\.0\.0\.1:3000;/)
  assert.match(rendered, /ilsangkit_release_api \{ server 127\.0\.0\.1:8000;/)
  assert.match(rendered, /default "fixed-0123456789ab"/)
  assert.doesNotMatch(rendered, /deploy\/releases|proxy_cache_path/)
})

test('PM2 cleanup selects only release processes with matching release directories', () => {
  const processes = [
    { name: 'ilsangkit-backend', pm2_env: { pm_cwd: '/home/project2/backend' } },
    { name: 'other-service', pm2_env: { pm_cwd: '/home/project2/deploy/releases/address-a/backend' } },
    { name: 'ilsangkit-backend-address-f80a26c09cb5', pm2_env: { pm_cwd: '/home/project2/deploy/releases/address-f80a26c09cb5/backend' } },
    { name: 'ilsangkit-frontend-address-f80a26c09cb5', pm2_env: { pm_cwd: '/home/project2/deploy/releases/address-f80a26c09cb5/frontend' } },
  ]
  assert.deepEqual(selectReleaseProcesses(processes), [
    'ilsangkit-backend-address-f80a26c09cb5',
    'ilsangkit-frontend-address-f80a26c09cb5',
  ])
  assert.throws(() => selectReleaseProcesses([
    { name: 'ilsangkit-backend-address-f80a26c09cb5', pm2_env: { pm_cwd: '/home/project2/backend' } },
  ]))
})

test('public smoke selects a hashed CSS or JS asset from SSR HTML', () => {
  assert.equal(firstHashedAsset('<link href="/_nuxt/entry.CwfdUfJz.css"><script src="/_nuxt/app.X.js">'), '/_nuxt/entry.CwfdUfJz.css')
  assert.throws(() => firstHashedAsset('<link href="/_nuxt/../secrets.css">'))
  assert.throws(() => firstHashedAsset('<html>no assets</html>'))
})

test('prepare CLI writes private fixed env files without echoing secrets', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-fixed-runtime-'))
  try {
    const source = join(dir, 'readiness.json')
    const backend = join(dir, 'backend.env')
    const frontend = join(dir, 'frontend.env')
    writeFileSync(source, JSON.stringify(readiness))
    writeFileSync(backend, 'DATABASE_URL=mysql://private@localhost/db\n')
    writeFileSync(frontend, 'SITEMAP_REGEN_TOKEN=private-token\n')
    const result = spawnSync(process.execPath, ['scripts/deploy/fixed-runtime.mjs', 'prepare', sha, source, backend, frontend], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.doesNotMatch(result.stdout + result.stderr, /private-token|private@localhost/)
    assert.equal(statSync(backend).mode & 0o777, 0o600)
    assert.equal(statSync(frontend).mode & 0o777, 0o600)
    assert.match(readFileSync(backend, 'utf8'), /REAL_ESTATE_SUMMARY_MODE=address/)
    assert.match(readFileSync(frontend, 'utf8'), /NUXT_INTERNAL_API_BASE=http:\/\/127\.0\.0\.1:8000/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
