#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import { isAbsolute, join, relative, resolve } from 'node:path'
import * as nodeUtil from 'node:util'

const DEFAULT_ACTIVE_BACKEND = '/home/project2/backend'
const DEFAULT_CURRENT_BACKEND = '/home/project2/current-backend'
const DEFAULT_INVENTORY = '/home/project2/deploy/inventory.json'
const RELEASE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{2,80}$/i

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new Error(`Failed to read ${label}: ${error.message}`)
  }
}

function realpath(path) {
  return realpathSync.native(resolve(path))
}

function pathInside(parent, child) {
  const parentPath = existsSync(parent) ? realpath(parent) : resolve(parent)
  const childPath = existsSync(child) ? realpath(child) : resolve(child)
  const rel = relative(parentPath, childPath)
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))
}

function releaseIdFromBackendDir(backendDir, releasesRoot) {
  if (!releasesRoot || !pathInside(releasesRoot, backendDir)) return null
  const releasesRootPath = existsSync(releasesRoot) ? realpath(releasesRoot) : resolve(releasesRoot)
  const backendPath = existsSync(backendDir) ? realpath(backendDir) : resolve(backendDir)
  const rel = relative(releasesRootPath, backendPath)
  const parts = rel.split(/[\\/]/)
  if (parts.length !== 2) return null
  const [releaseId, artifactDir] = parts
  if (!RELEASE_ID_PATTERN.test(releaseId) || artifactDir !== 'backend') return null
  return releaseId
}

function assertAbsolute(value, label) {
  if (typeof value !== 'string' || !isAbsolute(value)) {
    throw new Error(`${label} must be an absolute path`)
  }
  return value
}

function parseEnvWithBackendTools(envFile, backendDir) {
  const contents = readFileSync(envFile, 'utf8')
  if (typeof nodeUtil.parseEnv === 'function') return nodeUtil.parseEnv(contents)

  const require = createRequire(import.meta.url)
  try {
    const dotenv = require(join(backendDir, 'node_modules', 'dotenv'))
    return dotenv.parse(contents)
  } catch (error) {
    throw new Error(`Failed to load dotenv parser for ${envFile}: ${error.message}`)
  }
}

function loadEnvFile(envFile, backendDir) {
  if (!existsSync(envFile)) throw new Error(`backend env file not found: ${envFile}`)
  return parseEnvWithBackendTools(envFile, backendDir)
}

function safeSummary(runtime) {
  const result = {
    mode: runtime.mode,
    activeBackendDir: runtime.activeBackendDir,
    envFile: runtime.envFile,
    writerLockDir: runtime.writerLockDir,
    sitemapDir: runtime.sitemapDir,
    sitemapRegenBase: runtime.sitemapRegenBase,
  }
  if (runtime.releaseId) result.releaseId = runtime.releaseId
  if (runtime.summaryMode) result.summaryMode = runtime.summaryMode
  if (runtime.summaryRunId) result.summaryRunId = runtime.summaryRunId
  return result
}

function resolveActiveBackendLink(options, env) {
  const explicit = options.activeBackendLink ?? env.ILSK_ACTIVE_BACKEND_LINK
  if (explicit) return explicit
  if (existsSync(DEFAULT_CURRENT_BACKEND)) return DEFAULT_CURRENT_BACKEND
  return DEFAULT_ACTIVE_BACKEND
}

function assertActivePointerMatches(pointerPath, activeBackendLink, label) {
  if (!pointerPath) return
  if (resolve(pointerPath) !== resolve(activeBackendLink)) {
    throw new Error(`${label} backend pointer does not match active backend link`)
  }
}

