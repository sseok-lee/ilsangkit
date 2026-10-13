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

# robots.txt 의 그룹은 상속되지 않는다 — 자기 이름 그룹이 있는 봇은 `User-agent: *` 를 통째로 무시한다.
# 따라서 "차단됐는가"는 **그룹 단위로** 봐야 한다. 파일 전체 grep 은 오답이다.
#
# 실제로 그렇게 틀렸다: wifi 상세는 검색엔진(Yeti·*)에는 열려 있고 AI 크롤러
# (GPTBot·ChatGPT-User·ClaudeBot·PerplexityBot)에만 `Disallow: /wifi/wifi-` 가 걸려 있다.
# 의도된 설정이며 robots.txt 주석에 근거가 적혀 있는데, 파일 전체 grep 이 AI 그룹 줄을
# 잡아 이 스크립트가 프로덕션에서 항상 FAIL 했다. 그래서 CI 에 연결되지 못한 채 남아 있었다.
#
# 첫날부터 실패하는 검사는 무시당한다 — 그게 카나리 최악의 결말이다.
robots_group() {
  # robots_group "<robots.txt 본문>" "<User-agent 값>" → 그 그룹의 지시문만 출력
  printf '%s\n' "$1" | awk -v ua="$2" '
    /^[[:space:]]*#/ { next }
    tolower($0) ~ /^user-agent:[[:space:]]*/ {
      val = $0; sub(/^[^:]*:[[:space:]]*/, "", val); gsub(/[[:space:]]+$/, "", val)
      ingroup = (tolower(val) == tolower(ua))
      next
    }
    ingroup { print }
  '
}

if [ -n "$robots_body" ]; then
  contains "$robots_body" 'Sitemap: https://ilsangkit.co.kr/sitemap.xml' && pass "Sitemap 지시문 포함" || fail "robots.txt Sitemap 지시문 누락"

  # 검색엔진 그룹만 확인한다. AI 크롤러 그룹의 차단은 의도된 설정이다.
  for ua in '*' 'Yeti'; do
    group=$(robots_group "$robots_body" "$ua")
    if [ -z "$group" ]; then
      fail "robots.txt 에 'User-agent: $ua' 그룹이 없음"
      continue
    fi
    # wifi 상세는 robots 차단이 아니라 HTML noindex 로 제외한다. 그래야 크롤러가 noindex 를 직접 확인한다.
    # (robots 로 막으면 크롤러가 기존 사본을 재평가할 수 없어 색인이 동결된다 — 2026-07 실측.)
    if printf '%s' "$group" | grep -qE '^[[:space:]]*Disallow:[[:space:]]*/wifi'; then
      fail "[$ua] wifi 가 robots 에서 차단됨 — noindex-only 정책과 불일치"
    else
      pass "[$ua] wifi robots 차단 없음 (noindex 확인 가능)"
    fi
    if printf '%s' "$group" | grep -qE '^[[:space:]]*Disallow:[[:space:]]*/aed'; then
      fail "[$ua] AED 가 robots 에서 차단됨 — 현재 정책상 색인 대상"
    else
      pass "[$ua] AED robots 차단 없음"
    fi
  done
fi
echo ""

# ────────────────────────────────────────────────────────────
# 8. 색인 오염 signature — 카나리의 핵심
#
# 2026-07 색인 오염의 원인은 SSR 일시 장애 때 useFacilityMeta 가 title 을 만들지
# 못해 nuxt.config.ts:198 의 사이트 기본 title 이 HTTP 200 + `index, follow` 로
# 나가고, 그게 그대로 색인된 것이었다. 서로 다른 카테고리 페이지가 바이트 단위로
# 같아지므로 Google 이 한 canonical 로 묶었다(실측: childcare·park 이 /trash/6495 로 병합).
#
# 그 버그(markDegradedResponse 의 ReferenceError)는 3개월간 CI 초록 상태로 살아 있었다.
# 테스트가 프로덕션에 없는 전역을 stubGlobal 로 만들어 줬고 ESLint 도 no-undef 를 눌렀다.
# 발견 경로는 네이버 중복 title 리포트였다 — 이미 100건 이상 오염된 뒤였다.
#
# 그래서 여기서는 "구현이 맞는가"가 아니라 **오염 signature 가 나타나는가**를 직접 본다.
# 자연 발생한 장애 순간에 응답이 올바르게 503 이었는지, 잘못된 200 이었는지가 잡힌다.
#
# ⚠️ 한계: 프로덕션에 장애를 일부러 유발할 수는 없다. 이 절은 (a) 정상 경로가 정상인지와
#    (b) 오염 signature 가 없는지만 확인한다. 실패 경로 자체의 검증은 로컬 실패 주입
#    (백엔드 종료 또는 200+success:false 스텁) 으로 한다.
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣  색인 오염 signature 검사"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# nuxt.config.ts:198 = `${SITE_NAME} - ${SITE_TAGLINE}` (utils/seoConstants.ts)
DEFAULT_TITLE='일상킷 - 부동산 실거래가·청약·내 주변 생활정보'
# 구 세대 tagline. 네이버 진단에서 04-27~06-03 크롤분 50건이 이 title 로 잡혔다.
LEGACY_DEFAULT_TITLE='일상킷 - 내 주변 생활 편의 정보'

# 홈은 예외다 — 브랜드 SERP 대표결과 목적으로 기본 title 을 의도적으로 쓴다(#647/648).
# 나머지 페이지는 전부 `… | 일상킷` 패턴이어야 한다.
SIGNATURE_PATHS="${SIGNATURE_PATHS:-$SAMPLE_CATEGORY_HUB $SAMPLE_FACILITY_PATH $SAMPLE_REAL_ESTATE_PATH}"

