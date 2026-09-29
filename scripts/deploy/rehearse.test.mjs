import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import test from 'node:test'
import {
  assertExpectedFailureEvidence,
  buildRuntimePlan,
  generateRehearsalProbes,
  makeRehearsalBuildingKey,
  parseCommandOutput,
  prepareRehearsalArtifacts,
  prepareRuntimeAdapterFiles,
  classifyProbeResult,
  createProbePlan,
  executeRuntimePlan,
  runRehearsalCli,
  runLongInflightSwitchProbes,
  runContinuousProbeWhile,
  runContinuousProbePhase,
  runProbePlan,
  summarizeProbeRecords,
  validateRuntimePreflight,
  validateRehearsalInventory,
} from './rehearse.mjs'

const baseProbe = {
  name: 'apt-sale-list',
  path: '/real-estate/apt-sale',
  expect: {
    status: 200,
    releaseId: 'address-a',
    addressKey: 'apt:1168010100:역삼동:123',
    total: 2,
    minItems: 1,
    assetStatus: 200,
  },
}

function requiredProbes() {
  const typeProbes = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'].map((type) => ({
    name: `${type}-list`,
    path: `/real-estate/${type}/seoul/gangnam`,
    expect: { status: 200, releaseId: 'address-a', total: 2, minItems: 1 },
  }))
  return [
    { name: 'home', path: '/', expect: { status: 200, releaseId: 'address-a' } },
    { name: 'api-health', path: '/api/health', expect: { status: 200, releaseId: 'address-a' } },
    { name: 'sitemap', path: '/sitemap.xml', expect: { status: 200, releaseId: 'address-a' } },
    { name: 'same-name-address-a', path: '/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=같은이름검증&buildingKey=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', expect: { status: 200, releaseId: 'address-a', addressKey: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
    { name: 'same-name-address-b', path: '/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=같은이름검증&buildingKey=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', expect: { status: 200, releaseId: 'address-a', addressKey: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } },
    { name: 'same-name-address-a-html', path: '/real-estate/apt-sale/seoul/gangnam/같은이름검증/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', expect: { status: 200, releaseId: 'address-a', bodyIncludes: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
    { name: 'same-name-address-b-html', path: '/real-estate/apt-sale/seoul/gangnam/같은이름검증/bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', expect: { status: 200, releaseId: 'address-a', bodyIncludes: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' } },
    { name: 'land-query-a', path: '/api/real-estate/land/transactions?keyword=A', expect: { status: 200, releaseId: 'address-a', total: 2, minItems: 1 } },
    { name: 'land-query-b', path: '/api/real-estate/land/transactions?keyword=B', expect: { status: 200, releaseId: 'address-a', total: 2, minItems: 1 } },
    { name: 'land-query-a-html', path: '/real-estate/land/seoul/gangnam/역삼동?q=A', expect: { status: 200, releaseId: 'address-a', bodyIncludes: '토지' } },
    { name: 'land-query-b-html', path: '/real-estate/land/seoul/gangnam/역삼동?q=B', expect: { status: 200, releaseId: 'address-a', bodyIncludes: '토지' } },
    { name: 'hashed-asset', path: '/_nuxt/app.abc123.js', expect: { status: 200, releaseId: 'address-a', assetStatus: 200 } },
    { name: 'old-unkeyed-detail', path: '/real-estate/apt-sale/seoul/gangnam/같은이름검증', expect: { status: 200, releaseId: 'address-a' } },
    { name: 'new-keyed-retention', path: '/real-estate/apt-sale/seoul/gangnam/같은이름검증/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', expect: { status: 200, releaseId: 'address-a', bodyIncludes: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' } },
    { name: 'retained-old-asset', path: '/_nuxt/oldhash.js', expect: { status: 200, releaseId: 'address-a', assetStatus: 200 } },
    { name: 'retained-old-html-hash', path: '/real-estate/apt-sale/seoul/gangnam/같은이름검증', extractAsset: true, expect: { status: 200, releaseId: 'address-a', oldHash: 'oldhash' } },
    { name: 'long-inflight-switch', path: '/api/rehearsal/slow', longInflight: true, expect: { status: 200, releaseId: 'old-main', completedAfterCommand: true } },
    ...typeProbes,
  ]
}

function requiredFailureMatrix() {
  return [
    'invalid-check',
    'city-timeout',
    'lock-busy',
    'candidate-api-down',
    'nginx-test-failure',
    'reload-failure',
    'post-pointer-orchestrator-exit',
    'smoke-failure',
    'forced-rollback',
  ].map((name) => ({
    name,
    command: process.execPath,
    args: ['-e', `process.stderr.write(${JSON.stringify(`${name} expected failure`)}); process.exit(2)`],
    expectedExitCode: 2,
    expectedErrorPattern: `${name} expected failure`,
    setupCommand: process.execPath,
    setupArgs: ['-e', 'process.exit(0)'],
    teardownCommand: process.execPath,
    teardownArgs: ['-e', 'process.exit(0)'],
    probePhase: 'rollback-retention',
    expectedOutcome: 'previous-service-remains-readable',
  }))
}

function validInventory(extra = {}) {
  return {
    publicOrigin: 'http://127.0.0.1:19000',
    proxyPort: 19000,
    deployRoot: '/tmp/ilsangkit-c3-runtime-test',
    releasesRoot: '/tmp/ilsangkit-c3-runtime-test/releases',
    nginxConfigPath: '/tmp/ilsangkit-c3-runtime-test/nginx/nginx.conf',
    nginxIncludePath: '/tmp/ilsangkit-c3-runtime-test/nginx/active.conf',
    reservePorts: [13000, 13001, 13002, 13003, 13004, 18000, 18001, 18002, 18003, 18004, 19000],
    releaseScriptPath: 'scripts/deploy/release.mjs',
    summaryTransitionScriptPath: 'backend/dist/scripts/runSummaryTransition.js',
    rehearsalInventoryPath: '/tmp/ilsangkit-c3/c3-local-inventory.json',
    inventoryPath: '/tmp/ilsangkit-c3/release-inventory.json',
    manifestPath: '/tmp/ilsangkit-c3/address-manifest.json',
    compatibilityManifestPath: '/tmp/ilsangkit-c3/compat-manifest.json',
    summaryTransitionReportPath: '/tmp/ilsangkit-c3/summary-transition-report.json',
    phaseDurationMs: 200,
    longInflightStartSignalPath: null,
    probes: requiredProbes(),
    failureMatrix: requiredFailureMatrix(),
    normalDeploys: [
      { name: 'normal-deploy-1', manifestPath: '/tmp/ilsangkit-c3/normal-1.json', expectSummaryPrepareCalls: 0, expectAssetDeleteCalls: 0 },
      { name: 'normal-deploy-2', manifestPath: '/tmp/ilsangkit-c3/normal-2.json', expectSummaryPrepareCalls: 0, expectAssetDeleteCalls: 0 },
    ],
    retention: {
      rollbackReleaseId: 'compat-a',
      oldUnkeyedUrl: '/real-estate/apt-sale/seoul/gangnam/같은이름검증',
      newKeyedUrl: '/real-estate/apt-sale/seoul/gangnam/같은이름검증/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      oldAssetPath: '/_nuxt/oldhash.js',
      oldAssetHash: 'oldhash',
      longInflightUrl: '/api/rehearsal/slow',
      expectOldAssetsStatus: 200,
      expectRollbackReadable: true,
    },
    dbFixture: {
      urlEnv: 'C3_REHEARSAL_TEST_DATABASE_URL',
      guard: 'testDatabaseGuard localhost3307 *_test',
      recipe: 'C1 schema + B3 prepare/verify generates V2 and ready singleton; no seeded ready state',
      requiredTables: ['RealEstateBuildingSummaryV2', 'RealEstateSummaryState'],
    },
    ...extra,
  }
}

test('createProbePlan schedules at most five requests per second while cycling probes', () => {
  const plan = createProbePlan([
    { name: 'home', path: '/' },
    { name: 'api', path: '/api/health' },
  ], { durationMs: 2_000 })

  assert.equal(plan.length, 10)
  assert.deepEqual(plan.slice(0, 4).map((entry) => [entry.probe.name, entry.plannedAtMs]), [
    ['home', 0],
    ['api', 200],
    ['home', 400],
    ['api', 600],
  ])
  for (let windowStart = 0; windowStart < 2_000; windowStart += 1_000) {
    const inWindow = plan.filter((entry) => entry.plannedAtMs >= windowStart && entry.plannedAtMs < windowStart + 1_000)
    assert.ok(inWindow.length <= 5)
  }
})

test('classifyProbeResult counts transport, timeout, status, release, address, total, and asset failures', () => {
  const records = [
    classifyProbeResult(baseProbe, { error: { code: 'ECONNREFUSED', message: 'connect refused' }, latencyMs: 4 }),
    classifyProbeResult(baseProbe, { timedOut: true, latencyMs: 51 }),
    classifyProbeResult(baseProbe, { status: 502, releaseId: 'address-a', latencyMs: 7 }),
    classifyProbeResult(baseProbe, {
      status: 200,
      releaseId: 'compat-b',
      addressKey: 'wrong-address',
      total: 3,
      items: [],
      assetStatus: 404,
      latencyMs: 9,
    }),
  ]

  const summary = summarizeProbeRecords(records)

  assert.equal(summary.total, 4)
  assert.equal(summary.failed, 4)
  assert.deepEqual(summary.failuresByType, {
    address: 1,
    asset: 1,
    release: 1,
    status: 1,
    timeout: 1,
    total: 2,
    transport: 1,
  })
})


test('classifyProbeResult validates totals against the observed release id when a phase spans a switch', () => {
  const probe = {
    name: 'apt-sale-list',
    path: '/api/real-estate/apt-sale/complexes',
    expect: { status: 200, releaseIds: ['old-main', 'address-a'], totalByReleaseId: { 'old-main': 1, 'address-a': 2 }, minItems: 1 },
  }

  const oldRecord = classifyProbeResult(probe, { status: 200, releaseId: 'old-main', total: 1, items: [{}] })
  const addressRecord = classifyProbeResult(probe, { status: 200, releaseId: 'address-a', total: 2, items: [{}, {}] })
  const mismatch = classifyProbeResult(probe, { status: 200, releaseId: 'address-a', total: 1, items: [{}] })

  assert.equal(oldRecord.ok, true)
  assert.equal(addressRecord.ok, true)
  assert.equal(mismatch.ok, false)
  assert.match(mismatch.errors.find((error) => error.type === 'total').message, /expected total 2/)
})

test('runProbePlan enforces max concurrency four and turns slow probes into timeout records', async () => {
  const plan = Array.from({ length: 8 }, (_, index) => ({
    probe: { name: `probe-${index}`, path: `/probe-${index}`, expect: { status: 200 } },
    plannedAtMs: 0,
    sequence: index,
  }))
  let active = 0
  let maxActive = 0

  const records = await runProbePlan(plan, {
    concurrency: 4,
    timeoutMs: 5,
    sleep: async () => {},
    request: async ({ probe, signal }) => {
      active += 1
      maxActive = Math.max(maxActive, active)
      try {
        await new Promise((resolve, reject) => {
          const timer = setTimeout(resolve, probe.name === 'probe-0' ? 20 : 1)
          signal.addEventListener('abort', () => {
            clearTimeout(timer)
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          }, { once: true })
        })
        return { status: 200, latencyMs: 1 }
      } finally {
        active -= 1
      }
    },
  })

  assert.equal(maxActive, 4)
  assert.equal(records.length, 8)
  assert.equal(records.filter((record) => record.errors.some((error) => error.type === 'timeout')).length, 1)
})

test('runContinuousProbePhase waits for ordinary HTML response bodies before releasing probe slots', async () => {
  const probe = { name: 'ordinary-html', path: '/html', expect: { status: 200, releaseId: 'address-a' } }
  let releaseBody
  const bodyReleased = new Promise((resolve) => { releaseBody = resolve })
  const runPromise = runContinuousProbePhase(
    { name: 'phase', durationMs: 200, rps: 5, concurrency: 1 },
    [probe],
    {
      publicOrigin: 'http://example.test',
      fetch: async () => ({
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/html' : 'address-a') },
        text: async () => {
          await bodyReleased
          return '<html>ordinary body</html>'
        },
      }),
    },
  )

  let settled = false
  runPromise.then(() => { settled = true }, () => { settled = true })
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(settled, false)
  releaseBody()
  const result = await runPromise

  assert.equal(result.records[0].ok, true)
  assert.equal(result.records[0].bodyBytes, '<html>ordinary body</html>'.length)
})

test('runProbePlan aborts a timed-out probe and continues without waiting forever', async () => {
  const plan = [
    { probe: { name: 'never-settles', path: '/slow', expect: { status: 200 } }, plannedAtMs: 0, sequence: 0 },
    { probe: { name: 'next-probe', path: '/next', expect: { status: 200 } }, plannedAtMs: 0, sequence: 1 },
  ]
  let abortObserved = false

  const records = await Promise.race([
    runProbePlan(plan, {
      concurrency: 1,
      timeoutMs: 5,
      sleep: async () => {},
      request: async ({ probe, signal }) => {
        if (probe.name === 'next-probe') return { status: 200, latencyMs: 1 }
        return await new Promise((_, reject) => {
          signal.addEventListener('abort', () => {
            abortObserved = true
            reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))
          }, { once: true })
        })
      },
    }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('runProbePlan did not return after timeout')), 60)),
  ])

  assert.equal(abortObserved, true)
  assert.equal(records.length, 2)
  assert.equal(records[0].ok, false)
  assert.equal(records[0].errors[0].type, 'timeout')
  assert.equal(records[1].ok, true)
})

test('runProbePlan clears timeout after a fast success so completed probes are not aborted later', async () => {
  let capturedSignal
  const records = await runProbePlan([
    { probe: { name: 'fast', path: '/fast', expect: { status: 200 } }, plannedAtMs: 0, sequence: 0 },
  ], {
    concurrency: 1,
    timeoutMs: 20,
    sleep: async () => {},
    request: async ({ signal }) => {
      capturedSignal = signal
      return { status: 200, latencyMs: 1 }
    },
  })

  await new Promise((resolve) => setTimeout(resolve, 40))

  assert.equal(records[0].ok, true)
  assert.equal(capturedSignal.aborted, false)
})

test('validateRehearsalInventory requires six types, address identity, failure matrix, retention, and normal deploy guarantees', () => {
  assert.equal(validateRehearsalInventory(validInventory()), true)

  const missingType = validInventory({ probes: requiredProbes().filter((probe) => probe.name !== 'offitel-rent-list') })
  assert.throws(() => validateRehearsalInventory(missingType), /offitel-rent-list/)

  for (const requiredRetentionProbe of ['old-unkeyed-detail', 'new-keyed-retention', 'retained-old-asset', 'retained-old-html-hash', 'long-inflight-switch']) {
    const missingRetention = validInventory({ probes: requiredProbes().filter((probe) => probe.name !== requiredRetentionProbe) })
    assert.throws(() => validateRehearsalInventory(missingRetention), new RegExp(requiredRetentionProbe))
  }

  const oneDeploy = validInventory({ normalDeploys: [{ name: 'only-deploy', expectSummaryPrepareCalls: 0, expectAssetDeleteCalls: 0 }] })
  assert.throws(() => validateRehearsalInventory(oneDeploy), /two normal deploy/)
})

test('buildRuntimePlan prepares guarded real release orchestration without executing runtime', () => {
  const plan = buildRuntimePlan(validInventory(), { phaseDurationMs: 200 })

  assert.equal(plan.stage, 'guarded-runtime-plan')
  assert.equal(plan.execute, false)
  assert.deepEqual(plan.continuousPhases.map((phase) => [phase.name, phase.command, phase.rps, phase.concurrency]), [
    ['old-baseline', null, 5, 4],
    ['first-transition-schema-prepare-check-switch', 'summary-transition', 5, 4],
    ['post-switch-address', null, 5, 4],
    ['rollback-transition', 'release-rollback', 5, 4],
    ['rollback-retention', null, 5, 4],
  ])
  assert.equal(plan.failureMatrix.length, 9)
  assert.deepEqual(plan.normalDeploys.map((deploy) => deploy.command), ['release-deploy', 'release-deploy'])
  assert.match(plan.preparedRuntimeCommand, /c3-local-inventory\.json/)
  assert.match(plan.preparedRuntimeCommand, /--execute/)
  assert.ok(plan.prerequisites.some((item) => item.includes('B4 and C2 reviews approved')))
})

test('runRehearsalCli writes guarded runtime plan and refuses relative report paths', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-c3-rehearse-'))
  const inventoryPath = join(dir, 'inventory.json')
  const reportPath = join(dir, 'report.json')
  writeFileSync(inventoryPath, `${JSON.stringify(validInventory(), null, 2)}\n`)

  await assert.rejects(
    () => runRehearsalCli([`--inventory=${inventoryPath}`, '--report=relative-report.json']),
    /absolute path/,
  )

  const report = await runRehearsalCli([`--inventory=${inventoryPath}`, `--report=${reportPath}`])
  const written = JSON.parse(readFileSync(reportPath, 'utf8'))

  assert.equal(report.stage, 'guarded-runtime-plan')
  assert.equal(written.execute, false)
  assert.match(written.preparedRuntimeCommand, /scripts\/deploy\/rehearse\.mjs/)
  assert.deepEqual(written.outstanding, ['actual proxy/server release switching waits for C2/B4 readiness gates and --execute'])
})

test('executeRuntimePlan can run summary transition from explicit backend cwd with absolute script paths', async () => {
  const backendCwd = '/tmp/ilsangkit-c3-backend-cwd'
  const inventory = validInventory({ phaseDurationMs: 1, summaryTransitionCwd: backendCwd })
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  let transitionRun
  const fetch = async (url) => {
    const path = new URL(String(url)).pathname
    const isApi = path.startsWith('/api/')
    const releaseId = path === '/api/rehearsal/slow' ? 'old-main' : 'address-a'
    const key = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const json = { data: { releaseId, buildingKey: key, identity: { buildingKey: key }, pagination: { total: 2 }, items: [{ id: 1 }] } }
    const html = path.startsWith('/real-estate/land/')
      ? '<html><main>토지 C3 검증</main></html>'
      : `<html><script src="/_nuxt/oldhash.js"></script><main>${key}</main></html>`
    return {
      status: 200,
      headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? (isApi ? 'application/json' : 'text/html') : releaseId) },
      text: async () => isApi ? JSON.stringify(json) : html,
    }
  }

  const result = await executeRuntimePlan(plan, inventory, {
    execute: true,
    timeoutMs: 20,
    probeWindowMs: 1,
    maxProbeWindows: 1,
    skipLongInflight: true,
    fetch,
    env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
    checkPortFree: async () => true,
    runner: {
      run: async (command, args, options = {}) => {
        if (args.some((arg) => String(arg).endsWith('runSummaryTransition.js'))) {
          transitionRun = { command, args, cwd: options.cwd }
          return { command, args, cwd: options.cwd }
        }
        if (args.includes('deploy')) return { command, args, summaryPrepareCalls: 0, assetDeleteCalls: 0 }
        if (args[0] === '-e' && String(args[1]).includes('process.exit(0)')) return { command, args, hook: 'ok' }
        if (args[0] === '-e') {
          const stderr = String(args[1]).match(/write\("([^"]+)/)?.[1] ?? 'expected injected failure'
          const error = new Error(stderr)
          error.code = 2
          error.stderr = stderr
          throw error
        }
        return { command, args }
      },
    },
  })

  assert.equal(result.ready, true)
  assert.equal(transitionRun.cwd, backendCwd)
  assert.equal(transitionRun.args[0], resolve(process.cwd(), inventory.summaryTransitionScriptPath))
  assert.equal(transitionRun.args[transitionRun.args.indexOf('--release-script') + 1], resolve(process.cwd(), inventory.releaseScriptPath))
})

