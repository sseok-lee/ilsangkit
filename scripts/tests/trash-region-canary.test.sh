#!/usr/bin/env bash
set -u

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

PASSED=0
FAILED=0
ASSERTIONS=0

contains() {
  local haystack="$1"
  local needle="$2"
  printf '%s' "$haystack" | grep -q -- "$needle"
}

not_contains() {
  local haystack="$1"
  local needle="$2"
  ! printf '%s' "$haystack" | grep -q -- "$needle"
}

pass() { PASSED=$((PASSED + 1)); }
fail() { FAILED=$((FAILED + 1)); }

# shellcheck source=../lib/trash-region-canary.sh
. "$ROOT_DIR/scripts/lib/trash-region-canary.sh"

run_helper_case() {
  local expected="$1"
  local path="$2"
  local html="$3"
  local before_failed="$FAILED"

  validate_trash_region_html "$path" "$html"

  if [ "$expected" = "pass" ]; then
    if [ "$FAILED" -ne "$before_failed" ]; then
      echo "Expected pass but helper failed for $path" >&2
      exit 1
    fi
  else
    if [ "$FAILED" -eq "$before_failed" ]; then
      echo "Expected fail but helper passed for $path" >&2
      exit 1
    fi
    FAILED="$before_failed"
  fi
  ASSERTIONS=$((ASSERTIONS + 1))
}

GOOD_PATH='/gyeonggi/uiwang/trash'
GOOD_HTML='<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="index, follow"></head><body><a href="/trash/1001">원본</a></body></html>'

run_helper_case pass "$GOOD_PATH" "$GOOD_HTML"
run_helper_case pass "$GOOD_PATH" '<html><head><link href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash" rel="canonical"><meta content="follow, index" name="robots"></head><body><a href="/trash/1001#from">원본</a></body></html>'
run_helper_case pass "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="index, follow"></head><body><a class="source-link" href="/trash/1001">원본</a></body></html>'
run_helper_case pass "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="index, follow"></head><body><a class="source-link" href="/trash/1001#from-guide">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="index, follow"></head><body><a data-href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="index, noindex"></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="follow,noindex"></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta content="index,noindex" name="robots"></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"></head><body><a href="/trash/areas/1">동</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"></head><body><script>{"url":"/trash/1001"}</script></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta name="robots" content="noindex, follow"></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"><meta content="follow, noindex" name="robots"></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/gapyeong/trash"></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" '<html><head></head><body><a href="/trash/1001">원본</a></body></html>'
run_helper_case fail "$GOOD_PATH" ''
run_helper_case fail "$GOOD_PATH" '<html><head><link rel="canonical" href="https://ilsangkit.co.kr/gyeonggi/uiwang/trash"></head><body>로딩 중</body></html>'

fetch_status_case() {
  local label="$1"
  local status="$2"
  local curl_exit="$3"
  local body="$4"
  local before_failed="$FAILED"

  validate_trash_region_response "$label" "$status" "$curl_exit" "$body"
  if [ "$FAILED" -eq "$before_failed" ]; then
    echo "Expected response fail for $label" >&2
    exit 1
  fi
  FAILED="$before_failed"
  ASSERTIONS=$((ASSERTIONS + 1))
}

fetch_status_case network-error '000' 28 "$GOOD_HTML"
fetch_status_case redirect '302' 0 "$GOOD_HTML"
fetch_status_case not-found '404' 0 "$GOOD_HTML"
fetch_status_case server-error '503' 0 "$GOOD_HTML"

echo "trash-region-canary helper tests passed: assertions=$ASSERTIONS helper_pass_calls=$PASSED"
