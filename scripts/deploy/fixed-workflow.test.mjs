import assert from 'node:assert/strict'
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

const deploy = readFileSync('.github/workflows/deploy.yml', 'utf8')
const sync = readFileSync('.github/workflows/sync-real-estate.yml', 'utf8')
const regen = readFileSync('.github/workflows/regen-sitemaps.yml', 'utf8')

test('tested main SHA is packaged and deployed into the canonical backend/frontend paths', () => {
  assert.match(deploy, /ref: \$\{\{ github\.event\.workflow_run\.head_sha \}\}/)
  assert.match(deploy, /\/home\/project2\/run\/fixed-deploy/)
  assert.match(deploy, /fixed-deploy\.sh/)
  assert.match(deploy, /retire-release-processes\.sh/)
  assert.doesNotMatch(deploy, /release-inbox|node "\$RELEASE_SCRIPT" deploy/)
  assert.doesNotMatch(deploy, /db push --accept-data-loss|KILL\s+/)
})

test('scheduled jobs run from the canonical backend even while rollback symlinks exist', () => {
  for (const workflow of [sync, regen]) {
    assert.match(workflow, /ACTIVE_BACKEND_DIR="\/home\/project2\/backend"/)
    assert.doesNotMatch(workflow, /if \[ -L \/home\/project2\/current-backend \]/)
    assert.match(workflow, /REAL_ESTATE_WRITE_LOCK_DIR|SITEMAP_DIR/)
  }
})

test('fixed deploy stages verified artifacts and preserves the active release until public smoke', () => {
  const script = readFileSync('scripts/deploy/fixed-deploy.sh', 'utf8')
  assert.match(script, /sha256sum -c/)
  assert.match(script, /flock -n/)
  assert.match(script, /\/api\/internal\/release-readiness/)
  assert.match(script, /nginx -t/)
  assert.match(script, /cache_key_count/)
  assert.match(script, /asset-path/)
  assert.match(script, /rollback/)
  assert.match(script, /pm2 start/)
  assert.match(script, /TOUCHED_PATHS/)
  assert.match(script, /mktemp -d/)
  assert.doesNotMatch(script, /db push|DROP DATABASE|rm -rf/)
  const retire = readFileSync('scripts/deploy/retire-release-processes.sh', 'utf8')
  assert.match(retire, /select-release-processes/)
  assert.match(retire, /pm2 save/)
  assert.match(retire, /assert_no_process_cwd/)
  assert.match(retire, /keep_release/)
  assert.match(retire, /\.release-manifest\.json/)
  assert.match(retire, /release-inbox\/\*; do\n\s+test -d "\$candidate" \|\| continue\n\s+\[ "\$\(basename "\$candidate"\)" = "\$keep_release" \] && continue/)
  assert.doesNotMatch(retire, /rm -rf/)
})