test('executeRuntimePlan validates preflight, runs failure matrix, and asserts measured normal deploy counts', async () => {
  const inventory = validInventory({ phaseDurationMs: 1 })
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  const commands = []
  const fetch = async (url) => {
    const path = new URL(String(url)).pathname
    const isSlow = String(url).includes('/api/rehearsal/slow')
    if (isSlow) await new Promise((resolve) => setTimeout(resolve, 5))
    const isApi = path.startsWith('/api/')
    const releaseId = isSlow ? 'old-main' : 'address-a'
    const key = path.includes('/building-info') && String(url).includes('bbbbbbbb')
      ? 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
      : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const html = path.startsWith('/real-estate/land/')
      ? '<html><main>토지 C3 검증</main></html>'
      : `<html><script src="/_nuxt/oldhash.js"></script><main>${key}</main></html>`
    const json = { data: { releaseId, buildingKey: key, identity: { buildingKey: key }, pagination: { total: 2 }, items: [{ id: 1, buildingName: 'C3공통주택' }] } }
    return {
      status: 200,
      ok: true,
      headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? (isApi ? 'application/json' : 'text/html') : releaseId) },
      json: async () => json,
      text: async () => isApi ? JSON.stringify(json) : html,
    }
  }

  await assert.rejects(
    () => executeRuntimePlan(plan, inventory, { execute: false, fetch }),
    /--execute/,
  )

  const result = await executeRuntimePlan(plan, inventory, {
    execute: true,
    timeoutMs: 20,
    probeWindowMs: 1,
    maxProbeWindows: 1,
    fetch,
    env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
    checkPortFree: async () => true,
    runner: {
      run: async (command, args) => {
        commands.push([command, ...args])
        if (args.includes(inventory.summaryTransitionScriptPath)) await new Promise((resolve) => setTimeout(resolve, 1))
        if (args.includes('deploy')) return { command, args, summaryPrepareCalls: 0, assetDeleteCalls: 0 }
        if (args[0] === '-e' && String(args[1]).includes('process.exit(0)')) return { command, args, hook: 'ok' }
        if (args[0] === '-e') {
            const stderr = String(args[1]).match(/write\(\"([^\"]+)/)?.[1] ?? 'expected injected failure'
            const error = new Error(stderr)
            error.code = 2
            error.stderr = stderr
            throw error
          }
        return { command, args }
      },
    },
  })

  assert.equal(result.ready, true)
  assert.deepEqual(result.preflight.checkedPorts, [13001, 13002, 13003, 13004, 18001, 18002, 18003, 18004])
  assert.equal(result.preflight.proxyPort, 19000)
  assert.equal(result.failureMatrix.length, 9)
  assert.ok(result.failureMatrix.every((failure) => failure.publicOutcome.transitionProbeResult?.phase === 'rollback-transition'))
  const transitionCommand = commands.find((command) => command.includes(inventory.summaryTransitionScriptPath))
  assert.ok(transitionCommand)
  assert.ok(transitionCommand.includes('--compatibility-manifest'))
  assert.ok(transitionCommand.includes(inventory.compatibilityManifestPath))
  assert.ok(transitionCommand.includes('--report-out'))
  assert.ok(transitionCommand.includes(inventory.summaryTransitionReportPath))
  assert.ok(commands.some((command) => command.includes('rollback')))
  assert.equal(commands.filter((command) => command.includes('deploy')).length, 2)
})


