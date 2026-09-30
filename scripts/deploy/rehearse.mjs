#!/usr/bin/env node
import { execFile } from 'node:child_process'
import { createServer } from 'node:net'
import { createHash } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path'
import { isDeepStrictEqual, promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const DEFAULT_RPS = 5
const DEFAULT_CONCURRENCY = 4
const DEFAULT_TIMEOUT_MS = 5_000
const DEFAULT_PHASE_MS = 60_000
const DEFAULT_COMMAND_TIMEOUT_MS = 30 * 60_000
const REAL_ESTATE_TYPES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']
const REQUIRED_FAILURE_MATRIX = [
  'invalid-check',
  'city-timeout',
  'lock-busy',
  'candidate-api-down',
  'nginx-test-failure',
  'reload-failure',
  'post-pointer-orchestrator-exit',
  'smoke-failure',
  'forced-rollback',
]
const REQUIRED_RELEASE_PORTS = [13000, 13001, 13002, 13003, 13004, 18000, 18001, 18002, 18003, 18004, 19000]
const ACTIVE_BASELINE_PORTS = new Set([13000, 18000, 19000])
const REQUIRED_CANDIDATE_PORTS = REQUIRED_RELEASE_PORTS.filter((port) => !ACTIVE_BASELINE_PORTS.has(port))
const REQUIRED_RETENTION_PROBES = [
  'old-unkeyed-detail',
  'new-keyed-retention',
  'retained-old-asset',
  'retained-old-html-hash',
  'long-inflight-switch',
]
const REQUIRED_BACKEND_MARKERS = ['package.json', 'dist/server.js', 'prisma/schema.prisma']
const REQUIRED_FRONTEND_MARKERS = ['package.json', '.output/server/index.mjs', '.output/public']
const PROPERTY_TYPE_BY_REAL_ESTATE_TYPE = {
  'apt-sale': 'apt',
  'apt-rent': 'apt',
  'villa-sale': 'villa',
  'villa-rent': 'villa',
  'offitel-sale': 'offitel',
  'offitel-rent': 'offitel',
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function normalizeFailureType(type) {
  return String(type)
}

function addError(errors, type, message) {
  errors.push({ type: normalizeFailureType(type), message })
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex')
}

function assertAbsolutePath(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value)) throw new Error(`${label} must be an absolute path`)
}

function resolveFromCurrentCwd(value) {
  return isAbsolute(value) ? value : resolve(process.cwd(), value)
}

function assertPathInside(parent, child, label) {
  assertAbsolutePath(parent, `${label} parent`)
  assertAbsolutePath(child, label)
  const rel = relative(resolve(parent), resolve(child))
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return
  throw new Error(`${label} must stay under ${parent}`)
}

function assertTmpRehearsalPath(value, label) {
  assertAbsolutePath(value, label)
  const resolved = resolve(value)
  if (!resolved.startsWith('/tmp/ilsangkit-c3-')) throw new Error(`${label} must be under /tmp/ilsangkit-c3-*`)
}

function fileSha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

export function makeRehearsalBuildingKey(identity) {
  return createHash('sha256').update([
    identity.propertyType,
    identity.bjdCode,
    identity.buildingName,
    String(identity.dongName ?? '').trim(),
    String(identity.jibun ?? '').trim(),
  ].join('\x1f')).digest('hex')
}

function encodePathPart(value) {
  return encodeURIComponent(String(value).normalize('NFC'))
}

function isHashDetailPath(path) {
  const segments = String(path).split(/[?#]/, 1)[0].split('/').filter(Boolean)
  return segments.length === 6 && segments[0] === 'real-estate' && /^[a-f0-9]{64}$/i.test(segments[5] ?? '')
}

function realEstateBaseDetailPath(identity) {
  return `/real-estate/${identity.type}/${identity.citySlug}/${identity.districtSlug}/${encodePathPart(identity.buildingName)}`
}

function realEstateHashDetailPath(identity) {
  const buildingKey = identity.buildingKey ?? makeRehearsalBuildingKey(identity)
  if (!/^[a-f0-9]{64}$/.test(buildingKey)) throw new Error(`buildingKey must be 64 lowercase hex for ${identity.label ?? identity.buildingName}`)
  return `${realEstateBaseDetailPath(identity)}/${buildingKey}`
}

export function realEstateDetailPath(identity) {
  const explicitPath = identity.currentUrl ?? identity.canonicalPath ?? identity.publicUrl
  if (explicitPath && !isHashDetailPath(explicitPath)) return explicitPath
  return realEstateBaseDetailPath(identity)
}

function realEstateBuildingInfoApiPath(identity) {
  const buildingKey = identity.buildingKey ?? makeRehearsalBuildingKey(identity)
  if (!/^[a-f0-9]{64}$/.test(buildingKey)) throw new Error(`buildingKey must be 64 lowercase hex for ${identity.label ?? identity.buildingName}`)
  const type = identity.type ?? 'apt-sale'
  return `/api/real-estate/${type}/building-info?bjdCode=${encodeURIComponent(identity.bjdCode)}&buildingName=${encodeURIComponent(identity.buildingName)}&buildingKey=${encodeURIComponent(buildingKey)}`
}

function selectNuxtAsset(frontendPublicDir) {
  const nuxtDir = join(frontendPublicDir, '_nuxt')
  if (!existsSync(nuxtDir) || !statSync(nuxtDir).isDirectory()) throw new Error('frontend public _nuxt directory is required')
  const candidates = readdirSync(nuxtDir)
    .filter((name) => !name.endsWith('.gz') && !name.endsWith('.br') && /\.(js|css)$/.test(name))
    .sort()
  if (candidates.length === 0) throw new Error('no hashed _nuxt js/css asset found')
  const fileName = candidates[0]
  const path = join(nuxtDir, fileName)
  return { fileName, path, sha256: fileSha256(path), publicPath: `/_nuxt/${fileName}` }
}

function assertLocalTestDatabaseUrl(rawUrl, label = 'dbFixture.urlEnv') {
  if (!rawUrl) throw new Error(`${label} value is required`)
  let parsed
  try { parsed = new URL(rawUrl) } catch { throw new Error(`${label} must resolve to a valid MySQL URL`) }
  const databaseName = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  const localHost = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost'
  if (parsed.protocol !== 'mysql:' || !localHost || parsed.port !== '3307' || !databaseName.endsWith('_test') || databaseName.length <= '_test'.length) {
    throw new Error(`${label} must be localhost:3307 *_test MySQL`)
  }
  return rawUrl
}

function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms))
}

async function defaultCheckPortFree(port) {
  return await new Promise((resolvePromise) => {
    const server = createServer()
    server.once('error', () => resolvePromise(false))
    server.once('listening', () => server.close(() => resolvePromise(true)))
    server.listen(port, '127.0.0.1')
  })
}

function assertFullAppDirectory(root, markers, label) {
  assertAbsolutePath(root, label)
  if (!existsSync(root) || !statSync(root).isDirectory()) throw new Error(`${label} must be an existing directory`)
  for (const marker of markers) {
    const markerPath = join(root, marker)
    if (!existsSync(markerPath)) throw new Error(`${label} missing full-app marker ${marker}`)
  }
}

function unwrapJsonPayload(json) {
  if (!json || typeof json !== 'object') return {}
  const data = json.data && typeof json.data === 'object' ? json.data : undefined
  const payload = data?.items || data?.results || data?.pagination ? data : json
  return {
    releaseId: json.releaseId ?? data?.releaseId,
    addressKey: json.addressKey
      ?? json.selectedAddressKey
      ?? json.buildingKey
      ?? json.identity?.buildingKey
      ?? data?.addressKey
      ?? data?.selectedAddressKey
      ?? data?.buildingKey
      ?? data?.identity?.buildingKey
      ?? data?.building?.addressKey
      ?? data?.building?.buildingKey,
    total: json.total ?? json.pagination?.total ?? data?.total ?? data?.pagination?.total,
    items: json.items ?? json.results ?? (Array.isArray(json.data) ? json.data : undefined) ?? data?.items ?? data?.results ?? [],
  }
}

function expectedValueForRelease(map, releaseId) {
  if (!map || releaseId == null) return undefined
  return map[releaseId] ?? map[String(releaseId)]
}

