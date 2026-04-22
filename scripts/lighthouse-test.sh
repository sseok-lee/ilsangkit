#!/bin/bash

###############################################################################
# Lighthouse Performance Test Script
#
# Purpose: Local Lighthouse measurement for Desktop and Mobile
# Usage: ./scripts/lighthouse-test.sh [desktop|mobile|both]
# Requirements: Node.js, @lhci/cli installed globally or in node_modules
###############################################################################

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_DIR="$PROJECT_ROOT/frontend"
OUTPUT_DIR="$PROJECT_ROOT/lighthouse-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Default mode
MODE="${1:-both}"

# Validate mode
if [[ ! "$MODE" =~ ^(desktop|mobile|both)$ ]]; then
  echo -e "${RED}Error: Invalid mode '$MODE'. Use 'desktop', 'mobile', or 'both'${NC}"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

###############################################################################
# Functions
###############################################################################

check_dependencies() {
  echo -e "${BLUE}Checking dependencies...${NC}"

  # Check if lhci is available
  if ! command -v lhci &> /dev/null; then
    if [ ! -f "$FRONTEND_DIR/node_modules/.bin/lhci" ]; then
      echo -e "${RED}Error: @lhci/cli not found${NC}"
      echo "Install it with: npm install -g @lhci/cli"
      echo "Or run: cd frontend && npm install --save-dev @lhci/cli"
      exit 1
    fi
    LHCI="$FRONTEND_DIR/node_modules/.bin/lhci"
  else
    LHCI="lhci"
  fi

  echo -e "${GREEN}✓ Lighthouse CI found${NC}"
}

# 감사 대상 URL 이 실제로 200 을 주는지(= redirect/404/fallback 이 아닌지) 확인한다.
# Lighthouse 는 결과 URL 이 무엇이든 측정값만 반환하므로, 헬스체크 없이 측정하면
# 백엔드/데이터 누락 상태에서 엉뚱한 점수가 나올 수 있다.
# lighthouserc.js 의 collect.url 목록을 그대로 읽어 검증한다.
health_check_urls() {
  echo -e "${BLUE}Verifying target URLs return 200 without redirects...${NC}"
  local cfg_urls
  cfg_urls=$(node -e "try { const cfg = require('$PROJECT_ROOT/lighthouserc.js'); for (const u of (cfg.ci?.collect?.url ?? [])) { console.log(u); } } catch (e) { process.exit(2); }")
  if [ -z "$cfg_urls" ]; then
    echo -e "${RED}Error: lighthouserc.js collect.url 이 비어 있습니다${NC}"
    return 1
  fi
  local failed=0
  while IFS= read -r url; do
    [ -z "$url" ] && continue
    local status
    status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 15 "$url" || echo 000)
    if [ "$status" = "200" ]; then
      echo -e "  ${GREEN}✓${NC} $url → 200"
    else
      echo -e "  ${RED}✗${NC} $url → $status (redirect/404/fallback 가능성)"
      failed=$((failed + 1))
    fi
  done <<< "$cfg_urls"
  if [ "$failed" -gt 0 ]; then
    echo -e "${RED}$failed 개 URL 이 200 이 아닙니다. 백엔드(port 8000)·MSW·프록시 상태를 확인하거나${NC}"
    echo -e "${YELLOW}  SAMPLE_FACILITY_URL 또는 lighthouserc.js 의 collect.url 을 환경에 맞게 조정하세요.${NC}"
    return 1
  fi
  echo -e "${GREEN}✓ All target URLs healthy${NC}"
}

# Nuxt preview 는 백엔드 API 를 자동으로 올리지 않는다. 사용자가 미리 기동했는지 확인하고,
# 기동 안 돼 있으면 친절하게 안내 후 종료한다 (false-green 방지).
ensure_backend_ready() {
  local backend_url="${NUXT_PUBLIC_API_BASE:-http://localhost:8000}"
  local status
  status=$(curl -o /dev/null -s -w '%{http_code}' --max-time 5 "$backend_url/api/health" 2>/dev/null || curl -o /dev/null -s -w '%{http_code}' --max-time 5 "$backend_url" 2>/dev/null || echo 000)
  if [ "$status" = "000" ]; then
    echo -e "${RED}백엔드(${backend_url}) 에 접근할 수 없습니다.${NC}"
    echo -e "${YELLOW}Lighthouse 대상 페이지는 대부분 데이터 의존이므로 백엔드가 먼저 떠 있어야 합니다:${NC}"
    echo "  cd backend && npm run dev    # port 8000"
    echo "  (또는 docker compose up -d 로 MySQL 기동 후 백엔드 실행)"
    exit 4
  fi
  echo -e "${GREEN}✓ Backend responsive at ${backend_url} (status ${status})${NC}"
}