test('executeRuntimePlan starts long inflight from address journal signal by default', async () => {
  const dir = mkdtempSync('/tmp/ilsangkit-c3-journal-signal-')
  const manifestPath = join(dir, 'address-manifest.json')
  writeFileSync(manifestPath, JSON.stringify({ releaseId: 'address-a' }))
  const inventory = validInventory({
    deployRoot: dir,
    releasesRoot: join(dir, 'releases'),
    nginxConfigPath: join(dir, 'nginx/nginx.conf'),
    nginxIncludePath: join(dir, 'nginx/active.conf'),
    manifestPath,
  })
  delete inventory.longInflightStartSignalPath
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  let slowRequested = false
  let slowRequestStarted
  const slowRequestStartedPromise = new Promise((resolve) => { slowRequestStarted = resolve })
  const slowRequestStartTimeout = () => new Promise((_, reject) => {
    setTimeout(() => reject(new Error('long inflight request did not start from address journal signal')), 100)
  })
  const result = await executeRuntimePlan(plan, inventory, {
    execute: true,
    timeoutMs: 200,
    probeWindowMs: 1,
    maxProbeWindows: 1,
    fetch: async (url) => {
      const path = new URL(String(url)).pathname
      const isSlow = path === '/api/rehearsal/slow'
      if (isSlow) {
        slowRequested = true
        slowRequestStarted()
        await new Promise((resolve) => setTimeout(resolve, 10))
      }
      const isApi = path.startsWith('/api/')
      const releaseId = isSlow ? 'old-main' : 'address-a'
      const key = path.includes('/building-info') && String(url).includes('bbbbbbbb')
        ? 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
        : 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      const json = { data: { releaseId, buildingKey: key, identity: { buildingKey: key }, pagination: { total: 2 }, items: [{ id: 1 }] } }
      const html = path.startsWith('/real-estate/land/')
        ? '<html><main>토지 C3 검증</main></html>'
        : `<html><script src="/_nuxt/oldhash.js"></script><main>${key}</main></html>`
      return {
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? (isApi ? 'application/json' : 'text/html') : releaseId) },
        json: async () => json,
        text: async () => isApi ? JSON.stringify(json) : html,
      }
    },
    env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
    checkPortFree: async () => true,
    runner: {
      run: async (command, args) => {
        if (args.includes(inventory.summaryTransitionScriptPath)) {
          mkdirSync(join(dir, 'journal'), { recursive: true })
          await Promise.resolve()
          writeFileSync(join(dir, 'journal/address-a.json'), '{"releaseId":"address-a"}\n')
          await Promise.race([slowRequestStartedPromise, slowRequestStartTimeout()])
        }
        if (args.includes('deploy')) return { command, args, summaryPrepareCalls: 0, assetDeleteCalls: 0 }
        if (args[0] === '-e' && String(args[1]).includes('process.exit(0)')) return { command, args, hook: 'ok' }
        if (args[0] === '-e') {
          const stderr = String(args[1]).match(/write\("([^"]+)/)?.[1] ?? 'expected injected failure'
          const error = new Error(stderr)
          error.code = 2
          error.stderr = stderr
          throw error
        }
        return { command, args }
      },
    },
  })

  assert.equal(slowRequested, true)
  assert.equal(result.ready, true)
})

