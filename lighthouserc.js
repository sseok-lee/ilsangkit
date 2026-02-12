module.exports = {
  ci: {
    collect: {
      startServerCommand: 'npm run preview',
      startServerReadyPattern: 'Local',
      startServerReadyTimeout: 30000,
      url: ['http://localhost:4173/'],
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

        // Best Practices > 80
        'categories:best-practices': ['error', { minScore: 0.8 }],

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
