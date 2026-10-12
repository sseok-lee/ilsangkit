import assert from 'node:assert/strict'
import * as fs from 'node:fs'
import { mkdtempSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { copyActiveReadinessIntoStateRoot, initActiveApp, publishActiveApp, readActiveApp } from './db-active-app.mjs'

const sha = 'a'.repeat(40)
const other = 'b'.repeat(40)
const releaseId = `fixed-${sha.slice(0, 12)}`

test('init-active creates missing active checkpoint only after local readiness and public release header match', () => {
  const dir = secureTemp('db-active-init-')
  try {
    const readinessPath = join(dir, 'initial-readiness.json')
    const headersPath = join(dir, 'initial-public-health.headers')
    writeFileSync(readinessPath, JSON.stringify({ ready: true, db: { ok: true }, releaseId }))
    writeFileSync(headersPath, `HTTP/2 200\nx-ilsangkit-release-id: ${releaseId}\n`)
    const created = initActiveApp(dir, sha, readinessPath, headersPath)
    assert.equal(created.status, 'initialized')
    assert.equal(readActiveApp(dir).fullSha, sha)
    assert.equal(statSync(join(dir, 'active-app.json')).mode & 0o777, 0o600)
    assert.equal(initActiveApp(dir, sha, readinessPath, headersPath).status, 'idempotent')
    assert.throws(() => initActiveApp(dir, other, readinessPath, headersPath), /ACTIVE_APP_EXISTS|ACTIVE_APP_READINESS/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('init-active rejects contradictory readiness or public health release identity', () => {
  const dir = secureTemp('db-active-bad-')
  try {
    const readinessPath = join(dir, 'initial-readiness.json')
    const headersPath = join(dir, 'initial-public-health.headers')
    writeFileSync(readinessPath, JSON.stringify({ ready: true, db: { ok: false }, releaseId }))
    writeFileSync(headersPath, `x-ilsangkit-release-id: ${releaseId}\n`)
    assert.throws(() => initActiveApp(dir, sha, readinessPath, headersPath), /INITIAL_READINESS/)
    writeFileSync(readinessPath, JSON.stringify({ ready: true, db: { ok: true }, releaseId }))
    writeFileSync(headersPath, 'x-ilsangkit-release-id: fixed-deadbeef0000\n')
    assert.throws(() => initActiveApp(dir, sha, readinessPath, headersPath), /PUBLIC_HEALTH_RELEASE/)
    writeFileSync(headersPath, `x-ilsangkit-release-id: ${releaseId}\nx-ilsangkit-release-id: ${releaseId}\n`)
    assert.throws(() => initActiveApp(dir, sha, readinessPath, headersPath), /PUBLIC_HEALTH_RELEASE/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('normal publish and read require matching readiness and reject missing active app', () => {
  const dir = secureTemp('db-active-publish-')
  try {
    const readiness = { ready: true, db: { ok: true }, releaseId }
    assert.throws(() => readActiveApp(dir), /ACTIVE_APP_REQUIRED/)
    assert.throws(() => publishActiveApp(dir, sha, { ...readiness, releaseId: 'wrong' }), /ACTIVE_APP_READINESS/)
    publishActiveApp(dir, sha, readiness)
    assert.equal(readActiveApp(dir, readiness).fullSha, sha)
    assert.throws(() => readActiveApp(dir, { ...readiness, releaseId: 'wrong' }), /ACTIVE_APP_READINESS/)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('copy readiness writes trusted private file inside the state root and rejects path escape', () => {
  const dir = secureTemp('db-active-copy-')
  const outside = secureTemp('db-active-outside-')
  try {
    const source = join(outside, 'readiness.json')
    writeFileSync(source, JSON.stringify({ ready: true, db: { ok: true }, releaseId }))
    assert.equal(copyActiveReadinessIntoStateRoot(dir, source), join(realpathSync(dir), 'active-readiness.json'))
    const inside = join(dir, 'source-readiness.json')
    writeFileSync(inside, JSON.stringify({ ready: true, db: { ok: true }, releaseId }))
    const copied = copyActiveReadinessIntoStateRoot(dir, inside)
    assert.equal(copied, join(realpathSync(dir), 'active-readiness.json'))
    assert.equal(JSON.parse(readFileSync(copied)).releaseId, releaseId)
    assert.equal(statSync(copied).mode & 0o777, 0o600)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})


test('publish keeps old active SHA if post-rename directory fsync fails', () => {
  const dir = secureTemp('db-active-fsync-')
  try {
    const oldRelease = `fixed-${other.slice(0, 12)}`
    publishActiveApp(dir, other, { ready: true, db: { ok: true }, releaseId: oldRelease })
    const io = failingDirectoryFsyncOnce(dir)
    assert.throws(() => publishActiveApp(dir, sha, { ready: true, db: { ok: true }, releaseId }, { io }), /DIR_FSYNC_FAIL/)
    assert.equal(readActiveApp(dir).fullSha, other)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('publish validates an existing active target before overwrite and refuses symlink creation paths', () => {
  const dir = secureTemp('db-active-target-')
  try {
    const outside = secureTemp('db-active-target-outside-')
    try {
      writeFileSync(join(outside, 'active-app.json'), '{}')
      symlinkSync(join(outside, 'active-app.json'), join(dir, 'active-app.json'))
      assert.throws(() => publishActiveApp(dir, sha, { ready: true, db: { ok: true }, releaseId }), /ACTIVE_APP_PATH_SYMLINK/)
      rmSync(join(dir, 'active-app.json'), { force: true })
      const linkedRoot = join(dir, 'linked-root')
      symlinkSync(outside, linkedRoot)
      assert.throws(() => publishActiveApp(join(linkedRoot, 'child'), sha, { ready: true, db: { ok: true }, releaseId }), /STATE_PATH_SYMLINK/)
    } finally { rmSync(outside, { recursive: true, force: true }) }
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('trusted state paths reject symlink ancestors and CLI uses the init-active contract', () => {
  const dir = secureTemp('db-active-symlink-')
  try {
    const real = join(dir, 'real')
    mkdirSync(real, { mode: 0o700 })
    symlinkSync(real, join(dir, 'linked'))
    assert.throws(() => publishActiveApp(join(dir, 'linked'), sha, { ready: true, db: { ok: true }, releaseId }), /STATE_PATH_SYMLINK/)

    const readinessPath = join(real, 'initial-readiness.json')
    const headersPath = join(real, 'initial-public-health.headers')
    writeFileSync(readinessPath, JSON.stringify({ ready: true, db: { ok: true }, releaseId }))
    writeFileSync(headersPath, `x-ilsangkit-release-id: ${releaseId}\n`)
    const result = spawnSync(process.execPath, ['scripts/deploy/db-active-app.mjs', 'init-active', real, sha, readinessPath, headersPath], { encoding: 'utf8' })
    assert.equal(result.status, 0, result.stderr)
    assert.equal(JSON.parse(result.stdout).status, 'initialized')
  } finally { rmSync(dir, { recursive: true, force: true }) }
})


function failingDirectoryFsyncOnce(dir) {
  const root = realpathSync(dir)
  const dirFds = new Set()
  let failed = false
  return {
    openSync(path, flags, mode) {
      const fd = fs.openSync(path, flags, mode)
      if (realpathSync(path) === root) dirFds.add(fd)
      return fd
    },
    writeFileSync: fs.writeFileSync,
    closeSync: fs.closeSync,
    renameSync: fs.renameSync,
    rmSync: fs.rmSync,
    fsyncSync(fd) {
      if (dirFds.has(fd) && !failed) {
        failed = true
        throw new Error('DIR_FSYNC_FAIL')
      }
      return fs.fsyncSync(fd)
    },
  }
}

function secureTemp(prefix) {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  return dir
}
