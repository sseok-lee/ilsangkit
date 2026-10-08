#!/usr/bin/env node
import { randomUUID } from 'node:crypto'
import { existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync, closeSync, fsyncSync } from 'node:fs'
import { dirname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const currentFile = fileURLToPath(import.meta.url)
const FULL_SHA = /^[a-f0-9]{40}$/
const RELEASE = /^fixed-[a-f0-9]{12}$/
const FORMAT = 1
const defaultIo = {
  openSync,
  writeFileSync,
  fsyncSync,
  closeSync,
  renameSync,
  rmSync,
}

export function readActiveApp(stateRoot, readiness = null) {
  const root = ensureSecureStateRoot(stateRoot, { create: false })
  const file = join(root, 'active-app.json')
  if (!existsSync(file)) throw new Error('ACTIVE_APP_REQUIRED')
  assertTrustedFile(root, file, 'ACTIVE_APP_PATH')
  const mode = lstatSync(file).mode
  if ((mode & 0o077) !== 0) throw new Error('ACTIVE_APP_MODE')
  const state = JSON.parse(readFileSync(file, 'utf8'))
  validateActiveState(state)
  if (readiness) assertReadinessForActiveApp(state, readiness)
  return state
}

export function publishActiveApp(stateRoot, fullSha, readiness, options = {}) {
  assertFullSha(fullSha, 'ACTIVE_APP_SHA')
  const releaseId = releaseIdForSha(fullSha)
  assertReadinessForActiveApp({ fullSha, releaseId }, readiness)
  const root = ensureSecureStateRoot(stateRoot, { create: true })
  validateExistingActiveTarget(root)
  const state = {
    format: FORMAT,
    fullSha,
    releaseId,
    publishedAt: new Date().toISOString(),
  }
  writePrivateJsonAtomic(root, 'active-app.json', state, options.io)
  return state
}

export function copyActiveReadinessIntoStateRoot(stateRoot, sourcePath) {
  const root = ensureSecureStateRoot(stateRoot, { create: true })
  const source = resolve(sourcePath)
  assertTrustedFile(dirname(source), source, 'ACTIVE_READINESS_SOURCE')
  const readiness = JSON.parse(readFileSync(source, 'utf8'))
  validateReadinessShape(readiness)
  writePrivateJsonAtomic(root, 'active-readiness.json', readiness)
  return join(root, 'active-readiness.json')
}

export function initActiveApp(stateRoot, fullSha, readinessPath, publicHealthHeadersPath) {
  assertFullSha(fullSha, 'ACTIVE_APP_SHA')
  const root = ensureSecureStateRoot(stateRoot, { create: true })
  const readinessFile = resolve(readinessPath)
  assertTrustedFile(root, readinessFile, 'INITIAL_READINESS_PATH')
  const headersFile = resolve(publicHealthHeadersPath)
  assertTrustedFile(root, headersFile, 'INITIAL_PUBLIC_HEALTH_PATH')
  const releaseId = releaseIdForSha(fullSha)
  const readiness = JSON.parse(readFileSync(readinessFile, 'utf8'))
  const activePath = join(root, 'active-app.json')
  if (existsSync(activePath)) {
    const current = readActiveApp(root)
    if (current.fullSha !== fullSha || current.releaseId !== releaseId) throw new Error('ACTIVE_APP_EXISTS')
    assertInitialReadiness(readiness, releaseId)
    assertPublicHealthReleaseHeader(readFileSync(headersFile, 'utf8'), releaseId)
    assertReadinessForActiveApp(current, readiness)
    return { ...current, status: 'idempotent' }
  }
  assertInitialReadiness(readiness, releaseId)
  assertPublicHealthReleaseHeader(readFileSync(headersFile, 'utf8'), releaseId)
  const state = publishActiveApp(root, fullSha, readiness)
  return { ...state, status: 'initialized' }
}

export function releaseIdForSha(fullSha) {
  assertFullSha(fullSha, 'ACTIVE_APP_SHA')
  return `fixed-${fullSha.slice(0, 12)}`
}

function assertInitialReadiness(readiness, releaseId) {
  validateReadinessShape(readiness)
  if (readiness.ready !== true || readiness.db?.ok !== true || readiness.releaseId !== releaseId) throw new Error('INITIAL_READINESS')
}

function validateReadinessShape(readiness) {
  if (!readiness || typeof readiness !== 'object' || typeof readiness.releaseId !== 'string') throw new Error('ACTIVE_READINESS_FORMAT')
}

function assertPublicHealthReleaseHeader(headers, releaseId) {
  const values = String(headers).split(/\r?\n/)
    .map((line) => line.match(/^x-ilsangkit-release-id:\s*(.+?)\s*$/i)?.[1])
    .filter(Boolean)
  if (values.length !== 1 || values[0] !== releaseId) throw new Error('PUBLIC_HEALTH_RELEASE')
}

function validateActiveState(state) {
  if (state?.format !== FORMAT || !FULL_SHA.test(state.fullSha ?? '') || state.releaseId !== releaseIdForSha(state.fullSha)) throw new Error('ACTIVE_APP_FORMAT')
}

function assertReadinessForActiveApp(state, readiness) {
  validateReadinessShape(readiness)
  if (readiness.ready !== true || readiness.db?.ok !== true || readiness.releaseId !== state.releaseId) throw new Error('ACTIVE_APP_READINESS')
}

function ensureSecureStateRoot(stateRoot, { create }) {
  const root = resolve(stateRoot)
  if (create) assertNoSymlinkPathComponents(dirname(root), 'STATE_PATH')
  if (create) mkdirSync(root, { recursive: true, mode: 0o700 })
  if (!existsSync(root)) throw new Error('STATE_PATH')
  assertNoSymlinkPathComponents(root, 'STATE_PATH')
  const info = lstatSync(root)
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('STATE_PATH')
  if ((info.mode & 0o077) !== 0) throw new Error('STATE_MODE')
  return realpathSync(root)
}

function assertTrustedFile(root, filePath, code) {
  const rootReal = realpathSync(resolve(root))
  const file = resolve(filePath)
  assertNoSymlinkPathComponents(file, code)
  const info = lstatSync(file)
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(code)
  const realFile = realpathSync(file)
  assertPathContained(rootReal, realFile, `${code}_ESCAPE`)
}

function assertNoSymlinkPathComponents(path, code) {
  const resolved = resolve(path)
  const parsed = parse(resolved)
  let current = parsed.root
  const rest = resolved.slice(parsed.root.length).split(sep).filter(Boolean)
  for (const part of rest) {
    current = join(current, part)
    if (!existsSync(current)) return
    if (lstatSync(current).isSymbolicLink() && !isAllowedSystemSymlink(current)) throw new Error(`${code}_SYMLINK`)
  }
}

function isAllowedSystemSymlink(path) {
  return path === '/var' || path === '/tmp'
}

function assertPathContained(root, child, code) {
  const rel = relative(resolve(root), resolve(child))
  if (rel === '' || (!rel.startsWith('..') && !isAbsolute(rel))) return
  throw new Error(code)
}

function validateExistingActiveTarget(root) {
  const target = join(root, 'active-app.json')
  if (!existsSync(target)) return null
  assertTrustedFile(root, target, 'ACTIVE_APP_PATH')
  const mode = lstatSync(target).mode
  if ((mode & 0o077) !== 0) throw new Error('ACTIVE_APP_MODE')
  validateActiveState(JSON.parse(readFileSync(target, 'utf8')))
}

function writePrivateJsonAtomic(root, fileName, value, injectedIo = defaultIo) {
  const io = { ...defaultIo, ...(injectedIo ?? {}) }
  const target = join(root, fileName)
  assertPathContained(root, target, 'ACTIVE_APP_ESCAPE')
  const previous = existsSync(target) ? readFileSync(target) : null
  const temp = join(root, `.${fileName}.${process.pid}.${randomUUID()}.tmp`)
  let fd = io.openSync(temp, 'wx', 0o600)
  try {
    io.writeFileSync(fd, `${JSON.stringify(value, null, 2)}\n`)
    io.fsyncSync(fd)
  } finally {
    io.closeSync(fd)
  }
  try {
    io.renameSync(temp, target)
    fsyncDirectorySync(root, io)
  } catch (error) {
    io.rmSync(temp, { force: true })
    restoreAfterFailedPublish(root, target, previous, io, error)
    throw error
  }
}

function restoreAfterFailedPublish(root, target, previous, io, originalError) {
  try {
    if (previous == null) {
      io.rmSync(target, { force: true })
    } else {
      const restoreTemp = join(root, `.active-app.restore.${process.pid}.${randomUUID()}.tmp`)
      let restoreFd = io.openSync(restoreTemp, 'wx', 0o600)
      try {
        io.writeFileSync(restoreFd, previous)
        io.fsyncSync(restoreFd)
      } finally {
        io.closeSync(restoreFd)
      }
      io.renameSync(restoreTemp, target)
    }
    try { fsyncDirectorySync(root, io) } catch {}
  } catch (restoreError) {
    const error = new Error('ACTIVE_APP_RESTORE_FAILED')
    error.cause = restoreError
    originalError.cause = error
    throw error
  }
}

function fsyncDirectorySync(root, io) {
  const dirFd = io.openSync(root, 'r')
  try { io.fsyncSync(dirFd) } finally { io.closeSync(dirFd) }
}

function assertFullSha(value, code) {
  if (!FULL_SHA.test(String(value ?? ''))) throw new Error(code)
}

async function main() {
  const command = process.argv[2]
  try {
    if (command === 'init-active') {
      const result = initActiveApp(process.argv[3], process.argv[4], process.argv[5], process.argv[6])
      process.stdout.write(`${JSON.stringify(result)}\n`)
      return
    }
    if (command === 'read-active') {
      const readiness = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')) : null
      process.stdout.write(`${JSON.stringify(readActiveApp(process.argv[3], readiness))}\n`)
      return
    }
    if (command === 'publish-active') {
      const readiness = JSON.parse(readFileSync(process.argv[5], 'utf8'))
      process.stdout.write(`${JSON.stringify(publishActiveApp(process.argv[3], process.argv[4], readiness))}\n`)
      return
    }
    if (command === 'copy-readiness') {
      process.stdout.write(`${JSON.stringify({ path: copyActiveReadinessIntoStateRoot(process.argv[3], process.argv[4]) })}\n`)
      return
    }
    throw new Error('ACTIVE_APP_COMMAND')
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) await main()
