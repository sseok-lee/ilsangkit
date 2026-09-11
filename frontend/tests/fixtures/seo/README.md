# SEO rendering regression harness

Run from `frontend/` with Node 20 and the existing lockfile dependencies:

```sh
npm run test:e2e:seo
```

Playwright starts a fixed API on port 18080, builds the real Nuxt app with this test-only configuration, and serves it on port 13000. Both ports must be free. The test configuration overrides the API proxy and prerenders the fixture pages to exercise actual extracted `_payload.json` loading. It does not modify the production Nuxt configuration or require a database.

Every test uses a fresh browser context with service workers blocked. The direct-load cases compare visible server-rendered content and metadata against the hydrated page while browser API requests fail. The suite also verifies that a nearby HardLink creates a new document and that changing a rent filter cannot leave the previous query's nearby cards visible.

`test-results/seo-results.json` records the initial `__NUXT_DATA__` data-src URL, its exact successful payload response, API request evidence, and hydration warning attachments. A negative control blocks both payload and API; additional cases cover failed-SSR retry and a router sale→rent transition with a delayed prior response. Warnings are recorded separately from content assertions; this suite does not claim to eliminate all hydration warnings or reproduce Naver's private renderer.

The harness cleans and writes only `.nuxt/seo-fixture/` and `.output/seo-fixture/`. Build it sequentially with the normal production build; normal builds may replace their parent directories. Both `seo-rendering-recovery.spec.ts` and the migrated `real-estate-nearby.spec.ts` are excluded from the default configuration so ordinary `npm run test:e2e` does not run them against port 3000 without the fixture API.
