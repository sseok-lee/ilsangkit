#!/usr/bin/env node
import { createHash, randomUUID } from 'node:crypto'
import { copyFileSync, createReadStream, existsSync, lstatSync, mkdirSync, readFileSync, readlinkSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { createConnection } from 'node:net'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const REQUIRED_PROBES = new Set([
  'apt-sale-list',
  'apt-rent-list',
  'villa-sale-list',
  'villa-rent-list',
  'offitel-sale-list',
  'offitel-rent-list',
  'same-name-address-a',
  'same-name-address-b',
  'sale-mode',
  'rent-mode',
  'sitemap',
  'waste',
])

const READINESS_PROBE_NAME = 'release-readiness'
const DEFAULT_READINESS_ATTEMPTS = 5
const DEFAULT_READINESS_DELAY_MS = 1000
const DEFAULT_READINESS_REQUEST_TIMEOUT_MS = 1000
const DEFAULT_PUBLIC_CONVERGENCE_ATTEMPTS = 5
const DEFAULT_PUBLIC_CONVERGENCE_DELAY_MS = 1000
const DEFAULT_PUBLIC_CONVERGENCE_REQUEST_TIMEOUT_MS = 1000

const LIST_PROBE_TYPES = new Map([
  ['apt-sale-list', 'apt-sale'],
  ['apt-rent-list', 'apt-rent'],
  ['villa-sale-list', 'villa-sale'],
  ['villa-rent-list', 'villa-rent'],
  ['offitel-sale-list', 'offitel-sale'],
  ['offitel-rent-list', 'offitel-rent'],
])

const HEX_64 = /^[a-f0-9]{64}$/

function parseProbeUrl(probe) {
  const raw = String(probe?.path ?? probe?.url ?? '')
  if (!raw) throw new Error(`probe ${probe?.name ?? '(unknown)'} path is required`)
  return new URL(raw, 'http://release-probe.local')
}

function isApiHealthProbe(probe) {
  try { return parseProbeUrl(probe).pathname === '/api/health' } catch { return false }
}

function assertProbePath(probe, pathname, label) {
  const actual = parseProbeUrl(probe).pathname
  if (actual !== pathname) throw new Error(`${label} probe must use ${pathname}`)
}

function assertProbeQueryValue(probe, key, pattern, label) {
  const value = parseProbeUrl(probe).searchParams.get(key)
  if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`${label} probe must include ${key}`)
  return value
}

function assertProbeExpectedJson(probe, key, predicate, label) {
  const value = probe?.expectedJson?.[key]
  if (!predicate(value)) throw new Error(`${label} probe must assert ${key}`)
  return value
}

function assertJsonTypeAssertion(probe, path, type, label) {
  if (probe?.expectedJsonTypes?.[path] !== type) throw new Error(`${label} probe must assert ${path} as ${type}`)
}

function assertJsonMinItemsAssertion(probe, path, min, label) {
  const actual = Number(probe?.expectedJsonMinItems?.[path])
  if (!Number.isInteger(actual) || actual < min) throw new Error(`${label} probe must assert ${path} min ${min}`)
}

function validateListBusinessProbe(probe, expectedType, manifest) {
  const label = probe.name
  if (probe.expectedReleaseId !== manifest.releaseId) throw new Error(`${label} probe must assert release id`)
  assertProbePath(probe, `/api/real-estate/${expectedType}/complexes`, label)
  assertJsonTypeAssertion(probe, 'data.total', 'nonnegativeNumber', label)
  assertJsonTypeAssertion(probe, 'data.items', 'array', label)
  assertJsonMinItemsAssertion(probe, 'data.items', 1, label)
  assertJsonTypeAssertion(probe, 'data.items[0].buildingName', 'nonemptyString', label)
}

function validateSameNameBusinessProbes(probes, manifest) {
  const a = probes.find(probe => probe?.name === 'same-name-address-a')
  const b = probes.find(probe => probe?.name === 'same-name-address-b')
  const identities = []
  for (const probe of [a, b]) {
    const label = probe.name
    if (probe.expectedReleaseId !== manifest.releaseId) throw new Error(`${label} probe must assert release id`)
    assertProbePath(probe, '/api/real-estate/apt-sale/building-info', label)
    const queryUrl = parseProbeUrl(probe)
    const queryBuildingName = queryUrl.searchParams.get('buildingName')
    if (typeof queryBuildingName !== 'string' || queryBuildingName.length === 0) throw new Error(`${label} probe must include buildingName`)
    const queryKey = assertProbeQueryValue(probe, 'buildingKey', HEX_64, label)
    const expectedKey = assertProbeExpectedJson(probe, 'data.buildingKey', value => HEX_64.test(String(value ?? '')), label)
    if (expectedKey !== queryKey) throw new Error(`${label} expected buildingKey must match query buildingKey`)
    const dongName = assertProbeExpectedJson(probe, 'data.dongName', value => typeof value === 'string' && value.length > 0, label)
    const jibun = assertProbeExpectedJson(probe, 'data.jibun', value => typeof value === 'string' && value.length > 0, label)
    const expectedBuildingName = assertProbeExpectedJson(probe, 'data.buildingName', value => value === queryBuildingName, label)
    identities.push({ key: expectedKey, buildingName: expectedBuildingName, address: `${dongName}\u001f${jibun}` })
  }
  if (identities[0].buildingName !== identities[1].buildingName) throw new Error('same-name address probes must assert the same building name')
  if (identities[0].key === identities[1].key) throw new Error('same-name address probes must assert two distinct building keys')
  if (identities[0].address === identities[1].address) throw new Error('same-name address probes must assert two distinct dongName/jibun addresses')
}

function validateModeBusinessProbe(probe, expectedType, expectedMode, manifest) {
  const label = probe.name
  if (probe.expectedReleaseId !== manifest.releaseId) throw new Error(`${label} probe must assert release id`)
  assertProbePath(probe, `/api/real-estate/${expectedType}/detail`, label)
  const queryKey = assertProbeQueryValue(probe, 'buildingKey', HEX_64, label)
  const queryMode = parseProbeUrl(probe).searchParams.get('mode')
  if (queryMode !== expectedMode) throw new Error(`${label} probe mode query must be ${expectedMode}`)
  assertProbeExpectedJson(probe, 'success', value => value === true, label)
  assertProbeExpectedJson(probe, 'data.filters.mode', value => value === expectedMode, label)
  assertProbeExpectedJson(probe, 'data.filters.buildingKey', value => value === queryKey, label)
}

function validateSitemapBusinessProbe(probe, manifest) {
  if (probe.expectedReleaseId !== manifest.releaseId) throw new Error('sitemap probe must assert release id')
  assertProbePath(probe, '/sitemap.xml', 'sitemap')
  if (probe.target && probe.target !== 'frontend') throw new Error('sitemap probe must target frontend')
  const includes = Array.isArray(probe.expectBodyIncludes) ? probe.expectBodyIncludes : [probe.expectBodyIncludes]
  if (!includes.includes('<loc>')) throw new Error('sitemap probe must assert XML loc marker')
}

