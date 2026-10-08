import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { platform, tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const script = readFileSync('scripts/deploy/fixed-deploy.sh', 'utf8')

test('fixed activation runs one actual DB gate before app switch and publish', () => {
  assert.doesNotMatch(script, /if ! switch_application_paths/)
  assert.doesNotMatch(script, /run_database_backup\(\) \{ :; \}|run_database_applying\(\) \{ :; \}|run_database_postcheck\(\) \{ :; \}|run_database_verified\(\) \{ :; \}/)
  assert.deepEqual(runOrderHarness('normal'), [
    'candidate-install', 'freshness:locked', 'db-gate:deploy', 'app-stop', 'app-move', 'public-probes', 'publish-active',
  ])
})

test('DB gate failure blocks app switch, and mid-switch failure reaches ERR rollback', () => {
  assert.deepEqual(runOrderHarness('db-fail'), ['candidate-install', 'freshness:locked', 'db-gate:deploy'])
  assert.deepEqual(runOrderHarness('app-fail'), [
    'candidate-install', 'freshness:locked', 'db-gate:deploy', 'app-stop', 'app-move', 'app-rollback',
  ])
})

test('same SHA validates DB with postcheck and probes without switch, publish, or DB down migration', () => {
  assert.deepEqual(runOrderHarness('same-sha'), ['candidate-install', 'freshness:locked', 'db-gate:verify', 'public-probes'])
  assert.deepEqual(runOrderHarness('same-verify-fail'), ['candidate-install', 'freshness:locked', 'db-gate:verify'])
})



test('real flock rejects concurrent same and different SHA activations before side effects and releases after exit or crash', async (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-flock-contention-'))
  let holder = null
  let crash = null
  try {
    writeFileSync(join(dir, 'worker.sh'), buildFlockWorkerScript(), { mode: 0o700 })
    if (platform() !== 'linux') {
      const dockerResult = runDockerFlockContention(dir)
      if (!dockerResult) {
        t.skip('linux flock unavailable locally and docker fallback unavailable')
        return
      }
      assert.equal(dockerResult.status, 0, dockerResult.stderr)
      return
    }

    const runner = localLinuxFlockRunnerIfAvailable()
    if (!runner) assert.fail('linux flock unavailable')
    holder = runner.spawnWorker(dir, {
      LABEL: 'holder-release',
      DEPLOY_SHA: 'a'.repeat(40),
      HOLD_LOCK: '1',
      RUN_ACTIVATION: '0',
    })
    await waitForFile(join(dir, 'holder-release.ready'), 5_000)

    for (const [label, sha] of [['same-contender', 'a'.repeat(40)], ['different-contender', 'b'.repeat(40)]]) {
      const contender = runner.runWorker(dir, { LABEL: label, DEPLOY_SHA: sha, RUN_ACTIVATION: '1' })
      assert.equal(contender.status, 2, contender.stderr)
    }
    assertNoEvents(dir, ['same-contender:', 'different-contender:', 'same-contender:candidate-install', 'different-contender:candidate-install'])

    writeFileSync(join(dir, 'holder-release.release'), 'release\n')
    assert.equal((await waitChild(holder, 5_000)).code, 0)
    holder = null
    const afterRelease = runner.runWorker(dir, { LABEL: 'after-release', DEPLOY_SHA: 'c'.repeat(40), RUN_ACTIVATION: '1' })
    assert.equal(afterRelease.status, 0, afterRelease.stderr)
    assertEventSequence(dir, 'after-release', ['lock-acquired', 'candidate-install', 'freshness:locked', 'db-gate:deploy', 'app-switch', 'public-probes', 'publish-active'])

    crash = runner.spawnWorker(dir, {
      LABEL: 'holder-crash',
      DEPLOY_SHA: 'd'.repeat(40),
      HOLD_LOCK: '1',
      RUN_ACTIVATION: '0',
    })
    await waitForFile(join(dir, 'holder-crash.ready'), 5_000)
    crash.kill('SIGKILL')
    await waitChild(crash, 5_000)
    crash = null
    const afterCrash = runWorkerUntilSuccess(runner, dir, { LABEL: 'after-crash', DEPLOY_SHA: 'e'.repeat(40), RUN_ACTIVATION: '1' })
    assert.equal(afterCrash.status, 0, afterCrash.stderr)
    assertEventSequence(dir, 'after-crash', ['lock-acquired', 'candidate-install', 'freshness:locked', 'db-gate:deploy', 'app-switch', 'public-probes', 'publish-active'])
  } finally {
    terminateChild(holder)
    terminateChild(crash)
    rmSync(dir, { recursive: true, force: true })
  }
})

test('exported fixed token is captured in memory and absent from npm child environment', () => {
  const result = runExportedTokenHarness()
  assert.equal(result.status, 0, result.stderr)
  assert.deepEqual(readEvents(result.eventsPath), ['npm-clean', 'npx-clean', 'freshness-token:secret-canary'])
})

test('stale candidate exits 78 before DB gate, app switch, or retire', () => {
  const result = runOrderHarnessResult('stale')
  assert.equal(result.status, 78, result.stderr)
  assert.deepEqual(readEvents(result.eventsPath), ['candidate-install', 'freshness:locked'])
})



function localLinuxFlockRunnerIfAvailable() {
  if (platform() !== 'linux') return null
  if (spawnSync('bash', ['-lc', 'command -v flock >/dev/null 2>&1']).status !== 0) return null
  return {
    runWorker(dir, env) {
      return spawnSync('bash', [join(dir, 'worker.sh')], { encoding: 'utf8', env: workerEnv(dir, env), timeout: 5_000 })
    },
    spawnWorker(dir, env) {
      return spawn('bash', [join(dir, 'worker.sh')], { encoding: 'utf8', env: workerEnv(dir, env), stdio: ['ignore', 'pipe', 'pipe'] })
    },
  }
}



function runDockerFlockContention(dir) {
  if (spawnSync('docker', ['image', 'inspect', 'node:20-bookworm-slim'], { stdio: 'ignore' }).status !== 0) return null
  writeFileSync(join(dir, 'docker-contention.sh'), buildDockerContentionScript(), { mode: 0o700 })
  const name = `fixed-flock-${process.pid}-${Date.now()}`
  try {
    return spawnSync('docker', [
      'run', '--rm', '--name', name,
      '-v', `${dir}:/h`, '-w', '/h',
      'node:20-bookworm-slim', 'timeout', '20s', 'bash', '/h/docker-contention.sh',
    ], { encoding: 'utf8', timeout: 25_000 })
  } finally {
    spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore' })
  }
}

function buildDockerContentionScript() {
  return [
    '#!/usr/bin/env bash',
    'set -Eeuo pipefail',
    'mkdir -p /tmp/fixed-flock-root/run',
    'run_worker() { LABEL="$1" DEPLOY_SHA="$2" HOLD_LOCK="${3:-0}" RUN_ACTIVATION="${4:-1}" ROOT=/tmp/fixed-flock-root EVENTS=/h/events READY="/h/$1.ready" RELEASE="/h/$1.release" bash /h/worker.sh; }',
    'start_worker() { LABEL="$1" DEPLOY_SHA="$2" HOLD_LOCK="${3:-0}" RUN_ACTIVATION="${4:-1}" ROOT=/tmp/fixed-flock-root EVENTS=/h/events READY="/h/$1.ready" RELEASE="/h/$1.release" bash /h/worker.sh & worker_pid=$!; }',
    'start_worker holder-release aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 1 0; holder="$worker_pid"',
    'for i in $(seq 1 100); do [ -f /h/holder-release.ready ] && break; sleep 0.05; done; [ -f /h/holder-release.ready ] || { echo holder release not ready >&2; exit 20; }',
    'set +e',
    'run_worker same-contender aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa 0 1',
    'same_status=$?',
    'run_worker different-contender bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb 0 1',
    'different_status=$?',
    'set -e',
    'if [ "$same_status" -eq 0 ]; then echo same contender acquired lock >&2; exit 10; fi',
    'if [ "$same_status" -ne 2 ]; then echo same contender wrong status >&2; exit 11; fi',
    'if [ "$different_status" -eq 0 ]; then echo different contender acquired lock >&2; exit 12; fi',
    'if [ "$different_status" -ne 2 ]; then echo different contender wrong status >&2; exit 13; fi',
    '! grep -Eq "^(same-contender|different-contender):" /h/events',
    'touch /h/holder-release.release',
    'wait "$holder"',
    'run_worker after-release cccccccccccccccccccccccccccccccccccccccc 0 1',
    'grep -Fx after-release:publish-active /h/events',
    'start_worker holder-crash dddddddddddddddddddddddddddddddddddddddd 1 0; crash="$worker_pid"',
    'for i in $(seq 1 100); do [ -f /h/holder-crash.ready ] && break; sleep 0.05; done; [ -f /h/holder-crash.ready ] || { echo holder crash not ready >&2; exit 21; }',
    'kill -9 "$crash"',
    'wait "$crash" || true',
    'after_crash_status=1',
    'for attempt in $(seq 1 20); do if run_worker after-crash eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee 0 1; then after_crash_status=0; break; fi; sleep 0.05; done',
    'if [ "$after_crash_status" -ne 0 ]; then echo after crash lock did not release >&2; exit 14; fi',
    'grep -Fx after-crash:publish-active /h/events',
  ].join('\n')
}

function workerEnv(dir, env) {
  return {
    PATH: process.env.PATH,
    ROOT: dir,
    EVENTS: join(dir, 'events'),
    READY: join(dir, `${env.LABEL}.ready`),
    RELEASE: join(dir, `${env.LABEL}.release`),
    ...env,
  }
}

function buildFlockWorkerScript() {
  return [
    '#!/usr/bin/env bash',
    'set -Eeuo pipefail',
    'mkdir -p "$ROOT/run"',
    'fail() { echo "[fixed-deploy] $*" >&2; return 2; }',
    'record_event() { printf "%s\\n" "$LABEL:$1" >> "$EVENTS"; }',
    'install_candidate_dependencies() { record_event candidate-install; }',
    'assert_candidate_fresh() { record_event "freshness:$1"; }',
    'is_same_sha_active() { return 1; }',
    'run_database_deploy() { record_event db-gate:deploy; }',
    'run_database_verify() { record_event db-gate:verify; }',
    'switch_application_paths() { record_event app-switch; }',
    'run_public_probes() { record_event public-probes; }',
    'publish_active_app() { record_event publish-active; }',
    extractFunction('run_fixed_activation_order'),
    extractFlockLines(),
    'record_event lock-acquired',
    'printf ready > "$READY"',
    'if [ "${HOLD_LOCK:-0}" = 1 ]; then while [ ! -f "$RELEASE" ]; do sleep 0.05; done; fi',
    'if [ "${RUN_ACTIVATION:-1}" = 1 ]; then run_fixed_activation_order; fi',
  ].join('\n')
}

function extractFlockLines() {
  const lines = script.split('\n')
  const start = lines.findIndex(line => line.includes('exec 9>"$ROOT/run/fixed-deploy.lock"'))
  assert.ok(start >= 0, 'fixed deploy must lock the shared deployment file descriptor')
  assert.match(lines[start + 1], /flock -n 9 \|\| fail/)
  return `${lines[start]}\n${lines[start + 1]}`
}

async function waitForFile(path, timeoutMs) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (existsSync(path)) return
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error(`timed out waiting for ${path}`)
}

