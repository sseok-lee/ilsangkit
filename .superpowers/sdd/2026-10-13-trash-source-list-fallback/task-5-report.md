# Task 5 Report — Region-only trash sitemap and source-list canary

## Scope

Implemented Task5 in worktree `.worktrees/trash-unified-source-guide` from base `5ecf2276daddee03c695d6baa0acbbea1ff900eb`.

The change keeps the generic static sitemap generator implementation intact and preserves the guard behavior. Trash sitemap generation now advertises only regional trash pages, while the old waste-area sitemap API remains as an empty compatibility envelope.

Production canary/workflow execution was intentionally not run.

## Changed files

- `.github/workflows/seo-canary.yml` — added Gapyeong as a secondary trash region sample path.
- `backend/src/services/sitemapService.ts` — removed waste-area rows from sitemap counts/lastmod and made `getWasteAreaIdsForSitemap()` return an empty list.
- `backend/src/routes/sitemap.ts` — kept `/api/sitemap/waste-areas` successful but empty for compatibility.
- `backend/__tests__/services/sitemapService.test.ts` — updated sitemap count expectations to region-only trash URLs and verified waste-area discovery is unused.
- `backend/__tests__/routes/sitemap.integration.test.ts` — locked the compatibility endpoint to an empty `areas: []` response.
- `backend/__tests__/scripts/generateSitemaps.test.ts` — added migration/carry-forward fixtures proving corrected region-only XML replaces area URLs when the count guard allows it and proving intentional count drops still carry forward.
- `frontend/server/utils/sitemap.ts` — removed frontend waste-area sitemap fetching and URL construction.
- `frontend/server/routes/sitemap.xml.ts` — updated trash sitemap comment to region-only behavior.
- `frontend/server/routes/sitemap/[...].ts` — updated trash child sitemap comment to region-only behavior.
- `frontend/tests/server/sitemap.test.ts` — updated sitemap expectations to region-only trash URLs and added coverage that the area endpoint can fail without breaking trash sitemaps.
- `frontend/tests/server/sitemap-quality-gate.test.ts` — quality gate mocks now reject waste-area sitemap calls, proving they are not used.
- `scripts/lib/trash-region-canary.sh` — added shared helper for trash region HTML/response validation.
- `scripts/tests/trash-region-canary.test.sh` — added shell regression coverage for the helper.
- `scripts/validate-seo.sh` — preserved the facility region canary, added Uiwang primary + Gapyeong secondary trash region canaries, fetches trash pages without redirect following, and validates HTTP 200, nonempty body, canonical, indexability, and real numeric `/trash/{id}` anchors.

## Behavior notes

- `/sitemap.xml` and `/sitemap/trash*.xml` now use only `/gyeonggi/.../trash` style region URLs for trash.
- `/trash/areas/{id}` is no longer emitted by backend counts or frontend sitemap builders.
- `/api/sitemap/waste-areas` still returns `success: true` with `data.areas: []` for compatibility.
- The generic static generator was not changed; new fixtures prove the existing migration and carry-forward paths for stale area URLs.
- The trash region canary helper accepts only SSR-visible real anchors such as `<a href="/trash/1001">` or fragment variants. Script/JSON-only `/trash/1001` text and `/trash/areas/...` anchors fail.
- Trash canary response status handling remains outside the HTML helper and checks curl exit, exact HTTP 200, and nonempty body before HTML assertions.

## Verification commands and output

### Focused RED

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && source .superpowers/sdd/2026-10-13-trash-source-list-fallback/test-env.sh && (cd backend && npx vitest run __tests__/services/sitemapService.test.ts __tests__/routes/sitemap.integration.test.ts __tests__/scripts/generateSitemaps.test.ts)
```

Expected failures before implementation:

- `getSitemapPageCounts` still counted waste regions plus waste areas and used area `maxUpdatedAt`.
- `/api/sitemap/waste-areas` still returned mocked area rows instead of the empty compatibility envelope.

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && (cd frontend && npx vitest run tests/server/sitemap.test.ts tests/server/sitemap-quality-gate.test.ts tests/server/sitemapStatic.test.ts) ; bash scripts/tests/trash-region-canary.test.sh
```

Expected failures before implementation:

- Frontend sitemap tests still fetched `/api/sitemap/waste-areas` and emitted `/trash/areas/{id}`.
- The new trash region canary helper script did not exist yet.

