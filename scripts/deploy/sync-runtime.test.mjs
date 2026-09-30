import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { resolveSyncRuntime } from './sync-runtime.mjs'

function makeFixture() {
  const root = mkdtempSync(join(tmpdir(), 'sync-runtime-'))
  const deployRoot = join(root, 'deploy')
  const releasesRoot = join(deployRoot, 'releases')
  const releaseId = 'address-20260930-a'
  const backendDir = join(releasesRoot, releaseId, 'backend')
  const frontendDir = join(releasesRoot, releaseId, 'frontend')
  const sharedDir = join(deployRoot, 'shared')
  const envFile = join(sharedDir, 'backend.env')
  const currentBackend = join(deployRoot, 'current-backend')
  const releaseRoot = join(releasesRoot, releaseId)
  const manifestPath = join(releaseRoot, '.release-manifest.json')
  const inventoryPath = join(deployRoot, 'inventory.json')
  mkdirSync(backendDir, { recursive: true })
  mkdirSync(frontendDir, { recursive: true })
  mkdirSync(sharedDir, { recursive: true })
  symlinkSync(backendDir, currentBackend)
  writeFileSync(envFile, [
    'DATABASE_URL="mysql://file-db?connection_limit=1&pool_timeout=5"',
    'OPENAPI_SERVICE_KEY=file-secret',
    'NODE_ENV=development',
    'REAL_ESTATE_SUMMARY_MODE=legacy',
    'REAL_ESTATE_URL_MODE=keyed',
    'SITEMAP_DIR=/stale/sitemap',
    'SITEMAP_REGEN_TOKEN=file-stale-token',
  ].join('\n'))
  const inventory = {
    deployRoot,
    releasesRoot,
    activeReleaseId: releaseId,
    active: {
      releaseId,
      backend: { releaseId, cwd: backendDir, port: 18001 },
      frontend: { releaseId, cwd: frontendDir, port: 13001 },
    },
    activePointers: { backend: currentBackend, frontend: join(deployRoot, 'current-frontend') },
    envFile,
    runtime: {
      backendEnvFile: envFile,
      realEstateWriteLockDir: join(sharedDir, 'locks'),
      sitemapDir: join(sharedDir, 'sitemaps', releaseId),
    },
  }
  const manifest = {
    releaseId,
    ports: { frontend: 13001, backend: 18001 },
    summary: { mode: 'address', runId: 'summary-run-1', expectedRunId: 'summary-run-1', state: 'ready' },
    activePointers: inventory.activePointers,
    runtime: inventory.runtime,
  }
  writeFileSync(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`)
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
  return { root, releaseId, releaseRoot, backendDir, currentBackend, inventoryPath, manifestPath, envFile, manifest, inventory }
}

test('release runtime loads protected backend env and overrides release-owned values', () => {
  const fixture = makeFixture()
  const runtime = resolveSyncRuntime({
    activeBackendLink: fixture.currentBackend,
    inventoryPath: fixture.inventoryPath,
  }, {
    DATABASE_URL: 'mysql://parent-stale',
    SITEMAP_REGEN_TOKEN: 'token-from-workflow',
  })

  assert.equal(runtime.mode, 'release')
  assert.equal(runtime.releaseId, fixture.releaseId)
  assert.equal(runtime.env.DATABASE_URL, 'mysql://file-db?connection_limit=1&pool_timeout=5')
  assert.equal(runtime.env.OPENAPI_SERVICE_KEY, 'file-secret')
  assert.equal(runtime.env.NODE_ENV, 'production')
  assert.equal(runtime.env.REAL_ESTATE_SUMMARY_MODE, 'address')
  assert.equal(runtime.env.REAL_ESTATE_URL_MODE, 'preserved')
  assert.equal(runtime.env.REAL_ESTATE_SUMMARY_RUN_ID, 'summary-run-1')
  assert.equal(runtime.env.ILSK_SUMMARY_RUN_ID, 'summary-run-1')
  assert.equal(runtime.env.SITEMAP_DIR, fixture.manifest.runtime.sitemapDir)
  assert.equal(runtime.env.SITEMAP_REGEN_BASE, 'http://127.0.0.1:13001')
  assert.equal(runtime.env.SITEMAP_REGEN_TOKEN, 'token-from-workflow')
})

test('release runtime supports explicit manifest override only', () => {
  const fixture = makeFixture()
  const overrideManifest = join(fixture.root, 'override.release-manifest.json')
  writeFileSync(overrideManifest, `${JSON.stringify({
    ...fixture.manifest,
    summary: { mode: 'compatibility', runId: 'override-run', expectedRunId: 'override-run', state: 'ready' },
  }, null, 2)}\n`)

  const runtime = resolveSyncRuntime({
    activeBackendLink: fixture.currentBackend,
    inventoryPath: fixture.inventoryPath,
    manifestPath: overrideManifest,
  })

  assert.equal(runtime.summaryMode, 'compatibility')
  assert.equal(runtime.summaryRunId, 'override-run')
  assert.equal(runtime.env.REAL_ESTATE_SUMMARY_MODE, 'compatibility')
  assert.equal(runtime.env.REAL_ESTATE_SUMMARY_RUN_ID, 'override-run')
})

test('release runtime fails when retained release manifest is missing', () => {
  const fixture = makeFixture()
  const otherRoot = mkdtempSync(join(tmpdir(), 'sync-runtime-missing-manifest-'))
  const deployRoot = join(otherRoot, 'deploy')
  const releasesRoot = join(deployRoot, 'releases')
  const releaseId = 'address-20260930-b'
  const backendDir = join(releasesRoot, releaseId, 'backend')
  const frontendDir = join(releasesRoot, releaseId, 'frontend')
  const currentBackend = join(deployRoot, 'current-backend')
  mkdirSync(backendDir, { recursive: true })
  mkdirSync(frontendDir, { recursive: true })
  symlinkSync(backendDir, currentBackend)
  writeFileSync(fixture.inventoryPath, `${JSON.stringify({
    ...fixture.inventory,
    releasesRoot,
    activeReleaseId: releaseId,
    active: {
      releaseId,
      backend: { releaseId, cwd: backendDir, port: 18001 },
      frontend: { releaseId, cwd: frontendDir, port: 13001 },
    },
    activePointers: { ...fixture.inventory.activePointers, backend: currentBackend },
  }, null, 2)}\n`)

  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: currentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /\.release-manifest\.json/,
  )
})

test('release runtime fails closed when current-backend disagrees with inventory pointer', () => {
  const fixture = makeFixture()
  const badInventory = {
    ...fixture.inventory,
    activePointers: { ...fixture.inventory.activePointers, backend: join(fixture.root, 'wrong-current-backend') },
  }
  writeFileSync(fixture.inventoryPath, `${JSON.stringify(badInventory, null, 2)}\n`)

  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: fixture.currentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /inventory backend pointer does not match active backend link/,
  )
})

test('release runtime fails closed when inventory active backend cwd or port drifts from manifest', () => {
  const fixture = makeFixture()
  const badInventory = {
    ...fixture.inventory,
    active: {
      ...fixture.inventory.active,
      backend: { ...fixture.inventory.active.backend, cwd: join(fixture.root, 'deploy/releases/other/backend') },
    },
  }
  mkdirSync(badInventory.active.backend.cwd, { recursive: true })
  writeFileSync(fixture.inventoryPath, `${JSON.stringify(badInventory, null, 2)}\n`)

  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: fixture.currentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /inventory\.active\.backend\.cwd does not match active release backend/,
  )

  writeFileSync(fixture.inventoryPath, `${JSON.stringify({
    ...fixture.inventory,
    active: {
      ...fixture.inventory.active,
      frontend: { ...fixture.inventory.active.frontend, port: 13002 },
    },
  }, null, 2)}\n`)

  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: fixture.currentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /inventory active frontend port does not match manifest frontend port/,
  )
})

test('release runtime rejects malformed active release paths and invalid summary state', () => {
  const fixture = makeFixture()
  const nestedBackend = join(fixture.root, 'deploy/releases/address-20260930-a/backend/nested')
  const nestedCurrentBackend = join(fixture.root, 'deploy/current-backend-nested')
  mkdirSync(nestedBackend, { recursive: true })
  symlinkSync(nestedBackend, nestedCurrentBackend)

  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: nestedCurrentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /current-backend does not point at inventory\.releasesRoot\/<releaseId>\/backend/,
  )

  writeFileSync(fixture.manifestPath, `${JSON.stringify({
    ...fixture.manifest,
    summary: { mode: 'legacy', runId: 'summary-run-1', expectedRunId: 'summary-run-1', state: 'ready' },
  }, null, 2)}\n`)
  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: fixture.currentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /manifest summary mode must be address or compatibility/,
  )

  writeFileSync(fixture.manifestPath, `${JSON.stringify({
    ...fixture.manifest,
    summary: { mode: 'address', runId: 'summary-run-1', expectedRunId: 'other-run', state: 'ready' },
  }, null, 2)}\n`)
  assert.throws(
    () => resolveSyncRuntime({
      activeBackendLink: fixture.currentBackend,
      inventoryPath: fixture.inventoryPath,
    }),
    /manifest summary runId must match expectedRunId/,
  )
})

test('legacy runtime loads active backend dotenv without requiring release inventory', () => {
  const root = mkdtempSync(join(tmpdir(), 'sync-runtime-legacy-'))
  const backendDir = join(root, 'backend')
  mkdirSync(backendDir, { recursive: true })
  writeFileSync(join(backendDir, '.env'), [
    'DATABASE_URL=mysql://legacy-db?connection_limit=1&pool_timeout=5',
    'OPENAPI_SERVICE_KEY=legacy-secret',
  ].join('\n'))

  const runtime = resolveSyncRuntime({ activeBackendLink: backendDir }, {
    SITEMAP_REGEN_TOKEN: 'token-from-workflow',
  })

  assert.equal(runtime.mode, 'legacy')
  assert.equal(runtime.env.DATABASE_URL, 'mysql://legacy-db?connection_limit=1&pool_timeout=5')
  assert.equal(runtime.env.OPENAPI_SERVICE_KEY, 'legacy-secret')
  assert.equal(runtime.env.SITEMAP_DIR, '/home/project2/sitemaps')
  assert.equal(runtime.env.SITEMAP_REGEN_BASE, 'http://127.0.0.1:3000')
  assert.equal(runtime.env.SITEMAP_REGEN_TOKEN, 'token-from-workflow')
})

test('run command injects resolved runtime env into child without printing env file values itself', () => {
  const fixture = makeFixture()
  const result = spawnSync(process.execPath, [
    'scripts/deploy/sync-runtime.mjs',
    'run',
    '--active-backend-link',
    fixture.currentBackend,
    '--inventory',
    fixture.inventoryPath,
    '--',
    process.execPath,
    '-e',
    'process.stdout.write([process.env.DATABASE_URL, process.env.REAL_ESTATE_SUMMARY_MODE, process.env.SITEMAP_REGEN_BASE].join("\\n"))',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: { SITEMAP_REGEN_TOKEN: 'token-from-workflow' },
  })

  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(result.stdout.split('\n'), [
    'mysql://file-db?connection_limit=1&pool_timeout=5',
    'address',
    'http://127.0.0.1:13001',
  ])
  assert.equal(result.stderr, '')
})
