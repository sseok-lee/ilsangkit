import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, existsSync, lstatSync, rmSync, readlinkSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import test from 'node:test'
import {
  buildCandidateEnvironment,
  renderNginxReleaseConfig,
  retainHashedAssets,
  runReleaseCommand,
  validateManifest,
  verifyArtifacts,
} from './release.mjs'

const require = createRequire(import.meta.url)
const releaseEcosystemPath = require.resolve('../../ecosystem.release.config.cjs')
const releaseEcosystemEnvKeys = [
  'ILSK_RELEASE_ID',
  'ILSK_RELEASE_ROOT',
  'ILSK_BACKEND_PORT',
  'ILSK_FRONTEND_PORT',
  'NUXT_INTERNAL_API_BASE',
  'ILSK_BACKEND_ENV_FILE',
  'DATABASE_URL',
  'REAL_ESTATE_SUMMARY_MODE',
  'REAL_ESTATE_URL_MODE',
  'REAL_ESTATE_SUMMARY_RUN_ID',
  'ILSK_SUMMARY_RUN_ID',
  'REAL_ESTATE_WRITE_LOCK_DIR',
  'SITEMAP_DIR',
]

function loadReleaseEcosystemWithEnv(env) {
  const keys = new Set([...releaseEcosystemEnvKeys, ...Object.keys(env)])
  const previous = {}
  for (const key of keys) {
    previous[key] = process.env[key]
    if (Object.hasOwn(env, key)) process.env[key] = env[key]
    else delete process.env[key]
  }
  delete require.cache[releaseEcosystemPath]
  try {
    return require(releaseEcosystemPath)
  } finally {
    delete require.cache[releaseEcosystemPath]
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function makeWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'c2-release-'))
  const deployRoot = join(root, 'deploy')
  const releasesRoot = join(deployRoot, 'releases')
  const sharedRoot = join(deployRoot, 'shared')
  const assetsDir = join(sharedRoot, 'assets')
  const sitemapDir = join(sharedRoot, 'sitemaps')
  const nginxDir = join(deployRoot, 'nginx')
  mkdirSync(releasesRoot, { recursive: true })
  mkdirSync(assetsDir, { recursive: true })
  mkdirSync(sitemapDir, { recursive: true })
  mkdirSync(nginxDir, { recursive: true })
  const activeInclude = join(nginxDir, 'release-active.conf')
  const activeIncludeInitial = join(nginxDir, 'release-old.conf')
  writeFileSync(activeIncludeInitial, 'old include')
  symlinkSync(activeIncludeInitial, activeInclude)
  return { root, deployRoot, releasesRoot, sharedRoot, assetsDir, sitemapDir, nginxDir, activeInclude }
}

function createInventory(workspace) {
  const inventory = {
    deployRoot: workspace.deployRoot,
    releasesRoot: workspace.releasesRoot,
    nginxConfigPath: join(workspace.nginxDir, 'nginx.conf'),
    nginxIncludePath: workspace.activeInclude,
    nginxBinary: '/usr/sbin/nginx',
    pm2Binary: '/usr/bin/pm2',
    active: {
      backend: { name: 'ilsangkit-backend-old', cwd: join(workspace.releasesRoot, 'old', 'backend'), port: 8000 },
      frontend: { name: 'ilsangkit-frontend-old', cwd: join(workspace.releasesRoot, 'old', 'frontend'), port: 3000 },
    },
    reservePorts: [13000, 13001, 18000, 18001, 19000],
    assets: { publicDir: workspace.assetsDir },
    sitemap: { path: join(workspace.sitemapDir, 'sitemap.xml'), releaseDir: join(workspace.sitemapDir, 'address-20260929-abc123') },
    envFile: join(workspace.sharedRoot, 'backend.env'),
    realEstateWriteLockDir: join(workspace.sharedRoot, 'locks'),
    activeBackendLink: join(workspace.deployRoot, 'current-backend'),
    activeFrontendLink: join(workspace.deployRoot, 'current-frontend'),
    database: { engine: 'mysql', version: '8.0.44' },
    free: { diskBytes: 20_000_000_000, memoryBytes: 2_000_000_000 },
    writers: [],
  }
  writeFileSync(inventory.nginxConfigPath, `events {}
http { include ${inventory.nginxIncludePath}; }
`)
  return inventory
}


function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function createArtifacts(workspace) {
  const backendArtifact = join(workspace.root, 'backend.tgz')
  const frontendArtifact = join(workspace.root, 'frontend.tgz')
  const hashedAsset = join(workspace.root, 'entry.abc123.js')
  const backendContent = 'backend artifact'
  const frontendContent = 'frontend artifact'
  const assetContent = 'console.log("asset")'
  writeFileSync(backendArtifact, backendContent)
  writeFileSync(frontendArtifact, frontendContent)
  writeFileSync(hashedAsset, assetContent)
  return {
    backendArtifact,
    frontendArtifact,
    hashedAsset,
    backendSha256: sha256(backendContent),
    frontendSha256: sha256(frontendContent),
    hashedAssetSha256: sha256(assetContent),
  }
}


const SAME_A_KEY = 'a'.repeat(64)
const SAME_B_KEY = 'b'.repeat(64)
const MODE_KEY = 'c'.repeat(64)
const FRONTEND_SSR_PATH = '/real-estate/apt-sale/gyeongnam/changwon-seongsan/%EC%84%B1%EC%9B%90'