test('executeRuntimePlan times out a never-settling transition command without hanging probes', async () => {
  const inventory = validInventory({ phaseDurationMs: 1 })
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  const fetch = async () => ({
    status: 200,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'address-a') },
    json: async () => ({ releaseId: 'address-a', addressKey: 'apt:1168010100:역삼동:123', total: 2, items: [{ id: 1 }] }),
    text: async () => '<script src="/_nuxt/oldhash.js"></script>',
  })

  await assert.rejects(
    () => Promise.race([
      executeRuntimePlan(plan, inventory, {
        execute: true,
        timeoutMs: 20,
        commandTimeoutMs: 10,
        probeWindowMs: 1,
        maxProbeWindows: 1,
        fetch,
        env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
        checkPortFree: async () => true,
        runner: {
          run: async (command, args) => {
            if (args.includes(inventory.summaryTransitionScriptPath)) return await new Promise(() => {})
            return { command, args }
          },
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('executeRuntimePlan did not return after command timeout')), 80)),
    ]),
    /timed out after 10ms/,
  )
})

test('runContinuousProbePhase excludes long-inflight and inactive phase probes', async () => {
  const phase = { name: 'old-baseline', durationMs: 1_000, rps: 5, concurrency: 4 }
  const probes = [
    { name: 'generic', path: '/api/generic', expect: { status: 200, releaseId: 'old-main' } },
    { name: 'active', path: '/api/active', expectByPhase: { 'old-baseline': { status: 200, releaseId: 'old-main' } } },
    { name: 'inactive', path: '/api/inactive', expectByPhase: { 'post-switch-address': { status: 200, releaseId: 'address-a' } } },
    { name: 'long-inflight-switch', path: '/api/rehearsal/slow', longInflight: true, expectByPhase: { 'old-baseline': { status: 200, releaseId: 'old-main' } } },
  ]
  const seen = []
  const result = await runContinuousProbePhase(phase, probes, {
    publicOrigin: 'http://127.0.0.1:19000',
    fetch: async (url) => {
      seen.push(new URL(String(url)).pathname)
      return {
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'old-main') },
        json: async () => ({ releaseId: 'old-main' }),
        text: async () => JSON.stringify({ releaseId: 'old-main' }),
      }
    },
  })

  assert.equal(seen.includes('/api/rehearsal/slow'), false)
  assert.equal(seen.includes('/api/inactive'), false)
  assert.ok(seen.includes('/api/generic'))
  assert.ok(seen.includes('/api/active'))
  assert.equal(result.summary.failed, 0)
})

test('runContinuousProbePhase extracts buildingKey from actual building-info JSON data shapes', async () => {
  const expectedKey = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const result = await runContinuousProbePhase(
    { name: 'post-switch-address', durationMs: 1, rps: 5, concurrency: 4 },
    [{
      name: 'same-name-address-a',
      path: `/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=C3&buildingKey=${expectedKey}`,
      expectByPhase: { 'post-switch-address': { status: 200, releaseId: 'address-a', addressKey: expectedKey } },
    }],
    {
      publicOrigin: 'http://127.0.0.1:19000',
      fetch: async () => ({
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'address-a') },
        text: async () => JSON.stringify({
          data: {
            releaseId: 'address-a',
            buildingKey: expectedKey,
            identity: { buildingKey: expectedKey },
          },
        }),
      }),
    },
  )

  assert.equal(result.summary.failed, 0)
  assert.equal(result.records[0].addressKey, expectedKey)
})