function validateWasteBusinessProbe(probe, manifest) {
  if (probe.expectedReleaseId !== manifest.releaseId) throw new Error('waste probe must assert release id')
  assertProbePath(probe, '/api/waste-schedules', 'waste')
  assertJsonTypeAssertion(probe, 'data.total', 'nonnegativeNumber', 'waste')
  assertJsonTypeAssertion(probe, 'data.items', 'array', 'waste')
  assertJsonMinItemsAssertion(probe, 'data.items', 1, 'waste')
  assertJsonTypeAssertion(probe, 'data.items[0].id', 'nonnegativeNumber', 'waste')
}

function validateBusinessProbeContracts(manifest) {
  const probes = asArray(manifest.probes)
  const byName = new Map(probes.map(probe => [probe?.name, probe]))
  for (const probeName of REQUIRED_PROBES) {
    const probe = byName.get(probeName)
    if (!probe) throw new Error(`missing business probe: ${probeName}`)
    if (probeName !== READINESS_PROBE_NAME && isApiHealthProbe(probe)) {
      throw new Error(`${probeName} probe must not point to /api/health`)
    }
  }
  for (const [probeName, expectedType] of LIST_PROBE_TYPES.entries()) {
    validateListBusinessProbe(byName.get(probeName), expectedType, manifest)
  }
  validateSameNameBusinessProbes(probes, manifest)
  validateModeBusinessProbe(byName.get('sale-mode'), 'apt-sale', 'sale', manifest)
  validateModeBusinessProbe(byName.get('rent-mode'), 'apt-rent', 'wolse', manifest)
  validateSitemapBusinessProbe(byName.get('sitemap'), manifest)
  validateWasteBusinessProbe(byName.get('waste'), manifest)
}

function readJsonPath(value, path) {
  return String(path).split('.').reduce((current, rawPart) => {
    if (current === undefined || current === null) return undefined
    const match = /^([^[]+)(?:\[(\d+)\])?$/.exec(rawPart)
    if (!match) return undefined
    const next = current?.[match[1]]
    return match[2] === undefined ? next : next?.[Number(match[2])]
  }, value)
}

function matchesJsonType(value, type) {
  if (type === 'boolean') return typeof value === 'boolean'
  if (type === 'string') return typeof value === 'string'
  if (type === 'nonemptyString') return typeof value === 'string' && value.length > 0
  if (type === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (type === 'nonnegativeNumber') return typeof value === 'number' && Number.isFinite(value) && value >= 0
  if (type === 'array') return Array.isArray(value)
  if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value)
  if (type === '64hex') return typeof value === 'string' && HEX_64.test(value)
  throw new Error(`unknown expectedJsonTypes assertion: ${type}`)
}

const DEFAULT_TEMPLATE = `# Generated release include. Values must come from a validated manifest.
upstream ilsangkit_release_web { server 127.0.0.1:{{FRONTEND_PORT}}; }
upstream ilsangkit_release_api { server 127.0.0.1:{{BACKEND_PORT}}; }
map $host $ilsangkit_release { default "{{RELEASE_ID}}"; }

proxy_cache_path {{CACHE_PATH}} levels=1:2 keys_zone={{CACHE_ZONE}}:50m inactive=30m max_size=512m;
proxy_cache_key "$scheme$request_method$host$request_uri$ilsangkit_release";
`

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function assertAbsolutePath(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`)
  }
}

function assertPathInside(parent, child, label) {
  assertAbsolutePath(parent, `${label} parent`)
  assertAbsolutePath(child, label)
  const rel = relative(resolve(parent), resolve(child))
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return
  throw new Error(`${label} must stay under ${parent}`)
}

function rollbackProxyManifest(manifest) {
  return {
    ...manifest,
    releaseId: manifest.rollback.releaseId,
    ports: { frontend: manifest.rollback.frontendPort, backend: manifest.rollback.backendPort },
    cachePath: manifest.rollback.cachePath ?? manifest.cachePath,
  }
}

function assertPort(value, label) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${label} must be a valid TCP port`)
  }
  return port
}

function artifactList(manifest) {
  return [manifest.backendArtifact, manifest.frontendArtifact, ...asArray(manifest.artifacts)].filter(Boolean)
}

function artifactFingerprint(manifest) {
  return createHash('sha256').update(JSON.stringify(artifactList(manifest).map(artifact => ({
    path: artifact.path,
    sha256: artifact.sha256,
    target: artifact.target ?? null,
  })))).digest('hex')
}

function readinessProbe(manifest) {
  return asArray(manifest.probes).find(probe => probe?.name === READINESS_PROBE_NAME)
}

function assertRuntimeConfig(manifest, inventory) {
  const runtime = manifest.runtime ?? inventory.runtime
  if (!runtime || typeof runtime !== 'object') throw new Error('runtime configuration is required')
  const envFile = runtime.backendEnvFile ?? inventory.envFile
  if (typeof envFile !== 'string' || !isAbsolute(envFile)) throw new Error('runtime backendEnvFile must be an absolute path')
  const writerLockDir = runtime.realEstateWriteLockDir ?? inventory.realEstateWriteLockDir
  if (typeof writerLockDir !== 'string' || !isAbsolute(writerLockDir)) throw new Error('runtime realEstateWriteLockDir must be an absolute path')
  const sitemapDir = runtime.sitemapDir ?? inventory.sitemap?.releaseDir
  if (typeof sitemapDir !== 'string' || !isAbsolute(sitemapDir)) throw new Error('runtime release sitemapDir must be an absolute path')
  return { envFile, writerLockDir, sitemapDir }
}

