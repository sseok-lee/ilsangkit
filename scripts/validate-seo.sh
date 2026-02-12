#!/bin/bash

# SEO 코드 레벨 검증 스크립트
# Phase: P14-T3
# 프로젝트: 일상킷

# set -e removed to allow full validation report

echo "========================================"
echo "🔍 일상킷 SEO 코드 레벨 검증"
echo "========================================"
echo ""

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
BACKEND_DIR="$PROJECT_ROOT/backend"

PASSED=0
FAILED=0

# 색상 정의
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
}

echo "📁 프로젝트 루트: $PROJECT_ROOT"
echo ""

# ==========================================
# 1. robots.txt 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1️⃣  robots.txt 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ROBOTS_FILE="$FRONTEND_DIR/public/robots.txt"

if [ -f "$ROBOTS_FILE" ]; then
    check_pass "robots.txt 파일 존재"

    # 사이트맵 URL 확인
    if grep -q "Sitemap: https://ilsangkit.co.kr/sitemap.xml" "$ROBOTS_FILE"; then
        check_pass "사이트맵 URL 포함"
    else
        check_fail "사이트맵 URL 누락"
    fi

    # Allow 규칙 확인
    if grep -q "Allow: /" "$ROBOTS_FILE"; then
        check_pass "주요 페이지 크롤링 허용"
    else
        check_fail "Allow 규칙 누락"
    fi

    # Disallow 규칙 확인
    if grep -q "Disallow: /api/" "$ROBOTS_FILE"; then
        check_pass "API 경로 차단 설정"
    else
        check_warn "API 경로 차단 권장"
    fi
else
    check_fail "robots.txt 파일 없음"
fi

echo ""

# ==========================================
# 2. 사이트맵 엔드포인트 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "2️⃣  사이트맵 엔드포인트 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

SITEMAP_FILE="$BACKEND_DIR/src/routes/sitemap.ts"

if [ -f "$SITEMAP_FILE" ]; then
    check_pass "사이트맵 라우터 파일 존재"

    # 카테고리 엔드포인트 확인
    if grep -q "/facilities/:category" "$SITEMAP_FILE"; then
        check_pass "시설 카테고리 엔드포인트 구현"
    else
        check_fail "카테고리 엔드포인트 누락"
    fi

    # 쓰레기 배출 엔드포인트 확인
    if grep -q "/waste-schedules" "$SITEMAP_FILE"; then
        check_pass "쓰레기 배출 일정 엔드포인트 구현"
    else
        check_fail "쓰레기 배출 엔드포인트 누락"
    fi
else
    check_fail "사이트맵 라우터 파일 없음"
fi

echo ""

# ==========================================
# 3. nuxt.config.ts 메타 태그 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "3️⃣  nuxt.config.ts 메타 태그 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

NUXT_CONFIG="$FRONTEND_DIR/nuxt.config.ts"

if [ -f "$NUXT_CONFIG" ]; then
    check_pass "nuxt.config.ts 파일 존재"

    # HTML lang 속성
    if grep -q "lang: 'ko'" "$NUXT_CONFIG"; then
        check_pass "HTML lang='ko' 설정"
    else
        check_fail "HTML lang 속성 누락"
    fi

    # viewport 메타 태그
    if grep -q "viewport" "$NUXT_CONFIG"; then
        check_pass "viewport 메타 태그 설정"
    else
        check_fail "viewport 메타 태그 누락"
    fi

    # description 메타 태그
    if grep -q "description" "$NUXT_CONFIG"; then
        check_pass "description 메타 태그 설정"
    else
        check_fail "description 메타 태그 누락"
    fi

    # 보안 헤더 확인
    if grep -q "X-Content-Type-Options" "$NUXT_CONFIG"; then
        check_pass "보안 헤더 설정 (X-Content-Type-Options)"
    else
        check_warn "보안 헤더 추가 권장"
    fi

    # 캐싱 설정 확인
    if grep -q "cache-control" "$NUXT_CONFIG"; then
        check_pass "정적 리소스 캐싱 설정"
    else
        check_warn "캐싱 전략 추가 권장"
    fi