### Focused GREEN

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && source .superpowers/sdd/2026-10-13-trash-source-list-fallback/test-env.sh && (cd backend && npx vitest run __tests__/services/sitemapService.test.ts __tests__/routes/sitemap.integration.test.ts __tests__/scripts/generateSitemaps.test.ts) && (cd frontend && npx vitest run tests/server/sitemap.test.ts tests/server/sitemap-quality-gate.test.ts tests/server/sitemapStatic.test.ts) && bash -n scripts/validate-seo.sh scripts/lib/trash-region-canary.sh scripts/tests/trash-region-canary.test.sh && bash scripts/tests/trash-region-canary.test.sh
```

Output summary:

- Backend focused tests: 3 files, 60 tests passed.
- Frontend focused tests: 3 files, 101 tests passed.
- Shell syntax checks passed.
- `trash-region-canary helper tests passed: assertions=14 helper_pass_calls=20`.

### Full backend tests

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && source .superpowers/sdd/2026-10-13-trash-source-list-fallback/test-env.sh && (cd backend && npm run test)
```

Output summary:

- 254 test files passed.
- 2855 tests passed.
- Existing Prisma/pool warning output appeared; no failures.

### Full frontend tests

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && (cd frontend && npm run test)
```

Output summary:

- 385 test files passed.
- 3970 tests passed, 1 skipped.
- Existing Vue/component warning output appeared; no failures.

### Lint and shell checks

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && (cd backend && npm run lint) && (cd frontend && npm run lint) && bash -n scripts/validate-seo.sh scripts/lib/trash-region-canary.sh scripts/tests/trash-region-canary.test.sh && bash scripts/tests/trash-region-canary.test.sh
```

Output summary:

- Backend lint exited 0 with 98 warnings.
- Frontend lint exited 0 with 726 warnings.
- Shell syntax checks passed.
- `trash-region-canary helper tests passed: assertions=14 helper_pass_calls=20`.

### Diff and build checks

```bash
git diff --check
```

Output: exited 0.

```bash
source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && (cd backend && npm run build) && (cd frontend && npm run build)
```

Output summary:

- Backend `tsc` build passed.
- Frontend Nuxt production build passed.
- Existing Browserslist age warning and existing PostCSS lexical warnings appeared; build completed successfully.

### Final shell recheck after self-review fix

```bash
bash -n scripts/validate-seo.sh scripts/lib/trash-region-canary.sh scripts/tests/trash-region-canary.test.sh && bash scripts/tests/trash-region-canary.test.sh && git diff --check
```

Output:

- `trash-region-canary helper tests passed: assertions=14 helper_pass_calls=20`.
- `git diff --check` exited 0.

## Self-review

- Confirmed the static sitemap generator implementation was not modified.
- Confirmed waste-area sitemap compatibility remains successful but empty.
- Confirmed frontend sitemap generation no longer reads the waste-area endpoint.
- Confirmed migration fixtures cover both replacement of stale area XML and carry-forward when a drop exceeds the guard threshold.
- Confirmed `validate-seo.sh` sources the trash helper relative to the script directory, so it works when invoked as `./scripts/validate-seo.sh` from the repo root or another working directory.
- Confirmed no production canary, workflow dispatch, deployment, push, PR, dependency install, or production cache purge was performed.

## Release and migration instructions

- Deploy the backend/frontend changes together so sitemap count data and frontend sitemap rendering agree on region-only trash URLs.
- After deployment, allow the normal sitemap artifact generation path to fetch the corrected `/sitemap/trash*.xml` files. The existing count guard can replace stale area-containing trash XML when the URL count does not drop beyond the configured threshold.
- If the intentional region-only migration causes a child trash sitemap URL count drop beyond the guard threshold in production artifacts, review the generated XML and update the sitemap count baseline or release artifact deliberately rather than disabling the guard globally.
- Do not purge production caches as part of this task. Let normal deployment and artifact generation paths refresh the affected sitemap artifacts.
- Keep Uiwang (`/gyeonggi/uiwang/trash`) as the primary trash region canary and Gapyeong (`/gyeonggi/gapyeong/trash`) as the secondary canary sample.
- When the canary is run after release, failures to watch are HTTP redirects/non-200 statuses, empty SSR bodies, missing canonical, accidental `noindex`, and missing real numeric `/trash/{id}` anchors.

## Concerns / known gaps

- Production canary and GitHub workflow were not run by instruction.
- Lint still reports existing warning volume in both packages; no lint errors were introduced.
- Frontend build still emits existing Browserslist and PostCSS warnings; build succeeds.