export function validateManifest(manifest, inventory, options = {}) {
  const bootstrapCompatibilityCheck = options.bootstrapCompatibilityCheck === true
  if (!manifest || typeof manifest !== 'object') throw new Error('manifest is required')
  if (!inventory || typeof inventory !== 'object') throw new Error('inventory is required')
  if (!/^[a-z0-9][a-z0-9._-]{2,80}$/i.test(String(manifest.releaseId ?? ''))) {
    throw new Error('manifest.releaseId must be a stable release id')
  }
  if (!/^[a-f0-9]{40}$/i.test(String(manifest.commitSha ?? ''))) {
    throw new Error('manifest.commitSha must be a 40-character SHA')
  }
  if (manifest.workflowSha && manifest.workflowSha !== manifest.commitSha) {
    throw new Error('workflow head SHA must match manifest commitSha')
  }

  assertPathInside(inventory.deployRoot, inventory.releasesRoot, 'inventory.releasesRoot')
  const releaseRoot = join(inventory.releasesRoot, manifest.releaseId)
  assertPathInside(inventory.releasesRoot, releaseRoot, 'releaseRoot')

  const backendPort = assertPort(manifest.ports?.backend, 'manifest.ports.backend')
  const frontendPort = assertPort(manifest.ports?.frontend, 'manifest.ports.frontend')
  const reserved = new Set(asArray(inventory.reservePorts).map(Number))
  if (!reserved.has(backendPort) || !reserved.has(frontendPort)) {
    throw new Error('candidate ports must come from inventory.reservePorts')
  }
  if ([inventory.active?.backend?.port, inventory.active?.frontend?.port].map(Number).includes(backendPort)
    || [inventory.active?.backend?.port, inventory.active?.frontend?.port].map(Number).includes(frontendPort)) {
    throw new Error('candidate ports must not collide with active ports')
  }

  const internalApiBase = manifest.internalApiBase ?? `http://127.0.0.1:${backendPort}`
  if (String(internalApiBase).replace(/\/+$/, '').endsWith('/api')) {
    throw new Error('NUXT_INTERNAL_API_BASE uses origin contract with NO /api suffix')
  }

  const rollback = manifest.rollback
  if (!manifest.rollbackReleaseId || !rollback || rollback.releaseId !== manifest.rollbackReleaseId) {
    throw new Error('rollbackReleaseId must resolve to a rollback manifest')
  }
  if (!rollback.retained) throw new Error('rollback release must be retained')
  if (bootstrapCompatibilityCheck && manifest.summary?.mode !== 'compatibility') {
    throw new Error('bootstrap compatibility check requires compatibility summary mode')
  }
  if (!bootstrapCompatibilityCheck) {
    if (!rollback.supportsKeyedUrls) throw new Error('rollback release must support keyed URLs')
    if (!rollback.businessProbesPass) throw new Error('rollback release business probes must pass')
    if (asArray(rollback.probes).length === 0) throw new Error('rollback release must include live business probes')
  }
  assertPort(rollback.backendPort, 'rollback.backendPort')
  assertPort(rollback.frontendPort, 'rollback.frontendPort')

  if (manifest.summary?.state !== 'ready') throw new Error('summary state must be ready')
  if (manifest.summary?.mode !== 'address' && manifest.summary?.mode !== 'compatibility') {
    throw new Error('summary mode must be address or compatibility')
  }
  if (!manifest.summary?.runId || manifest.summary.runId !== manifest.summary.expectedRunId) {
    throw new Error('summary runId must match manifest expectation')
  }
  assertRuntimeConfig(manifest, inventory)
  const activeBackendLink = manifest.activePointers?.backend ?? inventory.activePointers?.backend ?? inventory.activeBackendLink
  const activeFrontendLink = manifest.activePointers?.frontend ?? inventory.activePointers?.frontend ?? inventory.activeFrontendLink
  if (typeof activeBackendLink !== 'string' || !isAbsolute(activeBackendLink)) throw new Error('active backend pointer path is required')
  if (typeof activeFrontendLink !== 'string' || !isAbsolute(activeFrontendLink)) throw new Error('active frontend pointer path is required')
  const readiness = readinessProbe(manifest)
  if (!readiness) throw new Error('release-readiness probe is required')
  if (readiness.target !== 'backend' || readiness.path !== '/api/internal/release-readiness') {
    throw new Error('release-readiness probe must target backend internal readiness')
  }
  if (readiness.expectedJson?.ready !== true || readiness.expectedJson?.releaseId !== manifest.releaseId || readiness.expectedJson?.['summary.runId'] !== manifest.summary.runId || readiness.expectedJson?.['summary.mode'] !== manifest.summary.mode) {
    throw new Error('release-readiness probe must assert ready, releaseId, summary.mode, and summary.runId')
  }

  const probes = asArray(manifest.probes)
  validateBusinessProbeContracts(manifest)
  const releaseHeaderTargets = new Set(probes
    .filter(probe => probe?.expectedReleaseId === manifest.releaseId)
    .map(probe => probe.target ?? (String(probe.path ?? '/').startsWith('/api/') ? 'backend' : 'frontend')))
  if (!releaseHeaderTargets.has('backend') || !releaseHeaderTargets.has('frontend')) {
    throw new Error('candidate probes must assert backend and frontend release ids')
  }
  const publicSmokeProbes = asArray(manifest.publicSmokeProbes)
  if (publicSmokeProbes.length === 0 || publicSmokeProbes.some(probe => probe?.expectedReleaseId !== manifest.releaseId)) {
    throw new Error('public smoke probes must assert the active release id')
  }

  for (const artifact of artifactList(manifest)) {
    assertAbsolutePath(artifact.path, 'artifact.path')
    if (!/^[a-f0-9]{64}$/i.test(String(artifact.sha256 ?? ''))) {
      throw new Error(`artifact ${artifact.path} must include sha256`)
    }
  }
  if (asArray(manifest.hashedAssets).length === 0) throw new Error('hashedAssets must be derived from the frontend artifact')

  return { releaseRoot, backendPort, frontendPort, internalApiBase }
}

function sha256File(path) {
  return new Promise((resolvePromise, rejectPromise) => {
    const hash = createHash('sha256')
    const stream = createReadStream(path)
    stream.on('error', rejectPromise)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('end', () => resolvePromise(hash.digest('hex')))
  })
}

export async function verifyArtifacts(manifest) {
  for (const artifact of artifactList(manifest)) {
    const actual = await sha256File(artifact.path)
    if (actual !== artifact.sha256) {
      throw new Error(`artifact checksum mismatch: ${artifact.path}`)
    }
  }
}

function artifactTargetDir(releaseRoot, artifact, defaultName) {
  const name = artifact.target ?? defaultName
  if (!/^[a-z0-9._-]+$/i.test(String(name))) {
    throw new Error(`artifact target must be a safe directory name: ${name}`)
  }
  const target = join(releaseRoot, name)
  assertPathInside(releaseRoot, target, 'artifact target')
  return target
}

export async function installArtifacts(context) {
  const { manifest, runner, releaseRoot } = context
  if (!releaseRoot) throw new Error('releaseRoot is required before artifact install')
  const backendDir = artifactTargetDir(releaseRoot, manifest.backendArtifact, 'backend')
  const frontendDir = artifactTargetDir(releaseRoot, manifest.frontendArtifact, 'frontend')
  const markerPath = join(releaseRoot, '.install-manifest.json')
  const fingerprint = artifactFingerprint(manifest)
  if (existsSync(markerPath)) {
    const marker = JSON.parse(readFileSync(markerPath, 'utf8'))
    if (marker.fingerprint !== fingerprint || marker.commitSha !== manifest.commitSha) {
      throw new Error('immutable release artifact conflict')
    }
    await step(runner, 'reuse-installed-artifacts', { releaseRoot })
    return { backendDir, frontendDir, reused: true }
  }
  if (existsSync(backendDir) || existsSync(frontendDir)) {
    throw new Error('immutable release directory already contains unverified files')
  }
  mkdirSync(backendDir, { recursive: true })
  mkdirSync(frontendDir, { recursive: true })

  await step(runner, 'install-artifacts', { releaseRoot })
  await runner.run?.('tar', ['-xzf', manifest.backendArtifact.path, '-C', backendDir])
  await runner.run?.('tar', ['-xzf', manifest.frontendArtifact.path, '-C', frontendDir])

  await step(runner, 'install-backend-runtime', { cwd: backendDir })
  await runner.run?.('npm', ['ci', '--omit=dev'], { cwd: backendDir })
  await step(runner, 'generate-prisma-client', { cwd: backendDir })
  await runner.run?.('npx', ['prisma', 'generate'], { cwd: backendDir })
  atomicWriteJson(markerPath, { commitSha: manifest.commitSha, fingerprint, installedAt: new Date(context.now()).toISOString() })

  return { backendDir, frontendDir, reused: false }
}