function semanticBusinessProbes(releaseId, summaryMode = 'address', runId = 'summary-run-1') {
  const listProbe = (name, type) => ({
    name,
    path: `/api/real-estate/${type}/complexes?city=서울특별시&district=강남구&limit=1`,
    target: 'backend',
    expectedReleaseId: releaseId,
    expectedJson: { success: true },
    expectedJsonTypes: { 'data.total': 'nonnegativeNumber', 'data.items': 'array', 'data.items[0].buildingName': 'nonemptyString' },
    expectedJsonMinItems: { 'data.items': 1 },
  })
  const buildingInfoProbe = (name, key, jibun) => ({
    name,
    path: `/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=${encodeURIComponent('같은아파트')}&buildingKey=${key}`,
    target: 'backend',
    expectedReleaseId: releaseId,
    expectedJson: { success: true, 'data.buildingKey': key, 'data.dongName': '역삼동', 'data.jibun': jibun, 'data.buildingName': '같은아파트' },
  })
  const detailProbe = (name, type, mode) => ({
    name,
    path: `/api/real-estate/${type}/detail?bjdCode=1168010100&buildingName=${encodeURIComponent('모드아파트')}&buildingKey=${MODE_KEY}&mode=${mode}`,
    target: 'backend',
    expectedReleaseId: releaseId,
    expectedJson: { success: true, 'data.filters.mode': mode, 'data.filters.buildingKey': MODE_KEY },
  })
  return [
    { name: 'release-readiness', path: '/api/internal/release-readiness', target: 'backend', expectedReleaseId: releaseId, expectedJson: { ready: true, releaseId, 'summary.mode': summaryMode, 'summary.runId': runId } },
    listProbe('apt-sale-list', 'apt-sale'),
    listProbe('apt-rent-list', 'apt-rent'),
    listProbe('villa-sale-list', 'villa-sale'),
    listProbe('villa-rent-list', 'villa-rent'),
    listProbe('offitel-sale-list', 'offitel-sale'),
    listProbe('offitel-rent-list', 'offitel-rent'),
    buildingInfoProbe('same-name-address-a', SAME_A_KEY, '101-1'),
    buildingInfoProbe('same-name-address-b', SAME_B_KEY, '202-2'),
    detailProbe('sale-mode', 'apt-sale', 'sale'),
    detailProbe('rent-mode', 'apt-rent', 'wolse'),
    { name: 'frontend-ssr', path: FRONTEND_SSR_PATH, target: 'frontend', expectedReleaseId: releaseId, expectBodyIncludes: ['<h1', '성원', '매매'] },
    { name: 'sitemap', path: '/sitemap.xml', target: 'frontend', expectedReleaseId: releaseId, expectBodyIncludes: '<loc>', expectedHeaders: { 'x-sitemap-source': 'static' } },
    {
      name: 'waste',
      path: '/api/waste-schedules?city=서울특별시&district=강남구&limit=1',
      target: 'backend',
      expectedReleaseId: releaseId,
      expectedJson: { success: true },
      expectedJsonTypes: { 'data.total': 'nonnegativeNumber', 'data.items': 'array', 'data.items[0].id': 'nonnegativeNumber' },
      expectedJsonMinItems: { 'data.items': 1 },
    },
  ]
}

function releaseIdForUrl(rawUrl, fallback = 'address-20260929-abc123') {
  const url = new URL(String(rawUrl), 'http://release-test.local')
  if (fallback === 'address-20260929-abc123' && (url.port === '13000' || url.port === '18000')) return 'compat-20260929-prev'
  return fallback
}

function semanticJsonForUrl(rawUrl, releaseId, summaryMode = 'address') {
  const url = new URL(String(rawUrl), 'http://release-test.local')
  releaseId = releaseId ?? releaseIdForUrl(rawUrl)
  const path = url.pathname
  if (path === '/api/internal/release-readiness') return { ready: true, releaseId, summary: { mode: summaryMode, runId: 'summary-run-1' } }
  if (path.endsWith('/complexes')) return { success: true, data: { total: 1, items: [{ buildingName: '테스트단지', buildingKey: SAME_A_KEY }] } }
  if (path.endsWith('/building-info')) {
    const key = url.searchParams.get('buildingKey') ?? SAME_A_KEY
    return { success: true, data: { buildingName: '같은아파트', buildingKey: key, dongName: '역삼동', jibun: key === SAME_B_KEY ? '202-2' : '101-1' } }
  }
  if (path.endsWith('/detail')) {
    const mode = url.searchParams.get('mode') ?? 'sale'
    return {
      success: true,
      data: {
        filters: {
          mode,
          buildingKey: url.searchParams.get('buildingKey') ?? MODE_KEY,
          bjdCode: url.searchParams.get('bjdCode') ?? '1168010100',
          buildingName: url.searchParams.get('buildingName') ?? '모드아파트',
          dongName: '역삼동',
          jibun: '101-1',
        },
      },
    }
  }
  if (path === '/api/waste-schedules') return { success: true, data: { total: 1, items: [{ id: 1, city: '서울특별시', district: '강남구' }] } }
  return { success: true, releaseId, summary: { mode: summaryMode, runId: 'summary-run-1' } }
}

function semanticTextForUrl(rawUrl) {
  const url = new URL(String(rawUrl), 'http://release-test.local')
  if (url.pathname === '/sitemap.xml') return '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://ilsangkit.co.kr/sitemap/facilities.xml</loc></sitemap></sitemapindex>'
  if (url.pathname === FRONTEND_SSR_PATH) return '<!doctype html><html><body><main><h1>성원</h1><p>아파트 매매 실거래가</p></main></body></html>'
  return 'ok'
}

function semanticHeadersForUrl(rawUrl, releaseId = 'address-20260929-abc123') {
  const effectiveReleaseId = releaseIdForUrl(rawUrl, releaseId)
  return {
    get(name) {
      const normalized = String(name).toLowerCase()
      if (normalized === 'x-ilsangkit-release-id') return effectiveReleaseId
      if (normalized === 'x-sitemap-source' && new URL(String(rawUrl), 'http://release-test.local').pathname === '/sitemap.xml') return 'static'
      return null
    },
  }
}

function createManifest(workspace, artifacts, extra = {}) {
  return {
    releaseId: 'address-20260929-abc123',
    commitSha: 'a'.repeat(40),
    workflowSha: 'a'.repeat(40),
    backendArtifact: { path: artifacts.backendArtifact, sha256: artifacts.backendSha256 },
    frontendArtifact: { path: artifacts.frontendArtifact, sha256: artifacts.frontendSha256 },
    ports: { frontend: 13001, backend: 18001, proxy: 19000 },
    rollbackReleaseId: 'compat-20260929-prev',
    rollback: {
      releaseId: 'compat-20260929-prev',
      frontendPort: 13000,
      backendPort: 18000,
      retained: true,
      supportsKeyedUrls: true,
      businessProbesPass: true,
      probes: [
        { name: 'rollback-readiness', path: '/api/internal/release-readiness', target: 'backend', expectedReleaseId: 'compat-20260929-prev', expectedJson: { ready: true, releaseId: 'compat-20260929-prev', 'summary.mode': 'address', 'summary.runId': 'summary-run-1' } },
        { name: 'rollback-frontend-ssr', path: FRONTEND_SSR_PATH, target: 'frontend', expectedReleaseId: 'compat-20260929-prev', expectBodyIncludes: ['<h1', '성원', '매매'] },
      ],
    },
    summary: { mode: 'address', runId: 'summary-run-1', expectedRunId: 'summary-run-1', state: 'ready' },
    runtime: {
      backendEnvFile: join(workspace.sharedRoot, 'backend.env'),
      realEstateWriteLockDir: join(workspace.sharedRoot, 'locks'),
      sitemapDir: join(workspace.sharedRoot, 'sitemaps', 'address-20260929-abc123'),
    },
    activePointers: {
      backend: join(workspace.deployRoot, 'current-backend'),
      frontend: join(workspace.deployRoot, 'current-frontend'),
    },
    publicOrigin: 'http://127.0.0.1:19000',
    hashedAssets: [{ path: artifacts.hashedAsset, fileName: 'entry.abc123.js', sha256: artifacts.hashedAssetSha256 }],
    probes: semanticBusinessProbes('address-20260929-abc123'),
    publicSmokeProbes: [
      { name: 'public-health', path: '/api/health', target: 'proxy', expectedReleaseId: 'address-20260929-abc123' },
      { name: 'public-sitemap', path: '/sitemap.xml', target: 'proxy', expectedReleaseId: 'address-20260929-abc123', expectBodyIncludes: '<loc>', expectedHeaders: { 'x-sitemap-source': 'static' } },
    ],
    ...extra,
  }
}

