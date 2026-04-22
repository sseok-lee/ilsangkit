// 대표 유입 페이지 셋 — 홈만 통과해도 전체 SEO 가 초록으로 보이는 false green 을 제거하기 위해
// 카테고리 허브 / 실제 시설 상세 / 지역-카테고리 허브 / 부동산 허브 / 정적 가이드까지 포함한다.
// 각 URL 은 npm run preview 환경에서 300/404 없이 200 을 반환해야 한다(health_check_urls 가 강제).
//
// 시설 상세는 실제 DB ID 에 의존하므로 env 로 교체 가능하게 둔다.
//   - 기본값: /toilet/toilet-00379099bd5d661e
//   - override: SAMPLE_FACILITY_URL=/toilet/<real-id>
// 레거시 부동산 허브(/real-estate/apt-sale)는 301 대상이라 제외한다.
// /search 는 의도적 noindex 페이지라 Lighthouse SEO 평가 대상에서 제외한다.
const PREVIEW_BASE = 'http://localhost:4173'
const SAMPLE_FACILITY_URL = process.env.SAMPLE_FACILITY_URL || '/toilet/toilet-00379099bd5d661e'
const LIGHTHOUSE_URLS = [
  `${PREVIEW_BASE}/`,
  `${PREVIEW_BASE}/toilet`,
  `${PREVIEW_BASE}${SAMPLE_FACILITY_URL}`,
  `${PREVIEW_BASE}/seoul/gangnam/toilet`,
  `${PREVIEW_BASE}/real-estate`,
  `${PREVIEW_BASE}/guide`,
]

module.exports = {
  ci: {
    collect: {
      startServerCommand: 'PORT=4173 npm run preview',
      startServerReadyPattern: 'Listening',
      startServerReadyTimeout: 60000,
      url: LIGHTHOUSE_URLS,
      numberOfRuns: 3,
      settings: {
        preset: 'desktop',
        throttling: {
          rttMs: 40,
          throughputKbps: 10 * 1024,
          cpuSlowdownMultiplier: 1,
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
        },
      },
    },
    assert: {
      assertions: {
        // Performance > 90
        'categories:performance': ['error', { minScore: 0.9 }],

        // SEO > 90
        'categories:seo': ['error', { minScore: 0.9 }],

        // Accessibility > 85
        'categories:accessibility': ['error', { minScore: 0.85 }],

        // Best Practices — warn only (CI 환경에서 HTTPS 미사용 등으로 자동 감점되는 항목 포함)
        'categories:best-practices': ['warn', { minScore: 0.8 }],

        // Core Web Vitals from specs/non-functional-requirements.yaml
        'largest-contentful-paint': ['error', { maxNumericValue: 2500 }], // < 2.5s
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.1 }], // < 0.1
        'total-blocking-time': ['warn', { maxNumericValue: 300 }], // proxy for FID

        // Bundle size constraints
        'total-byte-weight': ['warn', { maxNumericValue: 512000 }], // < 500KB
        'dom-size': ['warn', { maxNumericValue: 1500 }],

        // Rendering optimization
        'first-contentful-paint': ['warn', { maxNumericValue: 1800 }],
        'speed-index': ['warn', { maxNumericValue: 3400 }],

        // Network optimization
        'uses-long-cache-ttl': 'off', // handled by Nginx
        'uses-rel-preconnect': 'off', // Kakao Maps API requires runtime load
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