export async function retainHashedAssets(manifest, inventory) {
  const assets = asArray(manifest.hashedAssets)
  if (assets.length === 0) return []
  assertAbsolutePath(inventory.assets?.publicDir, 'inventory.assets.publicDir')
  const nuxtDir = join(inventory.assets.publicDir, '_nuxt')
  mkdirSync(nuxtDir, { recursive: true })
  const retained = []
  for (const asset of assets) {
    assertAbsolutePath(asset.path, 'hashed asset path')
    if (!/^[^/]+$/.test(String(asset.fileName ?? ''))) {
      throw new Error('hashed asset fileName must be a basename')
    }
    const actual = await sha256File(asset.path)
    if (actual !== asset.sha256) throw new Error(`hashed asset checksum mismatch: ${asset.fileName}`)
    const target = join(nuxtDir, asset.fileName)
    if (existsSync(target)) {
      const existing = await sha256File(target)
      if (existing !== asset.sha256) {
        throw new Error(`hashed asset ${asset.fileName} already exists with different content`)
      }
      retained.push(target)
      continue
    }
    copyFileSync(asset.path, target)
    retained.push(target)
  }
  return retained
}

export function buildCandidateEnvironment(manifest, inventory = {}) {
  const backendPort = assertPort(manifest.ports?.backend, 'manifest.ports.backend')
  const frontendPort = assertPort(manifest.ports?.frontend, 'manifest.ports.frontend')
  const internalApiBase = manifest.internalApiBase ?? `http://127.0.0.1:${backendPort}`
  if (String(internalApiBase).replace(/\/+$/, '').endsWith('/api')) {
    throw new Error('NUXT_INTERNAL_API_BASE uses origin contract with NO /api suffix')
  }
  const runtime = assertRuntimeConfig(manifest, inventory)
  return {
    NODE_ENV: 'production',
    HOST: '127.0.0.1',
    NITRO_HOST: '127.0.0.1',
    PORT: String(frontendPort),
    NUXT_PORT: String(frontendPort),
    NUXT_INTERNAL_API_BASE: internalApiBase,
    NUXT_PUBLIC_API_BASE: '',
    ILSK_RELEASE_ID: manifest.releaseId,
    REAL_ESTATE_SUMMARY_MODE: manifest.summary.mode,
    REAL_ESTATE_SUMMARY_RUN_ID: manifest.summary.runId,
    ILSK_SUMMARY_RUN_ID: manifest.summary.runId,
    REAL_ESTATE_WRITE_LOCK_DIR: runtime.writerLockDir,
    SITEMAP_DIR: runtime.sitemapDir,
    ILSK_BACKEND_ENV_FILE: runtime.envFile,
  }
}

function escapeTemplateValue(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function nginxCacheZoneName(releaseId) {
  const hash = createHash('sha256').update(String(releaseId)).digest('hex').slice(0, 16)
  return `ilsangkit_release_cache_${hash}`
}

export function renderNginxReleaseConfig(manifest, template = DEFAULT_TEMPLATE) {
  const backendPort = assertPort(manifest.ports?.backend, 'manifest.ports.backend')
  const frontendPort = assertPort(manifest.ports?.frontend, 'manifest.ports.frontend')
  return template
    .replaceAll('{{FRONTEND_PORT}}', String(frontendPort))
    .replaceAll('{{BACKEND_PORT}}', String(backendPort))
    .replaceAll('{{RELEASE_ID}}', escapeTemplateValue(manifest.releaseId))
    .replaceAll('{{CACHE_ZONE}}', nginxCacheZoneName(manifest.releaseId))
    .replaceAll('{{CACHE_PATH}}', escapeTemplateValue(manifest.cachePath ?? `/tmp/ilsangkit-nginx-cache-${manifest.releaseId}`))
}

function defaultRunner() {
  return {
    async step() {},
    async run(command, args, options) {
      return execFileAsync(command, args, options)
    },
  }
}

async function step(runner, name, details) {
  if (runner.step) await runner.step(name, details)
}

function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(tmp, path)
}

function atomicSymlink(target, linkPath) {
  mkdirSync(dirname(linkPath), { recursive: true })
  const tmp = `${linkPath}.tmp-${process.pid}-${Date.now()}`
  rmSync(tmp, { force: true })
  symlinkSync(target, tmp)
  renameSync(tmp, linkPath)
}


function readLockOwner(lockPath) {
  const ownerPath = join(lockPath, 'owner.json')
  if (!existsSync(ownerPath)) return undefined
  try {
    return JSON.parse(readFileSync(ownerPath, 'utf8'))
  } catch {
    return undefined
  }
}

