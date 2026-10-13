# Task 3 Report — target-led source card/detail presentation and common list UI

## Summary

Implemented Task3 in the `trash-unified-source-guide` worktree. Trash source cards and details now use target-led, source-neutral presentation titles while preserving raw source identifiers, source URLs, verified-area navigation, and the original source fields. Added reusable list/search UI components for the upcoming list-route integration without wiring route pages in this task.

## Files changed

- `frontend/utils/wasteSchedule.ts` — added placeholder handling for `해당사항없음`, target splitting, target summary, and `wasteSourceTitle` helpers.
- `frontend/composables/useWasteSchedule.ts` — renamed the bulk type label from `대형폐기물` to `일시적 다량폐기물` in the schedule transform.
- `frontend/components/facility/WasteScheduleCard.vue` — uses `wasteSourceTitle`, target-led labels, accessible card title, and non-fabricated bulk schedule display.
- `frontend/components/trash/WasteTypeSection.vue` — preserves source-provided day labels such as `기타` and formats overnight time ranges as `익일`.
- `frontend/components/trash/WasteScheduleContent.vue` — uses target-led source titles, raw target display, external source links, verified-area filter links, normalized bulk placeholders, and all source schedule sections.
- `frontend/components/trash/WasteListSearch.vue` — new reusable city/district/keyword/verified-area search form.
- `frontend/components/trash/WasteListPanel.vue` — new reusable source-card list panel with loading, error, empty, out-of-range, pagination, and safe keyword excerpt states.
- `frontend/composables/useFacilityMeta.ts` — detail metadata now uses visible source titles and accepts emission place input.
- `frontend/composables/useStructuredData.ts` — structured data now uses visible source titles and area-served URLs from `wasteAreaFilterHref` when available.
- `frontend/pages/trash/[id].vue` — detail page passes visible source title through head, schema, breadcrumbs, verified-area links, and page copy.
- `frontend/tests/utils/wasteSchedulePresentation.test.ts` — new RED/GREEN coverage for exact title table and parsing edge cases.
- `frontend/tests/components/trash/WasteListSearch.test.ts` — new reusable search UI tests.
- `frontend/tests/components/trash/WasteListPanel.test.ts` — new reusable list panel state and event tests.
- `frontend/tests/components/facility/WasteScheduleCard.test.ts` — updated card presentation coverage.
- `frontend/tests/components/trash/WasteScheduleContent.test.ts` — updated detail presentation coverage.
- `frontend/tests/composables/useFacilityMeta.test.ts` — updated meta title coverage.
- `frontend/tests/composables/useStructuredData.test.ts` — updated schema area-served coverage.
- `frontend/tests/pages/trashSourceContract.test.ts` — updated contract expectations for visible source titles and verified area links.

## TDD evidence

### RED

Command:

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test -- tests/utils/wasteSchedulePresentation.test.ts tests/components/facility/WasteScheduleCard.test.ts tests/components/trash/WasteScheduleContent.test.ts tests/pages/trashSourceContract.test.ts tests/components/trash/WasteListPanel.test.ts
```

Result: failed as expected before implementation. The failures showed missing `wasteSourceTitle`, `splitWasteTargetForDisplay`, and `summarizeWasteTarget`; missing `WasteListPanel.vue`; source cards/details still rendered raw target titles; detail source link still pointed at `/trash/6567`; raw target and verified-area links were not separated; and the bulk label still used `대형폐기물`.

### Focused GREEN

Command:

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test -- tests/utils/wasteSchedulePresentation.test.ts tests/components/facility/WasteScheduleCard.test.ts tests/components/trash/WasteScheduleContent.test.ts tests/pages/trashSourceContract.test.ts tests/components/trash/WasteListPanel.test.ts tests/components/trash/WasteListSearch.test.ts tests/composables/useFacilityMeta.test.ts tests/composables/useStructuredData.test.ts
```

Result: passed — 8 test files, 180 tests.

### Additional Task3-facing regression checks

Command:

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test -- tests/components/region/RegionTrashSchedule.test.ts tests/pages/trash-detail.test.ts tests/composables/useWasteSchedule.test.ts tests/composables/useWasteList.test.ts tests/composables/useWasteAreaOptions.test.ts tests/utils/wasteListQuery.test.ts
```

Result: passed — 6 test files, 44 tests. Negative-path `useWasteSchedule` tests emitted expected error logs.

## Full verification

### Frontend tests

Command:

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test
```

Result: passed — 382 test files, 3946 passed, 1 skipped, 3947 total. Output includes existing unrelated Vue warnings.

### Backend tests

Command:

```bash
cd backend && source ~/.nvm/nvm.sh && nvm use 20 && source ../.superpowers/sdd/2026-10-13-trash-source-list-fallback/test-env.sh && npm run test
```

Result: passed — 254 test files, 2853 tests. Output includes existing pool-parameter, CORS, and negative-path logs.

### Frontend lint

Command:

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint
```

Result: passed — 0 errors, 727 existing warnings.

Touched-file lint command:

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx eslint utils/wasteSchedule.ts components/facility/WasteScheduleCard.vue components/trash/WasteScheduleContent.vue components/trash/WasteTypeSection.vue components/trash/WasteListSearch.vue components/trash/WasteListPanel.vue 'pages/trash/[id].vue' composables/useFacilityMeta.ts composables/useStructuredData.ts composables/useWasteSchedule.ts tests/utils/wasteSchedulePresentation.test.ts tests/components/facility/WasteScheduleCard.test.ts tests/components/trash/WasteScheduleContent.test.ts tests/components/trash/WasteListSearch.test.ts tests/components/trash/WasteListPanel.test.ts tests/pages/trashSourceContract.test.ts tests/composables/useFacilityMeta.test.ts tests/composables/useStructuredData.test.ts
```

Result: passed — 0 errors. Remaining 7 warnings are pre-existing console warnings in `composables/useWasteSchedule.ts` and existing `any` warnings in `useStructuredData.test.ts`.

### Backend lint

Command:

```bash
cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint
```

Result: passed — 0 errors, 100 existing warnings.

### Diff check

Command:

```bash
git diff --check
```

Result: passed with no whitespace errors.

## Self-review

- Confirmed the presentation helper keeps unbalanced parentheses whole, avoids splitting on `.`, splits top-level comma/plus/semicolon, and treats placeholder target strings as unavailable.
- Confirmed source card/detail presentation does not invent route-specific titles or hardcode visual-preview region IDs.
- Confirmed `/trash/{id}` remains the source-detail route and verified-area navigation uses `wasteAreaFilterHref(areaId)`.
- Confirmed source detail keeps the external source URL for `원문 보기` and separately exposes the raw target as `원본 대상`.
- Confirmed new list/search components are standalone for Task4 route integration and do not change route behavior in Task3.
- Confirmed `git diff --check`, full package tests, and package lint completed after implementation.

## Concerns / deferred work

- Real 390px/1440px browser screenshots and visual comparison are deferred to Task6 per the task brief; no integrated browser visual verification was performed in Task3.
- `WasteListSearch.vue` and `WasteListPanel.vue` are intentionally not wired into list route pages yet because Task4 owns route integration.
- Full frontend/backend lint and tests pass, but both packages still print existing warning/log backlogs that were outside Task3 scope.
