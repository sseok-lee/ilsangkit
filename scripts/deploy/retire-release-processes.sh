#!/usr/bin/env bash
set -Eeuo pipefail

ROOT=/home/project2
DEPLOY_SHA="${DEPLOY_SHA:-}"
[[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo '[fixed-retire] tested commit SHA required' >&2; exit 2; }
FIXED_ID="fixed-${DEPLOY_SHA:0:12}"
HELPER="$ROOT/run/fixed-deploy/${DEPLOY_SHA:0:12}/scripts/deploy/fixed-runtime.mjs"
test -f "$HELPER"
STAGE="$ROOT/run/fixed-deploy/${DEPLOY_SHA:0:12}"
exec 9>"$ROOT/run/fixed-deploy.lock"
flock -n 9
headers="$(mktemp /tmp/ilsangkit-fixed-retire.XXXXXXXX)"
trap 'rm -f "$headers"' EXIT

# The fixed service must be public before legacy processes can be retired.
! grep -Fq 'include /home/project2/deploy/nginx/release-active.conf;' /etc/nginx/nginx.conf
test -f /etc/nginx/conf.d/10-ilsangkit-fixed.conf
curl -fsS -m 20 'http://127.0.0.1:8000/api/internal/release-readiness' |
  node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const r=JSON.parse(s);if(!r.ready||r.releaseId!==process.argv[1]||!r.db?.ok)process.exit(2)})' "$FIXED_ID"
curl -fsS -m 20 -D "$headers" 'https://ilsangkit.co.kr/api/health' -o /dev/null
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$headers"

release_names="$(pm2 jlist | node "$HELPER" select-release-processes)"
if [ -n "$release_names" ]; then
  while IFS= read -r name; do
    echo "[fixed-retire] remove PM2 entry $name"
    pm2 delete "$name"
  done <<< "$release_names"
  pm2 save
fi

remaining="$(pm2 jlist | node "$HELPER" select-release-processes)"
test -z "$remaining"
curl -fsS -m 20 -D "$headers" 'https://ilsangkit.co.kr/api/health' -o /dev/null
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$headers"
echo '[fixed-retire] only canonical PM2 processes remain'

# Keep exactly the current successful attempt, which contains the previous
# canonical build for one-step rollback. Older uploaded stages are disposable.
successful_attempt="$(cat "$STAGE/successful-attempt")"
[[ "$successful_attempt" =~ ^attempt\.[A-Za-z0-9]{8}$ ]]
test -d "$STAGE/$successful_attempt/previous"
for candidate in "$STAGE"/attempt.*; do
  test -d "$candidate" || continue
  [ "$(basename "$candidate")" = "$successful_attempt" ] && continue
  find "$candidate" -depth -delete