function isProcessLive(pid) {
  if (!Number.isInteger(Number(pid)) || Number(pid) <= 0) return false
  try {
    process.kill(Number(pid), 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function recoverableStaleLock(inventory, lockPath, now) {
  const recover = Number(inventory.deployLock?.recoverStaleAfterMs ?? 0)
  const recoveryToken = inventory.deployLock?.recoveryToken
  if (!recover || inventory.deployLock?.allowStaleRecovery !== true || !recoveryToken) return false
  const owner = readLockOwner(lockPath)
  if (!owner || owner.token !== recoveryToken) return false
  if (typeof owner.startedAtMs !== 'number' || now - owner.startedAtMs <= recover) return false
  if (isProcessLive(owner.pid)) return false
  const safeStages = new Set(['prepared', 'checked', 'validated', 'rolled-back', 'reconciled-rolled-back', 'switched'])
  return safeStages.has(String(owner.stage ?? ''))
}

async function acquireDeployLock(inventory, now = Date.now(), runner = defaultRunner()) {
  const lockPath = join(inventory.deployRoot, 'locks', 'release.lock')
  const inheritedToken = process.env.ILSK_DEPLOY_LOCK_TOKEN
  const token = inheritedToken || randomUUID()
  mkdirSync(dirname(lockPath), { recursive: true })
  try {
    mkdirSync(lockPath, { recursive: false })
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error
    const owner = readLockOwner(lockPath)
    if (inheritedToken && owner?.token === inheritedToken) {
      return { path: lockPath, token: inheritedToken, inherited: true }
    }
    if (!recoverableStaleLock(inventory, lockPath, now)) {
      throw new Error(`deploy lock already held: ${lockPath}`)
    }
    await step(runner, 'recover-stale-deploy-lock', { lockPath })
    rmSync(lockPath, { recursive: true, force: true })
    try {
      mkdirSync(lockPath, { recursive: false })
    } catch (retryError) {
      if (retryError?.code === 'EEXIST') throw new Error(`deploy lock already held: ${lockPath}`)
      throw retryError
    }
  }
  atomicWriteJson(join(lockPath, 'owner.json'), {
    pid: process.pid,
    token,
    startedAtMs: now,
    processStartTimeMs: now - Math.round(process.uptime() * 1000),
    startedAt: new Date(now).toISOString(),
    stage: 'acquired',
  })
  return { path: lockPath, token }
}

function updateDeployLockStage(lock, stage) {
  if (!lock?.path) return
  const owner = readLockOwner(lock.path)
  if (!owner || owner.token !== lock.token) return
  atomicWriteJson(join(lock.path, 'owner.json'), { ...owner, stage, updatedAt: new Date().toISOString() })
}

function releaseDeployLock(lock) {
  if (!lock?.path || lock.inherited) return
  const owner = readLockOwner(lock.path)
  if (!owner || owner.token !== lock.token) return
  rmSync(lock.path, { recursive: true, force: true })
}

function readExistingLinkOrFile(path) {
  if (!existsSync(path)) return { type: 'missing', path }
  const stat = lstatSync(path)
  if (stat.isSymbolicLink()) return { type: 'symlink', target: readlinkSync(path), path }
  return { type: 'file', content: readFileSync(path, 'utf8'), path }
}

function restorePointer(snapshot) {
  if (!snapshot) return
  if (snapshot.type === 'missing') {
    rmSync(snapshot.path, { force: true })
  } else if (snapshot.type === 'symlink') {
    atomicSymlink(snapshot.target, snapshot.path)
  } else {
    const tmp = `${snapshot.path}.tmp-${process.pid}-${Date.now()}`
    writeFileSync(tmp, snapshot.content)
    renameSync(tmp, snapshot.path)
  }
}



function isPortFree(port, host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host, port })
    const finish = (free) => {
      socket.removeAllListeners()
      socket.destroy()
      resolve(free)
    }
    socket.setTimeout(1000)
    socket.once('connect', () => finish(false))
    socket.once('timeout', () => finish(false))
    socket.once('error', (error) => {
      if (error?.code === 'ECONNREFUSED') {
        finish(true)
      } else {
        reject(error)
      }
    })
  })
}

async function ensurePortsAvailable(context, ports) {
  for (const port of ports) {
    await step(context.runner, 'check-port-free', { port })
    const checker = context.portChecker ?? isPortFree
    const free = await checker(Number(port))
    if (!free) throw new Error(`candidate port is busy: ${port}`)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function finiteNonnegativeNumber(value, fallback, label) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${label} must be a finite nonnegative number`)
  return parsed
}

function finitePositiveInteger(value, fallback, label) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`)
  return parsed
}

async function waitForReadiness(context, target) {
  const requestTimeoutMs = finiteNonnegativeNumber(
    context.readinessRequestTimeoutMs,
    DEFAULT_READINESS_REQUEST_TIMEOUT_MS,
    'readinessRequestTimeoutMs',
  )
  const probe = target === 'backend'
    ? { name: 'backend-process-readiness', path: '/api/health', target: 'backend', requestTimeoutMs }
    : { name: 'frontend-process-readiness', path: '/', target: 'frontend', requestTimeoutMs }
  const attempts = finitePositiveInteger(context.readinessAttempts, DEFAULT_READINESS_ATTEMPTS, 'readinessAttempts')
  const delayMs = finiteNonnegativeNumber(context.readinessDelayMs, DEFAULT_READINESS_DELAY_MS, 'readinessDelayMs')
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runHttpProbes(context, [probe], 'candidate')
      return
    } catch (error) {
      lastError = error
      if (attempt < attempts && delayMs > 0) await (context.readinessSleep ?? sleep)(delayMs)
    }
  }
  const causeMessage = lastError instanceof Error ? lastError.message : String(lastError ?? 'unknown error')
  throw new Error(`${target} readiness failed after ${attempts} attempts: ${causeMessage}`, { cause: lastError })
}

function publicProxyOrigin(manifest) {
  const raw = manifest.publicOrigin ?? manifest.proxyOrigin
  if (raw) return String(raw).replace(/\/+$/, '')
  const proxyPort = manifest.ports?.proxy
  if (proxyPort) return `http://127.0.0.1:${assertPort(proxyPort, 'manifest.ports.proxy')}`
  throw new Error('public smoke requires a proxy/public origin')
}

function pointerPaths(context) {
  return {
    backend: context.manifest.activePointers?.backend ?? context.inventory.activePointers?.backend ?? context.inventory.activeBackendLink,
    frontend: context.manifest.activePointers?.frontend ?? context.inventory.activePointers?.frontend ?? context.inventory.activeFrontendLink,
  }
}

function updateActivePointers(context, releaseManifest) {
  const paths = pointerPaths(context)
  atomicSymlink(releaseManifest.backendDir ?? join(context.inventory.releasesRoot, releaseManifest.releaseId, 'backend'), paths.backend)
  atomicSymlink(releaseManifest.frontendDir ?? join(context.inventory.releasesRoot, releaseManifest.releaseId, 'frontend'), paths.frontend)
}
async function startProcesses(context) {
  const { runner, inventory, manifest, releaseRoot } = context
  const env = buildCandidateEnvironment(manifest, inventory)
  const configPath = resolve(fileURLToPath(new URL('../../ecosystem.release.config.cjs', import.meta.url)))
  if (!existsSync(configPath)) throw new Error(`release ecosystem config not found: ${configPath}`)
  await ensurePortsAvailable(context, [manifest.ports.backend, manifest.ports.frontend])
  const pm2Env = {
    ...process.env,
    ...env,
    ILSK_RELEASE_ROOT: releaseRoot,
    ILSK_BACKEND_PORT: String(manifest.ports.backend),
    ILSK_FRONTEND_PORT: String(manifest.ports.frontend),
  }
  await step(runner, 'start-backend', { releaseId: manifest.releaseId, configPath })
  await runner.run?.(inventory.pm2Binary, ['start', configPath, '--only', `ilsangkit-backend-${manifest.releaseId}`], {
    cwd: dirname(configPath),
    env: pm2Env,
  })
  await waitForReadiness(context, 'backend')
  await step(runner, 'start-frontend', { releaseId: manifest.releaseId, configPath })
  await runner.run?.(inventory.pm2Binary, ['start', configPath, '--only', `ilsangkit-frontend-${manifest.releaseId}`], {
    cwd: dirname(configPath),
    env: pm2Env,
  })
  await waitForReadiness(context, 'frontend')
}