function okFetch(events, status = 200) {
  return async (url) => {
    events?.push(`fetch ${url}`)
    return {
      ok: status >= 200 && status < 300,
      status,
      headers: semanticHeadersForUrl(url),
      text: async () => semanticTextForUrl(url),
      json: async () => semanticJsonForUrl(url),
    }
  }
}

function okFetchForRelease(events, releaseId, summaryMode = 'address') {
  return async (url) => {
    events?.push(`fetch ${url}`)
    return {
      ok: true,
      status: 200,
      headers: semanticHeadersForUrl(url, releaseIdForUrl(url, releaseId)),
      text: async () => semanticTextForUrl(url),
      json: async () => semanticJsonForUrl(url, releaseIdForUrl(url, releaseId), summaryMode),
    }
  }
}

function createRunner(events, failStep) {
  return {
    async step(name) {
      events.push(name)
      if (failStep === name) throw new Error(`${name} failed`)
    },
    async run(command, args) {
      events.push(`${command} ${args.join(' ')}`)
      if (failStep === command) throw new Error(`${command} failed`)
      return { stdout: '', stderr: '' }
    },
  }
}

function stepEvents(events) {
  return events.filter(event => !event.startsWith('/')
    && !event.startsWith('fetch ')
    && !event.startsWith('tar ')
    && !event.startsWith('npm ')
    && !event.startsWith('npx '))
}

test('validateManifest rejects missing rollback compatibility and double /api internal base', () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const manifest = createManifest(workspace, artifacts, { rollback: { releaseId: 'compat-20260929-prev', retained: true, supportsKeyedUrls: true } })

  assert.throws(() => validateManifest(manifest, createInventory(workspace)), /rollback.*business probes/i)
  assert.throws(() => validateManifest({ ...createManifest(workspace, artifacts), internalApiBase: 'http://127.0.0.1:18001/api' }, createInventory(workspace)), /NO \/api suffix/)
})

test('validateManifest rejects health-only required business probes before runtime side effects', () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts, {
    probes: createManifest(workspace, artifacts).probes.map(probe => probe.name === 'apt-sale-list'
      ? { ...probe, path: '/api/health', expectedJsonTypes: {}, expectedJsonMinItems: {} }
      : probe),
  })

  assert.throws(() => validateManifest(manifest, inventory), /apt-sale-list probe must not point to \/api\/health/)
})

test('validateManifest requires a real frontend SSR business probe', () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const base = createManifest(workspace, artifacts)
  const withoutSsr = createManifest(workspace, artifacts, {
    probes: base.probes.filter(probe => probe.name !== 'frontend-ssr'),
  })
  const staticAssetPretendingToBeSsr = createManifest(workspace, artifacts, {
    probes: base.probes.map(probe => probe.name === 'frontend-ssr'
      ? { ...probe, path: '/_nuxt/app.js', expectBodyIncludes: [''] }
      : probe),
  })

  assert.throws(() => validateManifest(withoutSsr, inventory), /candidate probes must include a frontend SSR business probe/)
  assert.throws(() => validateManifest(staticAssetPretendingToBeSsr, inventory), /candidate probes must include a frontend SSR business probe/)
})

test('validateManifest requires rollback to retain a frontend SSR probe', () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const base = createManifest(workspace, artifacts)
  const manifest = createManifest(workspace, artifacts, {
    rollback: {
      ...base.rollback,
      probes: base.rollback.probes.filter(probe => probe.name !== 'rollback-frontend-ssr'),
    },
  })

  assert.throws(() => validateManifest(manifest, inventory), /rollback probes must include a frontend SSR business probe/)
})

test('validateManifest requires sitemap business probe to assert the static source header', () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const base = createManifest(workspace, artifacts)
  const manifest = createManifest(workspace, artifacts, {
    probes: base.probes.map(probe => probe.name === 'sitemap'
      ? { ...probe, expectedHeaders: undefined }
      : probe),
  })

  assert.throws(() => validateManifest(manifest, inventory), /sitemap probe must assert x-sitemap-source static header/)
})


test('validateManifest requires same-name probes to share one building name and distinct addresses', () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const baseManifest = createManifest(workspace, artifacts)
  const differentNameManifest = createManifest(workspace, artifacts, {
    probes: baseManifest.probes.map(probe => probe.name === 'same-name-address-b'
      ? {
          ...probe,
          path: `/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=${encodeURIComponent('다른아파트')}&buildingKey=${SAME_B_KEY}`,
          expectedJson: { ...probe.expectedJson, 'data.buildingName': '다른아파트' },
        }
      : probe),
  })
  const duplicateAddressManifest = createManifest(workspace, artifacts, {
    probes: baseManifest.probes.map(probe => probe.name === 'same-name-address-b'
      ? { ...probe, expectedJson: { ...probe.expectedJson, 'data.dongName': '역삼동', 'data.jibun': '101-1' } }
      : probe),
  })

  assert.throws(() => validateManifest(differentNameManifest, inventory), /same building name/)
  assert.throws(() => validateManifest(duplicateAddressManifest, inventory), /distinct dongName\/jibun addresses/)
})

test('verifyArtifacts compares artifact checksums and refuses mismatches', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const manifest = createManifest(workspace, artifacts)

  await assert.doesNotReject(() => verifyArtifacts(manifest))
  await assert.rejects(() => verifyArtifacts({ ...manifest, backendArtifact: { ...manifest.backendArtifact, sha256: 'bad' } }), /checksum/i)
})