done
for candidate in "$ROOT"/run/fixed-deploy/*; do
  test -d "$candidate" || continue
  [ "$candidate" = "$STAGE" ] && continue
  [[ "$(basename "$candidate")" =~ ^[0-9a-f]{12}$ ]] || continue
  test -f "$candidate/SHA256SUMS" || continue
  find "$candidate" -depth -delete
done
echo '[fixed-retire] retained one successful fixed deployment stage'

# Only generated release directories are removed. Keep the former active
# release as an offline rollback until the fixed path has operated normally.
keep_release="$(node -e 'process.stdout.write(require(process.argv[1]).activeReleaseId)' "$ROOT/deploy/inventory.json")"
[[ "$keep_release" =~ ^(address|compat)-[a-z0-9-]+$ ]]
test -f "$ROOT/deploy/releases/$keep_release/.release-manifest.json"

retire_current_pointers() {
  local backend_link="$ROOT/current-backend" frontend_link="$ROOT/current-frontend"
  local backend_present=0 frontend_present=0
  if [ -e "$backend_link" ] || [ -L "$backend_link" ]; then backend_present=1; fi
  if [ -e "$frontend_link" ] || [ -L "$frontend_link" ]; then frontend_present=1; fi
  if [ "$backend_present" -ne "$frontend_present" ]; then
    echo '[fixed-retire] legacy current pointers must be present or absent as a pair' >&2
    return 2
  fi
  [ "$backend_present" -eq 1 ] || return 0
  if [ ! -L "$backend_link" ] || [ ! -L "$frontend_link" ] ||
     [ "$(readlink "$backend_link")" != "$ROOT/deploy/releases/$keep_release/backend" ] ||
     [ "$(readlink "$frontend_link")" != "$ROOT/deploy/releases/$keep_release/frontend" ]; then
    echo '[fixed-retire] legacy current pointers differ from the retained release' >&2
    return 2
  fi
  if [ ! -d "$ROOT/deploy/releases/$keep_release/backend" ] ||
     [ ! -d "$ROOT/deploy/releases/$keep_release/frontend" ]; then
    echo '[fixed-retire] retained release directories are missing' >&2
    return 2
  fi
  if [ -e "$STAGE/retired-current-backend" ] || [ -L "$STAGE/retired-current-backend" ] ||
     [ -e "$STAGE/retired-current-frontend" ] || [ -L "$STAGE/retired-current-frontend" ]; then
    echo '[fixed-retire] legacy current pointer archive already exists' >&2
    return 2
  fi
  [ "${1:-}" = check ] && return 0
  mv "$backend_link" "$STAGE/retired-current-backend" || return 2
  if ! mv "$frontend_link" "$STAGE/retired-current-frontend"; then
    mv "$STAGE/retired-current-backend" "$backend_link"
    echo '[fixed-retire] could not move both legacy current pointers' >&2
    return 2
  fi
  echo '[fixed-retire] archived verified legacy current pointers'
}

retire_current_pointers check

assert_no_process_cwd() {
  local directory="$1" cwd
  for link in /proc/[0-9]*/cwd; do
    cwd="$(readlink "$link" 2>/dev/null || true)"
    case "$cwd" in "$directory"|"$directory"/*) echo "[fixed-retire] process still uses $directory" >&2; return 2 ;; esac
  done
}

for candidate in "$ROOT"/deploy/releases/*; do
  test -d "$candidate" || continue
  [ "$(basename "$candidate")" = "$keep_release" ] && continue
  [[ "$(basename "$candidate")" =~ ^(address|compat)-[a-z0-9-]+$ ]] || continue
  test -f "$candidate/.release-manifest.json" || continue
  assert_no_process_cwd "$candidate"
  echo "[fixed-retire] remove unused generated release $(basename "$candidate")"
  find "$candidate" -depth -delete
done
for candidate in "$ROOT"/release-inbox/*; do
  test -d "$candidate" || continue
  [ "$(basename "$candidate")" = "$keep_release" ] && continue
  [[ "$(basename "$candidate")" =~ ^(address|compat)-[a-z0-9-]+$ ]] || continue
  test -f "$candidate/manifest.json" || continue
  assert_no_process_cwd "$candidate"
  echo "[fixed-retire] remove unused release bundle $(basename "$candidate")"
  find "$candidate" -depth -delete
done

curl -fsS -m 20 -D "$headers" 'https://ilsangkit.co.kr/api/health' -o /dev/null
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$headers"
page="$(mktemp /tmp/ilsangkit-fixed-retire-page.XXXXXXXX)"
trap 'rm -f "$headers" "$page"' EXIT
curl -fsS -m 20 -D "$headers" 'https://ilsangkit.co.kr/real-estate/apt-sale/gyeongnam' -o "$page"
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$headers"
asset_path="$(node "$HELPER" asset-path "$page")"
curl -fsS -m 20 "https://ilsangkit.co.kr$asset_path" -o /dev/null
curl -fsS -m 20 -D "$headers" 'https://ilsangkit.co.kr/sitemap.xml' -o "$page"
grep -q '<loc>' "$page"
grep -iq '^x-sitemap-source: static' "$headers"
assert_no_process_cwd "$ROOT/deploy/releases/$keep_release"
retire_current_pointers
echo "[fixed-retire] kept offline rollback release $keep_release"