function extractNuxtAssets(body) {
  if (typeof body !== 'string') return []
  return Array.from(body.matchAll(/(?:src|href)=["']([^"']*\/_nuxt\/[^"']+)["']/g)).map((match) => match[1])
}

export function createProbePlan(probes, options = {}) {
  const probeList = asArray(probes)
  if (probeList.length === 0) throw new Error('at least one probe is required')
  const rps = Number(options.rps ?? DEFAULT_RPS)
  const durationMs = Number(options.durationMs ?? 120_000)
  if (!Number.isInteger(rps) || rps < 1 || rps > DEFAULT_RPS) throw new Error('probe rps must be 1..5')
  if (!Number.isInteger(durationMs) || durationMs <= 0) throw new Error('durationMs must be positive')
  const intervalMs = Math.ceil(1_000 / rps)
  const count = Math.ceil(durationMs / intervalMs)
  return Array.from({ length: count }, (_, sequence) => ({
    sequence,
    plannedAtMs: sequence * intervalMs,
    probe: probeList[sequence % probeList.length],
  }))
}

export function classifyProbeResult(probe, result) {
  const startedAt = result.startedAt ?? new Date().toISOString()
  const errors = []
  const expect = probe.expect ?? {}
  const status = result.status ?? null

  if (result.timedOut) addError(errors, 'timeout', `${probe.name} timed out`)
  if (result.error) addError(errors, 'transport', result.error.message ?? String(result.error.code ?? result.error))
  if (result.redirectLoop) addError(errors, 'redirect', `${probe.name} entered a redirect loop`)
  if (typeof status === 'number' && status >= 500) addError(errors, 'status', `${probe.name} returned ${status}`)

  const fatalFailure = result.timedOut || result.error || result.redirectLoop || (typeof status === 'number' && status >= 500)
  if (!fatalFailure && expect.status != null && typeof status === 'number' && status !== expect.status) {
    addError(errors, 'status', `${probe.name} expected status ${expect.status}, got ${status}`)
  }
  if (!fatalFailure && expect.releaseIds != null && !asArray(expect.releaseIds).includes(result.releaseId)) {
    addError(errors, 'release', `${probe.name} expected one of releases ${asArray(expect.releaseIds).join(',')}, got ${result.releaseId ?? '(missing)'}`)
  }
  if (!fatalFailure && expect.releaseId != null && result.releaseId !== expect.releaseId) {
    addError(errors, 'release', `${probe.name} expected release ${expect.releaseId}, got ${result.releaseId ?? '(missing)'}`)
  }
  if (!fatalFailure && expect.addressKey != null && result.addressKey !== expect.addressKey) {
    addError(errors, 'address', `${probe.name} expected address ${expect.addressKey}, got ${result.addressKey ?? '(missing)'}`)
  }
  const expectedTotalForRelease = expectedValueForRelease(expect.totalByReleaseId, result.releaseId)
  const expectedTotal = expectedTotalForRelease ?? expect.total
  if (!fatalFailure && expectedTotal != null && result.total !== expectedTotal) {
    addError(errors, 'total', `${probe.name} expected total ${expectedTotal}, got ${result.total ?? '(missing)'}`)
  }
  if (!fatalFailure && expect.minItems != null && asArray(result.items).length < expect.minItems) {
    addError(errors, 'total', `${probe.name} expected at least ${expect.minItems} items, got ${asArray(result.items).length}`)
  }
  if (!fatalFailure && expect.assetStatus != null && result.assetStatus !== expect.assetStatus) {
    addError(errors, 'asset', `${probe.name} expected asset status ${expect.assetStatus}, got ${result.assetStatus ?? '(missing)'}`)
  }
  if (!fatalFailure && expect.bodyIncludes != null && !String(result.body ?? '').includes(expect.bodyIncludes)) {
    addError(errors, 'body', `${probe.name} missing body fragment`)
  }
  if (!fatalFailure && expect.oldHash != null && !asArray(result.extractedAssets).some((asset) => String(asset).includes(expect.oldHash))) {
    addError(errors, 'asset', `${probe.name} missing retained asset hash ${expect.oldHash}`)
  }
  if (!fatalFailure && expect.completedAfterCommand === true && result.startedBeforeCommand === false) {
    addError(errors, 'inflight', `${probe.name} started after the observed switch point`)
  }
  if (!fatalFailure && expect.completedAfterCommand === true && result.completedAfterCommand !== true) {
    addError(errors, 'inflight', `${probe.name} completed before the observed switch point`)
  }

  return {
    probe: probe.name,
    path: probe.path,
    plannedAtMs: result.plannedAtMs,
    startedAt,
    status,
    latencyMs: result.latencyMs ?? null,
    startedAtMs: result.startedAtMs ?? null,
    completedAtMs: result.completedAtMs ?? null,
    observedSwitchAtMs: result.observedSwitchAtMs ?? null,
    commandCompletedAtMs: result.commandCompletedAtMs ?? null,
    releaseId: result.releaseId ?? null,
    addressKey: result.addressKey ?? null,
    total: result.total ?? null,
    itemCount: Array.isArray(result.items) ? result.items.length : null,
    assetStatus: result.assetStatus ?? null,
    bodyBytes: result.bodyBytes ?? null,
    extractedAssets: asArray(result.extractedAssets),
    ok: errors.length === 0,
    errors,
  }
}

function timeoutAfter(timeoutMs, controller) {
  let timer
  const promise = new Promise((resolve) => {
    timer = setTimeout(() => {
      controller.abort()
      resolve({ timedOut: true, latencyMs: timeoutMs })
    }, timeoutMs)
  })
  return { promise, clear: () => clearTimeout(timer) }
}

export async function runProbePlan(plan, options) {
  const concurrency = Number(options.concurrency ?? DEFAULT_CONCURRENCY)
  const timeoutMs = Number(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > DEFAULT_CONCURRENCY) throw new Error('probe concurrency must be 1..4')
  if (!Number.isInteger(timeoutMs) || timeoutMs <= 0) throw new Error('timeoutMs must be positive')
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)))
  const request = options.request
  if (typeof request !== 'function') throw new Error('request function is required')

  const records = []
  let next = 0
  const startedAt = Date.now()

  async function worker() {
    while (next < plan.length) {
      const entry = plan[next]
      next += 1
      const delayMs = Math.max(0, entry.plannedAtMs - (Date.now() - startedAt))
      if (delayMs > 0) await sleep(delayMs)
      const started = Date.now()
      let result
      const controller = new AbortController()
      const requestPromise = Promise.resolve().then(() => request({ probe: entry.probe, entry, signal: controller.signal }))
      const timeout = timeoutAfter(timeoutMs, controller)
      try {
        result = await Promise.race([requestPromise, timeout.promise])
      } catch (error) {
        result = { error, latencyMs: Date.now() - started }
      } finally {
        timeout.clear()
      }
      records.push(classifyProbeResult(entry.probe, {
        ...result,
        plannedAtMs: entry.plannedAtMs,
        latencyMs: result.latencyMs ?? Date.now() - started,
      }))
      if (result?.timedOut) {
        requestPromise.catch(() => {
          // Timeout is already recorded; attach a catch so an ignored abort does
          // not produce an unhandled rejection after the scheduler has moved on.
        })
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, plan.length) }, () => worker()))
  return records.sort((a, b) => (a.plannedAtMs ?? 0) - (b.plannedAtMs ?? 0))
}

export function summarizeProbeRecords(records) {
  const failuresByType = {}
  let failed = 0
  for (const record of records) {
    if (!record.ok) failed += 1
    for (const error of record.errors) {
      failuresByType[error.type] = (failuresByType[error.type] ?? 0) + 1
    }
  }
  return {
    total: records.length,
    passed: records.length - failed,
    failed,
    failuresByType: Object.fromEntries(Object.entries(failuresByType).sort(([a], [b]) => a.localeCompare(b))),
  }
}

function probeNames(probes) {
  return new Set(asArray(probes).map((probe) => probe?.name).filter(Boolean))
}

function requireProbe(probes, name) {
  if (!probeNames(probes).has(name)) throw new Error(`missing rehearsal probe: ${name}`)
}

function validateProxyProbeCoverage(probes) {
  requireProbe(probes, 'home')
  requireProbe(probes, 'api-health')
  requireProbe(probes, 'sitemap')
  requireProbe(probes, 'same-name-address-a')
  requireProbe(probes, 'same-name-address-b')
  requireProbe(probes, 'same-name-address-a-html')
  requireProbe(probes, 'same-name-address-b-html')
  requireProbe(probes, 'same-name-address-a-hash-404')
  requireProbe(probes, 'same-name-address-b-hash-404')
  requireProbe(probes, 'land-query-a')
  requireProbe(probes, 'land-query-b')
  requireProbe(probes, 'land-query-a-html')
  requireProbe(probes, 'land-query-b-html')
  requireProbe(probes, 'hashed-asset')
  for (const name of REQUIRED_RETENTION_PROBES) requireProbe(probes, name)
  for (const type of REAL_ESTATE_TYPES) requireProbe(probes, `${type}-list`)
  for (const name of ['same-name-address-a', 'same-name-address-b']) {
    const probe = asArray(probes).find((candidate) => candidate?.name === name)
    const expects = [probe?.expect, ...Object.values(probe?.expectByPhase ?? {})]
    if (!expects.some((expect) => expect?.addressKey)) throw new Error(`${name} must assert addressKey`)
  }
  for (const name of ['same-name-address-a-html', 'same-name-address-b-html', 'new-keyed-retention']) {
    const probe = asArray(probes).find((candidate) => candidate?.name === name)
    const expects = [probe?.expect, ...Object.values(probe?.expectByPhase ?? {})]
    if (!expects.some((expect) => expect?.bodyIncludes)) throw new Error(`${name} must assert bodyIncludes`)
  }
  for (const name of ['same-name-address-a-hash-404', 'same-name-address-b-hash-404']) {
    const probe = asArray(probes).find((candidate) => candidate?.name === name)
    const expects = [probe?.expect, ...Object.values(probe?.expectByPhase ?? {})]
    if (!expects.some((expect) => expect?.status === 404)) throw new Error(`${name} must assert hash detail URL 404`)
  }
  const assetProbe = asArray(probes).find((candidate) => candidate?.name === 'hashed-asset')
  const assetExpects = [assetProbe?.expect, ...Object.values(assetProbe?.expectByPhase ?? {})]
  if (!assetExpects.some((expect) => expect?.assetStatus === 200)) throw new Error('hashed-asset probe must assert assetStatus 200')
  const retainedAssetProbe = asArray(probes).find((candidate) => candidate?.name === 'retained-old-asset')
  const retainedAssetExpects = [retainedAssetProbe?.expect, ...Object.values(retainedAssetProbe?.expectByPhase ?? {})]
  if (!retainedAssetExpects.some((expect) => expect?.assetStatus === 200)) throw new Error('retained-old-asset probe must assert assetStatus 200')
  const oldHtmlProbe = asArray(probes).find((candidate) => candidate?.name === 'retained-old-html-hash')
  const oldHtmlExpects = [oldHtmlProbe?.expect, ...Object.values(oldHtmlProbe?.expectByPhase ?? {})]
  if (!oldHtmlExpects.some((expect) => expect?.oldHash)) throw new Error('retained-old-html-hash probe must assert oldHash')
  const inflightProbe = asArray(probes).find((candidate) => candidate?.name === 'long-inflight-switch')
  const inflightExpects = [inflightProbe?.expect, ...Object.values(inflightProbe?.expectByPhase ?? {})]
  if (inflightProbe?.longInflight !== true || !inflightExpects.some((expect) => expect?.completedAfterCommand === true)) {
    throw new Error('long-inflight-switch probe must assert completedAfterCommand')
  }
}