test('buildCandidateEnvironment keeps same-origin public api, summary mode, and runtime paths', () => {
  const workspace = makeWorkspace()
  const env = buildCandidateEnvironment(createManifest(workspace, createArtifacts(workspace)), createInventory(workspace))

  assert.equal(env.NUXT_INTERNAL_API_BASE, 'http://127.0.0.1:18001')
  assert.equal(env.NUXT_PUBLIC_API_BASE, '')
  assert.equal(env.HOST, '127.0.0.1')
  assert.equal(env.NITRO_HOST, '127.0.0.1')
  assert.equal(env.REAL_ESTATE_SUMMARY_MODE, 'address')
  assert.equal(env.REAL_ESTATE_URL_MODE, 'preserved')
  assert.equal(env.REAL_ESTATE_SUMMARY_RUN_ID, 'summary-run-1')
  assert.equal(env.SITEMAP_DIR, join(workspace.sharedRoot, 'sitemaps', 'address-20260929-abc123'))
})

test('release ecosystem loads backend env file while preserving release runtime values', () => {
  const workspace = makeWorkspace()
  const envFile = join(workspace.sharedRoot, 'backend.env')
  writeFileSync(envFile, [
    'DATABASE_URL=mysql://file-db',
    'CORS_ORIGIN=https://ilsangkit.co.kr',
    'NODE_ENV=development',
    'HOST=0.0.0.0',
    'PORT=9999',
    'REAL_ESTATE_SUMMARY_MODE=legacy',
    'REAL_ESTATE_URL_MODE=keyed',
    'REAL_ESTATE_SUMMARY_RUN_ID=stale-run',
    'ILSK_SUMMARY_RUN_ID=stale-run',
    'SITEMAP_DIR=/stale/sitemap',
  ].join('\n'))

  const ecosystem = loadReleaseEcosystemWithEnv({
    ILSK_RELEASE_ID: 'address-20260929-abc123',
    ILSK_RELEASE_ROOT: process.cwd(),
    ILSK_BACKEND_PORT: '18001',
    ILSK_FRONTEND_PORT: '13001',
    NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:18001',
    ILSK_BACKEND_ENV_FILE: envFile,
    DATABASE_URL: 'mysql://parent-stale-db',
    REAL_ESTATE_SUMMARY_MODE: 'address',
    REAL_ESTATE_URL_MODE: 'preserved',
    REAL_ESTATE_SUMMARY_RUN_ID: 'summary-run-1',
    ILSK_SUMMARY_RUN_ID: 'summary-run-1',
    REAL_ESTATE_WRITE_LOCK_DIR: join(workspace.sharedRoot, 'locks'),
    SITEMAP_DIR: join(workspace.sharedRoot, 'sitemaps', 'address-20260929-abc123'),
  })
  const backend = ecosystem.apps.find(app => app.name === 'ilsangkit-backend-address-20260929-abc123')
  const frontend = ecosystem.apps.find(app => app.name === 'ilsangkit-frontend-address-20260929-abc123')

  assert.equal(backend.env.DATABASE_URL, 'mysql://file-db')
  assert.equal(backend.env.CORS_ORIGIN, 'https://ilsangkit.co.kr')
  assert.equal(backend.env.NODE_ENV, 'production')
  assert.equal(backend.env.HOST, '127.0.0.1')
  assert.equal(backend.env.PORT, '18001')
  assert.equal(backend.env.REAL_ESTATE_SUMMARY_MODE, 'address')
  assert.equal(backend.env.REAL_ESTATE_URL_MODE, 'preserved')
  assert.equal(backend.env.REAL_ESTATE_SUMMARY_RUN_ID, 'summary-run-1')
  assert.equal(backend.env.ILSK_SUMMARY_RUN_ID, 'summary-run-1')
  assert.equal(backend.env.REAL_ESTATE_WRITE_LOCK_DIR, join(workspace.sharedRoot, 'locks'))
  assert.equal(backend.env.SITEMAP_DIR, join(workspace.sharedRoot, 'sitemaps', 'address-20260929-abc123'))
  assert.equal(backend.env.ILSK_BACKEND_ENV_FILE, envFile)
  assert.equal(frontend.env.DATABASE_URL, undefined)
  assert.equal(frontend.env.CORS_ORIGIN, undefined)
  assert.equal(frontend.env.NUXT_INTERNAL_API_BASE, 'http://127.0.0.1:18001')
})

test('release ecosystem rejects a configured missing backend env file', () => {
  const workspace = makeWorkspace()
  const missingEnvFile = join(workspace.sharedRoot, 'missing-backend.env')

  assert.throws(() => loadReleaseEcosystemWithEnv({
    ILSK_RELEASE_ID: 'address-20260929-abc123',
    ILSK_RELEASE_ROOT: process.cwd(),
    ILSK_BACKEND_PORT: '18001',
    ILSK_FRONTEND_PORT: '13001',
    NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:18001',
    ILSK_BACKEND_ENV_FILE: missingEnvFile,
    REAL_ESTATE_SUMMARY_MODE: 'address',
    REAL_ESTATE_SUMMARY_RUN_ID: 'summary-run-1',
    ILSK_SUMMARY_RUN_ID: 'summary-run-1',
  }), /Failed to load release backend env file/)
})

test('release ecosystem rejects an omitted backend env file instead of inheriting parent env', () => {
  assert.throws(() => loadReleaseEcosystemWithEnv({
    ILSK_RELEASE_ID: 'address-20260929-abc123',
    ILSK_RELEASE_ROOT: process.cwd(),
    ILSK_BACKEND_PORT: '18001',
    ILSK_FRONTEND_PORT: '13001',
    NUXT_INTERNAL_API_BASE: 'http://127.0.0.1:18001',
    DATABASE_URL: 'mysql://parent-stale-db',
    REAL_ESTATE_SUMMARY_MODE: 'address',
    REAL_ESTATE_SUMMARY_RUN_ID: 'summary-run-1',
    ILSK_SUMMARY_RUN_ID: 'summary-run-1',
  }), /Missing ILSK_BACKEND_ENV_FILE/)
})

test('renderNginxReleaseConfig writes shared web/api release include with release cache namespace', () => {
  const rendered = renderNginxReleaseConfig(createManifest(makeWorkspace(), createArtifacts(makeWorkspace())))

  assert.match(rendered, /upstream ilsangkit_release_web \{ server 127\.0\.0\.1:13001; \}/)
  assert.match(rendered, /upstream ilsangkit_release_api \{ server 127\.0\.0\.1:18001; \}/)
  assert.match(rendered, /map \$host \$ilsangkit_release \{ default "address-20260929-abc123"; \}/)
  assert.match(rendered, /proxy_cache_path .*keys_zone=ilsangkit_release_cache_[a-f0-9]{16}:50m/)
  assert.match(rendered, /proxy_cache_key .*\$ilsangkit_release/)

  const rollbackRendered = renderNginxReleaseConfig({
    ...createManifest(makeWorkspace(), createArtifacts(makeWorkspace())),
    releaseId: 'compat-20260929-prev',
  })
  assert.notEqual(
    /keys_zone=([^:]+):50m/.exec(rendered)?.[1],
    /keys_zone=([^:]+):50m/.exec(rollbackRendered)?.[1],
  )
})

