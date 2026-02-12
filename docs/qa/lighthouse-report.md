# Lighthouse Performance Testing Guide

## Overview

This document describes the Lighthouse performance testing infrastructure for 일상킷 (ilsangkit). We measure Core Web Vitals, SEO, and Accessibility scores to ensure production-grade user experience.

## Performance Targets

Based on `specs/non-functional-requirements.yaml`:

### Lighthouse Scores

| Category | Target | Description |
|----------|--------|-------------|
| **Desktop Performance** | > 90 | Overall performance score for desktop users |
| **Mobile Performance** | > 85 | Overall performance score for mobile users (3G throttling) |
| **SEO Score** | > 90 | Search engine optimization score |
| **Accessibility Score** | > 85 | WCAG 2.1 Level AA compliance |
| **Best Practices** | > 80 | Security, HTTPS, modern web standards |

### Core Web Vitals

| Metric | Target | Description |
|--------|--------|-------------|
| **LCP** (Largest Contentful Paint) | < 2.5s | Time to render largest content element |
| **FID** (First Input Delay) | < 100ms | Time from first interaction to browser response |
| **CLS** (Cumulative Layout Shift) | < 0.1 | Visual stability - unexpected layout shifts |
| **INP** (Interaction to Next Paint) | < 200ms | Responsiveness across all interactions |

### Bundle Size Constraints

| Asset Type | Limit (gzipped) | Description |
|------------|-----------------|-------------|
| JavaScript | < 200KB | Total JS bundle size |
| CSS | < 50KB | Total CSS bundle size |
| Total Transfer | < 500KB | Initial page load size |

## Configuration

### Lighthouse CI Config (`lighthouserc.js`)

The root-level `lighthouserc.js` defines:

```javascript
{
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      url: ['http://localhost:4173/'],
      numberOfRuns: 3,  // Average of 3 runs for stability
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,               // Desktop: fast network
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1
        }
      }
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: 0.9 }],
        'categories:seo': ['error', { minScore: 0.9 }],
        'categories:accessibility': ['error', { minScore: 0.85 }],
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }],
        'total-blocking-time': ['warn', { maxNumericValue: 300 }]
      }
    }
  }
}
```

**Key Points:**
- Desktop preset: Optimized network (10 Mbps), no CPU throttling
- Mobile preset: 3G throttling (1.6 Mbps), 4x CPU slowdown
- 3 runs per test to average out variance
- Assertions fail build if thresholds not met

## Testing Methods

### 1. Local Testing (Manual)

Use the provided script to run Lighthouse locally:

```bash
# Desktop only
./scripts/lighthouse-test.sh desktop

# Mobile only
./scripts/lighthouse-test.sh mobile

# Both desktop and mobile
./scripts/lighthouse-test.sh both
```

**Process:**
1. Builds frontend with `npm run build`
2. Starts production preview server
3. Runs Lighthouse with specified preset
4. Saves reports to `lighthouse-reports/` directory

**Output:**
- HTML reports: `lighthouse-reports/{desktop|mobile}_{timestamp}/*.report.html`
- JSON data: `lighthouse-reports/{desktop|mobile}_{timestamp}/*.json`
- Console summary with pass/fail status

### 2. CI/CD Testing (Automated)

Lighthouse CI runs automatically on GitHub Actions:

```yaml
# .github/workflows/lighthouse-ci.yml
- name: Run Lighthouse CI
  run: |
    npm install -g @lhci/cli
    lhci autorun
```

**Triggers:**
- Every push to `main` branch
- Every pull request (build check)

**Actions:**
- Runs desktop Lighthouse test
- Fails build if scores below threshold
- Uploads reports to temporary storage

### 3. Production Testing (Post-Deploy)

After production deployment:

```bash
# Manual production test
npx @lhci/cli collect --url=https://ilsangkit.com

# With assertions
npx @lhci/cli autorun --url=https://ilsangkit.com
```

**Recommended Frequency:**
- After every production deployment
- Weekly scheduled tests
- Before major releases

## Interpreting Results

### Performance Score Breakdown

Lighthouse calculates performance score from weighted metrics:

| Metric | Weight | Description |
|--------|--------|-------------|
| First Contentful Paint (FCP) | 10% | First text/image rendered |
| Speed Index | 10% | Visual completeness over time |
| Largest Contentful Paint (LCP) | 25% | Largest content element rendered |
| Total Blocking Time (TBT) | 30% | Main thread blocking time (FID proxy) |
| Cumulative Layout Shift (CLS) | 25% | Visual stability |

### Reading HTML Reports

1. Open `*.report.html` in browser
2. **Performance Section:**
   - Overall score (0-100)
   - Core Web Vitals metrics
   - Filmstrip view of page load
3. **Opportunities:**
   - Suggestions to improve performance
   - Estimated savings in ms/KB
4. **Diagnostics:**
   - Additional technical details
   - Network requests, JavaScript execution

### Common Issues and Fixes

#### Low Performance Score (< 90)

**Symptoms:**
- Slow LCP (> 2.5s)
- High TBT (> 300ms)
- Large bundle size

**Solutions:**
1. **Optimize Images:**
   ```bash
   # Convert PNG to WebP
   cwebp -q 80 input.png -o output.webp
   ```
   - Use WebP format for all images
   - Add `loading="lazy"` for below-fold images
   - Use `<picture>` with multiple sizes

2. **Reduce JavaScript Bundle:**
   ```bash
   # Analyze bundle
   cd frontend && npm run build
   npx vite-bundle-visualizer
   ```
   - Use dynamic imports for heavy libraries (Kakao Maps)
   - Remove unused dependencies
   - Enable tree-shaking