function validateFailureMatrix(failureMatrix) {
  const cases = asArray(failureMatrix)
  const names = probeNames(cases)
  for (const name of REQUIRED_FAILURE_MATRIX) {
    if (!names.has(name)) throw new Error(`missing failure matrix case: ${name}`)
  }
  for (const failure of cases) {
    if (!failure?.command) throw new Error(`failure matrix case ${failure?.name ?? '(unknown)'} requires executable command`)
    if (!Array.isArray(failure.args)) throw new Error(`failure matrix case ${failure.name} requires args array`)
    if (failure.expectCommandFailure !== false && failure.expectedExitCode == null && !failure.expectedErrorPattern && !failure.expectedReport) {
      throw new Error(`failure matrix case ${failure.name} must assert expectedExitCode, expectedErrorPattern, or expectedReport`)
    }
  }
}

function validateNormalDeploys(normalDeploys) {
  const deployments = asArray(normalDeploys)
  if (deployments.length < 2) throw new Error('at least two normal deploy rehearsals are required')
  deployments.forEach((deploy, index) => {
    if (deploy.expectSummaryPrepareCalls !== 0) throw new Error(`normal deploy ${index + 1} must assert zero summary prepare calls`)
    if (deploy.expectAssetDeleteCalls !== 0) throw new Error(`normal deploy ${index + 1} must assert zero asset delete calls`)
  })
}

function validateRetention(retention) {
  if (!retention?.rollbackReleaseId) throw new Error('retention.rollbackReleaseId is required')
  if (!retention?.oldUnkeyedUrl || !retention?.newKeyedUrl) throw new Error('retention must include oldUnkeyedUrl and newKeyedUrl')
  if (!retention?.oldAssetPath || !retention?.oldAssetHash) throw new Error('retention must include oldAssetPath and oldAssetHash')
  if (!retention?.longInflightUrl) throw new Error('retention.longInflightUrl is required')
  if (retention.expectOldAssetsStatus !== 200) throw new Error('retention must assert old assets status 200')
  if (retention.expectRollbackReadable !== true) throw new Error('retention must assert rollback readability')
}

function validateDbFixture(dbFixture) {
  if (!dbFixture?.urlEnv) throw new Error('dbFixture.urlEnv is required')
  if (!String(dbFixture.urlEnv).includes('TEST')) throw new Error('dbFixture.urlEnv must point to a test database env var')
  if (!Array.isArray(dbFixture.requiredTables) || dbFixture.requiredTables.length === 0) throw new Error('dbFixture.requiredTables is required')
  for (const table of ['RealEstateBuildingSummaryV2', 'RealEstateSummaryState']) {
    if (!dbFixture.requiredTables.includes(table)) throw new Error(`dbFixture.requiredTables must include ${table}`)
  }
}



function requiredSeedIdentity(seedReport, label) {
  const identity = asArray(seedReport?.sameNameBuildings).find((item) => item.label === label || item.label === `address-${label}`)
    ?? seedReport?.sameNameBuildings?.[label]
    ?? seedReport?.sameNameBuildings?.[`address-${label}`]
    ?? seedReport?.urls?.realEstateDetails?.['apt-sale']?.[label === 'a' ? 0 : 1]
  if (!identity) throw new Error(`seed report missing sameNameBuildings.${label}`)
  const type = identity.type ?? 'apt-sale'
  const propertyType = identity.propertyType ?? PROPERTY_TYPE_BY_REAL_ESTATE_TYPE[type]
  const enriched = {
    citySlug: 'seoul',
    districtSlug: 'gangnam',
    buildingName: 'C3공통주택',
    bjdCode: '1168010100',
    dongName: '역삼동',
    jibun: label === 'a' ? '101-1' : '202-2',
    ...identity,
    type,
    propertyType,
  }
  for (const key of ['citySlug', 'districtSlug', 'buildingName', 'bjdCode', 'dongName']) {
    if (!enriched[key]) throw new Error(`seed identity ${label} missing ${key}`)
  }
  enriched.buildingKey ??= makeRehearsalBuildingKey(enriched)
  return enriched
}

