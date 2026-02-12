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

  # Run Lighthouse with desktop settings
  $LHCI autorun \
    --collect.startServerCommand="npm run preview" \
    --collect.startServerReadyPattern="Local" \
    --collect.startServerReadyTimeout=30000 \
    --collect.url="http://localhost:4173/" \
    --collect.numberOfRuns=3 \
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

  # Run Lighthouse with mobile settings
  $LHCI autorun \
    --collect.startServerCommand="npm run preview" \
    --collect.startServerReadyPattern="Local" \
    --collect.startServerReadyTimeout=30000 \
    --collect.url="http://localhost:4173/" \
    --collect.numberOfRuns=3 \
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
build_frontend

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