function writeReleaseInclude(inventory, proxyManifest) {
  const templatePath = fileURLToPath(new URL('./nginx-release.conf.template', import.meta.url))
  const template = existsSync(templatePath) ? readFileSync(templatePath, 'utf8') : DEFAULT_TEMPLATE
  const includePath = join(inventory.deployRoot, 'nginx', `${proxyManifest.releaseId}.conf`)
  assertPathInside(join(inventory.deployRoot, 'nginx'), includePath, 'release include')
  mkdirSync(dirname(includePath), { recursive: true })
  writeFileSync(includePath, renderNginxReleaseConfig(proxyManifest, template))
  return includePath
}

function writeCandidateNginxConfig(inventory, includePath, releaseId) {
  const candidateConfigPath = join(inventory.deployRoot, 'nginx', `${releaseId}.nginx.conf`)
  assertPathInside(join(inventory.deployRoot, 'nginx'), candidateConfigPath, 'candidate nginx config')
  mkdirSync(dirname(candidateConfigPath), { recursive: true })
  if (existsSync(inventory.nginxConfigPath)) {
    const currentConfig = readFileSync(inventory.nginxConfigPath, 'utf8')
    const rewritten = currentConfig.includes(inventory.nginxIncludePath)
      ? currentConfig.replaceAll(inventory.nginxIncludePath, includePath)
      : `${currentConfig}\ninclude ${includePath};\n`
    writeFileSync(candidateConfigPath, rewritten)
  } else {
    writeFileSync(candidateConfigPath, `include ${includePath};\n`)
  }
  return candidateConfigPath
}

async function validateProxy(context, proxyManifest = context.manifest) {
  const includePath = writeReleaseInclude(context.inventory, proxyManifest)
  const candidateConfigPath = writeCandidateNginxConfig(context.inventory, includePath, proxyManifest.releaseId)
  await step(context.runner, 'validate-proxy', { includePath, candidateConfigPath })
  await context.runner.run?.(context.inventory.nginxBinary, ['-t', '-c', candidateConfigPath])
  return includePath
}

async function switchPointer(context, includePath) {
  await step(context.runner, 'switch-pointer', { includePath })
  atomicSymlink(includePath, context.inventory.nginxIncludePath)
  updateActivePointers(context, { releaseId: context.manifest.releaseId })
  await step(context.runner, 'reload-proxy', { releaseId: context.manifest.releaseId })
  await context.runner.run?.(context.inventory.nginxBinary, ['-s', 'reload'])
}

async function rollbackPointer(context) {
  const rollbackInclude = writeReleaseInclude(context.inventory, rollbackProxyManifest(context.manifest))
  await step(context.runner, 'rollback-pointer', { releaseId: context.manifest.rollbackReleaseId, includePath: rollbackInclude })
  atomicSymlink(rollbackInclude, context.inventory.nginxIncludePath)
  updateActivePointers(context, { releaseId: context.manifest.rollbackReleaseId })
  await step(context.runner, 'reload-proxy-rollback', { releaseId: context.manifest.rollbackReleaseId })
  await context.runner.run?.(context.inventory.nginxBinary, ['-s', 'reload'])
}

async function writeJournal(context, stage, extra = {}) {
  const journalPath = join(context.inventory.deployRoot, 'journal', `${context.manifest.releaseId}.json`)
  atomicWriteJson(journalPath, {
    releaseId: context.manifest.releaseId,
    rollbackReleaseId: context.manifest.rollbackReleaseId,
    stage,
    manifestChecksum: createHash('sha256').update(JSON.stringify(context.manifest)).digest('hex'),
    updatedAt: new Date(context.now()).toISOString(),
    ...extra,
  })
  return journalPath
}

async function validateAndVerify(context, options = {}) {
  await step(context.runner, 'validate-manifest', { releaseId: context.manifest.releaseId })
  const validation = validateManifest(context.manifest, context.inventory, options)
  context.releaseRoot = validation.releaseRoot
  await step(context.runner, 'verify-artifacts', { releaseId: context.manifest.releaseId })
  await verifyArtifacts(context.manifest)
  if (!options.bootstrapCompatibilityCheck) {
    await verifyRollbackReadiness(context)
  }
  return validation
}

function probeUrl(manifest, probe, phase) {
  const path = String(probe.path ?? '/')
  if (phase === 'public') {
    if (probe.target && probe.target !== 'proxy' && probe.target !== 'public') {
      throw new Error(`public smoke probe must use proxy/public target: ${probe.name ?? path}`)
    }
    const origin = publicProxyOrigin(manifest)
    if (probe.url) {
      const parsed = new URL(probe.url)
      if (parsed.origin !== origin) {
        throw new Error(`public smoke probe URL must use public origin: ${probe.name ?? probe.url}`)
      }
      return probe.url
    }
    return `${origin}${path.startsWith('/') ? path : `/${path}`}`
  }
  if (probe.url) return probe.url
  const target = probe.target ?? (path.startsWith('/api/') ? 'backend' : 'frontend')
  const ports = phase === 'rollback'
    ? { backend: manifest.rollback.backendPort, frontend: manifest.rollback.frontendPort, proxy: manifest.rollback.proxyPort }
    : manifest.ports
  const port = target === 'backend' ? ports.backend : target === 'proxy' ? ports.proxy : ports.frontend
  assertPort(port, `${phase} probe ${probe.name ?? path} port`)
  return `http://127.0.0.1:${port}${path.startsWith('/') ? path : `/${path}`}`
}

function createProbeTimeout(timeoutMs) {
  if (!timeoutMs) return { signal: undefined, clear: () => {} }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  return { signal: controller.signal, clear: () => clearTimeout(timeout) }
}

async function consumeProbeBody(response) {
  if (typeof response?.text === 'function') await response.text()
}

class ProbeReleaseIdMismatchError extends Error {
  constructor(message, actualReleaseId) {
    super(message)
    this.actualReleaseId = actualReleaseId
  }
}

function isReleaseIdMismatch(error) {
  return error instanceof ProbeReleaseIdMismatchError
}

function releaseIdFromPointerTarget(target, releasesRoot) {
  if (typeof target !== 'string' || typeof releasesRoot !== 'string') return null
  const relativeTarget = relative(resolve(releasesRoot), resolve(target))
  if (relativeTarget.startsWith('..') || isAbsolute(relativeTarget) || relativeTarget === '') return null
  const [releaseId] = relativeTarget.split(/[\\/]/)
  return releaseId || null
}

function releaseIdFromNginxInclude(includePath) {
  if (!includePath || !existsSync(includePath)) return null
  try {
    const include = readFileSync(includePath, 'utf8')
    return /map\s+\$host\s+\$ilsangkit_release\s*\{[^}]*default\s+"([^"]+)"/s.exec(include)?.[1] ?? null
  } catch {
    return null
  }
}

