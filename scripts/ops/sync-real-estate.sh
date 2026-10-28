#!/usr/bin/env bash
# 부동산·청약 일일 동기화 (운영 서버 cron 이 매일 03:00 KST 실행, 수동 실행은 sync-real-estate.yml).
#
# 2026-10-18 GitHub schedule 에서 서버 cron 으로 옮겼다. '0 18 * * *' 예약이 매일 2~6시간
# 늦게 시작했다(GitHub 정각 대기열 지연, 최근 20회 실측). 단계와 시간 예산은 옮기기 전
# 워크플로와 같다. 배포가 /home/project2/ops 로 설치하고, cron 은 /etc/cron.d/ilsangkit-sync
# (서버 관리 파일)에 있다.
#
# 결과는 $STATUS_FILE 에 남긴다. sync-real-estate-check.yml 이 매일 이 파일을 읽어
# 실패하거나 오늘 실행 기록이 없으면 워크플로를 실패시킨다(GitHub 실패 메일이 경보).
set -u

ROOT=/home/project2
ACTIVE_BACKEND_DIR="/home/project2/backend"
BACKEND_ENV_FILE="$ACTIVE_BACKEND_DIR/.env"
FRONTEND_ENV_FILE="$ROOT/frontend/.env"
RUN_DIR="$ROOT/run"
LOG_DIR="$ROOT/logs/real-estate-sync"
STATUS_FILE="$RUN_DIR/real-estate-sync.status"
SYNC_LOCK="$RUN_DIR/real-estate-sync.lock"
DEPLOY_LOCK="$RUN_DIR/fixed-deploy.lock"

mkdir -p "$LOG_DIR" "$RUN_DIR"
LOG_FILE="$LOG_DIR/$(date +%F).log"
# cron 실행은 로그 파일로, 수동 실행(워크플로)은 화면에도 남긴다.
exec > >(tee -a "$LOG_FILE") 2>&1
find "$LOG_DIR" -name '*.log' -mtime +14 -delete

STARTED_AT="$(date '+%F %T')"
write_status() {
  printf 'started=%s\nfinished=%s\nexit=%s\n' "$STARTED_AT" "$(date '+%F %T')" "$1" > "$STATUS_FILE.tmp"
  mv "$STATUS_FILE.tmp" "$STATUS_FILE"
}

# 두 번 동시에 돌지 않는다. fixed-deploy.sh 는 이 잠금이 잡혀 있으면 배포를 거부한다.
exec 8>"$SYNC_LOCK"
if ! flock -n 8; then
  echo "[error] 다른 부동산 동기화가 실행 중이다($SYNC_LOCK)"
  exit 3
fi
# 배포가 진행 중이면 끝날 때까지(최대 30분) 기다린다. 배포는 backend/dist 를 통째로 바꾼다.
if [ -e "$DEPLOY_LOCK" ]; then
  exec 9<"$DEPLOY_LOCK"
  if ! flock -w 1800 9; then
    echo "[error] 배포 잠금이 30분 넘게 풀리지 않아 동기화를 건너뛴다"
    write_status 5
    exit 5
  fi
  exec 9<&-
fi

set -x
echo "[step:start] $(date -u +%FT%TZ)"
cd "$ACTIVE_BACKEND_DIR"
echo "[step:active-backend] $ACTIVE_BACKEND_DIR"
test -f "$BACKEND_ENV_FILE" || { echo '[error] fixed backend env missing'; write_status 2; exit 2; }
run_backend_node_timed() {
  RUNTIME_LIMIT="$1"
  shift
  timeout --kill-after=30s "$RUNTIME_LIMIT" node --env-file "$BACKEND_ENV_FILE" "$@"
}
export REAL_ESTATE_WRITE_LOCK_DIR="${REAL_ESTATE_WRITE_LOCK_DIR:-$ROOT/run/real-estate-locks}"
mkdir -p "$REAL_ESTATE_WRITE_LOCK_DIR"
REAL_ESTATE_SYNC_EXIT=0
echo "[step:real-estate-lock-dir] $REAL_ESTATE_WRITE_LOCK_DIR"