test('runReleaseCommand deploy executes safe release sequence and retains previous processes', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  const result = await runReleaseCommand('deploy', { inventory, manifest, runner: createRunner(events), fetch: okFetch(events), portChecker: async () => true })

  assert.deepEqual(stepEvents(events), [
    'validate-manifest',
    'verify-artifacts',
    'verify-rollback-readiness',
    'install-artifacts',
    'install-backend-runtime',
    'generate-prisma-client',
    'check-port-free',
    'check-port-free',
    'start-backend',
    'start-frontend',
    'check-business-responses',
    'validate-proxy',
    'switch-pointer',
    'reload-proxy',
    'public-smoke',
    'retain-previous',
  ])
  assert.equal(result.releaseId, manifest.releaseId)
  assert.ok(events.includes(`tar -xzf ${manifest.backendArtifact.path} -C ${join(inventory.releasesRoot, manifest.releaseId, 'backend')}`))
  assert.ok(events.includes(`tar -xzf ${manifest.frontendArtifact.path} -C ${join(inventory.releasesRoot, manifest.releaseId, 'frontend')}`))
  assert.ok(events.includes('npm ci --omit=dev'))
  assert.ok(events.includes('npx prisma generate'))
  assert.equal(lstatSync(inventory.nginxIncludePath).isSymbolicLink(), true)
  assert.ok(existsSync(join(inventory.deployRoot, 'journal', `${manifest.releaseId}.json`)))
})

test('runReleaseCommand stops before switch and leaves traffic unchanged when business checks fail', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  await assert.rejects(() => runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner(events, 'check-business-responses'),
    fetch: okFetch(events),
    portChecker: async () => true,
  }), /check-business-responses failed/)

  assert.ok(!events.includes('switch-pointer'))
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
})

test('runReleaseCommand rolls back pointer when public smoke fails after switch', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  await assert.rejects(() => runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner(events, 'public-smoke'),
    fetch: okFetch(events),
    portChecker: async () => true,
  }), /public-smoke failed/)

  assert.ok(events.includes('rollback-pointer'))
  assert.ok(events.includes('reload-proxy-rollback'))
  const activeInclude = readFileSync(inventory.nginxIncludePath, 'utf8')
  assert.match(activeInclude, /compat-20260929-prev/)
  assert.match(activeInclude, /127\.0\.0\.1:13000/)
  assert.match(activeInclude, /127\.0\.0\.1:18000/)
})


test('runReleaseCommand switch waits through previous active public release id during proxy convergence', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  writeFileSync(inventory.nginxIncludePath, 'map $host $ilsangkit_release { default "old-main"; }')
  const events = []
  const sleeps = []
  let publicHealthCalls = 0

  const result = await runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner(events),
    publicConvergenceAttempts: 3,
    publicConvergenceDelayMs: 25,
    publicConvergenceRequestTimeoutMs: 50,
    publicConvergenceSleep: async (ms) => { sleeps.push(ms) },
    fetch: async (url, options = {}) => {
      events.push(`fetch ${url}`)
      const isPublicHealth = String(url).includes(':19000/api/health')
      if (isPublicHealth) publicHealthCalls += 1
      const releaseId = isPublicHealth && publicHealthCalls === 1
        ? 'old-main'
        : manifest.releaseId
      if (isPublicHealth) assert.ok(options.signal, 'public smoke fetch receives an abort signal')
      return {
        ok: true,
        status: 200,
        headers: semanticHeadersForUrl(url, releaseId),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
  })

  assert.equal(result.releaseId, manifest.releaseId)
  assert.deepEqual(sleeps, [25])
  assert.equal(publicHealthCalls, 2)
  assert.ok(events.includes('retain-previous'))
})

test('runReleaseCommand switch rejects zero public convergence timeout before fetching public probes', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  let publicFetchCalls = 0

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner([]),
    publicConvergenceRequestTimeoutMs: 0,
    fetch: async (url) => {
      if (String(url).includes(':19000')) publicFetchCalls += 1
      return { ok: true, status: 200, headers: semanticHeadersForUrl(url), text: async () => semanticTextForUrl(url), json: async () => semanticJsonForUrl(url) }
    },
  }), /publicConvergenceRequestTimeoutMs must be a positive integer/)

  assert.equal(publicFetchCalls, 0)
})

test('runReleaseCommand switch rejects zero public probe timeout before fetching public probes', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts, {
    publicSmokeProbes: createManifest(workspace, artifacts).publicSmokeProbes.map((probe, index) => index === 0
      ? { ...probe, requestTimeoutMs: 0 }
      : probe),
  })
  let publicFetchCalls = 0

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: async (url) => {
      if (String(url).includes(':19000')) publicFetchCalls += 1
      return { ok: true, status: 200, headers: semanticHeadersForUrl(url), text: async () => semanticTextForUrl(url), json: async () => semanticJsonForUrl(url) }
    },
  }), /public smoke probe public-health requestTimeoutMs must be a positive integer/)

  assert.equal(publicFetchCalls, 0)
})

test('runReleaseCommand switch fails immediately on public status/body failures instead of converging', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []
  const sleeps = []

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner(events),
    publicConvergenceAttempts: 3,
    publicConvergenceDelayMs: 25,
    publicConvergenceSleep: async (ms) => { sleeps.push(ms) },
    fetch: async (url) => {
      events.push(`fetch ${url}`)
      const status = String(url).includes(':19000/api/health') ? 503 : 200
      return {
        ok: status === 200,
        status,
        headers: semanticHeadersForUrl(url, manifest.rollbackReleaseId),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
  }), /status 503/)

  assert.deepEqual(sleeps, [])
  assert.ok(events.includes('rollback-pointer'))
})

test('runReleaseCommand switch rejects unknown public release id without convergence retry', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []
  const sleeps = []

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner(events),
    publicConvergenceAttempts: 3,
    publicConvergenceDelayMs: 25,
    publicConvergenceSleep: async (ms) => { sleeps.push(ms) },
    fetch: async (url) => {
      events.push(`fetch ${url}`)
      return {
        ok: true,
        status: 200,
        headers: semanticHeadersForUrl(url, new URL(String(url)).port === '19000' ? 'unknown-release' : 'address-20260929-abc123'),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
  }), /release id mismatch/)

  assert.deepEqual(sleeps, [])
  assert.ok(events.includes('rollback-pointer'))
})

