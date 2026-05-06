#!/usr/bin/env bash
#
# validate-seo.sh — 런타임 SEO 검증 스크립트.
#
# 서버가 실행 중이어야 한다 (frontend dev/preview 또는 프로덕션 URL).
#
#   # 기본값 (http://localhost:3000)
#   ./scripts/validate-seo.sh
#
#   # 다른 BASE_URL 검사 (환경변수 또는 첫 번째 인자)
#   BASE_URL=https://ilsangkit.co.kr ./scripts/validate-seo.sh
#   ./scripts/validate-seo.sh https://ilsangkit.co.kr
#
# 특징:
#   - 실제 HTTP 응답을 검사해 "파일이 존재하는지" 가 아니라 "렌더 결과가 SEO 계약을 지키는지" 를 확인한다.
#   - 대표 URL과 정책 파일(홈 / 카테고리 허브 / 시설 상세 / 부동산 상세 / /search(noindex) / robots.txt / /sitemap.xml) 를 검사한다.
#   - 모든 검사는 PASS/FAIL 로 카운트되어 마지막에 요약된다.
#   - 서버가 꺼져 있으면 curl 로 최초 1회 헬스체크 후 친절한 에러 메시지로 조기 종료한다.

set -u

BASE_URL="${1:-${BASE_URL:-http://localhost:3000}}"
BASE_URL="${BASE_URL%/}" # trailing slash 제거

# 대표 URL — 환경마다 존재하는 ID/경로가 다르므로 반드시 환경변수로 오버라이드할 것.
#   SAMPLE_CATEGORY_HUB (default: /toilet)
#   SAMPLE_FACILITY_PATH (default: /toilet/toilet-00379099bd5d661e — 로컬 DB에 존재하는 ID로 바꿀 것)
#   SAMPLE_REAL_ESTATE_PATH (default: /real-estate — 허브 페이지. 리다이렉트 없는 경로를 고르는 게 안전)
#   SAMPLE_SEARCH_PATH (default: /search)
#   SAMPLE_PAGINATED_PATH (default: /toilet?page=2 — noindex pagination 회귀 확인용)
SAMPLE_CATEGORY_HUB="${SAMPLE_CATEGORY_HUB:-/toilet}"
SAMPLE_FACILITY_PATH="${SAMPLE_FACILITY_PATH:-/toilet/toilet-00379099bd5d661e}"
SAMPLE_REAL_ESTATE_PATH="${SAMPLE_REAL_ESTATE_PATH:-/real-estate}"
SAMPLE_SEARCH_PATH="${SAMPLE_SEARCH_PATH:-/search}"
SAMPLE_PAGINATED_PATH="${SAMPLE_PAGINATED_PATH:-/toilet?page=2}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; PASSED=$((PASSED + 1)); }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; FAILED=$((FAILED + 1)); }
note() { echo -e "${YELLOW}ℹ${NC}  $1"; }

echo "========================================"
echo "🔍 일상킷 SEO 런타임 검증"
echo "========================================"
echo "BASE_URL: $BASE_URL"
echo ""

if ! command -v curl >/dev/null 2>&1; then
  echo "curl 이 필요합니다." >&2
  exit 2
fi

# 헬스체크: BASE_URL 홈에 도달 가능한지 확인. 실패 시 명확한 에러로 종료 (나머지 검사를 전부 FAIL 로 오해하지 않도록).
if ! curl -fsS --max-time 10 -o /dev/null "$BASE_URL/"; then
  echo -e "${RED}서버에 접근할 수 없습니다: $BASE_URL${NC}" >&2
  echo "dev 서버(npm run dev) 또는 preview 를 먼저 실행하거나 BASE_URL 을 다른 값으로 지정하세요." >&2
  exit 3
fi

fetch_body() {
  # -L: redirect 따라가기 (예: apex/www canonical host, 레거시 URL). SEO 검증은 최종 렌더 결과 기준이므로 follow 가 필요하다.
  local url="$1"
  curl -fsSL --max-time 15 -A 'ilsangkit-validate-seo/1.0' "$url"
}

