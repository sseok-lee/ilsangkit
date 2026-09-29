#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'

export const REQUIRED_INVENTORY_FIELDS = [
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
]

const REQUIRED_WRITER_COMMANDS = new Map([
  ['sync:apt-sale', 'tsx src/scripts/syncAptSale.ts'],
  ['sync:apt-rent', 'tsx src/scripts/syncAptRent.ts'],
  ['sync:villa-sale', 'tsx src/scripts/syncVillaSale.ts'],
  ['sync:villa-rent', 'tsx src/scripts/syncVillaRent.ts'],
  ['sync:offitel-sale', 'tsx src/scripts/syncOffitelSale.ts'],
  ['sync:offitel-rent', 'tsx src/scripts/syncOffitelRent.ts'],
  ['sync:geocode-real-estate', 'tsx src/scripts/geocodeRealEstate.ts'],
  ['refresh-real-estate-summary', 'tsx src/scripts/refreshRealEstateSummary.ts'],
])

const OPTIONAL_WRITER_COMMANDS = new Map([
  ['sync-real-estate-workflow', '.github/workflows/sync-real-estate.yml'],
  ['sync-subscription', 'tsx src/scripts/syncSubscription.ts'],
  ['sync-public-rental', 'tsx src/scripts/syncPublicRental.ts'],
  ['sync-waste', 'tsx src/scripts/syncTrash.ts'],
  ['generate-sitemaps', 'tsx src/scripts/generateSitemaps.ts'],
])

const KNOWN_WRITERS = new Map([...REQUIRED_WRITER_COMMANDS, ...OPTIONAL_WRITER_COMMANDS])

function getPathValue(value, dottedPath) {
  return dottedPath.split('.').reduce((current, segment) => current?.[segment], value)
}

function isPresent(value) {
  return value !== undefined && value !== null && value !== ''
}

function asArray(value) {
  return Array.isArray(value) ? value : []
}

function canonicalPath(pathValue) {
  if (typeof pathValue !== 'string' || pathValue.trim() === '') return null
  const normalized = resolve(pathValue)
  try {
    return realpathSync.native(normalized)
  } catch {
    return normalized
  }
}

function staysUnder(parent, child) {
  const parentPath = canonicalPath(parent)
  const childPath = canonicalPath(child)
  if (!parentPath || !childPath) return false
  const relativePath = relative(parentPath, childPath)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

function requireAbsolutePath(inventory, field, errors) {
  const value = getPathValue(inventory, field)
  if (isPresent(value) && (typeof value !== 'string' || !isAbsolute(value))) {
    errors.push(`${field} must be an absolute path`)
  }
}

export function sanitizePm2Process(processInfo) {
  const portValue = processInfo?.pm2_env?.PORT ?? processInfo?.pm2_env?.port
  const port = Number(portValue)
  return {
    name: processInfo?.name,
    pid: processInfo?.pid,
    cwd: processInfo?.pm2_env?.pm_cwd,
    ...(Number.isInteger(port) ? { port } : {}),
  }
}

export function validateInventory(inventory) {
  const errors = []
  const warnings = []

  for (const field of REQUIRED_INVENTORY_FIELDS) {
    if (!isPresent(getPathValue(inventory, field))) {
      errors.push(`missing required field: ${field}`)
    }
  }

  for (const field of [
    'deployRoot',
    'releasesRoot',
    'assets.publicDir',
    'sitemap.path',
    'envFile',
    'active.backend.cwd',
    'active.frontend.cwd',
  ]) {
    requireAbsolutePath(inventory, field, errors)
  }

  if (isPresent(inventory?.deployRoot) && isPresent(inventory?.releasesRoot)
    && !staysUnder(inventory.deployRoot, inventory.releasesRoot)) {
    errors.push('releasesRoot must stay under deployRoot')
  }

  const ports = asArray(inventory?.reservePorts)
    .concat([inventory?.active?.backend?.port, inventory?.active?.frontend?.port])
    .filter(port => port !== undefined && port !== null)
    .map(Number)
  const seenPorts = new Set()
  for (const port of ports) {
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      errors.push(`invalid port: ${port}`)
      continue
    }
    if (seenPorts.has(port)) errors.push(`duplicate reserve port: ${port}`)
    seenPorts.add(port)
  }

  const writers = asArray(inventory?.writers)
  const writerByName = new Map()
  for (const writer of writers) {
    if (!writer?.name) {
      errors.push('writer missing name')
      continue
    }
    writerByName.set(writer.name, writer)
    const expectedCommand = KNOWN_WRITERS.get(writer.name)
    if (!expectedCommand) {
      errors.push(`unknown writer: ${writer.name}`)
      continue
    }
    if (typeof writer.command !== 'string' || writer.command.trim() === '') {
      errors.push(`writer ${writer.name} missing command`)
    } else if (writer.command !== expectedCommand) {
      errors.push(`writer ${writer.name} command mismatch`)
    }
    if (typeof writer.lock !== 'string' || writer.lock.trim() === '') {
      errors.push(`writer ${writer.name} missing lock identity`)
    }
  }
  for (const writerName of REQUIRED_WRITER_COMMANDS.keys()) {
    if (!writerByName.has(writerName)) {
      errors.push(`missing required writer: ${writerName}`)
    }
  }

  if (!Number.isFinite(inventory?.free?.diskBytes) || inventory.free.diskBytes <= 0) {
    errors.push('free.diskBytes must be measured before mutation')
  }
  if (!Number.isFinite(inventory?.free?.memoryBytes) || inventory.free.memoryBytes <= 0) {
    errors.push('free.memoryBytes must be measured before mutation')
  }

  const activeNames = new Set([
    inventory?.active?.backend?.name,
    inventory?.active?.frontend?.name,
  ].filter(Boolean))
  for (const ecosystemName of asArray(inventory?.ecosystemProcesses)) {
    if (!activeNames.has(ecosystemName)) {
      warnings.push(`ecosystem process "${ecosystemName}" differs from active PM2 inventory`)
    }
  }

  return {
    ok: errors.length === 0,
    safeToMutate: errors.length === 0,
    errors,
    warnings,
  }
}

function usage() {
  return 'usage: node scripts/deploy/inventory.mjs --fixture inventory.json'
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fixtureIndex = process.argv.indexOf('--fixture')
  if (fixtureIndex === -1 || !process.argv[fixtureIndex + 1]) {
    console.error(usage())
    process.exitCode = 2
  } else {
    const inventory = JSON.parse(readFileSync(process.argv[fixtureIndex + 1], 'utf8'))
    const result = validateInventory(inventory)
    console.log(JSON.stringify(result, null, 2))
    if (!result.ok) process.exitCode = 1
  }
}
