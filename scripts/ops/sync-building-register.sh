#!/usr/bin/env bash
# 건축물대장(건축HUB 대용량 파일) 동기화. 운영 서버 cron 이 매일 06:30 KST 실행한다:
#   30 6 * * * root /home/project2/ops/sync-building-register.sh
#
# 매일은 목록만 확인한다. 총괄표제부·표제부는 대상 월이 바뀐 날(매월 20일 무렵)만,
# 전유공용면적(3GB)은 3개월마다 받는다. zip 은 디스크에 받아 줄 단위로 읽고 끝나면 지운다.
#
# 03:00 부동산 동기화와 같은 잠금을 쓴다. 그쪽이 돌고 있으면 오늘은 건너뛰고 내일 다시 확인한다.
# 이 잠금이 잡혀 있는 동안은 배포도 백엔드를 바꾸지 않는다(fixed-deploy.sh).
set -u

ROOT=/home/project2
ACTIVE_BACKEND_DIR="/home/project2/backend"
BACKEND_ENV_FILE="$ACTIVE_BACKEND_DIR/.env"
RUN_DIR="$ROOT/run"
LOG_DIR="$ROOT/logs/building-register-sync"
SYNC_LOCK="$RUN_DIR/real-estate-sync.lock"
DEPLOY_LOCK="$RUN_DIR/fixed-deploy.lock"
WORK_DIR="$ROOT/tmp/building-register"

mkdir -p "$LOG_DIR" "$RUN_DIR" "$WORK_DIR"
LOG_FILE="$LOG_DIR/$(date +%F).log"
exec > >(tee -a "$LOG_FILE") 2>&1
find "$LOG_DIR" -name '*.log' -mtime +30 -delete

exec 8>"$SYNC_LOCK"
if ! flock -n 8; then
  echo "[skip] 부동산 동기화가 실행 중이다($SYNC_LOCK) — 내일 다시 확인한다"
  exit 0
fi
# 배포 중이면 끝날 때까지(최대 30분) 기다린다. 배포는 backend/dist 를 통째로 바꾼다.
if [ -e "$DEPLOY_LOCK" ]; then
  exec 9<"$DEPLOY_LOCK"
  if ! flock -w 1800 9; then
    echo "[skip] 배포 잠금이 30분 넘게 풀리지 않아 오늘은 건너뛴다"
    exit 0
  fi
  exec 9<&-
fi

test -f "$BACKEND_ENV_FILE" || { echo '[error] backend env missing'; exit 2; }
cd "$ACTIVE_BACKEND_DIR"
echo "[step:start] $(date -u +%FT%TZ)"
# 메모리 상한 512MB — 서버 여유 메모리가 약 2GB 라 파일을 통째로 올리면 안 된다(스트리밍 처리).
timeout --kill-after=30s 3h node --max-old-space-size=512 --env-file "$BACKEND_ENV_FILE" \
  "$ACTIVE_BACKEND_DIR/dist/scripts/syncBuildingRegister.js" --work-dir "$WORK_DIR" "$@"
STATUS=$?
echo "[step:end] $(date -u +%FT%TZ) exit=$STATUS"
exit "$STATUS"