function waitChild(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => {
      terminateChild(child)
      reject(new Error(`child timed out after ${timeoutMs}ms stdout=${stdout} stderr=${stderr}`))
    }, timeoutMs)
    child.stdout?.on('data', chunk => { stdout += chunk })
    child.stderr?.on('data', chunk => { stderr += chunk })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, stdout, stderr })
    })
  })
}

function terminateChild(child) {
  if (!child || child.killed || child.exitCode !== null) return
  child.kill('SIGTERM')
  setTimeout(() => {
    if (!child.killed && child.exitCode === null) child.kill('SIGKILL')
  }, 250).unref?.()
}

function assertEventSequence(dir, label, suffixes) {
  const events = readEventsWithoutCleanup(join(dir, 'events')).filter(event => event.startsWith(`${label}:`))
  assert.deepEqual(events, suffixes.map(suffix => `${label}:${suffix}`))
}

function assertNoEvents(dir, prefixes) {
  const events = readEventsWithoutCleanup(join(dir, 'events'))
  for (const prefix of prefixes) assert.equal(events.some(event => event.startsWith(prefix)), false, `${prefix} should not run while lock is held`)
}

function readEventsWithoutCleanup(path) {
  return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n').filter(Boolean) : []
}


function runWorkerUntilSuccess(runner, dir, env) {
  let last = null
  for (let attempt = 0; attempt < 20; attempt += 1) {
    last = runner.runWorker(dir, env)
    if (last.status === 0) return last
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 50)
  }
  return last
}