# 현재 월과 직전 월만 동기화 (YYYYMM)
CURRENT_YM=$(date +%Y%m)
PREV_YM=$(date -d "1 month ago" +%Y%m)
echo "[step:ym-resolved PREV=$PREV_YM CUR=$CURRENT_YM]"

if [ ! -f "$ACTIVE_BACKEND_DIR/dist/scripts/syncAptSale.js" ]; then
  echo "[error] dist/scripts/syncAptSale.js 미존재 — 배포 선행 필요"
  write_status 2
  exit 2
fi
echo "[step:dist-ok]"

echo "=== 부동산 실거래가 동기화 시작 ==="
echo "대상: ${PREV_YM}, ${CURRENT_YM}"

# 순차 실행(API 부하 분산). `timeout --kill-after=30s 20m`는 스크립트 내부 watchdog(20분)이
# 뚫려도 OS 가 SIGTERM→SIGKILL 로 반드시 종료시키는 최종 방어선.
for SCRIPT in syncAptSale syncAptRent syncVillaSale syncVillaRent syncOffitelSale syncOffitelRent syncLandSale syncAuction; do
  echo "[step:loop-${SCRIPT}-start] $(date -u +%FT%TZ)"
  echo "--- ${SCRIPT} 동기화 ---"
  SCRIPT_EXIT=0
  run_backend_node_timed 20m "$ACTIVE_BACKEND_DIR/dist/scripts/${SCRIPT}.js" --from "$PREV_YM" --to "$CURRENT_YM" || SCRIPT_EXIT=$?
  if [ "$SCRIPT_EXIT" -ne 0 ]; then
    echo "[warn] ${SCRIPT} 실패 (exit=$SCRIPT_EXIT)"
    REAL_ESTATE_SYNC_EXIT=4
  fi
  echo "[step:loop-${SCRIPT}-end]"
done

# 좌표 없는 건물 지오코딩 (카카오 API rate limit 감안 45분)
echo "[step:geocode-start]"
run_backend_node_timed 45m "$ACTIVE_BACKEND_DIR/dist/scripts/geocodeRealEstate.js" \
  || echo "[warn] 지오코딩 실패 (exit=$?)"
echo "[step:geocode-end]"

# 공매 물건 지오코딩 (온비드 API 무좌표 → 카카오 주소검색, 30분)
echo "[step:geocode-auction-start]"
run_backend_node_timed 30m "$ACTIVE_BACKEND_DIR/dist/scripts/geocodeAuction.js" \
  || echo "[warn] 공매 지오코딩 실패 (exit=$?)"
echo "[step:geocode-auction-end]"

# Summary 테이블 갱신 (MySQL MAX_EXECUTION_TIME=60s 가 내부에서 강제).
# 60m: 2021~2022 거래 백필(2026-10-19)로 거래가 1.5배가 되자 6종 합계가 16분 → 약 35~40분으로
# 늘었다(그 전 25m 은 8/8·8/9 에 뒤쪽 타입이 조용히 스킵된 뒤 잡은 값).
# 85m: 2016~2020 거래 백필(2026-10-21~22)로 수동 갱신이 47분까지 늘어 60분 예산 여유가 13분뿐이었다.
# 스크립트 자체 watchdog(85분)이 먼저 걸리도록 바깥은 90m.
# 0=6종 완주 / 4=일부 타입 실패 / 124·137=timeout 이 죽임(뒤 타입 미실행) / 그 외=예외
echo "[step:summary-start]"
SUMMARY_EXIT=0
run_backend_node_timed 90m "$ACTIVE_BACKEND_DIR/dist/scripts/refreshRealEstateSummary.js" || SUMMARY_EXIT=$?
case "$SUMMARY_EXIT" in
  0) echo "[sync] Summary 갱신 완료" ;;
  4) echo "[warn] Summary 일부 타입 실패 — 위 로그의 '실패한 타입' 확인. 그 타입은 어제 값이 남는다."; REAL_ESTATE_SYNC_EXIT=4 ;;
  124|137) echo "[warn] Summary 가 85분 예산(바깥 90m)을 초과해 강제 종료됐다(exit=$SUMMARY_EXIT). 위 로그의 '완료 N/6' 확인."; REAL_ESTATE_SYNC_EXIT=4 ;;
  *) echo "[warn] Summary 갱신 실패 (exit=$SUMMARY_EXIT) — 전 타입이 어제 값으로 남는다."; REAL_ESTATE_SYNC_EXIT=4 ;;