test('runReleaseCommand check validates candidate nginx through the active include then restores traffic', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  await runReleaseCommand('check', { inventory, manifest, runner: createRunner(events), fetch: okFetch(events), portChecker: async () => true })

  assert.ok(events.includes(`${inventory.nginxBinary} -t -c ${join(inventory.deployRoot, 'nginx', `${manifest.releaseId}.nginx.conf`)}`))
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
  assert.match(readFileSync(join(inventory.deployRoot, 'nginx', `${manifest.releaseId}.conf`), 'utf8'), /address-20260929-abc123/)
})


test('runReleaseCommand check retries spaced readiness until delayed backend startup succeeds', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []
  const delays = []
  let backendReadinessAttempts = 0
  let backendReadinessBodyConsumed = false

  await runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: async (url, options = {}) => {
      events.push(`fetch ${url}`)
      if (String(url).includes(':18001/api/health')) {
        assert.ok(options.signal, 'readiness fetch receives an abort signal')
        backendReadinessAttempts += 1
        if (backendReadinessAttempts < 3) throw new Error('ECONNREFUSED backend port')
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => { backendReadinessBodyConsumed = true; return 'ok' },
          json: async () => ({}),
        }
      }
      return {
        ok: true,
        status: 200,
        headers: semanticHeadersForUrl(url, 'address-20260929-abc123'),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
    portChecker: async () => true,
    readinessDelayMs: 25,
    readinessRequestTimeoutMs: 50,
    readinessSleep: async (ms) => { delays.push(ms) },
  })

  assert.equal(backendReadinessAttempts, 3)
  assert.deepEqual(delays, [25, 25])
  assert.equal(backendReadinessBodyConsumed, true)
  assert.ok(events.includes('check-business-responses'))
})

test('runReleaseCommand check reports target readiness and final cause when backend never binds', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []
  const delays = []

  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: async (url, options = {}) => {
      events.push(`fetch ${url}`)
      if (String(url).includes(':18001/api/health')) {
        assert.ok(options.signal, 'readiness fetch receives an abort signal')
        throw new Error('ECONNREFUSED backend port')
      }
      return {
        ok: true,
        status: 200,
        headers: semanticHeadersForUrl(url, 'address-20260929-abc123'),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
    portChecker: async () => true,
    readinessAttempts: 2,
    readinessDelayMs: 10,
    readinessRequestTimeoutMs: 25,
    readinessSleep: async (ms) => { delays.push(ms) },
  }), /backend readiness failed after 2 attempts: ECONNREFUSED backend port/)

  assert.deepEqual(delays, [10])
  assert.ok(!events.includes('check-business-responses'))
  assert.ok(!events.includes('switch-pointer'))
})

test('runReleaseCommand check keeps readiness timeout active until response body is consumed', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  let backendReadinessAttempts = 0

  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: async (url, options = {}) => {
      if (String(url).includes(':18001/api/health')) {
        backendReadinessAttempts += 1
        return {
          ok: true,
          status: 200,
          headers: { get: () => null },
          text: async () => new Promise((resolve, reject) => {
            if (options.signal?.aborted) reject(new Error('slow readiness body aborted'))
            options.signal?.addEventListener('abort', () => reject(new Error('slow readiness body aborted')), { once: true })
          }),
          json: async () => ({}),
        }
      }
      return {
        ok: true,
        status: 200,
        headers: semanticHeadersForUrl(url, 'address-20260929-abc123'),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
    portChecker: async () => true,
    readinessAttempts: 2,
    readinessDelayMs: 0,
    readinessRequestTimeoutMs: 1,
  }), /backend readiness failed after 2 attempts: slow readiness body aborted/)

  assert.equal(backendReadinessAttempts, 2)
})

test('runReleaseCommand check uses a static frontend process probe before heavier SSR routes', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const frontendReadinessPaths = []

  await runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: async (url) => {
      const parsed = new URL(String(url))
      if (parsed.port === '13001' && (parsed.pathname === '/' || parsed.pathname === '/favicon.ico')) {
        frontendReadinessPaths.push(parsed.pathname)
        if (parsed.pathname === '/') throw new Error('frontend readiness should not hit SSR home')
      }
      return {
        ok: true,
        status: 200,
        headers: semanticHeadersForUrl(url, manifest.releaseId),
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
    portChecker: async () => true,
    readinessAttempts: 1,
  })

  assert.deepEqual(frontendReadinessPaths, ['/favicon.ico'])
})

test('runReleaseCommand bootstrap compatibility check allows old non-keyed rollback without switching public traffic', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const base = createManifest(workspace, artifacts)
  const manifest = {
    ...base,
    releaseId: 'compat-20260929-abc123',
    ports: { frontend: 13000, backend: 18000, proxy: 19000 },
    rollbackReleaseId: 'old-release',
    rollback: {
      releaseId: 'old-release',
      frontendPort: 3000,
      backendPort: 8000,
      retained: true,
      supportsKeyedUrls: false,
      businessProbesPass: false,
      probes: [],
    },
    summary: { mode: 'compatibility', runId: 'summary-run-1', expectedRunId: 'summary-run-1', state: 'ready' },
    probes: semanticBusinessProbes('compat-20260929-abc123', 'compatibility'),
    publicSmokeProbes: base.publicSmokeProbes.map(probe => ({
      ...probe,
      expectedReleaseId: 'compat-20260929-abc123',
    })),
  }
  const events = []

  assert.throws(() => validateManifest(manifest, inventory), /rollback release must support keyed URLs/)
  await runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: okFetchForRelease(events, 'compat-20260929-abc123', 'compatibility'),
    portChecker: async () => true,
    bootstrapCompatibilityCheck: true,
  })

  assert.ok(events.includes('validate-manifest'))
  assert.ok(!events.includes('verify-rollback-readiness'))
  assert.ok(!events.includes('switch-pointer'))
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
})

test('runReleaseCommand rejects bootstrap compatibility mode outside check', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)

  await assert.rejects(
    () => runReleaseCommand('switch', { inventory, manifest, bootstrapCompatibilityCheck: true }),
    /only allowed for check command/,
  )
})



test('runReleaseCommand check fails closed on candidate HTTP probe failure before switch', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: okFetch(events, 503),
    readinessAttempts: 1,
  }), /probe failed/)

  assert.ok(!events.includes('switch-pointer'))
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
})