function runExportedTokenHarness() {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-token-env-'))
  const eventsPath = join(dir, 'events')
  const prelude = script.slice(0, script.indexOf('fail() {'))
  const install = extractFunction('install_candidate_dependencies')
  const freshness = extractFunction('assert_candidate_fresh')
  const harness = [
    'set -Eeuo pipefail',
    `EVENTS=${shellQuote(eventsPath)}`,
    `mkdir -p ${shellQuote(join(dir, 'backend'))}`,
    "fail() { echo \"$*\" >&2; return 2; }",
    'record_event() { printf "%s\\n" "$1" >> "$EVENTS"; }',
    'npm() { if env | grep -Eq "^(FIXED_GITHUB_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_TOKEN)="; then record_event npm-leaked; return 3; fi; record_event npm-clean; }',
    'npx() { if env | grep -Eq "^(FIXED_GITHUB_TOKEN|GITHUB_TOKEN|GH_TOKEN|ACTIONS_TOKEN)="; then record_event npx-leaked; return 3; fi; record_event npx-clean; }',
    'node() { if [ "$1" = "$DB_HELPER" ] && [ "$2" = freshness ]; then record_event "freshness-token:$GITHUB_TOKEN"; return 0; fi; command node "$@"; }',
    prelude,
    `NEW=${shellQuote(dir)}`,
    `DB_HELPER=${shellQuote(join(dir, 'fixed-db.mjs'))}`,
    `ATTEMPT=${shellQuote(dir)}`,
    install,
    freshness,
    'install_candidate_dependencies',
    'assert_candidate_fresh locked',
  ].join('\n')
  const result = spawnSync('bash', ['-c', harness], {
    encoding: 'utf8',
    env: {
      ...process.env,
      DEPLOY_SHA: 'a'.repeat(40),
      FIXED_GITHUB_TOKEN: 'secret-canary',
      GITHUB_TOKEN: 'outer-github',
      GH_TOKEN: 'outer-gh',
      ACTIONS_TOKEN: 'outer-actions',
    },
  })
  return { ...result, eventsPath, dir }
}