export function generateRehearsalProbes(seedReport, artifactInfo = {}, options = {}) {
  const releaseIds = {
    old: seedReport?.releaseIds?.old ?? 'old-main',
    compatibility: seedReport?.releaseIds?.compatibility ?? 'compat-a',
    address: seedReport?.releaseIds?.address ?? 'address-a',
  }
  const addressA = requiredSeedIdentity(seedReport, 'a')
  const addressB = requiredSeedIdentity(seedReport, 'b')
  const asset = artifactInfo.asset ?? seedReport?.asset
  if (!asset?.publicPath) throw new Error('real hashed asset publicPath is required')
  const oldAsset = artifactInfo.oldAsset ?? seedReport?.oldAsset ?? asset
  if (!oldAsset?.publicPath || !oldAsset?.sha256) throw new Error('retained old asset publicPath and sha256 are required')
  const oldAssetHashFragment = oldAsset.hashFragment ?? basename(oldAsset.publicPath).split('.')[0]
  const listTotals = seedReport?.listTotals ?? seedReport?.modeCounts?.expectedAddressSummaryV2 ?? {}
  const legacyListTotals = seedReport?.legacyListTotals ?? seedReport?.modeCounts?.legacySummary ?? {}
  const listApiPaths = seedReport?.urls?.realEstateListApis ?? {}
  const listHtmlPaths = seedReport?.urls?.realEstateLists ?? {}
  const listRegion = seedReport?.listRegion ?? {}
  const listCity = listRegion.city ?? listRegion.cityName ?? '서울특별시'
  const listDistrict = listRegion.district ?? listRegion.districtName ?? '강남구'
  const listCitySlug = listRegion.citySlug ?? 'seoul'
  const listDistrictSlug = listRegion.districtSlug ?? 'gangnam'
  const listApiPath = (type) => listApiPaths[type] ?? `/api/real-estate/${type}/complexes?city=${encodeURIComponent(listCity)}&district=${encodeURIComponent(listDistrict)}&page=1&limit=20`
  const listHtmlPath = (type) => listHtmlPaths[type] ?? `/real-estate/${type}/${listCitySlug}/${listDistrictSlug}`
  const listTotalExpectByPhase = (type) => {
    const legacyTotal = legacyListTotals[type] ?? 1
    const addressTotal = listTotals[type] ?? legacyTotal
    return {
      'old-baseline': { status: 200, total: legacyTotal, minItems: 1, releaseId: releaseIds.old },
      'first-transition-schema-prepare-check-switch': { status: 200, totalByReleaseId: { [releaseIds.old]: legacyTotal, [releaseIds.address]: addressTotal }, minItems: 1, releaseIds: [releaseIds.old, releaseIds.address] },
      'post-switch-address': { status: 200, total: addressTotal, minItems: 1, releaseId: releaseIds.address },
      'rollback-transition': { status: 200, totalByReleaseId: { [releaseIds.address]: addressTotal, [releaseIds.compatibility]: legacyTotal }, minItems: 1, releaseIds: [releaseIds.address, releaseIds.compatibility] },
      'rollback-retention': { status: 200, total: legacyTotal, minItems: 1, releaseId: releaseIds.compatibility },
    }
  }
  const landApiPath = (keyword) => `/api/real-estate/land/transactions?bjdCode=${encodeURIComponent(seedReport?.land?.bjdCode ?? '1168010100')}&dongName=${encodeURIComponent(seedReport?.land?.dongName ?? '역삼동')}&limit=10&page=1&keyword=${encodeURIComponent(keyword)}`
  const landHtmlPath = (queryName, fallbackKeyword) => seedReport?.urls?.land?.[queryName] ?? `/real-estate/land/${listCitySlug}/${listDistrictSlug}/${encodePathPart(seedReport?.land?.dongName ?? '역삼동')}?q=${encodeURIComponent(fallbackKeyword)}`
  const landQueryKeyword = (queryName, fallbackKeyword) => {
    const explicit = seedReport?.urls?.land?.[`${queryName}Api`] ?? seedReport?.land?.[`${queryName}ApiPath`]
    if (explicit) return fallbackKeyword
    const rawPath = landHtmlPath(queryName, fallbackKeyword)
    try {
      return new URL(rawPath, 'http://release-probe.local').searchParams.get('q') ?? fallbackKeyword
    } catch {
      return fallbackKeyword
    }
  }
  const landApiProbePath = (queryName, fallbackKeyword) => seedReport?.urls?.land?.[`${queryName}Api`] ?? seedReport?.land?.[`${queryName}ApiPath`] ?? landApiPath(landQueryKeyword(queryName, fallbackKeyword))
  const landTotalExpectByPhase = (keyword) => {
    const legacyTotal = seedReport?.land?.legacyQueryTotal ?? seedReport?.modeCounts?.landTransactions ?? seedReport?.land?.total ?? 24
    const filteredTotal = seedReport?.urls?.land?.queryTotal ?? seedReport?.land?.queryTotal ?? 12
    return {
      'old-baseline': { status: 200, total: legacyTotal, minItems: 1, releaseId: releaseIds.old },
      'first-transition-schema-prepare-check-switch': { status: 200, totalByReleaseId: { [releaseIds.old]: legacyTotal, [releaseIds.address]: filteredTotal }, minItems: 1, releaseIds: [releaseIds.old, releaseIds.address] },
      'post-switch-address': { status: 200, total: filteredTotal, minItems: 1, releaseId: releaseIds.address },
      'rollback-transition': { status: 200, totalByReleaseId: { [releaseIds.address]: filteredTotal, [releaseIds.compatibility]: filteredTotal }, minItems: 1, releaseIds: [releaseIds.address, releaseIds.compatibility] },
      'rollback-retention': { status: 200, total: filteredTotal, minItems: 1, releaseId: releaseIds.compatibility },
    }
  }
  const phaseExpect = (common = {}) => ({
    'old-baseline': { ...common, releaseId: releaseIds.old },
    'first-transition-schema-prepare-check-switch': { ...common, releaseIds: [releaseIds.old, releaseIds.address] },
    'post-switch-address': { ...common, releaseId: releaseIds.address },
    'rollback-transition': { ...common, releaseIds: [releaseIds.address, releaseIds.compatibility] },
    'rollback-retention': { ...common, releaseId: releaseIds.compatibility },
  })
  const keyedDetailPhaseExpect = (common = {}) => ({
    'post-switch-address': { ...common, releaseId: releaseIds.address },
    'rollback-transition': { ...common, releaseIds: [releaseIds.address, releaseIds.compatibility] },
    'rollback-retention': { ...common, releaseId: releaseIds.compatibility },
  })
  const landHtmlExpectByPhase = phaseExpect({ status: 200, bodyIncludes: options.landBodyIncludes ?? '토지' })
  const detailA = seedReport?.urls?.realEstateDetails?.['apt-sale']?.[0]
  const addressADetailPath = realEstateDetailPath(addressA)
  const addressBDetailPath = realEstateDetailPath(addressB)
  const addressAHashPath = realEstateHashDetailPath(addressA)
  const addressBHashPath = realEstateHashDetailPath(addressB)
  const oldUnkeyedUrl = seedReport?.retention?.oldUnkeyedUrl ?? seedReport?.urls?.retention?.oldUnkeyedUrl ?? detailA?.oldReleaseUrl ?? detailA?.url ?? `/real-estate/${addressA.type}/${addressA.citySlug}/${addressA.districtSlug}/${encodePathPart(addressA.buildingName)}`
  const newKeyedUrl = seedReport?.retention?.newKeyedUrl && !isHashDetailPath(seedReport.retention.newKeyedUrl) ? seedReport.retention.newKeyedUrl : detailA?.currentUrl && !isHashDetailPath(detailA.currentUrl) ? detailA.currentUrl : addressADetailPath
  const retainedOldHtmlUrl = options.capturedOldHtmlPath ?? seedReport?.retention?.capturedOldHtmlPath ?? oldUnkeyedUrl
  const longInflightUrl = seedReport?.retention?.longInflightUrl ?? seedReport?.urls?.health ?? '/api/health?release-rehearsal-slow=1'
  return [
    { name: 'home', path: '/', expectByPhase: phaseExpect({ status: 200, bodyIncludes: options.homeBodyIncludes ?? '일상킷' }) },
    { name: 'api-health', path: '/api/health', expectByPhase: phaseExpect({ status: 200 }) },
    { name: 'sitemap', path: '/sitemap.xml', expectByPhase: phaseExpect({ status: 200 }) },
    { name: 'same-name-address-a', path: realEstateBuildingInfoApiPath(addressA), expectByPhase: keyedDetailPhaseExpect({ status: 200, addressKey: addressA.buildingKey }) },
    { name: 'same-name-address-b', path: realEstateBuildingInfoApiPath(addressB), expectByPhase: keyedDetailPhaseExpect({ status: 200, addressKey: addressB.buildingKey }) },
    { name: 'same-name-address-a-html', path: addressADetailPath, expectByPhase: keyedDetailPhaseExpect({ status: 200, bodyIncludes: addressA.buildingKey }) },
    { name: 'same-name-address-b-html', path: addressBDetailPath, expectByPhase: keyedDetailPhaseExpect({ status: 200, bodyIncludes: addressB.buildingKey }) },
    { name: 'same-name-address-a-hash-404', path: addressAHashPath, expectByPhase: keyedDetailPhaseExpect({ status: 404 }) },
    { name: 'same-name-address-b-hash-404', path: addressBHashPath, expectByPhase: keyedDetailPhaseExpect({ status: 404 }) },
    { name: 'land-query-a', path: landApiProbePath('queryA', 'A'), expectByPhase: landTotalExpectByPhase(landQueryKeyword('queryA', 'A')) },
    { name: 'land-query-b', path: landApiProbePath('queryB', 'B'), expectByPhase: landTotalExpectByPhase(landQueryKeyword('queryB', 'B')) },
    { name: 'land-query-a-html', path: landHtmlPath('queryA', 'A'), expectByPhase: landHtmlExpectByPhase },
    { name: 'land-query-b-html', path: landHtmlPath('queryB', 'B'), expectByPhase: landHtmlExpectByPhase },
    { name: 'hashed-asset', path: asset.publicPath, pathByPhase: { 'old-baseline': oldAsset.publicPath }, expectByPhase: phaseExpect({ status: 200, assetStatus: 200 }) },
    { name: 'old-unkeyed-detail', path: oldUnkeyedUrl, expectByPhase: { 'old-baseline': { status: 200, releaseId: releaseIds.old }, 'rollback-transition': { status: 200, releaseIds: [releaseIds.address, releaseIds.compatibility] }, 'rollback-retention': { status: 200, releaseId: releaseIds.compatibility } } },
    { name: 'new-keyed-retention', path: newKeyedUrl, expectByPhase: { 'post-switch-address': { status: 200, releaseId: releaseIds.address, bodyIncludes: addressA.buildingKey }, 'rollback-transition': { status: 200, releaseIds: [releaseIds.address, releaseIds.compatibility], bodyIncludes: addressA.buildingKey }, 'rollback-retention': { status: 200, releaseId: releaseIds.compatibility, bodyIncludes: addressA.buildingKey } } },
    { name: 'retained-old-asset', path: oldAsset.publicPath, expectByPhase: { 'post-switch-address': { status: 200, releaseId: releaseIds.address, assetStatus: 200 }, 'rollback-transition': { status: 200, releaseIds: [releaseIds.address, releaseIds.compatibility], assetStatus: 200 }, 'rollback-retention': { status: 200, releaseId: releaseIds.compatibility, assetStatus: 200 } } },
    { name: 'retained-old-html-hash', path: retainedOldHtmlUrl, extractAsset: true, expectByPhase: { 'post-switch-address': { status: 200, releaseId: releaseIds.address, oldHash: oldAssetHashFragment }, 'rollback-transition': { status: 200, releaseIds: [releaseIds.address, releaseIds.compatibility], oldHash: oldAssetHashFragment }, 'rollback-retention': { status: 200, releaseId: releaseIds.compatibility, oldHash: oldAssetHashFragment } } },
    { name: 'long-inflight-switch', path: longInflightUrl, longInflight: true, expectByPhase: { 'first-transition-schema-prepare-check-switch': { status: 200, releaseId: releaseIds.old, completedAfterCommand: true } } },
    ...REAL_ESTATE_TYPES.flatMap((type) => ([
      {
        name: `${type}-html-list`,
        path: listHtmlPath(type),
        expectByPhase: phaseExpect({ status: 200, bodyIncludes: options.listBodyIncludes ?? 'C3공통주택' }),
      },
      {
        name: `${type}-list`,
        path: listApiPath(type),
        expectByPhase: listTotalExpectByPhase(type),
      },
    ])),
  ]
}

function materializePhaseExpect(probe, phaseName) {
  const phaseExpect = probe.expectByPhase?.[phaseName] ?? probe.expect
  const phasePath = probe.pathByPhase?.[phaseName] ?? probe.path
  return phaseExpect ? { ...probe, path: phasePath, expect: phaseExpect } : { ...probe, path: phasePath }
}

export function generateFinalRehearsalInventory(baseInventory, seedReport, artifacts, options = {}) {
  const frontendPublicDir = options.frontendPublicDir ?? join(baseInventory.artifactSources.frontend, '.output/public')
  const asset = selectNuxtAsset(frontendPublicDir)
  return {
    ...baseInventory,
    probes: generateRehearsalProbes(seedReport, { asset, oldAsset: options.oldAsset ?? seedReport.oldAsset ?? asset }, options),
    releaseIds: seedReport.releaseIds,
    selectedAsset: asset,
    retention: {
      ...baseInventory.retention,
      rollbackReleaseId: seedReport.releaseIds?.compatibility ?? baseInventory.retention?.rollbackReleaseId,
      oldUnkeyedUrl: seedReport?.retention?.oldUnkeyedUrl ?? seedReport?.urls?.retention?.oldUnkeyedUrl ?? seedReport?.urls?.realEstateDetails?.['apt-sale']?.[0]?.oldReleaseUrl ?? seedReport?.urls?.realEstateDetails?.['apt-sale']?.[0]?.url ?? baseInventory.retention?.oldUnkeyedUrl,
      newKeyedUrl: seedReport?.retention?.newKeyedUrl ?? seedReport?.urls?.realEstateDetails?.['apt-sale']?.[0]?.currentUrl ?? realEstateDetailPath(requiredSeedIdentity(seedReport, 'a')),
      oldAssetPath: (options.oldAsset ?? seedReport.oldAsset ?? asset).publicPath,
      oldAssetHash: (options.oldAsset ?? seedReport.oldAsset ?? asset).sha256,
      longInflightUrl: seedReport?.retention?.longInflightUrl ?? seedReport?.urls?.health ?? '/api/health?release-rehearsal-slow=1',
      expectOldAssetsStatus: 200,
      expectRollbackReadable: true,
    },
    artifacts,
  }
}