function collectPreviousReleaseIds(inventory) {
  const releaseIds = new Set([
    inventory.activeReleaseId,
    inventory.active?.releaseId,
    inventory.active?.backend?.releaseId,
    inventory.active?.frontend?.releaseId,
    releaseIdFromNginxInclude(inventory.nginxIncludePath),
  ].filter(Boolean))
  const pointerCandidates = [
    inventory.activePointers?.backend ?? inventory.activeBackendLink,
    inventory.activePointers?.frontend ?? inventory.activeFrontendLink,
  ]
  for (const pointerPath of pointerCandidates) {
    if (!pointerPath || !existsSync(pointerPath)) continue
    try {
      const target = readlinkSync(pointerPath)
      const resolvedTarget = isAbsolute(target) ? target : resolve(dirname(pointerPath), target)
      const releaseId = releaseIdFromPointerTarget(resolvedTarget, inventory.releasesRoot)
      if (releaseId) releaseIds.add(releaseId)
    } catch {}
  }
  return [...releaseIds]
}

function expectedReleaseIdsForPublicConvergence(context) {
  return new Set([
    context.manifest.releaseId,
    context.manifest.rollbackReleaseId,
    context.manifest.rollback?.releaseId,
    ...asArray(context.previousReleaseIds),
  ].filter(Boolean))
}

function publicProbeRequestTimeoutMs(context, probe) {
  const hasProbeTimeout = probe.requestTimeoutMs !== undefined
  return finitePositiveInteger(
    hasProbeTimeout ? probe.requestTimeoutMs : context.publicConvergenceRequestTimeoutMs,
    DEFAULT_PUBLIC_CONVERGENCE_REQUEST_TIMEOUT_MS,
    hasProbeTimeout ? `public smoke probe ${probe.name ?? probe.path ?? 'request'} requestTimeoutMs` : 'publicConvergenceRequestTimeoutMs',
  )
}

function withPublicProbeTimeouts(context, probes) {
  return asArray(probes).map(probe => ({
    ...probe,
    requestTimeoutMs: publicProbeRequestTimeoutMs(context, probe),
  }))
}

function isRetryablePublicReleaseMismatch(context, error) {
  if (!isReleaseIdMismatch(error)) return false
  return expectedReleaseIdsForPublicConvergence(context).has(error.actualReleaseId)
}

async function runHttpProbes(context, probes, phase) {
  const fetchImpl = context.fetch
  for (const probe of asArray(probes)) {
    const url = probeUrl(context.manifest, probe, phase)
    const timeout = createProbeTimeout(probe.requestTimeoutMs ?? context.requestTimeoutMs)
    try {
      const response = await fetchImpl(url, { method: probe.method ?? 'GET', signal: timeout.signal })
      const expectedStatus = probe.expectedStatus ?? 200
      if (response.status !== expectedStatus || !response.ok) {
        await consumeProbeBody(response)
        throw new Error(`${phase} probe failed: ${probe.name ?? url} status ${response.status}`)
      }
      if (probe.expectBodyIncludes) {
        const body = await response.text()
        const includes = Array.isArray(probe.expectBodyIncludes) ? probe.expectBodyIncludes : [probe.expectBodyIncludes]
        for (const expectedText of includes) {
          if (!body.includes(expectedText)) {
            throw new Error(`${phase} probe failed: ${probe.name ?? url} missing expected body`)
          }
        }
      }
      if (probe.expectedReleaseId) {
        const actualReleaseId = response.headers?.get?.('x-ilsangkit-release-id')
        if (actualReleaseId !== probe.expectedReleaseId) {
          if (!probe.expectBodyIncludes) await consumeProbeBody(response)
          throw new ProbeReleaseIdMismatchError(`${phase} probe failed: ${probe.name ?? url} release id mismatch`, actualReleaseId)
        }
      }
      if (probe.expectedJson || probe.expectedJsonTypes || probe.expectedJsonMinItems) {
        const body = await response.json()
        for (const [key, expected] of Object.entries(probe.expectedJson ?? {})) {
          const actual = readJsonPath(body, key)
          if (actual !== expected) {
            throw new Error(`${phase} probe failed: ${probe.name ?? url} json ${key} mismatch`)
          }
        }
        for (const [key, expectedType] of Object.entries(probe.expectedJsonTypes ?? {})) {
          const actual = readJsonPath(body, key)
          if (!matchesJsonType(actual, expectedType)) {
            throw new Error(`${phase} probe failed: ${probe.name ?? url} json ${key} type mismatch`)
          }
        }
        for (const [key, minItems] of Object.entries(probe.expectedJsonMinItems ?? {})) {
          const parsedMinItems = Number(minItems)
          if (!Number.isInteger(parsedMinItems) || parsedMinItems < 0) {
            throw new Error(`${phase} probe failed: ${probe.name ?? url} json ${key} invalid min items assertion`)
          }
          const actual = readJsonPath(body, key)
          if (!Array.isArray(actual) || actual.length < parsedMinItems) {
            throw new Error(`${phase} probe failed: ${probe.name ?? url} json ${key} min items mismatch`)
          }
        }
      } else if (!probe.expectBodyIncludes) {
        await consumeProbeBody(response)
      }
    } finally {
      timeout.clear()
    }
  }
}

async function verifyRollbackReadiness(context) {
  await step(context.runner, 'verify-rollback-readiness', { releaseId: context.manifest.rollbackReleaseId })
  await runHttpProbes(context, context.manifest.rollback.probes, 'rollback')
}

async function checkBusinessResponses(context) {
  await step(context.runner, 'check-business-responses', { probes: context.manifest.probes.length })
  await runHttpProbes(context, context.manifest.probes, 'candidate')
}

async function publicSmoke(context) {
  const probes = withPublicProbeTimeouts(context, context.manifest.publicSmokeProbes)
  if (probes.length === 0) throw new Error('public smoke probes must be explicit proxy/public probes')
  await step(context.runner, 'public-smoke', { releaseId: context.manifest.releaseId, probes: probes.length })
  const attempts = finitePositiveInteger(context.publicConvergenceAttempts, DEFAULT_PUBLIC_CONVERGENCE_ATTEMPTS, 'publicConvergenceAttempts')
  const delayMs = finiteNonnegativeNumber(context.publicConvergenceDelayMs, DEFAULT_PUBLIC_CONVERGENCE_DELAY_MS, 'publicConvergenceDelayMs')
  let lastError
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await runHttpProbes(context, probes, 'public')
      return
    } catch (error) {
      lastError = error
      if (!isRetryablePublicReleaseMismatch(context, error) || attempt >= attempts) throw error
      if (delayMs > 0) await (context.publicConvergenceSleep ?? sleep)(delayMs)
    }
  }
  throw lastError ?? new Error('public smoke failed')
}