fetch_headers_and_body() {
  # stdout 에 헤더 + 본문을 이어서 출력. redirect 는 따라가지 않음 — /sitemap.xml 등 Content-Type 검사에 사용.
  local url="$1"
  curl -fsS --max-time 15 -A 'ilsangkit-validate-seo/1.0' -i "$url"
}

contains() {
  # contains "<text>" "<pattern>" → grep 패턴 포함 여부
  local haystack="$1"
  local needle="$2"
  printf '%s' "$haystack" | grep -q -- "$needle"
}

not_contains() {
  local haystack="$1"
  local needle="$2"
  ! printf '%s' "$haystack" | grep -q -- "$needle"
}

# ────────────────────────────────────────────────────────────
# 1. 홈
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  홈 페이지 검증  ($BASE_URL/)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
home_body=$(fetch_body "$BASE_URL/") || { fail "홈 응답 실패"; home_body=""; }
if [ -n "$home_body" ]; then
  contains "$home_body" '<title>' && pass "<title> 포함" || fail "<title> 누락"
  contains "$home_body" 'rel="canonical"' && pass "rel=canonical 포함" || fail "rel=canonical 누락"
  contains "$home_body" '"@type":"WebSite"' && pass "WebSite JSON-LD 포함" || note "WebSite JSON-LD 누락 (페이지 정책에 따라 허용)"
  not_contains "$home_body" 'content="noindex' && pass "홈은 noindex 없음" || fail "홈에서 noindex 감지 — 설정 오류 가능성"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 2. 카테고리 허브
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  카테고리 허브 검증  ($BASE_URL$SAMPLE_CATEGORY_HUB)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
hub_body=$(fetch_body "$BASE_URL$SAMPLE_CATEGORY_HUB") || { fail "카테고리 허브 응답 실패"; hub_body=""; }
if [ -n "$hub_body" ]; then
  contains "$hub_body" 'rel="canonical"' && pass "rel=canonical 포함" || fail "rel=canonical 누락"
  contains "$hub_body" '<h1' && pass "<h1> 포함" || fail "<h1> 누락"
  not_contains "$hub_body" 'content="noindex' && pass "page 1 은 noindex 아님" || fail "page 1 이 noindex — 설정 오류"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 3. 시설 상세
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  시설 상세 검증  ($BASE_URL$SAMPLE_FACILITY_PATH)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
detail_body=$(fetch_body "$BASE_URL$SAMPLE_FACILITY_PATH") || { fail "시설 상세 응답 실패"; detail_body=""; }
if [ -n "$detail_body" ]; then
  contains "$detail_body" 'application/ld+json' && pass "JSON-LD script 포함" || fail "JSON-LD script 누락"
  contains "$detail_body" 'rel="canonical"' && pass "rel=canonical 포함 (정상 데이터 상세)" || note "canonical 없음 — thin content noindex 상태일 수 있음"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 4. 부동산 상세(허브)
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  부동산 허브 검증  ($BASE_URL$SAMPLE_REAL_ESTATE_PATH)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
re_body=$(fetch_body "$BASE_URL$SAMPLE_REAL_ESTATE_PATH") || { fail "부동산 허브 응답 실패"; re_body=""; }
if [ -n "$re_body" ]; then
  contains "$re_body" 'rel="canonical"' && pass "rel=canonical 포함" || fail "rel=canonical 누락"
  contains "$re_body" '<title>' && pass "<title> 포함" || fail "<title> 누락"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 5. /search (noindex)
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  /search noindex 검증  ($BASE_URL$SAMPLE_SEARCH_PATH)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
search_body=$(fetch_body "$BASE_URL$SAMPLE_SEARCH_PATH") || { fail "/search 응답 실패"; search_body=""; }
if [ -n "$search_body" ]; then
  contains "$search_body" 'content="noindex' && pass "robots=noindex 포함" || fail "robots=noindex 누락 (/search 는 noindex 이어야 함)"
  # 정책: noindex 페이지는 canonical 을 내보내지 않는다 (.omc/notes/noindex-canonical-policy.md)
  not_contains "$search_body" 'rel="canonical"' && pass "canonical 없음 (noindex 정책 준수)" || fail "noindex + canonical 동시 출력 — 정책 위반"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 5b. Pagination noindex/canonical 회귀 — page 2+ 는 반드시 robots=noindex 이고 canonical 이 없어야 한다.
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣ -b  Pagination noindex 검증  ($BASE_URL$SAMPLE_PAGINATED_PATH)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
pagination_body=$(fetch_body "$BASE_URL$SAMPLE_PAGINATED_PATH") || { fail "pagination 응답 실패"; pagination_body=""; }
if [ -n "$pagination_body" ]; then
  contains "$pagination_body" 'content="noindex' && pass "page 2+ 는 robots=noindex" || fail "page 2+ 인데 robots=noindex 누락 — policy 회귀"
  not_contains "$pagination_body" 'rel="canonical"' && pass "page 2+ canonical 제거 (noindex 정책 준수)" || fail "page 2+ 에서 canonical 동시 출력 — 정책 위반"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 6. /sitemap.xml
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  /sitemap.xml 검증  ($BASE_URL/sitemap.xml)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
sitemap_response=$(fetch_headers_and_body "$BASE_URL/sitemap.xml") || { fail "/sitemap.xml 응답 실패"; sitemap_response=""; }
if [ -n "$sitemap_response" ]; then
  if printf '%s' "$sitemap_response" | grep -qi 'Content-Type:[[:space:]]*application/xml'; then
    pass "Content-Type: application/xml"
  else
    fail "Content-Type 이 application/xml 이 아님"
  fi
  contains "$sitemap_response" '<sitemapindex' && pass "<sitemapindex> 포함" || fail "<sitemapindex> 누락"
  contains "$sitemap_response" '/sitemap/static.xml' && pass "static sub-sitemap 링크 포함" || fail "static sub-sitemap 링크 누락"
  # 초기 색인 안정화 정책: wifi는 noindex-only 상세 정책으로 sitemap 제외, AED는 응급 검색 의도가 강해 포함.
  # 색인 제한 해제 시 이 기대값과 sitemapPolicy.ts/상세 noindex 정책을 함께 수정한다.
  not_contains "$sitemap_response" '/sitemap/wifi' && pass "wifi 제외 확인 (noindex-only 상세 정책)" || fail "wifi 가 sitemap index 에 포함됨 (현재 정책상 제외 대상)"
  contains "$sitemap_response" '/sitemap/aed' && pass "aed 포함 확인" || fail "aed sitemap chunk 누락 — 현재 정책상 색인 대상"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 7. /robots.txt
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  /robots.txt 검증  ($BASE_URL/robots.txt)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
robots_body=$(fetch_body "$BASE_URL/robots.txt") || { fail "/robots.txt 응답 실패"; robots_body=""; }
if [ -n "$robots_body" ]; then
  contains "$robots_body" 'Sitemap: https://ilsangkit.co.kr/sitemap.xml' && pass "Sitemap 지시문 포함" || fail "robots.txt Sitemap 지시문 누락"
  # wifi 상세는 robots.txt 차단이 아니라 HTML noindex 로 제외한다. 그래야 Googlebot 이 noindex 를 직접 확인한다.
  not_contains "$robots_body" 'Disallow: /wifi/' && pass "wifi robots 차단 없음 (noindex 확인 가능)" || fail "wifi가 robots에서 차단됨 — noindex-only 정책과 불일치"
  not_contains "$robots_body" 'Disallow: /aed/' && pass "AED robots 차단 없음" || fail "AED가 robots에서 차단됨 — 현재 정책상 색인 대상"
fi
echo ""

# ────────────────────────────────────────────────────────────
# 결과
# ────────────────────────────────────────────────────────────
echo "========================================"
echo "📊 결과 요약"
echo "========================================"
echo -e "${GREEN}✅ PASS${NC}: $PASSED"
echo -e "${RED}❌ FAIL${NC}: $FAILED"

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}모든 런타임 SEO 체크를 통과했습니다.${NC}"
  exit 0
else
  echo -e "${RED}$FAILED 개의 검사가 실패했습니다.${NC}"
  exit 1
fi