esac
echo "[step:summary-end]"

# 청약 분양정보 동기화. 지오코딩은 느려 맨 마지막 격리 단계로 미룬다(아래).
echo "[step:subscription-start]"
run_backend_node_timed 30m "$ACTIVE_BACKEND_DIR/dist/scripts/syncSubscription.js" --source ALL --skip-geocode \
  || echo "[warn] 청약 동기화 실패 (exit=$?)"
echo "[step:subscription-end]"

# 마이홈 + LH 공공임대 (공고 식별자로 병합, 주소 지오코딩 제외)
echo "[step:public-rental-start]"
run_backend_node_timed 20m "$ACTIVE_BACKEND_DIR/dist/scripts/syncPublicRental.js" --write \
  || echo "[warn] 공공임대 동기화 실패 (exit=$?) — sub-public-rent 이력 확인"
echo "[step:public-rental-end]"

# K-apt 공동주택 단지 정보 (자료실 주간 파일). 새 파일이 없는 날은 목록만 확인하고 끝난다.
# 실패해도 부동산 writer 결과에는 영향이 없다(별도 테이블) — kapt SyncHistory 로 확인.
echo "[step:kapt-start]"
run_backend_node_timed 15m "$ACTIVE_BACKEND_DIR/dist/scripts/syncKapt.js" \
  || echo "[warn] K-apt 단지 정보 동기화 실패 (exit=$?) — kapt 이력 확인"
echo "[step:kapt-end]"

# 사이트맵 정적 파일 재생성. 실패/가드거부 시 기존 파일 유지.
# 0=완전 갱신 / 4=부분 갱신(일부 이월) / 2=거부·실패 / 3=예외 / 1=env 누락
# 40m: 자식 98개를 순차로 받는데 부동산 URL 이 늘며 941s→1,119s 로 길어지다 2026-10-22 에 20m 을 넘겼다.
echo "[step:sitemap-gen-start]"
export SITEMAP_DIR="${SITEMAP_DIR:-$ROOT/sitemaps}"
export SITEMAP_REGEN_BASE="${SITEMAP_REGEN_BASE:-http://127.0.0.1:3000}"
set +x
SITEMAP_REGEN_TOKEN="$(grep -m1 '^SITEMAP_REGEN_TOKEN=' "$FRONTEND_ENV_FILE" | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')"
export SITEMAP_REGEN_TOKEN
set -x
SITEMAP_EXIT=0
run_backend_node_timed 40m "$ACTIVE_BACKEND_DIR/dist/scripts/generateSitemaps.js" || SITEMAP_EXIT=$?
case "$SITEMAP_EXIT" in
  0) echo "[sync] 사이트맵 갱신 완료" ;;
  4) echo "[warn] 사이트맵 부분 갱신 — 일부 파일이 직전 생성본으로 이월됐다." ;;
  *) echo "[warn] 사이트맵 생성 실패/거부 (exit=$SITEMAP_EXIT) — 기존 파일 유지." ;;
esac
echo "[step:sitemap-gen-end]"

# 청약 주소 지오코딩 (best-effort, 크리티컬 패스 밖). 2026-06-16 에 syncSubscription 안에서
# 1544건을 돌다 전체 잡을 타임아웃시킨 뒤 맨 마지막으로 격리했다.
echo "[step:subscription-geocode-start]"
run_backend_node_timed 15m "$ACTIVE_BACKEND_DIR/dist/scripts/geocodeSubscriptions.js" \
  || echo "[warn] 청약 지오코딩 실패/스킵 (exit=$?)"
echo "[step:subscription-geocode-end]"

set +x
write_status "$REAL_ESTATE_SYNC_EXIT"
if [ "$REAL_ESTATE_SYNC_EXIT" -ne 0 ]; then
  echo "[warn] 부동산 writer 단계에서 실패가 발생했다(exit=$REAL_ESTATE_SYNC_EXIT). 전체 작업은 완료했지만 실패로 종료한다."
  exit "$REAL_ESTATE_SYNC_EXIT"
fi
echo "=== 동기화 완료 ==="