3. **Optimize Fonts:**
   ```html
   <!-- Preload critical fonts -->
   <link rel="preload" href="/fonts/pretendard.woff2" as="font" crossorigin>
   ```
   - Use variable fonts to reduce files
   - Subset fonts to only needed characters
   - Use `font-display: swap` to prevent FOIT

4. **Code Splitting:**
   ```typescript
   // Lazy load routes
   const MapView = defineAsyncComponent(() => import('./MapView.vue'))
   ```
   - Split routes with Nuxt auto-imports
   - Lazy load non-critical components

#### Low SEO Score (< 90)

**Symptoms:**
- Missing meta tags
- No structured data
- Sitemap issues

**Solutions:**
1. **Check Meta Tags:**
   ```vue
   <script setup>
   useHead({
     title: '시설명 - 카테고리 | 일상킷',
     meta: [
       { name: 'description', content: '...' },
       { property: 'og:title', content: '...' },
     ]
   })
   </script>
   ```

2. **Validate Structured Data:**
   - Test with [Google Rich Results Test](https://search.google.com/test/rich-results)
   - Ensure JSON-LD present on all pages

3. **Verify Sitemap:**
   ```bash
   curl https://ilsangkit.com/sitemap.xml
   ```
   - Check 200 status code
   - Validate XML format

#### Low Accessibility Score (< 85)

**Symptoms:**
- Missing alt text
- Poor color contrast
- No keyboard navigation

**Solutions:**
1. **Alt Text:**
   ```vue
   <img src="icon.webp" alt="공중화장실 아이콘" />
   ```

2. **Color Contrast:**
   - Use [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
   - Ensure 4.5:1 ratio for normal text

3. **Keyboard Navigation:**
   ```vue
   <button @click="handleClick" @keydown.enter="handleClick">
     검색
   </button>
   ```
   - Add `tabindex` for custom interactive elements
   - Test with Tab key navigation

## Optimization Guidelines

### Image Optimization

```bash
# Install imagemin
npm install -g @squoosh/cli

# Convert and optimize
squoosh-cli --webp '{"quality":80}' --output-dir output/ input.png
```

**Best Practices:**
- Use WebP with PNG fallback
- Responsive images with `srcset`
- Lazy load below-fold images
- Use CDN for static assets

### Bundle Size Optimization

```bash
# Analyze current bundle
cd frontend
npm run build
ls -lh .output/public/_nuxt/

# Expected output (gzipped):
# entry.*.js: < 150KB
# *.css: < 30KB
```

**Strategies:**
1. **Dynamic Imports:**
   ```typescript
   // Bad: synchronous import
   import KakaoMap from '~/components/KakaoMap.vue'

   // Good: lazy load
   const KakaoMap = defineAsyncComponent(() =>
     import('~/components/KakaoMap.vue')
   )
   ```

2. **Remove Unused Code:**
   ```bash
   # Find unused exports
   npx ts-prune
   ```

3. **Optimize Dependencies:**
   ```bash
   # Check bundle size impact
   npx bundlephobia <package-name>
   ```

### Caching Strategy

Configure in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  nitro: {
    routeRules: {
      // Static assets - cache forever
      '/_nuxt/**': { headers: { 'cache-control': 'max-age=31536000, immutable' } },

      // API - no cache
      '/api/**': { headers: { 'cache-control': 'no-cache' } },

      // HTML pages - stale while revalidate
      '/**': { headers: { 'cache-control': 'max-age=3600, stale-while-revalidate=86400' } }
    }
  }
})
```

## Continuous Monitoring

### GitHub Actions Integration

The project includes automated Lighthouse CI:

```yaml
# .github/workflows/lighthouse-ci.yml
name: Lighthouse CI
on: [push, pull_request]
jobs:
  lighthouse:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run build
      - run: npm install -g @lhci/cli
      - run: lhci autorun
```

**Result:**
- ✅ Green check: All scores above threshold
- ❌ Red X: One or more scores below threshold (blocks merge)

### Manual Monitoring

Schedule weekly checks:

```bash
# Weekly production test
0 9 * * 1 /path/to/scripts/lighthouse-test.sh both >> /var/log/lighthouse.log
```

## Troubleshooting

### Script Fails to Run

**Error: `@lhci/cli not found`**

```bash
# Install globally
npm install -g @lhci/cli

# Or install locally
cd frontend
npm install --save-dev @lhci/cli
```

**Error: `Port 4173 already in use`**

```bash
# Kill existing process
lsof -ti:4173 | xargs kill -9

# Or use different port
npm run preview -- --port 4174
```

### Inconsistent Scores

**Causes:**
- Background processes using CPU
- Network instability
- Different Node.js versions

**Solutions:**
- Run multiple times (script does 3 runs by default)
- Close unnecessary applications
- Use dedicated CI environment

### Build Fails

**Error: `Build failed with errors`**

```bash
# Check build locally
cd frontend
npm run build

# Common issues:
# - TypeScript errors
# - Missing environment variables
# - ESLint warnings (set to error)
```

## Resources

### Tools
- [Google Lighthouse](https://developers.google.com/web/tools/lighthouse)
- [PageSpeed Insights](https://pagespeed.web.dev/)
- [WebPageTest](https://www.webpagetest.org/)
- [web.dev Measure](https://web.dev/measure/)

### Documentation
- [Core Web Vitals](https://web.dev/vitals/)
- [Lighthouse Scoring](https://web.dev/performance-scoring/)
- [Lighthouse CI](https://github.com/GoogleChrome/lighthouse-ci)

### Monitoring Services
- [Vercel Speed Insights](https://vercel.com/docs/speed-insights)
- [Google Search Console](https://search.google.com/search-console)
- [Cloudflare Web Analytics](https://www.cloudflare.com/web-analytics/)

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| 2026-02-12 | 1.0.0 | Initial documentation and script creation (P14-T1) |