test('runContinuousProbeWhile handles quick long-inflight rejection during continuous probes without unhandled rejection', async () => {
  const unhandled = []
  const onUnhandled = (reason) => { unhandled.push(reason) }
  process.on('unhandledRejection', onUnhandled)
  try {
    const phase = { name: 'first-transition-schema-prepare-check-switch', durationMs: 50, rps: 1, concurrency: 1 }
    const probes = [
      { name: 'continuous', path: '/api/continuous', expectByPhase: { 'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'address-a' } } },
      { name: 'long-inflight-switch', path: '/api/rehearsal/slow', longInflight: true, expectByPhase: { 'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'old-main', completedAfterCommand: true } } },
    ]
    const commandPromise = new Promise((_resolve, reject) => setTimeout(() => reject(new Error('transition exploded')), 0))

    await assert.rejects(
      () => runContinuousProbeWhile(phase, probes, commandPromise, {
        publicOrigin: 'http://127.0.0.1:19000',
        probeWindowMs: 50,
        maxProbeWindows: 1,
        timeoutMs: 100,
        fetch: async (url) => {
          const path = new URL(String(url)).pathname
          if (path === '/api/continuous') await new Promise((resolve) => setTimeout(resolve, 30))
          return {
            status: 200,
            headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : (path === '/api/rehearsal/slow' ? 'old-main' : 'address-a')) },
            text: async () => JSON.stringify({ releaseId: path === '/api/rehearsal/slow' ? 'old-main' : 'address-a' }),
          }
        },
      }),
      /transition exploded/,
    )
    await new Promise((resolve) => setImmediate(resolve))
    assert.deepEqual(unhandled, [])
  } finally {
    process.off('unhandledRejection', onUnhandled)
  }
})

test('runContinuousProbeWhile rotates probes across short windows instead of restarting at probe zero', async () => {
  const probes = Array.from({ length: 8 }, (_, index) => ({
    name: `probe-${index}`,
    path: `/api/probe-${index}`,
    expectByPhase: { phase: { status: 200, releaseId: 'address-a' } },
  }))
  const commandPromise = {
    outcome: new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: { done: true }, completedAt: Date.now() }), 1_500)),
  }
  const result = await runContinuousProbeWhile(
    { name: 'phase', durationMs: 2_000, rps: 5, concurrency: 4 },
    probes,
    commandPromise,
    {
      publicOrigin: 'http://127.0.0.1:19000',
      probeWindowMs: 1_000,
      skipLongInflight: true,
      fetch: async () => ({
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'address-a') },
        json: async () => ({ releaseId: 'address-a' }),
        text: async () => JSON.stringify({ releaseId: 'address-a' }),
      }),
    },
  )

  const names = new Set(result.probeResult.records.map((record) => record.probe))
  assert.ok(names.has('probe-5'))
  assert.ok(names.has('probe-6'))
  assert.ok(names.has('probe-7'))
  assert.equal(result.probeResult.summary.failed, 0)
})

test('runLongInflightSwitchProbes proves a pre-switch request completes after the observed switch, not merely command exit', async () => {
  const probe = {
    name: 'long-inflight-switch',
    path: '/api/rehearsal/slow',
    longInflight: true,
    expectByPhase: {
      'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'old-main', completedAfterCommand: true },
    },
  }
  let releaseRequest
  const switchStartedAt = Date.now()
  const commandPromise = {
    outcome: new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: { switched: true }, completedAt: Date.now(), switchedAtMs: switchStartedAt + 5 }), 5)),
  }
  const result = await runLongInflightSwitchProbes(
    { name: 'first-transition-schema-prepare-check-switch' },
    [probe],
    commandPromise,
    {
      publicOrigin: 'http://127.0.0.1:19000',
      timeoutMs: 50,
      fetch: async (url) => {
        releaseRequest = String(url)
        await new Promise((resolve) => setTimeout(resolve, 10))
        return {
          status: 200,
          headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'old-main') },
          json: async () => ({ releaseId: 'old-main' }),
          text: async () => JSON.stringify({ releaseId: 'old-main' }),
        }
      },
    },
  )

  assert.equal(releaseRequest, 'http://127.0.0.1:19000/api/rehearsal/slow')
  assert.equal(result.commandOutcome.ok, true)
  assert.equal(result.probeResult.records[0].probe, 'long-inflight-switch')
  assert.equal(result.probeResult.records[0].ok, true)
  assert.equal(typeof result.probeResult.records[0].startedAtMs, 'number')
  assert.equal(typeof result.probeResult.records[0].completedAtMs, 'number')
  assert.equal(typeof result.probeResult.records[0].observedSwitchAtMs, 'number')
  assert.equal(typeof result.probeResult.records[0].commandCompletedAtMs, 'number')
  assert.ok(result.probeResult.records[0].startedAtMs <= result.probeResult.records[0].observedSwitchAtMs)
  assert.ok(result.probeResult.records[0].completedAtMs >= result.probeResult.records[0].observedSwitchAtMs)
  assert.ok(result.probeResult.records[0].completedAtMs >= result.probeResult.records[0].commandCompletedAtMs)
})

test('runLongInflightSwitchProbes waits for response body EOF after headers arrive early', async () => {
  const probe = {
    name: 'long-inflight-switch',
    path: '/api/rehearsal/slow',
    longInflight: true,
    expectByPhase: {
      'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'old-main', completedAfterCommand: true },
    },
  }
  let releaseBody
  const bodyReleased = new Promise((resolve) => { releaseBody = resolve })
  const start = Date.now()
  const commandPromise = {
    outcome: new Promise((resolve) => setTimeout(() => resolve({ ok: true, value: { switched: true }, completedAt: Date.now(), switchedAtMs: start + 10 }), 10)),
  }
  const resultPromise = runLongInflightSwitchProbes(
    { name: 'first-transition-schema-prepare-check-switch' },
    [probe],
    commandPromise,
    {
      publicOrigin: 'http://127.0.0.1:19000',
      timeoutMs: 80,
      fetch: async () => ({
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/plain' : 'old-main') },
        text: async () => {
          await bodyReleased
          return 'slow response body'
        },
      }),
    },
  )

  await new Promise((resolve) => setTimeout(resolve, 20))
  let settled = false
  resultPromise.then(() => { settled = true }, () => { settled = true })
  await new Promise((resolve) => setTimeout(resolve, 0))
  assert.equal(settled, false)
  releaseBody()
  const result = await resultPromise

  assert.equal(result.probeResult.records[0].ok, true)
  assert.equal(result.probeResult.records[0].bodyBytes, 'slow response body'.length)
})

test('runLongInflightSwitchProbes aborts header-complete responses when body never reaches EOF', async () => {
  const probe = {
    name: 'long-inflight-switch',
    path: '/api/rehearsal/slow',
    longInflight: true,
    expectByPhase: {
      'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'old-main', completedAfterCommand: true },
    },
  }
  let aborted = false
  const commandPromise = {
    outcome: Promise.resolve({ ok: true, value: { switched: true }, completedAt: Date.now(), switchedAtMs: Date.now() }),
  }
  const result = await runLongInflightSwitchProbes(
    { name: 'first-transition-schema-prepare-check-switch' },
    [probe],
    commandPromise,
    {
      publicOrigin: 'http://127.0.0.1:19000',
      timeoutMs: 5,
      fetch: async (_url, { signal } = {}) => ({
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'text/plain' : 'old-main') },
        text: async () => await new Promise((_resolve, reject) => {
          signal?.addEventListener('abort', () => {
            aborted = true
            reject(new Error('body aborted'))
          }, { once: true })
        }),
      }),
    },
  )

  assert.equal(aborted, true)
  assert.equal(result.probeResult.records[0].ok, false)
  assert.deepEqual(result.probeResult.records[0].errors.map((error) => error.type), ['timeout'])
})