build_frontend() {
  echo -e "${BLUE}Building frontend...${NC}"
  cd "$FRONTEND_DIR"

  # Clean previous build
  rm -rf .output

  # Build for production
  npm run build

  if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Frontend build failed${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Frontend build successful${NC}"

  # Display bundle size
  echo -e "\n${YELLOW}Bundle Size Report:${NC}"
  if [ -d ".output/public/_nuxt" ]; then
    du -sh .output/public/_nuxt
    echo "Individual chunks:"
    ls -lh .output/public/_nuxt/*.js 2>/dev/null | awk '{print "  " $9 ": " $5}'
  fi
  echo ""
}

run_lighthouse_desktop() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}Running Lighthouse - Desktop Mode${NC}"
  echo -e "${BLUE}========================================${NC}\n"

  cd "$FRONTEND_DIR"

  # --config 를 명시적으로 전달해 작업 디렉토리와 무관하게 동일 threshold 가 적용되게 한다.
  # URL 목록은 lighthouserc.js 의 collect.url 에서 관리한다.
  $LHCI autorun \
    --config="$PROJECT_ROOT/lighthouserc.js" \
    --collect.settings.preset=desktop \
    --collect.settings.throttling.rttMs=40 \
    --collect.settings.throttling.throughputKbps=10240 \
    --collect.settings.throttling.cpuSlowdownMultiplier=1 \
    --collect.settings.screenEmulation.mobile=false \
    --collect.settings.screenEmulation.width=1350 \
    --collect.settings.screenEmulation.height=940 \
    --collect.settings.screenEmulation.deviceScaleFactor=1 \
    --upload.target=filesystem \
    --upload.outputDir="$OUTPUT_DIR/desktop_$TIMESTAMP"

  if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Desktop Lighthouse test completed${NC}"
    echo -e "Reports saved to: ${BLUE}$OUTPUT_DIR/desktop_$TIMESTAMP${NC}"
  else
    echo -e "\n${RED}✗ Desktop Lighthouse test failed${NC}"
    return 1
  fi
}

run_lighthouse_mobile() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}Running Lighthouse - Mobile Mode${NC}"
  echo -e "${BLUE}========================================${NC}\n"

  cd "$FRONTEND_DIR"

  # --config 를 명시적으로 전달 (동일 threshold + 동일 URL 셋 유지).
  $LHCI autorun \
    --config="$PROJECT_ROOT/lighthouserc.js" \
    --collect.settings.preset=mobile \
    --collect.settings.throttling.rttMs=150 \
    --collect.settings.throttling.throughputKbps=1638 \
    --collect.settings.throttling.cpuSlowdownMultiplier=4 \
    --collect.settings.screenEmulation.mobile=true \
    --collect.settings.screenEmulation.width=375 \
    --collect.settings.screenEmulation.height=667 \
    --collect.settings.screenEmulation.deviceScaleFactor=2 \
    --upload.target=filesystem \
    --upload.outputDir="$OUTPUT_DIR/mobile_$TIMESTAMP"

  if [ $? -eq 0 ]; then
    echo -e "\n${GREEN}✓ Mobile Lighthouse test completed${NC}"
    echo -e "Reports saved to: ${BLUE}$OUTPUT_DIR/mobile_$TIMESTAMP${NC}"
  else
    echo -e "\n${RED}✗ Mobile Lighthouse test failed${NC}"
    return 1
  fi
}

print_summary() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}Lighthouse Test Summary${NC}"
  echo -e "${BLUE}========================================${NC}\n"

  echo -e "Performance Targets (from specs/non-functional-requirements.yaml):"
  echo -e "  ${YELLOW}Desktop Performance:${NC} > 90"
  echo -e "  ${YELLOW}Mobile Performance:${NC} > 85"
  echo -e "  ${YELLOW}SEO Score:${NC} > 90"
  echo -e "  ${YELLOW}Accessibility Score:${NC} > 85"
  echo ""
  echo -e "Core Web Vitals Targets:"
  echo -e "  ${YELLOW}LCP (Largest Contentful Paint):${NC} < 2.5s"
  echo -e "  ${YELLOW}CLS (Cumulative Layout Shift):${NC} < 0.1"
  echo -e "  ${YELLOW}TBT (Total Blocking Time):${NC} < 300ms (proxy for FID)"
  echo ""
  echo -e "Reports Location: ${BLUE}$OUTPUT_DIR${NC}"
  echo -e "View HTML reports by opening ${YELLOW}*.report.html${NC} files in browser"
  echo ""
}

###############################################################################
# Main Execution
###############################################################################

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Lighthouse Performance Test${NC}"
echo -e "${BLUE}========================================${NC}\n"

check_dependencies
ensure_backend_ready
build_frontend

# preview 서버를 띄운 뒤(@lhci/cli 가 startServerCommand 로 관리) 각 URL 이 200 인지 확인한다.
# 이를 위해 short-lived preview 서버를 수동으로 한 번 올려 health_check 후 종료한다.
echo -e "\n${BLUE}Starting preview server for health check...${NC}"
cd "$FRONTEND_DIR"
PORT=4173 npm run preview >/tmp/ilsangkit-preview.log 2>&1 &
PREVIEW_PID=$!
trap 'kill "$PREVIEW_PID" 2>/dev/null || true' EXIT
# preview 가 준비될 때까지 최대 30초 대기
for _ in $(seq 1 30); do
  if curl -fs --max-time 2 "http://localhost:4173/" >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
if ! curl -fs --max-time 3 "http://localhost:4173/" >/dev/null 2>&1; then
  echo -e "${RED}Preview 서버가 30초 내 기동되지 않았습니다. /tmp/ilsangkit-preview.log 참조${NC}"
  exit 5
fi
if ! health_check_urls; then
  kill "$PREVIEW_PID" 2>/dev/null || true
  exit 6
fi
# lhci autorun 이 자체 preview 를 다시 띄우므로 여기서는 종료한다.
kill "$PREVIEW_PID" 2>/dev/null || true
wait "$PREVIEW_PID" 2>/dev/null || true
trap - EXIT

case "$MODE" in
  desktop)
    run_lighthouse_desktop
    ;;
  mobile)
    run_lighthouse_mobile
    ;;
  both)
    run_lighthouse_desktop
    echo -e "\n${YELLOW}Waiting 5 seconds before mobile test...${NC}"
    sleep 5
    run_lighthouse_mobile
    ;;
esac

print_summary

echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}All tests completed successfully!${NC}"
echo -e "${GREEN}========================================${NC}\n"