test('runReleaseCommand check fails closed when static sitemap response header is missing', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: async (url) => {
      events.push(`fetch ${url}`)
      return {
        ok: true,
        status: 200,
        headers: {
          get(name) {
            const normalized = String(name).toLowerCase()
            if (normalized === 'x-ilsangkit-release-id') return releaseIdForUrl(url)
            if (normalized === 'x-sitemap-source') return null
            return null
          },
        },
        text: async () => semanticTextForUrl(url),
        json: async () => semanticJsonForUrl(url),
      }
    },
    portChecker: async () => true,
    readinessAttempts: 1,
  }), /candidate probe failed: sitemap header x-sitemap-source mismatch/)

  assert.ok(!events.includes('switch-pointer'))
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
})

test('runReleaseCommand rollback switches to verified rollbackReleaseId include', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  const result = await runReleaseCommand('rollback', { inventory, manifest, runner: createRunner(events), fetch: okFetch(events) })

  assert.equal(result.releaseId, manifest.rollbackReleaseId)
  assert.ok(events.includes('rollback-pointer'))
  assert.ok(events.includes('reload-proxy-rollback'))
  assert.match(readFileSync(inventory.nginxIncludePath, 'utf8'), /compat-20260929-prev/)
})


test('runReleaseCommand validates semantic JSON probe fields', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)

  await assert.doesNotReject(() => runReleaseCommand('check', { inventory, manifest, runner: createRunner([]), fetch: okFetch([]), portChecker: async () => true }))
  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner([]),
    portChecker: async () => true,
    fetch: async (url) => ({
      ok: true,
      status: 200,
      headers: semanticHeadersForUrl(url, 'address-20260929-abc123'),
      text: async () => semanticTextForUrl(url),
      json: async () => String(url).includes('/complexes')
        ? { success: true, data: { total: -1, items: [] } }
        : semanticJsonForUrl(url),
    }),
  }), /json data.total type mismatch/)
})

test('runReleaseCommand rejects invalid runtime min-items assertions on additional probes', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts, {
    probes: [
      ...createManifest(workspace, artifacts).probes,
      {
        name: 'additional-invalid-min-items',
        path: '/api/real-estate/apt-sale/complexes?city=서울특별시&district=강남구&limit=1',
        target: 'backend',
        expectedReleaseId: 'address-20260929-abc123',
        expectedJsonMinItems: { 'data.items': 'not-a-number' },
      },
    ],
  })

  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: okFetch([]),
    portChecker: async () => true,
  }), /invalid min items assertion/)
})

test('runReleaseCommand reconcile writes a journal and rolls back when public smoke is unhealthy', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  const result = await runReleaseCommand('reconcile', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: async (url) => {
      events.push(`fetch ${url}`)
      const parsed = new URL(String(url))
      const status = parsed.port === '18000' || parsed.port === '13000' ? 200 : 503
      return { ok: status === 200, status, headers: semanticHeadersForUrl(url), text: async () => semanticTextForUrl(url), json: async () => semanticJsonForUrl(url) }
    },
  })

  assert.equal(result.releaseId, manifest.rollbackReleaseId)
  assert.ok(events.includes('rollback-pointer'))
  assert.match(readFileSync(result.journalPath, 'utf8'), /reconciled-rolled-back/)
  assert.equal(existsSync(join(inventory.deployRoot, 'locks', 'release.lock')), false)
})

test('retainHashedAssets adds immutable assets and rejects same-name content drift', async () => {
  const workspace = makeWorkspace()
  const sourceAsset = join(workspace.root, 'chunk.abc123.js')
  writeFileSync(sourceAsset, 'console.log("new")')
  const manifest = createManifest(workspace, createArtifacts(workspace), {
    hashedAssets: [{ path: sourceAsset, fileName: 'chunk.abc123.js', sha256: sha256('console.log("new")') }],
  })
  const inventory = createInventory(workspace)

  await retainHashedAssets(manifest, inventory)
  assert.equal(readFileSync(join(inventory.assets.publicDir, '_nuxt', 'chunk.abc123.js'), 'utf8'), 'console.log("new")')
  await assert.doesNotReject(() => retainHashedAssets(manifest, inventory))
  writeFileSync(join(inventory.assets.publicDir, '_nuxt', 'chunk.abc123.js'), 'console.log("old")')
  await assert.rejects(() => retainHashedAssets(manifest, inventory), /different content/)
})

test('runReleaseCommand refuses concurrent deploy lock and releases it after failure', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  mkdirSync(join(inventory.deployRoot, 'locks', 'release.lock'), { recursive: true })

  await assert.rejects(() => runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner([]),
  }), /deploy lock/)

  rmSync(join(inventory.deployRoot, 'locks', 'release.lock'), { recursive: true, force: true })
  await assert.rejects(() => runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner([], 'public-smoke'),
    fetch: okFetch([]),
    portChecker: async () => true,
  }), /public-smoke failed/)
  assert.equal(existsSync(join(inventory.deployRoot, 'locks', 'release.lock')), false)
})


test('standalone switch and rollback are blocked by the deploy lock before pointer mutation', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const lockPath = join(inventory.deployRoot, 'locks', 'release.lock')
  mkdirSync(lockPath, { recursive: true })
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({ pid: process.pid, token: 'live-token', startedAtMs: Date.now(), processStartTimeMs: Date.now() }))

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: okFetch([]),
  }), /deploy lock/)
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')

  await assert.rejects(() => runReleaseCommand('rollback', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: okFetch([]),
  }), /deploy lock/)
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
})



test('runReleaseCommand recovers only an explicitly tokened dead stale deploy lock', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = {
    ...createInventory(workspace),
    deployLock: { allowStaleRecovery: true, recoverStaleAfterMs: 1_000, recoveryToken: 'recover-token' },
  }
  const manifest = createManifest(workspace, artifacts)
  const lockPath = join(inventory.deployRoot, 'locks', 'release.lock')
  mkdirSync(lockPath, { recursive: true })
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({
    pid: 999999,
    token: 'recover-token',
    startedAtMs: 1,
    processStartTimeMs: 1,
    stage: 'prepared',
  }))
  const events = []

  await runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: okFetch(events),
    portChecker: async () => true,
    now: () => 10_000,
  })

  assert.ok(events.includes('recover-stale-deploy-lock'))
  assert.ok(events.includes('switch-pointer'))
  assert.equal(existsSync(lockPath), false)
})