test('runLongInflightSwitchProbes can delay request start until a manifest stamp signal changes', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-c3-inflight-signal-'))
  const signalPath = join(dir, 'address-manifest.json')
  writeFileSync(signalPath, '{\"runId\":\"old\"}\n')
  const probe = {
    name: 'long-inflight-switch',
    path: '/api/rehearsal/slow',
    longInflight: true,
    expectByPhase: {
      'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'old-main', completedAfterCommand: true },
    },
  }
  const start = Date.now()
  const commandPromise = {
    outcome: new Promise((resolve) => {
      setTimeout(() => writeFileSync(signalPath, '{\"runId\":\"new\"}\n'), 10)
      setTimeout(() => resolve({ ok: true, value: { switched: true }, completedAt: Date.now() + 80, switchedAtMs: start + 40 }), 40)
    }),
  }
  let requestStartedAt

  const result = await runLongInflightSwitchProbes(
    { name: 'first-transition-schema-prepare-check-switch' },
    [probe],
    commandPromise,
    {
      publicOrigin: 'http://127.0.0.1:19000',
      timeoutMs: 100,
      longInflightStartPollIntervalMs: 1,
      longInflightStartSignalPath: signalPath,
      fetch: async () => {
        requestStartedAt = Date.now()
        await new Promise((resolve) => setTimeout(resolve, 45))
        return {
          status: 200,
          headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'old-main') },
          json: async () => ({ releaseId: 'old-main' }),
          text: async () => JSON.stringify({ releaseId: 'old-main' }),
        }
      },
    },
  )

  assert.ok(requestStartedAt >= start + 8)
  assert.equal(result.probeResult.records[0].ok, true)
})

test('runLongInflightSwitchProbes rejects requests that finish before the observed switch point', async () => {
  const probe = {
    name: 'long-inflight-switch',
    path: '/api/rehearsal/slow',
    longInflight: true,
    expectByPhase: {
      'first-transition-schema-prepare-check-switch': { status: 200, releaseId: 'old-main', completedAfterCommand: true },
    },
  }
  const commandPromise = {
    outcome: Promise.resolve({ ok: true, value: { switched: true }, completedAt: Date.now() + 100, switchedAtMs: Date.now() + 100 }),
  }

  const result = await runLongInflightSwitchProbes(
    { name: 'first-transition-schema-prepare-check-switch' },
    [probe],
    commandPromise,
    {
      publicOrigin: 'http://127.0.0.1:19000',
      timeoutMs: 50,
      fetch: async () => ({
        status: 200,
        headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'old-main') },
        json: async () => ({ releaseId: 'old-main' }),
        text: async () => '',
      }),
    },
  )

  assert.equal(result.probeResult.records[0].ok, false)
  assert.deepEqual(result.probeResult.records[0].errors.map((error) => error.type), ['inflight'])
})

test('executeRuntimePlan rejects failure matrix commands that do not match expected fault evidence', async () => {
  const matrix = requiredFailureMatrix().map((failure) => failure.name === 'candidate-api-down'
    ? { ...failure, expectedExitCode: 88, expectedErrorPattern: 'ECONNREFUSED readiness' }
    : failure)
  const inventory = validInventory({ phaseDurationMs: 1, failureMatrix: matrix })
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  const fetch = async () => ({
    status: 200,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'address-a') },
    json: async () => ({ releaseId: 'address-a', addressKey: 'apt:1168010100:역삼동:123', total: 2, items: [{ id: 1 }] }),
    text: async () => '<script src="/_nuxt/oldhash.js"></script>',
  })

  await assert.rejects(
    () => executeRuntimePlan(plan, inventory, {
      execute: true,
      timeoutMs: 20,
      commandTimeoutMs: 20,
      probeWindowMs: 1,
      maxProbeWindows: 1,
      skipLongInflight: true,
      fetch,
      env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
      checkPortFree: async () => true,
      runner: {
        run: async (command, args) => {
          if (args.includes('deploy')) return { command, args, summaryPrepareCalls: 0, assetDeleteCalls: 0 }
          if (args[0] === '-e' && String(args[1]).includes('process.exit(0)')) return { command, args, hook: 'ok' }
          if (args[0] === '-e') {
            const error = new Error('generic unrelated failure')
            error.code = 2
            error.stderr = 'generic unrelated failure'
            throw error
          }
          return { command, args }
        },
      },
    }),
    /candidate-api-down.*expected exit code 88|candidate-api-down.*expected error pattern/,
  )
})

test('assertExpectedFailureEvidence compares object digests by value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-c3-fault-report-'))
  const reportPath = join(dir, 'db-fault-invalid-check-runtime.json')
  const failure = { name: 'db-fault-invalid-check', expectedReport: { path: reportPath, expectedFault: true, beforeAfterDigestEqual: true } }

  writeFileSync(reportPath, JSON.stringify({
    expectedFault: true,
    beforeDigest: { tables: { A: 1 }, rows: ['same'] },
    afterDigest: { tables: { A: 1 }, rows: ['same'] },
  }))
  assert.doesNotThrow(() => assertExpectedFailureEvidence(failure, { succeeded: false }))

  writeFileSync(reportPath, JSON.stringify({
    expectedFault: true,
    beforeDigest: { tables: { A: 1 }, rows: ['same'] },
    afterDigest: { tables: { A: 2 }, rows: ['same'] },
  }))
  assert.throws(() => assertExpectedFailureEvidence(failure, { succeeded: false }), /before\/after digest equality/)
})

test('validateRuntimePreflight rejects non-test DB URLs and busy candidate ports before runtime actions', async () => {
  const inventory = validInventory()
  await assert.rejects(
    () => validateRuntimePreflight(inventory, {
      env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit' },
      checkPortFree: async () => true,
    }),
    /localhost:3307 \*_test/,
  )
  await assert.rejects(
    () => validateRuntimePreflight(inventory, {
      env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
      checkPortFree: async (port) => port !== 13001,
    }),
    /13001/,
  )
})

test('prepareRehearsalArtifacts only packages full-app shaped backend and frontend build directories', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-c3-artifacts-'))
  const backend = join(dir, 'backend-full')
  const frontend = join(dir, 'frontend-full')
  mkdirSync(join(backend, 'dist'), { recursive: true })
  mkdirSync(join(backend, 'prisma'), { recursive: true })
  mkdirSync(join(frontend, '.output/server'), { recursive: true })
  mkdirSync(join(frontend, '.output/public'), { recursive: true })
  writeFileSync(join(backend, 'package.json'), '{}\n')
  writeFileSync(join(backend, 'dist/server.js'), 'console.log("backend")\n')
  writeFileSync(join(backend, 'prisma/schema.prisma'), 'datasource db { provider = "mysql" url = env("DATABASE_URL") }\n')
  writeFileSync(join(frontend, 'package.json'), '{}\n')
  writeFileSync(join(frontend, '.output/server/index.mjs'), 'console.log("frontend")\n')

  const inventory = validInventory({
    deployRoot: dir,
    releasesRoot: join(dir, 'releases'),
    nginxConfigPath: join(dir, 'nginx/nginx.conf'),
    nginxIncludePath: join(dir, 'nginx/active.conf'),
    artifactSources: { backend, frontend },
  })
  const artifacts = await prepareRehearsalArtifacts(inventory)

  assert.equal(artifacts.backendArtifact.sha256.length, 64)
  assert.equal(artifacts.frontendArtifact.sha256.length, 64)
  assert.match(artifacts.backendArtifact.path, /backend-full\.tar\.gz$/)
  assert.match(artifacts.frontendArtifact.path, /frontend-full\.tar\.gz$/)

  await assert.rejects(
    () => prepareRehearsalArtifacts(validInventory({ deployRoot: dir, releasesRoot: join(dir, 'releases'), nginxConfigPath: join(dir, 'nginx/nginx.conf'), nginxIncludePath: join(dir, 'nginx/active.conf'), artifactSources: { backend: join(dir, 'missing'), frontend } })),
    /full-app marker|existing directory/,
  )
})