function assertPort(value, label) {
  const port = Number(value)
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${label} must be a valid TCP port`)
  }
  return port
}

function assertReleasePathMatches(pathValue, expectedPath, label) {
  assertAbsolute(pathValue, label)
  if (realpath(pathValue) !== realpath(expectedPath)) {
    throw new Error(`${label} does not match active release backend`)
  }
}

function assertActiveInventory(inventory, releaseId, activeBackendDir, manifest) {
  const activeReleaseId = inventory.activeReleaseId ?? inventory.active?.releaseId ?? inventory.active?.backend?.releaseId
  if (activeReleaseId && activeReleaseId !== releaseId) {
    throw new Error('inventory active release id does not match current backend release id')
  }
  if (inventory.active?.backend?.cwd) {
    assertReleasePathMatches(inventory.active.backend.cwd, activeBackendDir, 'inventory.active.backend.cwd')
  }
  if (inventory.active?.backend?.port !== undefined) {
    const activeBackendPort = assertPort(inventory.active.backend.port, 'inventory.active.backend.port')
    const manifestBackendPort = assertPort(manifest.ports?.backend, 'manifest.ports.backend')
    if (activeBackendPort !== manifestBackendPort) {
      throw new Error('inventory active backend port does not match manifest backend port')
    }
  }
  if (inventory.active?.frontend?.port !== undefined) {
    const activeFrontendPort = assertPort(inventory.active.frontend.port, 'inventory.active.frontend.port')
    const manifestFrontendPort = assertPort(manifest.ports?.frontend, 'manifest.ports.frontend')
    if (activeFrontendPort !== manifestFrontendPort) {
      throw new Error('inventory active frontend port does not match manifest frontend port')
    }
  }
}

function assertActiveSummary(summary) {
  if (!summary || typeof summary !== 'object') throw new Error('manifest summary is required')
  if (summary.mode !== 'address' && summary.mode !== 'compatibility') {
    throw new Error('manifest summary mode must be address or compatibility')
  }
  if (typeof summary.runId !== 'string' || summary.runId.length === 0) {
    throw new Error('manifest summary runId is required')
  }
  if (summary.expectedRunId !== undefined && summary.expectedRunId !== summary.runId) {
    throw new Error('manifest summary runId must match expectedRunId')
  }
  if (summary.state !== undefined && summary.state !== 'ready') {
    throw new Error('manifest summary state must be ready')
  }
}

function resolveReleaseRuntime(options, env, activeBackendLink, activeBackendDir, inventory) {
  const releasesRoot = assertAbsolute(inventory.releasesRoot, 'inventory.releasesRoot')
  const releaseId = releaseIdFromBackendDir(activeBackendDir, releasesRoot)
  if (!releaseId) throw new Error('current-backend does not point at inventory.releasesRoot/<releaseId>/backend')
  const releaseRoot = join(releasesRoot, releaseId)

  assertActivePointerMatches(inventory.activePointers?.backend ?? inventory.activeBackendLink, activeBackendLink, 'inventory')

  const manifestPath = options.manifestPath ?? env.ILSK_RELEASE_MANIFEST_PATH ?? join(releaseRoot, '.release-manifest.json')
  const manifest = readJson(manifestPath, 'release manifest')
  if (manifest.releaseId !== releaseId) {
    throw new Error('active backend release id does not match manifest.releaseId')
  }
  assertActivePointerMatches(manifest.activePointers?.backend, activeBackendLink, 'manifest')
  assertActiveInventory(inventory, releaseId, activeBackendDir, manifest)
  assertActiveSummary(manifest.summary)

  const runtime = manifest.runtime ?? inventory.runtime
  if (!runtime || typeof runtime !== 'object') throw new Error('release runtime configuration is required')
  const envFile = assertAbsolute(runtime.backendEnvFile ?? inventory.envFile, 'runtime.backendEnvFile')
  const writerLockDir = assertAbsolute(runtime.realEstateWriteLockDir ?? inventory.realEstateWriteLockDir, 'runtime.realEstateWriteLockDir')
  const sitemapDir = assertAbsolute(runtime.sitemapDir ?? inventory.sitemap?.releaseDir, 'runtime.sitemapDir')
  const frontendPort = assertPort(manifest.ports?.frontend, 'manifest.ports.frontend')
  const summaryMode = manifest.summary.mode
  const summaryRunId = manifest.summary.runId

  const fileEnv = loadEnvFile(envFile, activeBackendDir)
  const sitemapRegenBase = runtime.sitemapRegenBase ?? `http://127.0.0.1:${frontendPort}`
  return {
    mode: 'release',
    activeBackendDir,
    releaseId,
    envFile,
    writerLockDir,
    sitemapDir,
    sitemapRegenBase,
    summaryMode,
    summaryRunId,
    env: {
      ...env,
      ...fileEnv,
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      ILSK_RELEASE_ID: releaseId,
      REAL_ESTATE_SUMMARY_MODE: summaryMode,
      REAL_ESTATE_URL_MODE: runtime.realEstateUrlMode ?? manifest.realEstateUrlMode ?? 'preserved',
      REAL_ESTATE_SUMMARY_RUN_ID: summaryRunId,
      ILSK_SUMMARY_RUN_ID: summaryRunId,
      REAL_ESTATE_WRITE_LOCK_DIR: writerLockDir,
      SITEMAP_DIR: sitemapDir,
      SITEMAP_REGEN_BASE: sitemapRegenBase,
      ...(env.SITEMAP_REGEN_TOKEN !== undefined ? { SITEMAP_REGEN_TOKEN: env.SITEMAP_REGEN_TOKEN } : {}),
      ILSK_BACKEND_ENV_FILE: envFile,
    },
  }
}

