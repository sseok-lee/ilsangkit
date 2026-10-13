#!/usr/bin/env bash

validate_trash_region_html() {
  local path="$1"
  local html="$2"
  local canonical="https://ilsangkit.co.kr$path"

  if [ -z "$html" ]; then
    fail "$path — 빈 HTML"
    return
  fi

  if contains "$html" "rel=\"canonical\" href=\"$canonical\"" ||
     contains "$html" "href=\"$canonical\" rel=\"canonical\""; then
    pass "$path — canonical"
  else
    fail "$path — canonical 누락 또는 불일치"
  fi

  if contains "$html" 'content="noindex, follow"' ||
     contains "$html" 'content="follow, noindex"' ||
     contains "$html" 'content="noindex"' ||
     contains "$html" 'content="noindex,'; then
    fail "$path — robots noindex 감지"
  else
    pass "$path — noindex 아님"
  fi

  if contains "$html" '<a[^>]*href="/trash/[0-9][0-9]*"' ||
     contains "$html" '<a[^>]*href="/trash/[0-9][0-9]*#from[^"]*"'; then
    pass "$path — 원본 배출안내 링크 SSR"
  else
    fail "$path — 원본 배출안내 링크 SSR 누락"
  fi
}

validate_trash_region_response() {
  local path="$1"
  local status="$2"
  local curl_exit="$3"
  local html="$4"

  if [ "$curl_exit" -ne 0 ]; then
    fail "$path — 응답 실패(curl exit $curl_exit, HTTP $status)"
    return
  fi

  if [ "$status" != "200" ]; then
    fail "$path — HTTP $status (200 필요)"
    return
  fi

  if [ -z "$html" ]; then
    fail "$path — HTTP 200 이지만 본문 없음"
    return
  fi

  validate_trash_region_html "$path" "$html"
}