test('public cutover tolerates stale nginx workers and fails closed if they persist', () => {
  const script = readFileSync('scripts/deploy/fixed-deploy.sh', 'utf8')
  const start = script.indexOf('wait_for_public_release() {')
  const end = script.indexOf('\n}\n', start)
  assert.ok(start >= 0 && end > start)
  const probe = script.slice(start, end + 2)
  const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-public-probe-'))
  const harness = [
    'set -euo pipefail',
    'FIXED_ID=fixed-0123456789ab',
    'probe_count=0',
    'curl() {',
    '  local headers="" body="" option served',
    '  while (($#)); do',
    '    case "$1" in -D|-o) option="$1"; shift; if [ "$option" = -D ]; then headers="$1"; else body="$1"; fi ;; esac',
    '    shift',
    '  done',
    '  probe_count=$((probe_count + 1))',
    '  served=address-old',
    '  if ((probe_count >= SWITCH_AT)); then served="$FIXED_ID"; fi',
    '  printf "HTTP/1.1 200 OK\\r\\nX-Ilsangkit-Release-Id: %s\\r\\n" "$served" > "$headers"',
    '  printf "ok\\n" > "$body"',
    '}',
    'sleep() { :; }',
    'fail() { echo "probe_count=$probe_count $*" >&2; return 2; }',
    probe,
    'wait_for_public_release health https://example.test/health "$PROBE_HEADERS" "$PROBE_BODY"',
    'echo "probe_count=$probe_count"',
  ].join('\n')
  try {
    for (const [switchAt, expectedStatus, expectedCount] of [[3, 0, 3], [31, 2, 30]]) {
      const result = spawnSync('bash', ['-c', harness], {
        encoding: 'utf8',
        env: {
          ...process.env,
          SWITCH_AT: String(switchAt),
          PROBE_HEADERS: join(dir, 'headers'),
          PROBE_BODY: join(dir, 'body'),
        },
      })
      assert.equal(result.status, expectedStatus, result.stderr)
      assert.match(`${result.stdout}\n${result.stderr}`, new RegExp(`probe_count=${expectedCount}\\b`))
    }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test('legacy current pointers retire only as a verified pair and tolerate later absence', () => {
  const script = readFileSync('scripts/deploy/retire-release-processes.sh', 'utf8')
  const start = script.indexOf('retire_current_pointers() {')
  const end = script.indexOf('\n}\n', start)
  assert.ok(start >= 0 && end > start, 'retirement must have a testable pointer guard')
  const retirePointers = script.slice(start, end + 2)
  const release = 'address-f80a26c09cb5'

  for (const scenario of ['valid', 'absent', 'backend-only', 'wrong-target', 'regular-file', 'archive-exists']) {
    const dir = mkdtempSync(join(tmpdir(), 'ilsangkit-current-retire-'))
    try {
      const root = join(dir, 'project2')
      const stage = join(dir, 'stage')
      const backend = join(root, 'current-backend')
      const frontend = join(root, 'current-frontend')
      const releaseBackend = join(root, 'deploy/releases', release, 'backend')
      const releaseFrontend = join(root, 'deploy/releases', release, 'frontend')
      mkdirSync(releaseBackend, { recursive: true })
      mkdirSync(releaseFrontend, { recursive: true })
      mkdirSync(stage)
      if (scenario === 'valid' || scenario === 'backend-only' || scenario === 'archive-exists') symlinkSync(releaseBackend, backend)
      if (scenario === 'valid' || scenario === 'archive-exists') symlinkSync(releaseFrontend, frontend)
      if (scenario === 'wrong-target') {
        const wrong = join(dir, 'wrong-backend')
        mkdirSync(wrong)
        symlinkSync(wrong, backend)
        symlinkSync(releaseFrontend, frontend)
      }
      if (scenario === 'regular-file') {
        writeFileSync(backend, 'do not replace')
        symlinkSync(releaseFrontend, frontend)
      }
      if (scenario === 'archive-exists') writeFileSync(join(stage, 'retired-current-backend'), 'keep this file')

      const result = spawnSync('bash', ['-c', `set -euo pipefail\nkeep_release="$KEEP_RELEASE"\n${retirePointers}\nretire_current_pointers`], {
        encoding: 'utf8',
        env: { ...process.env, ROOT: root, STAGE: stage, KEEP_RELEASE: release },
      })
      if (scenario === 'valid') {
        assert.equal(result.status, 0, result.stderr)
        assert.equal(existsSync(backend), false)
        assert.equal(existsSync(frontend), false)
        assert.ok(lstatSync(join(stage, 'retired-current-backend')).isSymbolicLink())
        assert.equal(readlinkSync(join(stage, 'retired-current-frontend')), releaseFrontend)
      } else if (scenario === 'absent') {
        assert.equal(result.status, 0, result.stderr)
      } else {
        assert.equal(result.status, 2, `${scenario}: ${result.stderr}`)
        assert.equal(existsSync(backend), true)
        if (scenario !== 'backend-only') assert.equal(existsSync(frontend), true)
      }
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

test('deployment and scheduled workflow YAML parses', () => {
  for (const file of ['.github/workflows/deploy.yml', '.github/workflows/sync-real-estate.yml', '.github/workflows/regen-sitemaps.yml']) {
    const result = spawnSync('python3', ['-c', 'import sys, yaml; yaml.safe_load(open(sys.argv[1], encoding="utf-8"))', file], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${file}: ${result.stderr}`)
  }
})
