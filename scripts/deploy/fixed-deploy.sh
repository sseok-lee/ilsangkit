#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

ROOT=/home/project2
NGINX_MAIN=/etc/nginx/nginx.conf
NGINX_SITE=/etc/nginx/sites-available/ilsangkit
NGINX_FIXED=/etc/nginx/conf.d/10-ilsangkit-fixed.conf
DEPLOY_SHA="${DEPLOY_SHA:-}"
[[ "$DEPLOY_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo '[fixed-deploy] tested commit SHA required' >&2; exit 2; }
STAGE="$ROOT/run/fixed-deploy/${DEPLOY_SHA:0:12}"
HELPER="$STAGE/scripts/deploy/fixed-runtime.mjs"
ATTEMPT=
BACKUP=
FAILED=
NEW=
INSTALL_STARTED=0
NGINX_TOUCHED=0
MODE=
TOUCHED_PATHS=()

fail() { echo "[fixed-deploy] $*" >&2; return 2; }

rollback() {
  local status="$1"
  trap - ERR
  set +e
  echo "[fixed-deploy] rollback after exit $status" >&2
  if [ "$NGINX_TOUCHED" -eq 1 ]; then
    cp -p "$BACKUP/nginx.conf" "$NGINX_MAIN"
    cp -p "$BACKUP/ilsangkit-site" "$NGINX_SITE"
    if [ -f "$BACKUP/ilsangkit-fixed.conf" ]; then
      cp -p "$BACKUP/ilsangkit-fixed.conf" "$NGINX_FIXED"
    elif [ -f "$NGINX_FIXED" ]; then
      mkdir -p "$FAILED"
      mv "$NGINX_FIXED" "$FAILED/ilsangkit-fixed.conf"
    fi
    nginx -t && systemctl reload nginx
  fi
  if [ "$INSTALL_STARTED" -eq 1 ]; then
    pm2 delete ilsangkit-backend >/dev/null 2>&1 || true
    pm2 delete ilsangkit-frontend >/dev/null 2>&1 || true
    for ((i=${#TOUCHED_PATHS[@]}-1; i>=0; i--)); do
      path="${TOUCHED_PATHS[$i]}"
      if [ -e "$ROOT/$path" ] || [ -L "$ROOT/$path" ]; then
        mkdir -p "$FAILED/$(dirname "$path")"
        mv "$ROOT/$path" "$FAILED/$path"
      fi
      if [ -e "$BACKUP/$path" ] || [ -L "$BACKUP/$path" ]; then
        mv "$BACKUP/$path" "$ROOT/$path"
      fi
    done
    if [ "$MODE" = fixed ]; then
      pm2 start "$ROOT/ecosystem.config.js" --env production
    fi
    pm2 save
  fi
  exit "$status"
}
trap 'rollback $?' ERR

test -f "$STAGE/SHA256SUMS" || fail "missing artifact checksums in $STAGE"
test -f "$HELPER" || fail 'missing fixed runtime helper'
test -f "$STAGE/ecosystem.config.js" || fail 'missing fixed PM2 config'
chmod 700 "$STAGE"
exec 9>"$ROOT/run/fixed-deploy.lock"
flock -n 9 || fail 'another fixed deployment is running'
cd "$STAGE"
sha256sum -c SHA256SUMS
cache_key_count="$(grep -Fc 'proxy_cache_key "$scheme$request_method$host$request_uri$ilsangkit_release";' "$NGINX_SITE" || true)"
[ "$cache_key_count" -eq 2 ] || fail 'API and page cache keys must include the active deployment ID'

if grep -Fq 'include /home/project2/deploy/nginx/release-active.conf;' "$NGINX_MAIN"; then
  MODE=migration
  test -L "$ROOT/current-backend" || fail 'release nginx is active without current-backend pointer'
  test -L "$ROOT/current-frontend" || fail 'release nginx is active without current-frontend pointer'
  ACTIVE_PORT="$(node -e 'const i=require(process.argv[1]);if(!i.active?.backend?.port)process.exit(2);process.stdout.write(String(i.active.backend.port))' "$ROOT/deploy/inventory.json")"
  ACTIVE_RELEASE="$(basename "$(dirname "$(readlink -f "$ROOT/current-backend")")")"
  INVENTORY_RELEASE="$(node -e 'const i=require(process.argv[1]);process.stdout.write(i.activeReleaseId)' "$ROOT/deploy/inventory.json")"
  [ "$ACTIVE_RELEASE" = "$INVENTORY_RELEASE" ] || fail 'active pointer disagrees with release inventory'
  test ! -e "$NGINX_FIXED" || fail 'fixed nginx include already exists during release mode'
else
  MODE=fixed
  test -f "$NGINX_FIXED" || fail 'neither release nor fixed nginx configuration is active'
  ACTIVE_PORT=8000
fi
echo "[fixed-deploy] mode=$MODE active-port=$ACTIVE_PORT"

FIXED_ID="fixed-${DEPLOY_SHA:0:12}"
if [ "$MODE" = fixed ] && curl -fsS -m 15 'http://127.0.0.1:8000/api/internal/release-readiness' | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const r=JSON.parse(s);if(!r.ready||r.releaseId!==process.argv[1]||!r.db?.ok)process.exit(2)})' "$FIXED_ID"; then
  echo "[fixed-deploy] $FIXED_ID is already active; verify the public service"
  curl -fsS -m 30 -D "$STAGE/retry-health.headers" 'https://ilsangkit.co.kr/api/health' -o "$STAGE/retry-health.json"
  grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$STAGE/retry-health.headers"
  curl -fsS -m 30 -D "$STAGE/retry-page.headers" 'https://ilsangkit.co.kr/real-estate/apt-sale/gyeongnam' -o "$STAGE/retry-page.html"
  grep -q '경남' "$STAGE/retry-page.html"
  grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$STAGE/retry-page.headers"
  asset_path="$(node "$HELPER" asset-path "$STAGE/retry-page.html")"
  curl -fsS -m 30 "https://ilsangkit.co.kr$asset_path" -o /dev/null
  curl -fsS -m 30 -D "$STAGE/retry-sitemap.headers" 'https://ilsangkit.co.kr/sitemap.xml' -o "$STAGE/retry-sitemap.xml"
  grep -q '<loc>' "$STAGE/retry-sitemap.xml"
  grep -iq '^x-sitemap-source: static' "$STAGE/retry-sitemap.headers"
  exit 0
fi

ATTEMPT="$(mktemp -d "$STAGE/attempt.XXXXXXXX")"
BACKUP="$ATTEMPT/previous"
FAILED="$ATTEMPT/failed"
NEW="$ATTEMPT/new"
mkdir -p "$NEW/backend" "$NEW/frontend" "$BACKUP/backend" "$BACKUP/frontend"
cp -p "$STAGE/ecosystem.config.js" "$NEW/ecosystem.config.js"
tar -xzf "$STAGE/backend.tgz" -C "$NEW/backend"
tar -xzf "$STAGE/frontend.tgz" -C "$NEW/frontend"
test -f "$NEW/backend/dist/server.js" || fail 'backend build missing'
test -f "$NEW/frontend/.output/server/index.mjs" || fail 'frontend build missing'

if [ "$MODE" = migration ]; then
  BACKEND_ENV="$ROOT/deploy/shared/backend.env"
  FRONTEND_ENV="$ROOT/deploy/shared/frontend.env"
  SITEMAP_SOURCE="$(node -e 'const i=require(process.argv[1]);process.stdout.write(i.runtime?.sitemapDir||"")' "$ROOT/deploy/inventory.json")"
  case "$SITEMAP_SOURCE" in "$ROOT/deploy/shared/sitemaps/"*) ;; *) fail 'unexpected shared sitemap path' ;; esac
  test -d "$SITEMAP_SOURCE" || fail 'active shared sitemap directory missing'
  mkdir -p "$NEW/sitemaps"
  rsync -a "$SITEMAP_SOURCE/" "$NEW/sitemaps/"
  ASSETS_SOURCE="$ROOT/deploy/shared/assets/_nuxt"
else
  BACKEND_ENV="$ROOT/backend/.env"
  FRONTEND_ENV="$ROOT/frontend/.env"
  ASSETS_SOURCE="$ROOT/frontend/.output/public/_nuxt"
fi
test -f "$BACKEND_ENV" && test -f "$FRONTEND_ENV" || fail 'current environment files missing'
test -d "$ASSETS_SOURCE" || fail 'current hashed frontend assets missing'
cp -p "$BACKEND_ENV" "$NEW/backend/.env"
cp -p "$FRONTEND_ENV" "$NEW/frontend/.env"
mkdir -p "$NEW/frontend/.output/public/_nuxt"
rsync -a --ignore-existing "$ASSETS_SOURCE/" "$NEW/frontend/.output/public/_nuxt/"
if [ "$MODE" = migration ] && [ -d "$ROOT/frontend/.output/public/_nuxt" ]; then
  rsync -a --ignore-existing "$ROOT/frontend/.output/public/_nuxt/" "$NEW/frontend/.output/public/_nuxt/"
fi

curl -fsS -m 30 "http://127.0.0.1:$ACTIVE_PORT/api/internal/release-readiness" > "$ATTEMPT/active-readiness.json"
node "$HELPER" prepare "$DEPLOY_SHA" "$ATTEMPT/active-readiness.json" "$NEW/backend/.env" "$NEW/frontend/.env" > "$ATTEMPT/runtime.json"
FIXED_ID="$(node -e 'process.stdout.write(require(process.argv[1]).id)' "$ATTEMPT/runtime.json")"
SUMMARY_RUN_ID="$(node -e 'process.stdout.write(require(process.argv[1]).summaryRunId)' "$ATTEMPT/runtime.json")"
echo "[fixed-deploy] candidate=$FIXED_ID summary-run=$SUMMARY_RUN_ID"

(
  cd "$NEW/backend"
  npm ci --omit=dev --no-audit --no-fund
  npx prisma generate
)

cp -p "$NGINX_MAIN" "$BACKUP/nginx.conf"
cp -p "$NGINX_SITE" "$BACKUP/ilsangkit-site"
if [ -f "$NGINX_FIXED" ]; then cp -p "$NGINX_FIXED" "$BACKUP/ilsangkit-fixed.conf"; fi

move_into_place() {
  local path="$1"
  if [ -e "$ROOT/$path" ] || [ -L "$ROOT/$path" ]; then mv "$ROOT/$path" "$BACKUP/$path"; fi
  TOUCHED_PATHS+=("$path")
  mv "$NEW/$path" "$ROOT/$path"
}

INSTALL_STARTED=1
pm2 delete ilsangkit-backend >/dev/null 2>&1 || true
pm2 delete ilsangkit-frontend >/dev/null 2>&1 || true
for path in backend/dist backend/prisma backend/node_modules backend/package.json backend/package-lock.json backend/.env frontend/.output frontend/.env; do
  move_into_place "$path"
done
move_into_place ecosystem.config.js
if [ "$MODE" = migration ]; then move_into_place sitemaps; fi

pm2 start "$ROOT/ecosystem.config.js" --env production
for attempt in $(seq 1 12); do
  if curl -fsS -m 15 "http://127.0.0.1:8000/api/internal/release-readiness" > "$ATTEMPT/fixed-readiness.json"; then break; fi
  sleep 5
done
node - "$ATTEMPT/fixed-readiness.json" "$FIXED_ID" "$SUMMARY_RUN_ID" <<'NODE'
const fs = require('fs')
const r = JSON.parse(fs.readFileSync(process.argv[2]))
if (!r.ready || r.releaseId !== process.argv[3] || r.summary?.mode !== 'address' ||
    r.summary?.runId !== process.argv[4] || r.realEstateUrls?.mode !== 'preserved' || !r.db?.ok) {
  throw new Error('fixed backend readiness differs from the live source')
}
NODE
curl -fsS -m 30 -D "$ATTEMPT/fixed-frontend.headers" 'http://127.0.0.1:3000/real-estate/apt-sale/gyeongnam' -o "$ATTEMPT/fixed-frontend.html"
grep -q '<h1' "$ATTEMPT/fixed-frontend.html"
grep -q '경남' "$ATTEMPT/fixed-frontend.html"
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$ATTEMPT/fixed-frontend.headers"
curl -fsS -m 30 -D "$ATTEMPT/fixed-sitemap.headers" 'http://127.0.0.1:3000/sitemap.xml' -o "$ATTEMPT/fixed-sitemap.xml"
grep -q '<loc>' "$ATTEMPT/fixed-sitemap.xml"
grep -iq '^x-sitemap-source: static' "$ATTEMPT/fixed-sitemap.headers"

NGINX_TOUCHED=1
node "$HELPER" render-nginx "$FIXED_ID" "$NGINX_FIXED"
if [ "$MODE" = migration ]; then
  sed -i '\|^[[:space:]]*include /home/project2/deploy/nginx/release-active.conf;[[:space:]]*$|d' "$NGINX_MAIN"
  grep -Fq 'alias /home/project2/deploy/shared/assets/_nuxt/;' "$NGINX_SITE" || fail 'expected release asset alias missing'
  sed -i 's|alias /home/project2/deploy/shared/assets/_nuxt/;|alias /home/project2/frontend/.output/public/_nuxt/;|' "$NGINX_SITE"
fi
nginx -t
systemctl reload nginx

curl -fsS -m 30 -D "$ATTEMPT/public-health.headers" 'https://ilsangkit.co.kr/api/health' -o "$ATTEMPT/public-health.json"
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$ATTEMPT/public-health.headers"
curl -fsS -m 30 -D "$ATTEMPT/public-page.headers" 'https://ilsangkit.co.kr/real-estate/apt-sale/gyeongnam' -o "$ATTEMPT/public-page.html"
grep -q '경남' "$ATTEMPT/public-page.html"
grep -iq "^x-ilsangkit-release-id: $FIXED_ID" "$ATTEMPT/public-page.headers"
asset_path="$(node "$HELPER" asset-path "$ATTEMPT/public-page.html")"
curl -fsS -m 30 "https://ilsangkit.co.kr$asset_path" -o /dev/null
curl -fsS -m 30 -D "$ATTEMPT/public-sitemap.headers" 'https://ilsangkit.co.kr/sitemap.xml' -o "$ATTEMPT/public-sitemap.xml"
grep -q '<loc>' "$ATTEMPT/public-sitemap.xml"
grep -iq '^x-sitemap-source: static' "$ATTEMPT/public-sitemap.headers"

pm2 save
printf '%s\n' "$(basename "$ATTEMPT")" > "$STAGE/successful-attempt"
trap - ERR
echo "[fixed-deploy] live=$FIXED_ID backend=$ROOT/backend frontend=$ROOT/frontend"