async function retainPrevious(context) {
  await step(context.runner, 'retain-previous', {
    backend: context.inventory.active?.backend?.name,
    frontend: context.inventory.active?.frontend?.name,
  })
}

export async function runReleaseCommand(command, options = {}) {
  if (options.bootstrapCompatibilityCheck && command !== 'check') {
    throw new Error('bootstrap compatibility check is only allowed for check command')
  }
  const runner = options.runner ?? defaultRunner()
  const context = {
    inventory: options.inventory,
    manifest: options.manifest,
    runner,
    now: options.now ?? (() => Date.now()),
    fetch: options.fetch ?? globalThis.fetch,
    portChecker: options.portChecker,
    readinessAttempts: options.readinessAttempts,
    readinessDelayMs: options.readinessDelayMs,
    readinessRequestTimeoutMs: options.readinessRequestTimeoutMs,
    readinessSleep: options.readinessSleep,
    publicConvergenceAttempts: options.publicConvergenceAttempts,
    publicConvergenceDelayMs: options.publicConvergenceDelayMs,
    publicConvergenceRequestTimeoutMs: options.publicConvergenceRequestTimeoutMs,
    publicConvergenceSleep: options.publicConvergenceSleep,
    previousReleaseIds: collectPreviousReleaseIds(options.inventory ?? {}),
    releaseRoot: undefined,
  }

  if (command === 'prepare') {
    let lock
    try {
      lock = await acquireDeployLock(context.inventory, context.now(), context.runner)
      const validation = await validateAndVerify(context)
      await installArtifacts(context)
      await retainHashedAssets(context.manifest, context.inventory)
      const journalPath = await writeJournal(context, 'prepared')
      updateDeployLockStage(lock, 'prepared')
      return { releaseId: context.manifest.releaseId, releaseRoot: validation.releaseRoot, journalPath }
    } finally {
      releaseDeployLock(lock)
    }
  }

  if (command === 'check') {
    let lock
    try {
      lock = await acquireDeployLock(context.inventory, context.now(), context.runner)
      await validateAndVerify(context, { bootstrapCompatibilityCheck: options.bootstrapCompatibilityCheck === true })
      await installArtifacts(context)
      await retainHashedAssets(context.manifest, context.inventory)
      await startProcesses(context)
      await checkBusinessResponses(context)
      await validateProxy(context)
      const journalPath = await writeJournal(context, 'checked')
      updateDeployLockStage(lock, 'checked')
      return { releaseId: context.manifest.releaseId, journalPath }
    } finally {
      releaseDeployLock(lock)
    }
  }

  if (command === 'switch') {
    let lock
    try {
      lock = await acquireDeployLock(context.inventory, context.now(), context.runner)
      await validateAndVerify(context)
      await retainHashedAssets(context.manifest, context.inventory)
      const includePath = await validateProxy(context)
      try {
        await switchPointer(context, includePath)
        await publicSmoke(context)
      } catch (error) {
        await rollbackPointer(context)
        const journalPath = await writeJournal(context, 'rolled-back', { reason: error instanceof Error ? error.message : String(error) })
        updateDeployLockStage(lock, 'rolled-back')
        throw error
      }
      await retainPrevious(context)
      const journalPath = await writeJournal(context, 'switched')
      updateDeployLockStage(lock, 'switched')
      return { releaseId: context.manifest.releaseId, journalPath }
    } finally {
      releaseDeployLock(lock)
    }
  }

  if (command === 'rollback') {
    let lock
    try {
      lock = await acquireDeployLock(context.inventory, context.now(), context.runner)
      await validateAndVerify(context)
      await retainHashedAssets(context.manifest, context.inventory)
      await rollbackPointer(context)
      const journalPath = await writeJournal(context, 'rolled-back')
      updateDeployLockStage(lock, 'rolled-back')
      return { releaseId: context.manifest.rollbackReleaseId, journalPath }
    } finally {
      releaseDeployLock(lock)
    }
  }

  if (command === 'deploy') {
    let lockPath
    try {
      lockPath = await acquireDeployLock(context.inventory, context.now(), context.runner)
      await validateAndVerify(context)
      await installArtifacts(context)
      await retainHashedAssets(context.manifest, context.inventory)
      await startProcesses(context)
      await checkBusinessResponses(context)
      const includePath = await validateProxy(context)
      await writeJournal(context, 'validated')
      updateDeployLockStage(lockPath, 'validated')
      try {
        await switchPointer(context, includePath)
        await publicSmoke(context)
      } catch (error) {
        await rollbackPointer(context)
        await writeJournal(context, 'rolled-back', { reason: error instanceof Error ? error.message : String(error) })
        updateDeployLockStage(lockPath, 'rolled-back')
        throw error
      }
      await retainPrevious(context)
      const journalPath = await writeJournal(context, 'switched')
      updateDeployLockStage(lockPath, 'switched')
      return { releaseId: context.manifest.releaseId, journalPath }
    } finally {
      releaseDeployLock(lockPath)
    }
  }

  if (command === 'reconcile') {
    let lockPath
    try {
      lockPath = await acquireDeployLock(context.inventory, context.now(), context.runner)
      await validateAndVerify(context)
      try {
        await publicSmoke(context)
        const journalPath = await writeJournal(context, 'reconciled-switched')
        updateDeployLockStage(lockPath, 'switched')
        return { releaseId: context.manifest.releaseId, journalPath }
      } catch (error) {
        await rollbackPointer(context)
        const journalPath = await writeJournal(context, 'reconciled-rolled-back', { reason: error instanceof Error ? error.message : String(error) })
        updateDeployLockStage(lockPath, 'reconciled-rolled-back')
        return { releaseId: context.manifest.rollbackReleaseId, journalPath }
      }
    } finally {
      releaseDeployLock(lockPath)
    }
  }

  throw new Error(`Unknown release command: ${command}`)
}

function parseCliArgs(argv) {
  const [command, ...rest] = argv
  const result = { command }
  for (let index = 0; index < rest.length; index += 1) {
    const arg = rest[index]
    if (arg === '--inventory') result.inventoryPath = rest[++index]
    else if (arg === '--manifest') result.manifestPath = rest[++index]
    else if (arg === '--bootstrap-compat-check') result.bootstrapCompatibilityCheck = true
    else throw new Error(`Unknown argument: ${arg}`)
  }
  return result
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2))
  if (!args.command || !args.inventoryPath || !args.manifestPath) {
    throw new Error('usage: node scripts/deploy/release.mjs <prepare|check|switch|rollback|deploy|reconcile> --inventory inventory.json --manifest manifest.json')
  }
  const inventory = JSON.parse(readFileSync(args.inventoryPath, 'utf8'))
  const manifest = JSON.parse(readFileSync(args.manifestPath, 'utf8'))
  const report = await runReleaseCommand(args.command, {
    inventory,
    manifest,
    bootstrapCompatibilityCheck: args.bootstrapCompatibilityCheck,
  })
  console.log(JSON.stringify(report, null, 2))
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