for path in $SIGNATURE_PATHS; do
  sig_head=$(curl -sSL --max-time 15 -A 'ilsangkit-validate-seo/1.0' -o /tmp/_canary_body.html \
    -w '%{http_code}' "$BASE_URL$path" 2>/dev/null) || sig_head=""
  if [ -z "$sig_head" ]; then
    fail "$path 응답 실패"
    continue
  fi
  sig_title=$(grep -o '<title[^>]*>[^<]*' /tmp/_canary_body.html | sed 's/<[^>]*>//' | head -1)
  sig_indexable=$(grep -qi 'content="index' /tmp/_canary_body.html && echo yes || echo no)

  # ★ 핵심 단정: 기본 title + 200 + index,follow 조합이 나오면 그게 오염이다.
  if [ "$sig_title" = "$DEFAULT_TITLE" ] || [ "$sig_title" = "$LEGACY_DEFAULT_TITLE" ]; then
    if [ "$sig_head" = "200" ] && [ "$sig_indexable" = "yes" ]; then
      fail "$path — 사이트 기본 title 이 200+index 로 노출 (색인 오염 signature): '$sig_title'"
    else
      note "$path — 기본 title 이지만 $sig_head / index=$sig_indexable (degraded 처리된 것으로 보임)"
    fi
  else
    pass "$path — 고유 title ($sig_head): '$sig_title'"
  fi

  # per-page title 규약: 홈 외 모든 페이지는 ` | 일상킷` 으로 끝난다.
  case "$sig_title" in
    *'| 일상킷') pass "$path — per-page title 규약 준수" ;;
    *) fail "$path — title 이 '| 일상킷' 패턴이 아님: '$sig_title'" ;;
  esac
done
rm -f /tmp/_canary_body.html
echo ""

# ────────────────────────────────────────────────────────────
# 9. 지역×카테고리 fail-closed 회귀
#
# #677 배포 직후, 클라이언트 전용 ref 를 SSR 시점에 읽어 모든 trash 지역 페이지가
# noindex 로 나간 사고가 있었다. #693 에서 같은 계열이 다른 경로(200+success:false)로
# 재발한 것도 확인됐다 — wasteSsr 가 null → wasteEmpty 참 → computeAreaNoindex noindex.
# 데이터가 있는 지역 페이지는 절대 noindex 여서는 안 된다.
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "9️⃣  지역 페이지 fail-closed 회귀 검사"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SAMPLE_REGION_FACILITY_PATH="${SAMPLE_REGION_FACILITY_PATH:-/seoul/gangnam/childcare}"
SAMPLE_REGION_TRASH_PATH="${SAMPLE_REGION_TRASH_PATH:-/gyeonggi/uiwang/trash}"

for path in "$SAMPLE_REGION_FACILITY_PATH" "$SAMPLE_REGION_TRASH_PATH"; do
  region_body=$(fetch_body "$BASE_URL$path") || { fail "$path 응답 실패"; continue; }
  if not_contains "$region_body" 'content="noindex'; then
    pass "$path — noindex 아님 (데이터 있는 지역)"
  else
    fail "$path — noindex 감지. 일시 장애가 noindex 로 굳었을 수 있음 (fail-closed 회귀)"
  fi
done
echo ""

# ────────────────────────────────────────────────────────────
# 10. 사이트맵 내용 — 빈 파일·지역 편향 회귀
#
# 자식 사이트맵이 200 이면서 URL 0개인 경우가 과거에 있었다(upstream 실패가 catch→[] 로
# 둔갑). 그리고 #695 이전에는 상한 절단에 orderBy 가 없어 childcare 15,000 URL 이
# 지역코드 5개만 담고 있었다(29 광주 이후 13개 시·도 누락).
# ────────────────────────────────────────────────────────────
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔟  사이트맵 내용 검사"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
SAMPLE_CHILD_SITEMAP="${SAMPLE_CHILD_SITEMAP:-/sitemap/childcare-1.xml}"
MIN_SITEMAP_URLS="${MIN_SITEMAP_URLS:-1000}"
MIN_REGION_CODES="${MIN_REGION_CODES:-10}"

child_sitemap=$(fetch_body "$BASE_URL$SAMPLE_CHILD_SITEMAP") || { fail "$SAMPLE_CHILD_SITEMAP 응답 실패"; child_sitemap=""; }
if [ -n "$child_sitemap" ]; then
  loc_count=$(printf '%s' "$child_sitemap" | grep -c '<loc>')
  if [ "$loc_count" -ge "$MIN_SITEMAP_URLS" ]; then
    pass "$SAMPLE_CHILD_SITEMAP — URL ${loc_count}개 (>= $MIN_SITEMAP_URLS)"
  else
    fail "$SAMPLE_CHILD_SITEMAP — URL ${loc_count}개뿐. 200 인데 빈 사이트맵일 수 있음"
  fi

  contains "$child_sitemap" '<lastmod>' && pass "lastmod 포함" || fail "lastmod 누락"

  # 지역 편향 회귀 — childcare id 는 `childcare-{법정동코드}` 라 앞 2자리가 시·도다.
  region_codes=$(printf '%s' "$child_sitemap" \
    | grep -o '<loc>[^<]*</loc>' \
    | sed 's/.*childcare-//;s/<.*//' \
    | cut -c1-2 | grep -E '^[0-9][0-9]$' | sort -u | wc -l | tr -d ' ')
  if [ "${region_codes:-0}" -ge "$MIN_REGION_CODES" ]; then
    pass "지역코드 ${region_codes}개 (>= $MIN_REGION_CODES) — 절단 층화 정상"
  else
    fail "지역코드 ${region_codes}개뿐 (< $MIN_REGION_CODES) — 절단이 지역 편향으로 회귀했을 수 있음"
  fi
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