export function prepareRuntimeAdapterFiles(inventory, options = {}) {
  const root = inventory.deployRoot
  assertTmpRehearsalPath(root, 'deployRoot')
  const nginxDir = join(root, 'nginx')
  const pm2Home = options.pm2Home ?? join(root, 'pm2')
  const proxyPort = Number(inventory.proxyPort ?? 19000)
  const configPath = join(nginxDir, 'docker-nginx.conf')
  const runnerPath = join(root, 'run-docker-nginx.sh')
  mkdirSync(nginxDir, { recursive: true })
  mkdirSync(pm2Home, { recursive: true })
  const config = `events {}
http {
  include /etc/nginx/mime.types;
  include ${inventory.nginxIncludePath};
  server {
    listen ${proxyPort};
    location = /__c3/slow-home {
      proxy_pass http://ilsangkit_release_web/_nuxt/2Px6S9w4.js;
      proxy_buffering off;
      limit_rate 4096;
    }
    location /api/ { proxy_pass http://ilsangkit_release_api; }
    location / { proxy_pass http://ilsangkit_release_web; }
  }
}
`
  writeFileSync(configPath, config)
  writeFileSync(runnerPath, `#!/usr/bin/env bash\nset -euo pipefail\ndocker run --rm --add-host=host.docker.internal:host-gateway -p 127.0.0.1:${proxyPort}:${proxyPort} -v ${nginxDir}:/etc/nginx/conf.d:ro nginx:1.28-alpine nginx -c /etc/nginx/conf.d/docker-nginx.conf\n`)
  return { nginxConfigPath: configPath, dockerCommandPath: runnerPath, pm2Home, proxyPort }
}

export async function validateRuntimePreflight(inventory, options = {}) {
  validateRehearsalInventory(inventory)
  const env = options.env ?? process.env
  assertTmpRehearsalPath(inventory.deployRoot, 'deployRoot')
  assertPathInside(inventory.deployRoot, inventory.releasesRoot, 'releasesRoot')
  assertPathInside(inventory.deployRoot, inventory.nginxConfigPath, 'nginxConfigPath')
  assertPathInside(inventory.deployRoot, inventory.nginxIncludePath, 'nginxIncludePath')
  const reservePorts = asArray(inventory.reservePorts).map(Number).sort((a, b) => a - b)
  for (const port of REQUIRED_RELEASE_PORTS) {
    if (!reservePorts.includes(port)) throw new Error(`reservePorts must include ${port}`)
  }
  const dbUrl = env[inventory.dbFixture.urlEnv]
  assertLocalTestDatabaseUrl(dbUrl, inventory.dbFixture.urlEnv)
  const checkPortFree = options.checkPortFree ?? defaultCheckPortFree
  const proxyPort = Number(inventory.proxyPort ?? 19000)
  const activePorts = new Set([13000, 18000, proxyPort])
  const candidatePorts = REQUIRED_RELEASE_PORTS.filter((port) => !activePorts.has(port))
  const busyPorts = []
  for (const port of candidatePorts) {
    if (!await checkPortFree(port)) busyPorts.push(port)
  }
  if (busyPorts.length > 0) throw new Error(`reserved rehearsal candidate ports are busy: ${busyPorts.join(',')}`)
  return { ok: true, checkedPorts: candidatePorts, proxyPort, dbUrlEnv: inventory.dbFixture.urlEnv, deployRoot: inventory.deployRoot }
}

export async function prepareRehearsalArtifacts(inventory, options = {}) {
  const artifactRoot = options.artifactRoot ?? join(inventory.deployRoot, 'artifacts')
  assertPathInside(inventory.deployRoot, artifactRoot, 'artifactRoot')
  const sources = inventory.artifactSources ?? {}
  assertFullAppDirectory(sources.backend, REQUIRED_BACKEND_MARKERS, 'artifactSources.backend')
  assertFullAppDirectory(sources.frontend, REQUIRED_FRONTEND_MARKERS, 'artifactSources.frontend')
  mkdirSync(artifactRoot, { recursive: true })
  const backendTar = join(artifactRoot, `${basename(sources.backend)}.tar.gz`)
  const frontendTar = join(artifactRoot, `${basename(sources.frontend)}.tar.gz`)
  const runner = options.runner
  const run = runner?.run ?? (async (command, args, runOptions) => execFileAsync(command, args, runOptions))
  await run('tar', ['-czf', backendTar, '-C', sources.backend, '.'])
  await run('tar', ['-czf', frontendTar, '-C', sources.frontend, '.'])
  return {
    backendArtifact: { path: backendTar, sha256: fileSha256(backendTar), target: 'backend' },
    frontendArtifact: { path: frontendTar, sha256: fileSha256(frontendTar), target: 'frontend' },
  }
}

export function validateRehearsalInventory(inventory) {
  if (!inventory || typeof inventory !== 'object') throw new Error('inventory is required')
  const errors = []
  try { validateProxyProbeCoverage(inventory.probes) } catch (error) { errors.push(error.message) }
  try { validateFailureMatrix(inventory.failureMatrix) } catch (error) { errors.push(error.message) }
  try { validateNormalDeploys(inventory.normalDeploys) } catch (error) { errors.push(error.message) }
  try { validateRetention(inventory.retention) } catch (error) { errors.push(error.message) }
  try { validateDbFixture(inventory.dbFixture) } catch (error) { errors.push(error.message) }
  if (!inventory.releaseScriptPath) errors.push('releaseScriptPath is required')
  if (!inventory.summaryTransitionScriptPath) errors.push('summaryTransitionScriptPath is required')
  if (!inventory.inventoryPath) errors.push('inventoryPath is required')
  if (inventory.rehearsalInventoryPath && !isAbsolute(inventory.rehearsalInventoryPath)) errors.push('rehearsalInventoryPath must be an absolute path')
  if (!inventory.manifestPath) errors.push('manifestPath is required')
  if (inventory.compatibilityManifestPath && !isAbsolute(inventory.compatibilityManifestPath)) errors.push('compatibilityManifestPath must be an absolute path')
  if (!inventory.urlBaselinePath) errors.push('urlBaselinePath is required')
  else if (!isAbsolute(inventory.urlBaselinePath)) errors.push('urlBaselinePath must be an absolute path')
  if (!inventory.expectedUrlFingerprint) errors.push('expectedUrlFingerprint is required')
  if (!inventory.expectedUrlPlanFingerprint) errors.push('expectedUrlPlanFingerprint is required')
  if (inventory.summaryTransitionReportPath && !isAbsolute(inventory.summaryTransitionReportPath)) errors.push('summaryTransitionReportPath must be an absolute path')
  if (inventory.summaryTransitionCwd && !isAbsolute(inventory.summaryTransitionCwd)) errors.push('summaryTransitionCwd must be an absolute path')
  if (errors.length > 0) throw new Error(errors.join('\n'))
  return true
}

export function buildRuntimePlan(inventory, options = {}) {
  validateRehearsalInventory(inventory)
  const phaseDurationMs = Number(options.phaseDurationMs ?? inventory.phaseDurationMs ?? DEFAULT_PHASE_MS)
  const continuousProbes = asArray(inventory.probes)
  const continuousPhases = [
    { name: 'old-baseline', durationMs: phaseDurationMs, command: null },
    { name: 'first-transition-schema-prepare-check-switch', durationMs: phaseDurationMs, command: 'summary-transition' },
    { name: 'post-switch-address', durationMs: phaseDurationMs, command: null },
    { name: 'rollback-transition', durationMs: phaseDurationMs, command: 'release-rollback' },
    { name: 'rollback-retention', durationMs: phaseDurationMs, command: null },
  ].map((phase) => ({
    ...phase,
    rps: DEFAULT_RPS,
    concurrency: DEFAULT_CONCURRENCY,
    probeCount: createProbePlan(continuousProbes, { durationMs: phase.durationMs, rps: DEFAULT_RPS }).length,
  }))
  const normalDeployCommands = asArray(inventory.normalDeploys).map((deploy, index) => ({
    name: deploy.name ?? `normal-deploy-${index + 1}`,
    command: 'release-deploy',
    manifestPath: deploy.manifestPath ?? inventory.manifestPath,
    expectSummaryPrepareCalls: deploy.expectSummaryPrepareCalls,
    expectAssetDeleteCalls: deploy.expectAssetDeleteCalls,
  }))
  return {
    ready: false,
    stage: 'guarded-runtime-plan',
    execute: Boolean(options.execute),
    inputHash: sha256(stableJson({ inventoryPath: inventory.inventoryPath, manifestPath: inventory.manifestPath, probes: continuousProbes.map((probe) => probe.name) })),
    preparedRuntimeCommand: `node scripts/deploy/rehearse.mjs --inventory=${inventory.rehearsalInventoryPath ?? inventory.inventoryPath} --report=/absolute/path/to/c3-rehearsal-report.json --execute`,
    releaseScriptPath: inventory.releaseScriptPath,
    summaryTransitionScriptPath: inventory.summaryTransitionScriptPath,
    inventoryPath: inventory.inventoryPath,
    manifestPath: inventory.manifestPath,
    dbFixture: inventory.dbFixture,
    deployRoot: inventory.deployRoot,
    reservePorts: inventory.reservePorts,
    artifactSources: inventory.artifactSources ?? null,
    continuousPhases,
    failureMatrix: asArray(inventory.failureMatrix).map((failure) => ({
      name: failure.name,
      command: failure.command,
      args: asArray(failure.args),
      setupCommand: failure.setupCommand,
      setupArgs: asArray(failure.setupArgs),
      teardownCommand: failure.teardownCommand,
      teardownArgs: asArray(failure.teardownArgs),
      probePhase: failure.probePhase ?? 'rollback-retention',
      expectedOutcome: failure.expectedOutcome ?? 'previous-service-remains-readable',
      expectCommandFailure: failure.expectCommandFailure !== false,
    })),
    normalDeploys: normalDeployCommands,
    retention: inventory.retention,
    prerequisites: [
      'B4 and C2 reviews approved',
      'candidate ports 13001-13004 and 18001-18004 free; old ports 13000/18000 and proxy 19000 may already be active',
      'dedicated test DB from dbFixture.urlEnv exists and passes guard',
      'release artifacts and manifests contain rollback/keyed URL metadata',
      'x-ilsangkit-release-id header is emitted by release backend/frontend path',
      'failureMatrix entries include executable local injection commands; runner hooks are test-only',
    ],
  }
}