else
    check_fail "nuxt.config.ts 파일 없음"
fi

echo ""

# ==========================================
# 4. 구조화된 데이터 Composable 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "4️⃣  구조화된 데이터 (JSON-LD) 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

STRUCTURED_DATA_FILE="$FRONTEND_DIR/composables/useStructuredData.ts"

if [ -f "$STRUCTURED_DATA_FILE" ]; then
    check_pass "useStructuredData.ts 파일 존재"

    # WebSite 스키마
    if grep -q "setWebsiteSchema" "$STRUCTURED_DATA_FILE"; then
        check_pass "WebSite 스키마 구현"
    else
        check_fail "WebSite 스키마 누락"
    fi

    # LocalBusiness/Place 스키마
    if grep -q "setFacilitySchema" "$STRUCTURED_DATA_FILE"; then
        check_pass "Facility 스키마 구현"
    else
        check_fail "Facility 스키마 누락"
    fi

    # BreadcrumbList 스키마
    if grep -q "setBreadcrumbSchema" "$STRUCTURED_DATA_FILE"; then
        check_pass "BreadcrumbList 스키마 구현"
    else
        check_fail "BreadcrumbList 스키마 누락"
    fi

    # Organization 스키마
    if grep -q "setOrganizationSchema" "$STRUCTURED_DATA_FILE"; then
        check_pass "Organization 스키마 구현"
    else
        check_warn "Organization 스키마 추가 권장"
    fi

    # GovernmentService 스키마
    if grep -q "setWasteScheduleSchema" "$STRUCTURED_DATA_FILE"; then
        check_pass "GovernmentService 스키마 구현"
    else
        check_warn "GovernmentService 스키마 누락"
    fi
else
    check_fail "useStructuredData.ts 파일 없음"
fi

echo ""

# ==========================================
# 5. 메타 태그 Composable 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "5️⃣  동적 메타 태그 Composable 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

META_FILE="$FRONTEND_DIR/composables/useFacilityMeta.ts"

if [ -f "$META_FILE" ]; then
    check_pass "useFacilityMeta.ts 파일 존재"

    # 홈페이지 메타
    if grep -q "setHomeMeta" "$META_FILE"; then
        check_pass "홈페이지 메타 함수 구현"
    else
        check_fail "홈페이지 메타 함수 누락"
    fi

    # 시설 상세 메타
    if grep -q "setFacilityDetailMeta" "$META_FILE"; then
        check_pass "시설 상세 메타 함수 구현"
    else
        check_fail "시설 상세 메타 함수 누락"
    fi

    # Open Graph 태그
    if grep -q "og:title" "$META_FILE"; then
        check_pass "Open Graph 태그 포함"
    else
        check_warn "Open Graph 태그 추가 권장"
    fi

    # Twitter Card 태그
    if grep -q "twitter:card" "$META_FILE"; then
        check_pass "Twitter Card 태그 포함"
    else
        check_warn "Twitter Card 태그 추가 권장"
    fi
else
    check_fail "useFacilityMeta.ts 파일 없음"
fi

echo ""

# ==========================================
# 6. 페이지별 SEO 구현 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "6️⃣  페이지별 SEO 구현 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 홈페이지
INDEX_PAGE="$FRONTEND_DIR/pages/index.vue"
if [ -f "$INDEX_PAGE" ]; then
    check_pass "홈페이지 파일 존재"

    if grep -q "setHomeMeta" "$INDEX_PAGE"; then
        check_pass "홈페이지 메타 설정 적용"
    else
        check_fail "홈페이지 메타 설정 누락"
    fi

    if grep -q "setWebsiteSchema" "$INDEX_PAGE"; then
        check_pass "홈페이지 WebSite 스키마 적용"
    else
        check_fail "홈페이지 WebSite 스키마 누락"
    fi

    if grep -q "<h1" "$INDEX_PAGE"; then
        check_pass "홈페이지 h1 태그 존재"
    else
        check_warn "홈페이지 h1 태그 확인 필요"
    fi
