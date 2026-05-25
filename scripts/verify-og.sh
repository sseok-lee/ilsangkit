#!/bin/bash
# OG 라우트 smoke 검증.
# 사용법:
#   ./scripts/verify-og.sh                          # 프로덕션 검사
#   ./scripts/verify-og.sh http://localhost:3000    # 로컬 검사
# 모든 URL이 200 + image/* 이어야 통과. 하나라도 실패하면 비-zero exit.

set -euo pipefail

BASE="${1:-https://ilsangkit.co.kr}"

URLS=(
  "$BASE/og-map?lat=35.17&lng=126.91&label=test&category=apt"
  "$BASE/og-map?lat=35.17&lng=126.91&label=%EC%83%88%ED%95%9CA&category=apt&city=%EA%B4%91%EC%A3%BC&district=%EB%B6%81%EA%B5%AC"
  "$BASE/og?category=apt&title=test"
  "$BASE/og?category=villa&title=test"
  "$BASE/og?category=offitel&title=test"
)

fail=0
for url in "${URLS[@]}"; do
  http=$(curl -s -o /dev/null -w "%{http_code}" "$url")
  ct=$(curl -sI "$url" | awk -F': ' 'tolower($1) == "content-type" {print $2}' | tr -d '\r')
  printf "%-3s  %-20s  %s\n" "$http" "${ct:-?}" "$url"
  if [ "$http" != "200" ]; then
    fail=1
  else
    case "$ct" in
      image/*) ;;
      *) fail=1 ;;
    esac
  fi
done

exit "$fail"