function resolveLegacyRuntime(env, activeBackendDir) {
  const envFile = env.ILSK_BACKEND_ENV_FILE ?? join(activeBackendDir, '.env')
  const fileEnv = existsSync(envFile) ? loadEnvFile(envFile, activeBackendDir) : {}
  const writerLockDir = env.REAL_ESTATE_WRITE_LOCK_DIR ?? '/home/project2/run/real-estate-locks'
  const sitemapDir = env.SITEMAP_DIR ?? '/home/project2/sitemaps'
  const sitemapRegenBase = env.SITEMAP_REGEN_BASE ?? 'http://127.0.0.1:3000'
  return {
    mode: 'legacy',
    activeBackendDir,
    envFile,
    writerLockDir,
    sitemapDir,
    sitemapRegenBase,
    env: {
      ...env,
      ...fileEnv,
      REAL_ESTATE_WRITE_LOCK_DIR: writerLockDir,
      SITEMAP_DIR: sitemapDir,
      SITEMAP_REGEN_BASE: sitemapRegenBase,
    },
  }
}

export function resolveSyncRuntime(options = {}, env = process.env) {
  const activeBackendLink = resolveActiveBackendLink(options, env)
  const activeBackendDir = realpath(activeBackendLink)
  const activeLinkExists = existsSync(activeBackendLink)
  const activeLinkIsSymlink = activeLinkExists && lstatSync(activeBackendLink).isSymbolicLink()
  const inventoryPath = options.inventoryPath ?? env.ILSK_DEPLOY_INVENTORY ?? DEFAULT_INVENTORY
  const inventoryExists = existsSync(inventoryPath)

  if (activeLinkIsSymlink || resolve(activeBackendLink) === resolve(DEFAULT_CURRENT_BACKEND)) {
    if (!inventoryExists) throw new Error('current-backend is active but deploy inventory is missing')
    return resolveReleaseRuntime(options, env, activeBackendLink, activeBackendDir, readJson(inventoryPath, 'deploy inventory'))
  }

  return resolveLegacyRuntime(env, activeBackendDir)
}

function parseCli(argv) {
  const [command = 'print', ...rest] = argv
  const options = {}
  const commandIndex = rest.indexOf('--')
  const optionArgs = commandIndex === -1 ? rest : rest.slice(0, commandIndex)
  const commandArgs = commandIndex === -1 ? [] : rest.slice(commandIndex + 1)
  for (let i = 0; i < optionArgs.length; i += 1) {
    const arg = optionArgs[i]
    if (arg === '--active-backend-link') options.activeBackendLink = optionArgs[++i]
    else if (arg === '--inventory') options.inventoryPath = optionArgs[++i]
    else if (arg === '--manifest') options.manifestPath = optionArgs[++i]
    else throw new Error(`Unknown option: ${arg}`)
  }
  return { command, options, commandArgs }
}

function runCommand(runtime, commandArgs) {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(commandArgs[0], commandArgs.slice(1), {
      cwd: runtime.activeBackendDir,
      env: runtime.env,
      stdio: 'inherit',
    })
    let forwardedSignal = null
    const forward = (signal) => {
      forwardedSignal = signal
      if (!child.killed) child.kill(signal)
    }
    const cleanup = () => {
      process.off('SIGTERM', onSigterm)
      process.off('SIGINT', onSigint)
      process.off('SIGHUP', onSighup)
    }
    const onSigterm = () => forward('SIGTERM')
    const onSigint = () => forward('SIGINT')
    const onSighup = () => forward('SIGHUP')
    process.once('SIGTERM', onSigterm)
    process.once('SIGINT', onSigint)
    process.once('SIGHUP', onSighup)
    child.once('error', (error) => {
      cleanup()
      rejectPromise(error)
    })
    child.once('exit', (code, signal) => {
      cleanup()
      if (code !== null) resolvePromise(code)
      else if (signal || forwardedSignal) resolvePromise(128 + (signal === 'SIGINT' || forwardedSignal === 'SIGINT' ? 2 : signal === 'SIGHUP' || forwardedSignal === 'SIGHUP' ? 1 : 15))
      else resolvePromise(1)
    })
  })
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const { command, options, commandArgs } = parseCli(process.argv.slice(2))
    const runtime = resolveSyncRuntime(options)
    if (command === 'print') {
      console.log(JSON.stringify(safeSummary(runtime), null, 2))
    } else if (command === 'run') {
      if (commandArgs.length === 0) throw new Error('run requires a command after --')
      process.exitCode = await runCommand(runtime, commandArgs)
    } else {
      throw new Error(`Unknown command: ${command}`)
    }
  } catch (error) {
    console.error(`[sync-runtime] ${error.message}`)
    process.exitCode = 2
  }
}