function runOrderHarness(scenario) {
  const result = runOrderHarnessResult(scenario)
  const expectedStatus = ['db-fail', 'app-fail', 'same-verify-fail'].includes(scenario) ? 2 : 0
  assert.equal(result.status, expectedStatus, result.stderr)
  return readEvents(result.eventsPath)
}

function runOrderHarnessResult(scenario) {
  const dir = mkdtempSync(join(tmpdir(), 'fixed-db-order-'))
  const eventsPath = join(dir, 'events')
  const activation = extractFunction('run_fixed_activation_order')
  const harness = [
    'set -Eeuo pipefail',
    `EVENTS=${shellQuote(eventsPath)}`,
    'INSTALL_STARTED=0',
    'record_event() { printf "%s\\n" "$1" >> "$EVENTS"; }',
    'trap \'status=$?; if [ "$INSTALL_STARTED" -eq 1 ]; then record_event app-rollback; fi; exit "$status"\' ERR',
    'install_candidate_dependencies() { record_event candidate-install; }',
    'assert_candidate_fresh() { record_event "freshness:$1"; if [ "$SCENARIO" = stale ]; then return 78; fi; }',
    'is_same_sha_active() { [ "$SCENARIO" = same-sha ] || [ "$SCENARIO" = same-verify-fail ]; }',
    'run_database_verify() { record_event db-gate:verify; if [ "$SCENARIO" = same-verify-fail ]; then return 2; fi; }',
    'run_database_deploy() { record_event db-gate:deploy; if [ "$SCENARIO" = db-fail ]; then return 2; fi; }',
    'switch_application_paths() { INSTALL_STARTED=1; record_event app-stop; record_event app-move; if [ "$SCENARIO" = app-fail ]; then return 2; fi; }',
    'run_public_probes() { record_event public-probes; }',
    'publish_active_app() { record_event publish-active; }',
    activation,
    'run_fixed_activation_order',
  ].join('\n')
  const result = spawnSync('bash', ['-c', harness], { encoding: 'utf8', env: { ...process.env, SCENARIO: scenario } })
  return { ...result, eventsPath, dir }
}

function extractFunction(name) {
  const marker = `${name}() {`
  const start = script.indexOf(marker)
  assert.ok(start >= 0, `${name} must be defined in fixed-deploy.sh`)
  let depth = 0
  let end = -1
  for (let i = start; i < script.length; i += 1) {
    if (script[i] === '{') depth += 1
    if (script[i] === '}') {
      depth -= 1
      if (depth === 0) { end = i + 1; break }
    }
  }
  assert.ok(end > start, `${name} function must close`)
  return script.slice(start, end)
}

function readEvents(path) {
  try { return readFileSync(path, 'utf8').trim().split('\n').filter(Boolean) } finally { rmSync(join(path, '..'), { recursive: true, force: true }) }
}

function shellQuote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`
}