test('classifyProbeResult verifies body fragments and retained old asset hashes', () => {
  const probe = { name: 'home', path: '/', expect: { status: 200, bodyIncludes: '검증', oldHash: 'oldhash' } }
  const ok = classifyProbeResult(probe, { status: 200, body: '<html>검증</html>', extractedAssets: ['/_nuxt/oldhash.js'] })
  const bad = classifyProbeResult(probe, { status: 200, body: '<html>다름</html>', extractedAssets: ['/_nuxt/newhash.js'] })

  assert.equal(ok.ok, true)
  assert.deepEqual(bad.errors.map((error) => error.type), ['body', 'asset'])
})


test('executeRuntimePlan accepts an explicit forced rollback success in the failure matrix', async () => {
  const matrix = requiredFailureMatrix().map((failure) => failure.name === 'forced-rollback'
    ? { ...failure, args: ['-e', 'process.exit(0)'], expectedOutcome: 'explicit-rollback-succeeds', expectCommandFailure: false }
    : failure)
  const inventory = validInventory({ phaseDurationMs: 1, failureMatrix: matrix })
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  const fetch = async () => ({
    status: 200,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'address-a') },
    json: async () => ({ releaseId: 'address-a', addressKey: 'apt:1168010100:역삼동:123', total: 2, items: [{ id: 1 }] }),
    text: async () => '<script src="/_nuxt/oldhash.js"></script>',
  })

  const result = await executeRuntimePlan(plan, inventory, {
    execute: true,
    timeoutMs: 20,
    commandTimeoutMs: 20,
    probeWindowMs: 1,
    maxProbeWindows: 1,
    skipLongInflight: true,
    fetch,
    env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
    checkPortFree: async () => true,
    runner: {
      run: async (command, args) => {
        if (args.includes('deploy')) return { command, args, summaryPrepareCalls: 0, assetDeleteCalls: 0 }
        if (args[0] === '-e' && String(args[1]).includes('process.exit(0)')) return { command, args, rollback: true }
        if (args[0] === '-e') {
            const stderr = String(args[1]).match(/write\(\"([^\"]+)/)?.[1] ?? 'expected injected failure'
            const error = new Error(stderr)
            error.code = 2
            error.stderr = stderr
            throw error
          }
        return { command, args }
      },
    },
  })

  assert.equal(result.failureMatrix.find((failure) => failure.name === 'forced-rollback').commandOutcome.succeeded, true)
})

