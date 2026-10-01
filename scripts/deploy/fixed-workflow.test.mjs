import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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

test('deployment and scheduled workflow YAML parses', () => {
  for (const file of ['.github/workflows/deploy.yml', '.github/workflows/sync-real-estate.yml', '.github/workflows/regen-sitemaps.yml']) {
    const result = spawnSync('python3', ['-c', 'import sys, yaml; yaml.safe_load(open(sys.argv[1], encoding="utf-8"))', file], { encoding: 'utf8' })
    assert.equal(result.status, 0, `${file}: ${result.stderr}`)
  }
})