else
    check_fail "홈페이지 파일 없음"
fi

# 시설 상세 페이지
DETAIL_PAGE="$FRONTEND_DIR/pages/[category]/[id].vue"
if [ -f "$DETAIL_PAGE" ]; then
    check_pass "시설 상세 페이지 파일 존재"

    if grep -q "setFacilityDetailMeta" "$DETAIL_PAGE"; then
        check_pass "시설 상세 메타 설정 적용"
    else
        check_fail "시설 상세 메타 설정 누락"
    fi

    if grep -q "setFacilitySchema" "$DETAIL_PAGE"; then
        check_pass "시설 상세 LocalBusiness 스키마 적용"
    else
        check_fail "시설 상세 스키마 누락"
    fi

    if grep -q "setBreadcrumbSchema" "$DETAIL_PAGE"; then
        check_pass "시설 상세 Breadcrumb 스키마 적용"
    else
        check_fail "시설 상세 Breadcrumb 누락"
    fi

    if grep -q "<h1" "$DETAIL_PAGE"; then
        check_pass "시설 상세 h1 태그 존재"
    else
        check_warn "시설 상세 h1 태그 확인 필요"
    fi
else
    check_fail "시설 상세 페이지 파일 없음"
fi

echo ""

# ==========================================
# 7. 이미지 최적화 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "7️⃣  이미지 최적화 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ICONS_DIR="$FRONTEND_DIR/public/icons/category"

if [ -d "$ICONS_DIR" ]; then
    WEBP_COUNT=$(find "$ICONS_DIR" -name "*.webp" | wc -l)
    PNG_COUNT=$(find "$ICONS_DIR" -name "*.png" | wc -l)

    if [ "$WEBP_COUNT" -gt 0 ]; then
        check_pass "WebP 이미지 사용 ($WEBP_COUNT개)"
    else
        check_warn "WebP 이미지 없음"
    fi

    if [ "$PNG_COUNT" -eq 0 ]; then
        check_pass "PNG 파일 정리 완료"
    else
        check_warn "PNG 파일 $PNG_COUNT개 남아있음 (WebP 변환 권장)"
    fi
else
    check_warn "아이콘 디렉토리 없음"
fi

# 로고 확인
LOGO_WEBP="$FRONTEND_DIR/public/icons/logo.webp"
if [ -f "$LOGO_WEBP" ]; then
    check_pass "로고 WebP 파일 존재"
else
    check_warn "로고 WebP 파일 없음"
fi

echo ""

# ==========================================
# 8. 접근성 검증
# ==========================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "8️⃣  접근성 (a11y) 기본 검증"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# aria-label 사용 확인 (홈페이지)
if grep -q "aria-label" "$INDEX_PAGE"; then
    check_pass "홈페이지 aria-label 사용"
else
    check_warn "홈페이지 aria-label 추가 권장"
fi

# aria-label 사용 확인 (상세 페이지)
if grep -q "aria-label" "$DETAIL_PAGE"; then
    check_pass "상세 페이지 aria-label 사용"
else
    check_warn "상세 페이지 aria-label 추가 권장"
fi

echo ""

# ==========================================
# 결과 요약
# ==========================================
echo "========================================"
echo "📊 검증 결과 요약"
echo "========================================"
echo ""
echo -e "${GREEN}✅ 통과${NC}: $PASSED"
echo -e "${RED}❌ 실패${NC}: $FAILED"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 모든 SEO 요소가 정상적으로 구현되었습니다!${NC}"
    echo ""
    echo "다음 단계:"
    echo "  1. 프로덕션 배포 (npm run build && npm run generate)"
    echo "  2. Google Search Console 도메인 등록"
    echo "  3. docs/qa/search-console-checklist.md 참조"
    exit 0
else
    echo -e "${RED}⚠️  $FAILED개의 항목이 실패했습니다. 위 내용을 확인하세요.${NC}"
    exit 1
fi