test('executeRuntimePlan rejects normal deploy results that only echo expected counts', async () => {
  const inventory = validInventory({ phaseDurationMs: 1 })
  const plan = buildRuntimePlan(inventory, { execute: true, phaseDurationMs: 1 })
  const fetch = async () => ({
    status: 200,
    headers: { get: (name) => (String(name).toLowerCase() === 'content-type' ? 'application/json' : 'address-a') },
    json: async () => ({ releaseId: 'address-a', addressKey: 'apt:1168010100:역삼동:123', total: 2, items: [{ id: 1 }] }),
    text: async () => 'ok',
  })

  await assert.rejects(
    () => executeRuntimePlan(plan, inventory, {
      execute: true,
      timeoutMs: 20,
      probeWindowMs: 1,
      maxProbeWindows: 1,
      skipLongInflight: true,
      fetch,
      env: { C3_REHEARSAL_TEST_DATABASE_URL: 'mysql://root:rootpassword@127.0.0.1:3307/ilsangkit_c3_release_20260929_test' },
      checkPortFree: async () => true,
      runner: {
        run: async (command, args) => {
          if (args[0] === '-e' && String(args[1]).includes('process.exit(0)')) return { command, args, hook: 'ok' }
          if (args[0] === '-e') {
            const stderr = String(args[1]).match(/write\(\"([^\"]+)/)?.[1] ?? 'expected injected failure'
            const error = new Error(stderr)
            error.code = 2
            error.stderr = stderr
            throw error
          }
          return { command, args }
        },
      },
    }),
    /summary prepare calls expected 0, got missing/,
  )
})


test('generateRehearsalProbes derives real 64-hex keyed URLs, real asset path, and phase release contracts', () => {
  const addressA = { label: 'a', type: 'apt-sale', propertyType: 'apt', citySlug: 'seoul', districtSlug: 'gangnam', buildingName: '같은이름검증', bjdCode: '1168010100', dongName: '역삼동', jibun: '123' }
  const addressB = { ...addressA, label: 'b', jibun: '124-1' }
  const seedReport = {
    releaseIds: { old: 'old-main', compatibility: 'compat-a', address: 'address-a' },
    sameNameBuildings: [addressA, addressB],
    listRegion: { citySlug: 'seoul', districtSlug: 'gangnam' },
    listTotals: { 'apt-sale': 2 },
    urls: { land: { queryA: '/real-estate/land/seoul/gangnam/역삼동?q=A-', queryB: '/real-estate/land/seoul/gangnam/역삼동?q=B-', queryTotal: 12 }, retention: { oldUnkeyedUrl: '/real-estate/apt-sale/seoul/gangnam/첫번째-old-unique' } },
    land: { total: 3, legacyQueryTotal: 24, queryAPath: '/real-estate/land/seoul/gangnam/역삼동?jimok=stale&page=2', queryBPath: '/real-estate/land/seoul/gangnam/역삼동?jimok=stale&page=1' },
  }

  const probes = generateRehearsalProbes(seedReport, { asset: { publicPath: '/_nuxt/BRaJIWcb.js', sha256: 'new-sha' }, oldAsset: { publicPath: '/_nuxt/oldhash.js', sha256: 'old-sha', hashFragment: 'oldhash' } }, { capturedOldHtmlPath: '/captured/old-detail.html' })
  const detail = probes.find((probe) => probe.name === 'same-name-address-a')
  const key = makeRehearsalBuildingKey(addressA)

  assert.match(key, /^[a-f0-9]{64}$/)
  assert.equal(detail.path, `/api/real-estate/apt-sale/building-info?bjdCode=1168010100&buildingName=${encodeURIComponent('같은이름검증')}&buildingKey=${key}`)
  assert.equal(detail.expectByPhase['old-baseline'], undefined)
  assert.equal(detail.expectByPhase['first-transition-schema-prepare-check-switch'], undefined)
  assert.equal(detail.expectByPhase['post-switch-address'].releaseId, 'address-a')
  assert.deepEqual(detail.expectByPhase['rollback-transition'].releaseIds, ['address-a', 'compat-a'])
  assert.equal(detail.expectByPhase['rollback-retention'].releaseId, 'compat-a')
  assert.deepEqual(probes.find((probe) => probe.name === 'home').expectByPhase['first-transition-schema-prepare-check-switch'].releaseIds, ['old-main', 'address-a'])
  assert.deepEqual(probes.find((probe) => probe.name === 'home').expectByPhase['rollback-transition'].releaseIds, ['address-a', 'compat-a'])
  assert.equal(probes.find((probe) => probe.name === 'land-query-a').path, '/api/real-estate/land/transactions?bjdCode=1168010100&dongName=%EC%97%AD%EC%82%BC%EB%8F%99&limit=10&page=1&keyword=A-')
  assert.equal(probes.find((probe) => probe.name === 'land-query-a').expectByPhase['old-baseline'].total, 24)
  assert.deepEqual(probes.find((probe) => probe.name === 'land-query-a').expectByPhase['first-transition-schema-prepare-check-switch'].totalByReleaseId, { 'old-main': 24, 'address-a': 12 })
  assert.equal(probes.find((probe) => probe.name === 'land-query-a').expectByPhase['post-switch-address'].total, 12)
  assert.deepEqual(probes.find((probe) => probe.name === 'land-query-a').expectByPhase['rollback-transition'].totalByReleaseId, { 'address-a': 12, 'compat-a': 12 })
  assert.equal(probes.find((probe) => probe.name === 'land-query-a-html').path, '/real-estate/land/seoul/gangnam/역삼동?q=A-')
  assert.equal(probes.find((probe) => probe.name === 'land-query-b-html').path, '/real-estate/land/seoul/gangnam/역삼동?q=B-')
  assert.equal(probes.find((probe) => probe.name === 'land-query-a-html').path.includes('keyword='), false)
  assert.equal(probes.find((probe) => probe.name === 'land-query-a-html').expectByPhase['post-switch-address'].bodyIncludes, '토지')
  assert.equal(probes.find((probe) => probe.name === 'hashed-asset').path, '/_nuxt/BRaJIWcb.js')
  assert.equal(probes.find((probe) => probe.name === 'hashed-asset').pathByPhase['old-baseline'], '/_nuxt/oldhash.js')
  assert.equal(probes.find((probe) => probe.name === 'apt-sale-list').path, '/api/real-estate/apt-sale/complexes?city=%EC%84%9C%EC%9A%B8%ED%8A%B9%EB%B3%84%EC%8B%9C&district=%EA%B0%95%EB%82%A8%EA%B5%AC&page=1&limit=20')
  assert.equal(probes.find((probe) => probe.name === 'apt-sale-list').expectByPhase['old-baseline'].total, 1)
  assert.deepEqual(probes.find((probe) => probe.name === 'apt-sale-list').expectByPhase['first-transition-schema-prepare-check-switch'].totalByReleaseId, { 'old-main': 1, 'address-a': 2 })
  assert.deepEqual(probes.find((probe) => probe.name === 'apt-sale-list').expectByPhase['rollback-transition'].totalByReleaseId, { 'address-a': 2, 'compat-a': 1 })
  assert.equal(probes.find((probe) => probe.name === 'apt-sale-list').expectByPhase['rollback-retention'].total, 1)
  assert.equal(probes.find((probe) => probe.name === 'apt-sale-html-list').path, '/real-estate/apt-sale/seoul/gangnam')
  assert.equal(probes.find((probe) => probe.name === 'old-unkeyed-detail').path, '/real-estate/apt-sale/seoul/gangnam/첫번째-old-unique')
  assert.equal(probes.find((probe) => probe.name === 'same-name-address-a-html').path, `/real-estate/apt-sale/seoul/gangnam/${encodeURIComponent('같은이름검증')}/${key}`)
  assert.equal(probes.find((probe) => probe.name === 'same-name-address-a-html').expectByPhase['post-switch-address'].bodyIncludes, key)
  assert.equal(probes.find((probe) => probe.name === 'new-keyed-retention').path, probes.find((probe) => probe.name === 'same-name-address-a-html').path)
  assert.equal(probes.find((probe) => probe.name === 'new-keyed-retention').expectByPhase['post-switch-address'].bodyIncludes, key)
  assert.deepEqual(probes.find((probe) => probe.name === 'new-keyed-retention').expectByPhase['rollback-transition'].releaseIds, ['address-a', 'compat-a'])
  assert.equal(probes.find((probe) => probe.name === 'retained-old-asset').path, '/_nuxt/oldhash.js')
  assert.equal(probes.find((probe) => probe.name === 'retained-old-html-hash').path, '/captured/old-detail.html')
  assert.equal(probes.find((probe) => probe.name === 'retained-old-html-hash').expectByPhase['rollback-retention'].oldHash, 'oldhash')
  assert.equal(probes.find((probe) => probe.name === 'long-inflight-switch').longInflight, true)
})


test('generateRehearsalProbes preserves explicit land API paths while using HTML q fallback only when API path is absent', () => {
  const addressA = { label: 'a', type: 'apt-sale', propertyType: 'apt', citySlug: 'seoul', districtSlug: 'gangnam', buildingName: '같은이름검증', bjdCode: '1168010100', dongName: '역삼동', jibun: '123' }
  const addressB = { ...addressA, label: 'b', jibun: '124-1' }
  const seedReport = {
    sameNameBuildings: [addressA, addressB],
    urls: {
      land: {
        queryA: '/real-estate/land/seoul/gangnam/역삼동?q=A-',
        queryB: '/real-estate/land/seoul/gangnam/역삼동?q=B-',
        queryAApi: '/api/real-estate/land/transactions?keyword=explicit-a',
        queryTotal: 12,
      },
    },
  }

  const probes = generateRehearsalProbes(seedReport, { asset: { publicPath: '/_nuxt/new.js', sha256: 'new-sha' }, oldAsset: { publicPath: '/_nuxt/old.js', sha256: 'old-sha' } })

  assert.equal(probes.find((probe) => probe.name === 'land-query-a').path, '/api/real-estate/land/transactions?keyword=explicit-a')
  assert.equal(probes.find((probe) => probe.name === 'land-query-b').path, '/api/real-estate/land/transactions?bjdCode=1168010100&dongName=%EC%97%AD%EC%82%BC%EB%8F%99&limit=10&page=1&keyword=B-')
})

test('prepareRuntimeAdapterFiles writes docker nginx adapter and isolated PM2 home without starting processes', () => {
  const dir = mkdtempSync('/tmp/ilsangkit-c3-adapter-')
  const inventory = validInventory({
    deployRoot: dir,
    releasesRoot: join(dir, 'releases'),
    nginxConfigPath: join(dir, 'nginx/nginx.conf'),
    nginxIncludePath: join(dir, 'nginx/active.conf'),
  })

  const adapter = prepareRuntimeAdapterFiles(inventory)
  const config = readFileSync(adapter.nginxConfigPath, 'utf8')
  const runner = readFileSync(adapter.dockerCommandPath, 'utf8')

  assert.equal(adapter.pm2Home, join(dir, 'pm2'))
  assert.match(config, /listen 19000/)
  assert.match(config, /include \/etc\/nginx\/mime\.types;/)
  assert.match(config, /include .+active\.conf/)
  assert.doesNotMatch(config, /add_header x-ilsangkit-release-id/)
  assert.match(config, /location = \/__c3\/slow-home/)
  assert.match(config, /limit_rate 4096/)
  assert.match(config, /proxy_pass http:\/\/ilsangkit_release_web/)
  assert.match(config, /proxy_pass http:\/\/ilsangkit_release_api/)
  assert.doesNotMatch(config, /proxy_pass http:\/\/host\.docker\.internal:13000/)
  assert.doesNotMatch(config, /proxy_pass http:\/\/host\.docker\.internal:18000/)
  assert.match(runner, /nginx:1\.28-alpine/)
  assert.match(runner, /host\.docker\.internal:host-gateway/)
})


test('parseCommandOutput accepts B3 progress logs before final JSON', () => {
  const parsed = parseCommandOutput('[SummaryV2] preparing 서울 강남\n{"complete":true,"runId":"run-1"}\n', { command: 'node', args: [] })
  assert.deepEqual(parsed, { complete: true, runId: 'run-1' })

  const fallback = parseCommandOutput('[SummaryV2] preparing only', { command: 'node', args: ['script.mjs'] })
  assert.equal(fallback.command, 'node')
  assert.match(fallback.stdout, /preparing only/)
})
