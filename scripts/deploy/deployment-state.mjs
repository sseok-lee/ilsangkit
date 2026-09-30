import { readFileSync, realpathSync, writeFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'
import { createServer } from 'node:net'

export function rebindProbes(probes, releaseId, summary) {
  if (!Array.isArray(probes) || !probes.length) throw new Error('inventory business probes are required')
  return probes.map(probe => {
    const next = { ...structuredClone(probe), expectedReleaseId: releaseId }
    if (probe.name === 'release-readiness') {
      next.expectedJson = { ...next.expectedJson, ready: true, releaseId, 'summary.mode': summary.mode, 'summary.runId': summary.runId }
    }
    return next
  })
}

export function inventoryForRelease(inventory, manifest) {
  if (!manifest.releaseId || !manifest.runtime || !manifest.summary || !manifest.probes?.length) throw new Error('complete active manifest required')
  const releaseRoot = join(inventory.releasesRoot, manifest.releaseId)
  const next = {
    ...inventory,
    activeReleaseId: manifest.releaseId,
    active: {
      releaseId: manifest.releaseId,
      backend: { name: `ilsangkit-backend-${manifest.releaseId}`, cwd: join(releaseRoot, 'backend'), port: manifest.ports.backend },
      frontend: { name: `ilsangkit-frontend-${manifest.releaseId}`, cwd: join(releaseRoot, 'frontend'), port: manifest.ports.frontend },
    },
    runtime: structuredClone(manifest.runtime),
    summary: structuredClone(manifest.summary),
    rollback: structuredClone(manifest.rollback),
    businessProbes: { candidate: structuredClone(manifest.probes), active: structuredClone(manifest.probes) },
    publicSmokeProbes: structuredClone(manifest.publicSmokeProbes),
    sitemap: { ...inventory.sitemap, releaseDir: manifest.runtime.sitemapDir },
  }
  delete next.candidate
  delete next.nextCandidate
  return next
}

export function persistActiveInventory(inventoryPath, inventory, manifest) {
  const next = inventoryForRelease(inventory, manifest)
  const tmp = `${inventoryPath}.${process.pid}.tmp`
  writeFileSync(tmp, JSON.stringify(next, null, 2) + '\n', { mode: 0o600 })
  renameSync(tmp, inventoryPath)
  return next
}

async function portAvailable(port) {
  return new Promise(resolve => {
    const server = createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

export async function bindDeploymentManifest(inventory, manifest, hashedAssets, readiness, options = {}) {
  const active = inventory.active
  if (!active?.releaseId || readiness.releaseId !== active.releaseId || !readiness.ready || readiness.summary?.mode !== 'address' || !readiness.summary.runId) throw new Error('active inventory/readiness mismatch')
  const realpath = options.realpath ?? realpathSync
  for (const kind of ['backend', 'frontend']) {
    const expected = join(inventory.releasesRoot, active.releaseId, kind)
    if (realpath(inventory.activePointers[kind]) !== expected || active[kind].cwd !== expected) throw new Error('active inventory/pointer mismatch')
  }
  const pairs = inventory.candidatePortPairs
  if (!Array.isArray(pairs) || !pairs.length) throw new Error('candidatePortPairs must be configured')
  const checkPort = options.portAvailable ?? portAvailable
  let ports
  for (const pair of pairs) {
    if (![pair.backend, pair.frontend].every(p => Number.isInteger(p) && inventory.reservePorts.includes(p))) throw new Error('invalid candidate port pair')
    if (pair.backend === pair.frontend || [active.backend.port, active.frontend.port].some(p => p === pair.backend || p === pair.frontend)) continue
    if (await checkPort(pair.backend) && await checkPort(pair.frontend)) { ports = pair; break }
  }
  if (!ports) throw new Error('no unused candidate port pair; retire an obsolete retained release explicitly')
  const summary = { mode: 'address', runId: readiness.summary.runId, expectedRunId: readiness.summary.runId, state: 'ready' }
  const probes = inventory.businessProbes.active ?? inventory.businessProbes.candidate
  return {
    ...manifest, ports,
    rollbackReleaseId: active.releaseId,
    rollback: { releaseId: active.releaseId, backendPort: active.backend.port, frontendPort: active.frontend.port, retained: true, supportsKeyedUrls: true, businessProbesPass: true, probes: rebindProbes(probes, active.releaseId, readiness.summary) },
    summary,
    runtime: structuredClone(inventory.runtime),
    activePointers: inventory.activePointers,
    publicOrigin: inventory.publicOrigin,
    probes: rebindProbes(probes, manifest.releaseId, summary),
    publicSmokeProbes: rebindProbes(inventory.publicSmokeProbes, manifest.releaseId, summary),
    hashedAssets,
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const [inventoryPath, manifestPath, assetsPath, readinessPath] = process.argv.slice(2)
    const read = path => JSON.parse(readFileSync(path, 'utf8'))
    const manifest = await bindDeploymentManifest(read(inventoryPath), read(manifestPath), read(assetsPath), read(readinessPath))
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n')
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
