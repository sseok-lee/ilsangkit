import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, symlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import test from 'node:test'
import {
  REQUIRED_INVENTORY_FIELDS,
  sanitizePm2Process,
  validateInventory,
} from './inventory.mjs'

const requiredWriters = [
  ['sync:apt-sale', 'tsx src/scripts/syncAptSale.ts'],
  ['sync:apt-rent', 'tsx src/scripts/syncAptRent.ts'],
  ['sync:villa-sale', 'tsx src/scripts/syncVillaSale.ts'],
  ['sync:villa-rent', 'tsx src/scripts/syncVillaRent.ts'],
  ['sync:offitel-sale', 'tsx src/scripts/syncOffitelSale.ts'],
  ['sync:offitel-rent', 'tsx src/scripts/syncOffitelRent.ts'],
  ['sync:geocode-real-estate', 'tsx src/scripts/geocodeRealEstate.ts'],
  ['refresh-real-estate-summary', 'tsx src/scripts/refreshRealEstateSummary.ts'],
]

const baseInventory = {
  deployRoot: '/srv/ilsangkit',
  releasesRoot: '/srv/ilsangkit/releases',
  nginxConfigPath: '/etc/nginx/sites-enabled/ilsangkit',
  nginxIncludePath: '/etc/nginx/includes/ilsangkit-release.conf',
  nginxBinary: '/usr/sbin/nginx',
  pm2Binary: '/usr/bin/pm2',
  active: {
    backend: { name: 'actual-backend', cwd: '/srv/ilsangkit/current/backend', port: 8000 },
    frontend: { name: 'actual-frontend', cwd: '/srv/ilsangkit/current/frontend', port: 3000 },
  },
  reservePorts: [13000, 13001, 18000, 18001, 19000],
  assets: { publicDir: '/srv/ilsangkit/current/frontend/public' },
  sitemap: { path: '/srv/ilsangkit/current/frontend/public/sitemap.xml' },
  envFile: '/srv/ilsangkit/shared/backend.env',
  database: { engine: 'mysql', version: '8.0.44' },
  free: { diskBytes: 20_000_000_000, memoryBytes: 2_000_000_000 },
  writers: requiredWriters.map(([name, command]) => ({ name, command, lock: `release-writer:${name}` })),
  pm2Snapshot: [
    { name: 'actual-backend', pm2_env: { pm_cwd: '/srv/ilsangkit/current/backend' }, monit: {}, pid: 10 },
    { name: 'actual-frontend', pm2_env: { pm_cwd: '/srv/ilsangkit/current/frontend' }, monit: {}, pid: 11 },
  ],
  ecosystemProcesses: ['ilsangkit-backend', 'ilsangkit-frontend'],
}

test('REQUIRED_INVENTORY_FIELDS documents the deploy cutover inventory contract', () => {
  assert.deepEqual(REQUIRED_INVENTORY_FIELDS, [
    'deployRoot',
    'releasesRoot',
    'nginxConfigPath',
    'nginxIncludePath',
    'nginxBinary',
    'pm2Binary',
    'active.backend.name',
    'active.backend.cwd',
    'active.backend.port',
    'active.frontend.name',
    'active.frontend.cwd',
    'active.frontend.port',
    'reservePorts',
    'assets.publicDir',
    'sitemap.path',
    'envFile',
    'database.engine',
    'database.version',
    'free.diskBytes',
    'free.memoryBytes',
    'writers',
  ])
})

test('validateInventory rejects missing fields, path escape, duplicate ports, unknown writers, and unchecked capacity', () => {
  const inventory = structuredClone(baseInventory)
  delete inventory.active.backend.cwd
  inventory.releasesRoot = '/srv/ilsangkit/releases/../../etc'
  inventory.reservePorts = [13000, 13000]
  inventory.writers = [{ name: 'unknown', command: 'rm -rf /', lock: 'bad' }]
  inventory.free = { diskBytes: null, memoryBytes: 0 }

  const result = validateInventory(inventory)

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /active\.backend\.cwd/)
  assert.match(result.errors.join('\n'), /releasesRoot must stay under deployRoot/)
  assert.match(result.errors.join('\n'), /duplicate reserve port: 13000/)
  assert.match(result.errors.join('\n'), /unknown writer: unknown/)
  assert.match(result.errors.join('\n'), /missing required writer: sync:apt-sale/)
  assert.match(result.errors.join('\n'), /free\.diskBytes/)
  assert.match(result.errors.join('\n'), /free\.memoryBytes/)
  assert.equal(result.safeToMutate, false)
})

test('validateInventory rejects missing nested asset and sitemap paths', () => {
  const inventory = structuredClone(baseInventory)
  inventory.assets = {}
  inventory.sitemap = {}

  const result = validateInventory(inventory)

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /assets\.publicDir/)
  assert.match(result.errors.join('\n'), /sitemap\.path/)
})

test('validateInventory rejects symlink releasesRoot escapes using real paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'inventory-root-'))
  const outside = mkdtempSync(join(tmpdir(), 'inventory-outside-'))
  const deployRoot = join(root, 'deploy')
  mkdirSync(deployRoot)
  const releaseLink = join(deployRoot, 'releases')
  symlinkSync(outside, releaseLink)

  const inventory = {
    ...structuredClone(baseInventory),
    deployRoot,
    releasesRoot: releaseLink,
  }

  const result = validateInventory(inventory)

  assert.equal(result.ok, false)
  assert.match(result.errors.join('\n'), /releasesRoot must stay under deployRoot/)
})

test('validateInventory requires concrete direct writer commands and locks', () => {
  const vague = {
    ...structuredClone(baseInventory),
    writers: [{ name: 'sync-real-estate', command: 'npm run sync:all', lock: 'release-writer:sync-real-estate' }],
  }
  const vagueResult = validateInventory(vague)
  assert.equal(vagueResult.ok, false)
  assert.match(vagueResult.errors.join('\n'), /unknown writer: sync-real-estate/)
  assert.match(vagueResult.errors.join('\n'), /missing required writer: sync:apt-sale/)

  const noCommand = structuredClone(baseInventory)
  noCommand.writers[0].command = ''
  noCommand.writers[1].lock = ''
  const noCommandResult = validateInventory(noCommand)
  assert.equal(noCommandResult.ok, false)
  assert.match(noCommandResult.errors.join('\n'), /writer sync:apt-sale missing command/)
  assert.match(noCommandResult.errors.join('\n'), /writer sync:apt-rent missing lock identity/)
})

test('validateInventory trusts actual PM2 snapshot names over ecosystem guesses', () => {
  const result = validateInventory(baseInventory)

  assert.equal(result.ok, true)
  assert.equal(result.safeToMutate, true)
  assert.deepEqual(result.warnings, [
    'ecosystem process "ilsangkit-backend" differs from active PM2 inventory',
    'ecosystem process "ilsangkit-frontend" differs from active PM2 inventory',
  ])
})

test('sanitizePm2Process excludes env and keeps only read-only identity fields', () => {
  assert.deepEqual(sanitizePm2Process({
    name: 'api',
    pid: 123,
    pm2_env: {
      pm_cwd: '/srv/app',
      PORT: '8000',
      DATABASE_URL: 'mysql://secret',
      env: { SECRET: 'nope' },
    },
    monit: { memory: 10 },
  }), {
    name: 'api',
    pid: 123,
    cwd: '/srv/app',
    port: 8000,
  })
})