function resolveProbeUrl(probe, options = {}) {
  const raw = probe.url ?? probe.path
  if (/^https?:\/\//.test(String(raw))) return raw
  const baseUrl = options.baseUrl ?? options.publicOrigin
  if (!baseUrl) throw new Error(`probe ${probe.name} requires absolute url or baseUrl`)
  return new URL(String(raw).startsWith('/') ? raw : `/${raw}`, baseUrl).toString()
}

async function requestProbe({ probe, signal, fetchImpl, baseUrl }) {
  const started = Date.now()
  const response = await fetchImpl(resolveProbeUrl(probe, { baseUrl }), { signal })
  let body
  let bodyBytes
  let json
  const contentType = response.headers?.get?.('content-type') ?? ''
  const shouldKeepBody = probe.longInflight === true || probe.expect?.bodyIncludes || probe.expect?.oldHash || probe.extractAsset
  const text = await response.text()
  bodyBytes = Buffer.byteLength(text)
  if (shouldKeepBody) body = text
  if (contentType.includes('application/json')) {
    try { json = JSON.parse(text) } catch { json = undefined }
  }
  const unwrapped = unwrapJsonPayload(json)
  const releaseId = response.headers?.get?.('x-ilsangkit-release-id') ?? unwrapped.releaseId
  return {
    status: response.status,
    latencyMs: Date.now() - started,
    releaseId,
    addressKey: unwrapped.addressKey,
    total: unwrapped.total,
    items: unwrapped.items,
    assetStatus: probe.expect?.assetStatus != null ? response.status : probe.assetStatus,
    body,
    bodyBytes,
    extractedAssets: extractNuxtAssets(body),
  }
}

export async function runContinuousProbePhase(phase, probes, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const materializedProbes = asArray(probes)
    .filter((probe) => probe?.longInflight !== true)
    .filter((probe) => probe?.expect || probe?.expectByPhase?.[phase.name])
    .map((probe) => materializePhaseExpect(probe, phase.name))
  const probeOffset = materializedProbes.length === 0 ? 0 : Number(options.probeOffset ?? 0) % materializedProbes.length
  const phaseProbes = [...materializedProbes.slice(probeOffset), ...materializedProbes.slice(0, probeOffset)]
  const plan = createProbePlan(phaseProbes, { durationMs: phase.durationMs, rps: phase.rps ?? DEFAULT_RPS })
  const records = await runProbePlan(plan, {
    concurrency: phase.concurrency ?? DEFAULT_CONCURRENCY,
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    request: ({ probe, signal }) => requestProbe({ probe, signal, fetchImpl, baseUrl: options.baseUrl ?? options.publicOrigin }),
  })
  return { phase: phase.name, records, summary: summarizeProbeRecords(records) }
}

export function parseCommandOutput(stdout, fallback) {
  const text = String(stdout ?? '').trim()
  if (!text) return fallback
  try { return JSON.parse(text) } catch {}
  const jsonLine = text.split(/\r?\n/).reverse().find((line) => {
    const trimmed = line.trim()
    return trimmed.startsWith('{') && trimmed.endsWith('}')
  })
  if (jsonLine) {
    try { return JSON.parse(jsonLine) } catch {}
  }
  return { ...fallback, stdout: text }
}

async function runCommand(command, args, options = {}) {
  const runner = options.runner
  if (runner?.run) return await runner.run(command, args, options)
  const commandTimeoutMs = Number(options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS)
  const { stdout } = await execFileAsync(command, args, {
    env: options.env,
    cwd: options.cwd,
    timeout: commandTimeoutMs,
    killSignal: 'SIGTERM',
  })
  return parseCommandOutput(stdout, { command, args })
}

function createCommandTimeoutError(timeoutMs) {
  const error = new Error(`command timed out after ${timeoutMs}ms`)
  error.code = 'C3_COMMAND_TIMEOUT'
  return error
}

function readPathIdentity(path) {
  try {
    const stat = lstatSync(path)
    if (stat.isSymbolicLink()) return `link:${readlinkSync(path)}`
    if (stat.isFile()) return `file:${fileSha256(path)}`
    return `${stat.dev}:${stat.ino}:${stat.mtimeMs}`
  } catch (error) {
    if (error?.code === 'ENOENT') return 'missing'
    throw error
  }
}

export function observePathSwitch(commandPromise, path, options = {}) {
  if (!path) return commandPromise
  const tracker = createCommandTracker(commandPromise, options)
  const initialIdentity = readPathIdentity(path)
  let switchedAtMs
  const intervalMs = Number(options.switchPollIntervalMs ?? 20)
  const timer = setInterval(() => {
    if (switchedAtMs != null) return
    if (readPathIdentity(path) !== initialIdentity) switchedAtMs = Date.now()
  }, intervalMs)
  const outcome = tracker.outcome.then((result) => {
    clearInterval(timer)
    if (switchedAtMs == null && readPathIdentity(path) !== initialIdentity) switchedAtMs = Date.now()
    return switchedAtMs == null ? result : { ...result, switchedAtMs }
  }, (error) => {
    clearInterval(timer)
    throw error
  })
  return { outcome }
}

function createCommandTracker(commandPromise, options = {}) {
  if (commandPromise?.outcome && typeof commandPromise.outcome.then === 'function') return commandPromise
  const timeoutMs = Number(options.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS)
  let timeout
  const originalOutcome = Promise.resolve(commandPromise).then(
    (value) => ({ ok: true, value, completedAt: Date.now() }),
    (error) => ({ ok: false, error, completedAt: Date.now() }),
  )
  const timeoutOutcome = new Promise((resolve) => {
    timeout = setTimeout(() => {
      resolve({ ok: false, error: createCommandTimeoutError(timeoutMs), timedOut: true, completedAt: Date.now() })
    }, timeoutMs)
  })
  const outcome = Promise.race([originalOutcome, timeoutOutcome]).then((result) => {
    clearTimeout(timeout)
    return result
  })
  return { outcome }
}

function mergeProbeResults(results, phaseName) {
  const records = results.flatMap((result) => result.records)
  return { phase: phaseName, records, summary: summarizeProbeRecords(records) }
}

async function waitForLongInflightStartSignal(commandTracker, options = {}) {
  const signalPath = options.longInflightStartSignalPath
  if (!signalPath) return { reason: 'immediate' }
  const initialIdentity = readPathIdentity(signalPath)
  const intervalMs = Number(options.longInflightStartPollIntervalMs ?? 20)
  return await new Promise((resolve) => {
    const timer = setInterval(() => {
      if (readPathIdentity(signalPath) !== initialIdentity) {
        clearInterval(timer)
        resolve({ reason: 'path-changed', path: signalPath, startedAtMs: Date.now() })
      }
    }, intervalMs)
    commandTracker.outcome.then((outcome) => {
      clearInterval(timer)
      resolve({ reason: 'command-finished', path: signalPath, outcome, startedAtMs: Date.now() })
    }, () => {
      clearInterval(timer)
      resolve({ reason: 'command-failed', path: signalPath, startedAtMs: Date.now() })
    })
  })
}

export async function runLongInflightSwitchProbes(phase, probes, commandPromise, options = {}) {
  const fetchImpl = options.fetch ?? globalThis.fetch
  const longProbes = asArray(probes)
    .filter((probe) => probe?.longInflight === true)
    .map((probe) => materializePhaseExpect(probe, phase.name))
    .filter((probe) => probe.expect?.completedAfterCommand === true)
  const startedAt = Date.now()
  const timeoutMs = Number(options.longInflightTimeoutMs ?? options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const commandTracker = createCommandTracker(commandPromise, options)
  const startSignal = await waitForLongInflightStartSignal(commandTracker, options)
  const controllers = []
  const inflight = longProbes.map((probe) => {
    const controller = new AbortController()
    controllers.push(controller)
    const requestStartedAt = Date.now()
    const requestPromise = requestProbe({ probe, signal: controller.signal, fetchImpl, baseUrl: options.baseUrl ?? options.publicOrigin })
    const timeout = timeoutAfter(timeoutMs, controller)
    return Promise.race([requestPromise, timeout.promise])
      .then((result) => ({ probe, result, requestStartedAt, completedAt: Date.now() }))
      .catch((error) => ({ probe, result: { error, latencyMs: Date.now() - startedAt }, requestStartedAt, completedAt: Date.now() }))
      .finally(() => {
        timeout.clear()
        requestPromise.catch(() => {
          // Abort/timeout already became the recorded probe result.
        })
      })
  })
  const commandOutcome = await commandTracker.outcome
  if (!commandOutcome.ok) {
    for (const controller of controllers) controller.abort()
  }
  const records = await Promise.all(inflight.map(async (promise) => {
    const { probe, result, requestStartedAt, completedAt } = await promise
    const observedSwitchAt = commandOutcome.switchedAtMs ?? commandOutcome.value?.switchedAtMs ?? commandOutcome.value?.switchObservedAtMs ?? commandOutcome.completedAt
    return classifyProbeResult(probe, {
      ...result,
      completedAfterCommand: completedAt >= observedSwitchAt,
      startedBeforeCommand: requestStartedAt <= observedSwitchAt,
      startedAtMs: requestStartedAt,
      completedAtMs: completedAt,
      observedSwitchAtMs: observedSwitchAt,
      commandCompletedAtMs: commandOutcome.completedAt ?? null,
      startSignal,
    })
  }))
  if (!commandOutcome.ok) throw commandOutcome.error
  return { commandOutcome, probeResult: { phase: `${phase.name}:long-inflight`, records, summary: summarizeProbeRecords(records) } }
}

export async function runContinuousProbeWhile(phase, probes, commandPromise, options = {}) {
  const started = Date.now()
  const windowMs = Math.max(1, Number(options.probeWindowMs ?? Math.min(phase.durationMs, 1_000)))
  const continuousProbes = asArray(probes).filter((probe) => probe?.longInflight !== true)
  const results = []
  const commandTracker = createCommandTracker(commandPromise, options)
  let commandOutcome
  const commandOutcomePromise = commandTracker.outcome.then((outcome) => {
    commandOutcome = outcome
    return outcome
  })
  const longInflight = (options.skipLongInflight === true
    ? commandOutcomePromise.then((outcome) => ({ commandOutcome: outcome, probeResult: { phase: `${phase.name}:long-inflight`, records: [], summary: summarizeProbeRecords([]) } }))
    : runLongInflightSwitchProbes(phase, probes, commandTracker, options))
    .catch((error) => ({ longInflightError: error }))
  const maxProbeWindows = Number.isInteger(options.maxProbeWindows) ? options.maxProbeWindows : Number.POSITIVE_INFINITY
  let probeWindows = 0
  let probeOffset = 0
  do {
    const result = await runContinuousProbePhase({ ...phase, durationMs: windowMs }, continuousProbes, { ...options, probeOffset })
    results.push(result)
    probeOffset += result.records.length
    probeWindows += 1
  } while ((!commandOutcome || Date.now() - started < phase.durationMs) && probeWindows < maxProbeWindows)
  const longInflightResult = await longInflight
  if (longInflightResult.longInflightError) throw longInflightResult.longInflightError
  if (!commandOutcome) commandOutcome = await commandOutcomePromise
  if (!commandOutcome.ok) throw commandOutcome.error
  return { probeResult: mergeProbeResults([...results, longInflightResult.probeResult], phase.name), commandResult: commandOutcome.value }
}

function expectedReportPath(failure) {
  if (failure.expectedReport?.path) return failure.expectedReport.path
  const args = asArray(failure.args)
  const index = args.indexOf('--report-out')
  if (index >= 0 && args[index + 1]) return args[index + 1]
  const inline = args.find((arg) => String(arg).startsWith('--report-out='))
  return inline ? String(inline).slice('--report-out='.length) : undefined
}

function readExpectedFailureReport(failure) {
  const reportPath = expectedReportPath(failure)
  if (!reportPath || !existsSync(reportPath)) return undefined
  return JSON.parse(readFileSync(reportPath, 'utf8'))
}

function longInflightStartSignalPath(inventory) {
  if (Object.prototype.hasOwnProperty.call(inventory, 'longInflightStartSignalPath')) return inventory.longInflightStartSignalPath
  const manifest = JSON.parse(readFileSync(inventory.manifestPath, 'utf8'))
  return join(inventory.deployRoot, 'journal', `${manifest.releaseId}.json`)
}

export function assertExpectedFailureEvidence(failure, commandOutcome) {
  if (failure.expectCommandFailure === false) return
  if (failure.expectedExitCode != null && commandOutcome.exitCode !== failure.expectedExitCode) {
    throw new Error(`failure matrix case ${failure.name} expected exit code ${failure.expectedExitCode}, got ${commandOutcome.exitCode ?? '(missing)'}`)
  }
  const combined = [commandOutcome.error, commandOutcome.stderr, commandOutcome.stdout, stableJson(commandOutcome.value ?? {})].filter(Boolean).join('\n')
  if (failure.expectedErrorPattern && !new RegExp(failure.expectedErrorPattern, 'i').test(combined)) {
    throw new Error(`failure matrix case ${failure.name} expected error pattern ${failure.expectedErrorPattern}`)
  }
  const report = readExpectedFailureReport(failure)
  if (failure.expectedReport || report) {
    if (!report) throw new Error(`failure matrix case ${failure.name} expected report was not written`)
    const expected = failure.expectedReport ?? {}
    if (expected.expectedFault !== undefined && report.expectedFault !== expected.expectedFault) {
      throw new Error(`failure matrix case ${failure.name} expected report expectedFault=${expected.expectedFault}`)
    }
    if (expected.detectedReasonPattern && !new RegExp(expected.detectedReasonPattern, 'i').test(String(report.detectedReason ?? ''))) {
      throw new Error(`failure matrix case ${failure.name} expected report detectedReason pattern ${expected.detectedReasonPattern}`)
    }
    if (expected.beforeAfterDigestEqual === true && !isDeepStrictEqual(report.beforeDigest, report.afterDigest)) {
      throw new Error(`failure matrix case ${failure.name} expected before/after digest equality`)
    }
    commandOutcome.report = report
  }
}

async function runExpectedFailureCommand(failure, options = {}) {
  try {
    const value = await runCommand(failure.command, asArray(failure.args), options)
    return { succeeded: value?.succeeded !== false, value }
  } catch (error) {
    const parsed = parseCommandOutput(error?.stdout, { command: failure.command, args: asArray(failure.args), stderr: error?.stderr })
    return {
      succeeded: false,
      exitCode: typeof error?.code === 'number' ? error.code : undefined,
      error: error instanceof Error ? error.message : String(error),
      stdout: error?.stdout,
      stderr: error?.stderr,
      value: parsed,
    }
  }
}

function findPhaseHealthProbe(probes, phaseName) {
  return asArray(probes)
    .find((probe) => probe?.name === 'api-health' && (probe.expect || probe.expectByPhase?.[phaseName]))
    ?? asArray(probes).find((probe) => probe?.path === '/api/health' && (probe.expect || probe.expectByPhase?.[phaseName]))
}

async function waitForStableRollbackReadiness(failure, inventory, transitionPhase, strictPhase, options = {}) {
  const strictHealthProbe = findPhaseHealthProbe(inventory.probes, strictPhase.name)
  const transitionHealthProbe = findPhaseHealthProbe(inventory.probes, transitionPhase.name) ?? strictHealthProbe
  if (!strictHealthProbe || !transitionHealthProbe) return null
  const strictExpectedReleaseId = materializePhaseExpect(strictHealthProbe, strictPhase.name).expect?.releaseId
  if (!strictExpectedReleaseId) return null
  const requiredSamples = Number(failure.rollbackStableSamples ?? options.failureRollbackStableSamples ?? 3)
  const intervalMs = Number(failure.rollbackStableIntervalMs ?? options.failureRollbackStableIntervalMs ?? 100)
  const timeoutMs = Number(failure.rollbackStableTimeoutMs ?? options.failureRollbackStableTimeoutMs ?? 5_000)
  if (!Number.isInteger(requiredSamples) || requiredSamples < 1) throw new Error('rollback stable samples must be a positive integer')
  if (!Number.isFinite(intervalMs) || intervalMs < 0) throw new Error('rollback stable interval must be finite and nonnegative')
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) throw new Error('rollback stable timeout must be finite and positive')

  const started = Date.now()
  const samples = []
  let consecutive = 0
  while (Date.now() - started <= timeoutMs) {
    const samplePhase = { ...transitionPhase, durationMs: 1, rps: 1, concurrency: 1 }
    const result = await runContinuousProbePhase(samplePhase, [transitionHealthProbe], options)
    const record = result.records[0]
    samples.push(record)
    if (result.summary.failed > 0) {
      return { ok: false, samples, result }
    }
    if (record?.releaseId === strictExpectedReleaseId) {
      consecutive += 1
      if (consecutive >= requiredSamples) return { ok: true, samples, result }
    } else {
      consecutive = 0
    }
    if (intervalMs > 0) await (options.sleep ?? sleep)(intervalMs)
  }
  return { ok: false, samples, result: { phase: transitionPhase.name, records: samples, summary: summarizeProbeRecords(samples) } }
}

async function proveFailurePublicOutcome(failure, inventory, options = {}) {
  const strictPhaseName = failure.probePhase ?? 'rollback-retention'
  const transitionPhase = {
    name: failure.rollbackTransitionProbePhase ?? 'rollback-transition',
    durationMs: Number(failure.rollbackTransitionProbeDurationMs ?? options.failureRollbackTransitionProbeWindowMs ?? options.probeWindowMs ?? 1),
    rps: DEFAULT_RPS,
    concurrency: DEFAULT_CONCURRENCY,
  }
  const strictPhase = {
    name: strictPhaseName,
    durationMs: Number(failure.probeDurationMs ?? options.failureProbeWindowMs ?? options.probeWindowMs ?? 1),
    rps: DEFAULT_RPS,
    concurrency: DEFAULT_CONCURRENCY,
  }
  const transitionProbeResult = await runContinuousProbePhase(transitionPhase, inventory.probes, options)
  const stableRollbackReadiness = await waitForStableRollbackReadiness(failure, inventory, transitionPhase, strictPhase, options)
  const strictProbeResult = stableRollbackReadiness?.ok === false
    ? stableRollbackReadiness.result
    : await runContinuousProbePhase(strictPhase, inventory.probes, options)
  const records = [...transitionProbeResult.records, ...asArray(stableRollbackReadiness?.samples), ...strictProbeResult.records]
  const previousReadable = transitionProbeResult.summary.failed === 0 && stableRollbackReadiness?.ok !== false && strictProbeResult.summary.failed === 0
  const badV2Public = records.some((record) => record.errors.some((error) => ['address', 'release', 'total'].includes(error.type)))
  return { previousReadable, badV2Public, probeResult: strictProbeResult, transitionProbeResult, stableRollbackReadiness }
}

async function runOptionalHookCommand(command, args, options = {}) {
  if (!command) return undefined
  return await runCommand(command, asArray(args), options)
}

async function runFailureMatrix(inventory, options = {}) {
  const results = []
  for (const failure of asArray(inventory.failureMatrix)) {
    let setupOutcome
    let commandOutcome
    let publicOutcome
    try {
      setupOutcome = await runOptionalHookCommand(failure.setupCommand, failure.setupArgs, options)
      commandOutcome = await runExpectedFailureCommand(failure, options)
      const expectsFailure = failure.expectCommandFailure !== false
      if (expectsFailure && commandOutcome.succeeded) throw new Error(`failure matrix case ${failure.name} unexpectedly succeeded`)
      if (!expectsFailure && !commandOutcome.succeeded) throw new Error(`failure matrix case ${failure.name} unexpectedly failed`)
      assertExpectedFailureEvidence(failure, commandOutcome)
      publicOutcome = await proveFailurePublicOutcome(failure, inventory, options)
      if (publicOutcome.previousReadable !== true) throw new Error(`failure matrix case ${failure.name} did not prove previous service readable`)
      if (publicOutcome.badV2Public === true) throw new Error(`failure matrix case ${failure.name} exposed invalid V2 data`)
      results.push({ name: failure.name, setupOutcome, commandOutcome, publicOutcome })
    } finally {
      await runOptionalHookCommand(failure.teardownCommand, failure.teardownArgs, options)
    }
  }
  return results
}

function assertNormalDeployResult(deploy, commandResult) {
  const actualPrepare = Number(commandResult?.summaryPrepareCalls ?? commandResult?.metrics?.summaryPrepareCalls)
  const actualDelete = Number(commandResult?.assetDeleteCalls ?? commandResult?.metrics?.assetDeleteCalls)
  if (actualPrepare !== deploy.expectSummaryPrepareCalls) {
    throw new Error(`${deploy.name} summary prepare calls expected ${deploy.expectSummaryPrepareCalls}, got ${Number.isNaN(actualPrepare) ? 'missing' : actualPrepare}`)
  }
  if (actualDelete !== deploy.expectAssetDeleteCalls) {
    throw new Error(`${deploy.name} asset delete calls expected ${deploy.expectAssetDeleteCalls}, got ${Number.isNaN(actualDelete) ? 'missing' : actualDelete}`)
  }
}

export async function executeRuntimePlan(plan, inventory, options = {}) {
  if (!options.execute) throw new Error('refusing to run rehearsal without --execute')
  const runtimeOptions = { publicOrigin: inventory.publicOrigin, commandTimeoutMs: inventory.commandTimeoutMs ?? DEFAULT_COMMAND_TIMEOUT_MS, longInflightTimeoutMs: inventory.longInflightTimeoutMs ?? 120_000, ...options }
  const preflight = await validateRuntimePreflight(inventory, runtimeOptions)
  const artifacts = inventory.artifactSources ? await prepareRehearsalArtifacts(inventory, runtimeOptions) : null
  const results = []
  for (const phase of plan.continuousPhases) {
    if (phase.command === 'summary-transition') {
      const transitionOptions = inventory.summaryTransitionCwd
        ? { ...runtimeOptions, cwd: inventory.summaryTransitionCwd }
        : runtimeOptions
      const transitionScriptPath = inventory.summaryTransitionCwd ? resolveFromCurrentCwd(inventory.summaryTransitionScriptPath) : inventory.summaryTransitionScriptPath
      const transitionReleaseScriptPath = inventory.summaryTransitionCwd ? resolveFromCurrentCwd(inventory.releaseScriptPath) : inventory.releaseScriptPath
      const transitionArgs = [transitionScriptPath, '--inventory', inventory.inventoryPath, '--manifest', inventory.manifestPath, '--release-script', transitionReleaseScriptPath]
      if (inventory.compatibilityManifestPath) transitionArgs.push('--compatibility-manifest', inventory.compatibilityManifestPath)
      transitionArgs.push(
        '--url-baseline',
        inventory.urlBaselinePath,
        '--expected-url-fingerprint',
        inventory.expectedUrlFingerprint,
        '--expected-url-plan-fingerprint',
        inventory.expectedUrlPlanFingerprint,
      )
      if (inventory.summaryTransitionReportPath) transitionArgs.push('--report-out', inventory.summaryTransitionReportPath)
      const commandPromise = observePathSwitch(runCommand(process.execPath, transitionArgs, transitionOptions), inventory.nginxIncludePath, transitionOptions)
      results.push({ phase: phase.name, ...await runContinuousProbeWhile(phase, inventory.probes, commandPromise, { ...runtimeOptions, longInflightStartSignalPath: longInflightStartSignalPath(inventory) }) })
    } else if (phase.command === 'release-rollback') {
      const commandPromise = observePathSwitch(runCommand(process.execPath, [inventory.releaseScriptPath, 'rollback', '--inventory', inventory.inventoryPath, '--manifest', inventory.manifestPath], runtimeOptions), inventory.nginxIncludePath, runtimeOptions)
      results.push({ phase: phase.name, ...await runContinuousProbeWhile(phase, inventory.probes, commandPromise, runtimeOptions) })
    } else {
      results.push({ phase: phase.name, probeResult: await runContinuousProbePhase(phase, inventory.probes, runtimeOptions) })
    }
  }
  const failureMatrix = await runFailureMatrix(inventory, runtimeOptions)
  for (const deploy of plan.normalDeploys) {
    const commandResult = await runCommand(process.execPath, [inventory.releaseScriptPath, 'deploy', '--inventory', inventory.inventoryPath, '--manifest', deploy.manifestPath], runtimeOptions)
    assertNormalDeployResult(deploy, commandResult)
    results.push({ phase: deploy.name, commandResult, expected: { summaryPrepareCalls: deploy.expectSummaryPrepareCalls, assetDeleteCalls: deploy.expectAssetDeleteCalls } })
  }
  return {
    ready: results.every((result) => !result.probeResult || result.probeResult.summary.failed === 0),
    preflight,
    artifacts,
    failureMatrix,
    results,
  }
}

function parseArgs(argv) {
  const args = { execute: false }
  for (const arg of argv) {
    if (arg.startsWith('--inventory=')) args.inventory = arg.slice('--inventory='.length)
    else if (arg.startsWith('--report=')) args.report = arg.slice('--report='.length)
    else if (arg === '--execute') args.execute = true
    else if (arg.startsWith('--phase-duration-ms=')) args.phaseDurationMs = Number(arg.slice('--phase-duration-ms='.length))
  }
  if (!args.inventory) throw new Error('--inventory=<local-inventory.json> is required')
  if (!args.report) throw new Error('--report=<report.json> is required')
  if (!isAbsolute(args.report)) throw new Error('--report must be an absolute path')
  return args
}

function atomicWriteJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`)
  renameSync(tmp, path)
}

export async function runRehearsalCli(argv = process.argv.slice(2), options = {}) {
  const args = parseArgs(argv)
  const inventory = JSON.parse(readFileSync(args.inventory, 'utf8'))
  const plan = buildRuntimePlan(inventory, { execute: args.execute, phaseDurationMs: args.phaseDurationMs })
  const report = args.execute
    ? { ...plan, execution: await executeRuntimePlan(plan, inventory, { ...options, execute: true }) }
    : { ...plan, outstanding: ['actual proxy/server release switching waits for C2/B4 readiness gates and --execute'] }
  atomicWriteJson(args.report, report)
  return report
}

export const runPreliminaryRehearsalCli = runRehearsalCli

if (import.meta.url === `file://${process.argv[1]}`) {
  runRehearsalCli()
    .then((report) => {
      console.info(JSON.stringify({ ready: report.ready, stage: report.stage, execute: report.execute }))
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error))
      process.exit(1)
    })
}