test('runReleaseCommand does not steal an old live deploy lock or release a replacement lock', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = {
    ...createInventory(workspace),
    deployLock: { allowStaleRecovery: true, recoverStaleAfterMs: 1_000, recoveryToken: 'recover-token' },
  }
  const manifest = createManifest(workspace, artifacts)
  const lockPath = join(inventory.deployRoot, 'locks', 'release.lock')
  mkdirSync(lockPath, { recursive: true })
  writeFileSync(join(lockPath, 'owner.json'), JSON.stringify({
    pid: process.pid,
    token: 'recover-token',
    startedAtMs: 1,
    processStartTimeMs: 1,
    stage: 'switching',
  }))

  await assert.rejects(() => runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: okFetch([]),
    now: () => 10_000,
  }), /deploy lock/)
  assert.equal(existsSync(lockPath), true)
  assert.match(readFileSync(join(lockPath, 'owner.json'), 'utf8'), /recover-token/)
})
test('runReleaseCommand reuses verified immutable installs and rejects artifact drift', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const firstEvents = []

  await runReleaseCommand('prepare', { inventory, manifest, runner: createRunner(firstEvents), fetch: okFetch(firstEvents) })
  assert.ok(firstEvents.includes('install-artifacts'))

  const reuseEvents = []
  await runReleaseCommand('check', { inventory, manifest, runner: createRunner(reuseEvents), fetch: okFetch(reuseEvents), portChecker: async () => true })
  assert.ok(reuseEvents.includes('reuse-installed-artifacts'))
  assert.ok(!reuseEvents.some(event => event.startsWith('tar ')))

  const drifted = createManifest(workspace, artifacts, {
    backendArtifact: { ...manifest.backendArtifact, sha256: 'b'.repeat(64) },
  })
  await assert.rejects(() => runReleaseCommand('check', {
    inventory,
    manifest: drifted,
    runner: createRunner([]),
    fetch: okFetch([]),
  }), /immutable release artifact conflict|checksum mismatch/)
})

test('startProcesses uses absolute ecosystem config, explicit cwd, and release runtime env', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const runs = []
  const runner = {
    async step() {},
    async run(command, args, options) {
      runs.push({ command, args, options })
      return { stdout: '', stderr: '' }
    },
  }

  await runReleaseCommand('check', { inventory, manifest, runner, fetch: okFetch([]), portChecker: async () => true })
  const pm2Starts = runs.filter(run => run.command === inventory.pm2Binary)
  assert.equal(pm2Starts.length, 2)
  for (const start of pm2Starts) {
    assert.ok(start.args[1].startsWith('/'), 'ecosystem config path is absolute')
    assert.equal(start.options.cwd, start.args[1].replace(/\/ecosystem\.release\.config\.cjs$/, ''))
    assert.equal(start.options.env.REAL_ESTATE_SUMMARY_MODE, 'address')
    assert.equal(start.options.env.REAL_ESTATE_SUMMARY_RUN_ID, 'summary-run-1')
    assert.equal(start.options.env.NUXT_INTERNAL_API_BASE, 'http://127.0.0.1:18001')
    assert.equal(start.options.env.SITEMAP_DIR, join(workspace.sharedRoot, 'sitemaps', 'address-20260929-abc123'))
  }
})

test('runReleaseCommand fails busy candidate ports before PM2 start', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []

  await assert.rejects(() => runReleaseCommand('deploy', {
    inventory,
    manifest,
    runner: createRunner(events),
    fetch: okFetch(events),
    portChecker: async (port) => port !== manifest.ports.backend,
  }), /candidate port is busy/)
  assert.ok(!events.includes('start-backend'))
  assert.equal(readFileSync(inventory.nginxIncludePath, 'utf8'), 'old include')
})



test('runReleaseCommand detects busy candidate ports with the default TCP checker before PM2 start', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const net = await import('node:net')
  const server = net.createServer()
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const busyPort = server.address().port
  inventory.reservePorts = [...inventory.reservePorts, busyPort]
  const manifest = createManifest(workspace, artifacts, {
    ports: { frontend: 13001, backend: busyPort, proxy: 19000 },
  })
  const events = []

  try {
    await assert.rejects(() => runReleaseCommand('check', {
      inventory,
      manifest,
      runner: createRunner(events),
      fetch: okFetch(events),
    }), /candidate port is busy/)
    assert.ok(!events.includes('start-backend'))
  } finally {
    await new Promise(resolve => server.close(resolve))
  }
})
test('public smoke rejects absolute URLs outside the validated public origin', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts, {
    publicSmokeProbes: [{
      name: 'candidate-direct-health',
      url: 'http://127.0.0.1:18001/api/health',
      target: 'proxy',
      expectedReleaseId: 'address-20260929-abc123',
    }],
  })

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: okFetch([]),
  }), /public smoke probe URL must use public origin/)
})

test('public smoke fails closed without explicit proxy probes', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts, { publicSmokeProbes: [] })

  await assert.rejects(() => runReleaseCommand('switch', {
    inventory,
    manifest,
    runner: createRunner([]),
    fetch: okFetch([]),
  }), /public smoke probes must assert/)
})

test('reload failure restores rollback pointer and active backend/frontend links', async () => {
  const workspace = makeWorkspace()
  const artifacts = createArtifacts(workspace)
  const inventory = createInventory(workspace)
  const manifest = createManifest(workspace, artifacts)
  const events = []
  let failedReload = false
  const runner = {
    async step(name) { events.push(name) },
    async run(command, args) {
      events.push(`${command} ${args.join(' ')}`)
      if (command === inventory.nginxBinary && args.join(' ') === '-s reload' && !failedReload) {
        failedReload = true
        throw new Error('reload failed')
      }
      return { stdout: '', stderr: '' }
    },
  }

  await assert.rejects(() => runReleaseCommand('switch', { inventory, manifest, runner, fetch: okFetch(events) }), /reload failed/)
  assert.ok(events.includes('rollback-pointer'))
  assert.match(readFileSync(inventory.nginxIncludePath, 'utf8'), /compat-20260929-prev/)
  assert.equal(readlinkSync(inventory.activeBackendLink), join(inventory.releasesRoot, manifest.rollbackReleaseId, 'backend'))
  assert.equal(readlinkSync(inventory.activeFrontendLink), join(inventory.releasesRoot, manifest.rollbackReleaseId, 'frontend'))
})

test('compatibility rollback retains preserved public URLs', () => {
  const workspace = makeWorkspace()
  const manifest = createManifest(workspace, createArtifacts(workspace))
  manifest.summary.mode = 'compatibility'
  assert.equal(buildCandidateEnvironment(manifest, createInventory(workspace)).REAL_ESTATE_URL_MODE, 'preserved')
})
