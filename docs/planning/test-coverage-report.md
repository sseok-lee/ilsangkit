# Test Coverage Report

**Generated**: 2026-02-12
**Project**: ilsangkit (일상킷)

---

## Executive Summary

| Layer | Total Coverage | Lines | Branches | Functions | Statements |
|-------|---------------|-------|----------|-----------|------------|
| **Backend** | **45.44%** | 45.44% | 50.84% | 46.85% | 45.55% |
| **Frontend** | **18.28%** | 18.28% | 57.00% | 33.62% | 18.28% |

---

## Backend Coverage (Vitest + Supertest)

### Overall Metrics
- **Lines**: 45.44%
- **Branches**: 50.84%
- **Functions**: 46.85%
- **Statements**: 45.55%

### Test Execution Summary
- **Total Tests**: 275 passed
- **Test Files**: 26 passed
- **Duration**: 2.55s

### Coverage by Directory

#### 🟢 High Coverage (≥80%)
| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `src/app.ts` | 90.90% | 25.00% | 100% | 90.90% |
| `src/middlewares/rateLimit.ts` | 100% | 100% | 100% | 100% |
| `src/middlewares/requestId.ts` | 100% | 100% | 100% | 100% |
| `src/middlewares/security.ts` | 95.00% | 77.27% | 100% | 95.00% |
| `src/middlewares/validate.ts` | 85.71% | 63.63% | 100% | 85.71% |
| `src/lib/asyncHandler.ts` | 100% | 100% | 100% | 100% |
| `src/lib/errors.ts` | 100% | 100% | 100% | 100% |
| `src/lib/prisma.ts` | 100% | 66.66% | 100% | 100% |
| `src/lib/publicApiClient.ts` | 93.75% | 84.21% | 100% | 93.18% |
| `src/schemas/common.ts` | 100% | 100% | 100% | 100% |
| `src/schemas/facility.ts` | 91.66% | 50.00% | 100% | 100% |
| `src/schemas/search.ts` | 100% | 100% | 100% | 100% |
| `src/schemas/wasteSchedule.ts` | 100% | 100% | 100% | 100% |
| `src/routes/facilities.ts` | 100% | 66.66% | 100% | 100% |
| `src/routes/meta.ts` | 76.92% | 100% | 75.00% | 76.92% |
| `src/services/geocodingService.ts` | 95.00% | 94.11% | 100% | 94.28% |
| `src/services/publicApiClient.ts` | 87.27% | 62.96% | 87.50% | 90.00% |

#### 🟡 Medium Coverage (50-79%)
| File | Statements | Branches | Functions | Lines |
|------|-----------|----------|-----------|-------|
| `src/lib/csvParser.ts` | 61.86% | 57.97% | 38.46% | 61.06% |
| `src/services/csvParser.ts` | 77.38% | 65.83% | 70.00% | 77.15% |
| `src/services/facilityService.ts` | 65.67% | 71.73% | 66.66% | 64.46% |
| `src/scripts/syncRegion.ts` | 62.82% | 71.05% | 60.00% | 63.88% |
| `src/scripts/syncTrash.ts` | 77.61% | 87.03% | 60.00% | 77.27% |
| `src/scripts/syncKiosk.ts` | 85.96% | 62.06% | 76.47% | 87.96% |

#### 🔴 Low Coverage (<50%) - Priority for Testing

##### Scripts (Data Sync Services)
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `src/scripts/syncAed.ts` | 0% | **HIGH** | Critical AED data sync - public safety feature |
| `src/scripts/syncClothes.ts` | 0% | HIGH | Clothes collection sync |
| `src/scripts/syncParking.ts` | 0% | HIGH | Parking facility sync |
| `src/scripts/syncToilet.ts` | 0% | HIGH | Public toilet sync - core feature |
| `src/scripts/syncAll.ts` | 0% | MEDIUM | Orchestrator for all sync tasks |
| `src/scripts/syncWifi.ts` | 16.93% | MEDIUM | WiFi hotspot sync |

##### Services
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `src/services/aedSyncService.ts` | 3.27% | **HIGH** | Service layer for AED sync |
| `src/services/clothesSyncService.ts` | 0% | HIGH | Service layer for clothes sync |
| `src/services/kioskSyncService.ts` | 0% | HIGH | Service layer for kiosk sync |
| `src/services/parkingSyncService.ts` | 0% | HIGH | Service layer for parking sync |
| `src/services/toiletSyncService.ts` | 0% | HIGH | Service layer for toilet sync |
| `src/services/wasteScheduleService.ts` | 0% | HIGH | Waste schedule lookup service |

##### Routes
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `src/routes/wasteSchedules.ts` | 20% | **HIGH** | Public API endpoint for waste schedules |
| `src/routes/sitemap.ts` | 33.33% | MEDIUM | SEO sitemap generation |

##### Constants & Types
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `src/constants/geo.ts` | 0% | LOW | Constants only - low priority |
| `src/constants/pagination.ts` | 0% | LOW | Constants only - low priority |
| `src/constants/sync.ts` | 0% | LOW | Constants only - low priority |
| `src/types/*` | 0% | LOW | Type definitions - TypeScript handles |

---

## Frontend Coverage (Vitest + Vue Test Utils)

### Overall Metrics
- **Lines**: 18.28%
- **Branches**: 57.00%
- **Functions**: 33.62%
- **Statements**: 18.28%

### Test Execution Summary
- **Total Tests**: 245 passed
- **Test Files**: 28 passed
- **Duration**: 5.11s

### Coverage by Directory

#### 🟢 High Coverage (≥80%)
| Component | Statements | Branches | Functions | Lines |
|-----------|-----------|----------|-----------|-------|
| `components/common/AppFooter.vue` | 100% | 100% | 100% | 100% |
| `components/common/AppHeader.vue` | 95.21% | 100% | 40% | 95.21% |
| `components/common/BaseButton.vue` | 100% | 100% | 100% | 100% |
| `components/common/BaseCard.vue` | 100% | 100% | 100% | 100% |
| `components/category/CategoryChips.vue` | 100% | 100% | 100% | 100% |
| `components/facility/DetailRow.vue` | 100% | 100% | 100% | 100% |
| `components/facility/FacilityCard.vue` | 100% | 71.42% | 100% | 100% |
| `components/facility/FacilityList.vue` | 100% | 100% | 100% | 100% |
| `components/facility/FeatureCard.vue` | 100% | 100% | 100% | 100% |
| `components/facility/OperatingStatusBadge.vue` | 100% | 100% | 100% | 100% |
| `components/facility/details/ToiletDetail.vue` | 100% | 85.71% | 100% | 100% |
| `components/location/CurrentLocationButton.vue` | 82.22% | 75.86% | 100% | 82.22% |
| `components/map/FacilityMap.vue` | 88.23% | 68.75% | 75% | 88.23% |
| `components/navigation/Breadcrumb.vue` | 100% | 100% | 100% | 100% |
| `components/search/SearchFilters.vue` | 100% | 100% | 100% | 100% |
| `components/search/SearchInput.vue` | 100% | 100% | 100% | 100% |
| `layouts/default.vue` | 100% | 100% | 100% | 100% |
| `pages/index.vue` | 98.72% | 94.73% | 71.42% | 98.72% |
| `pages/[category]/[id].vue` | 89.54% | 27.08% | 14.28% | 89.54% |
| `composables/useFacilityDetail.ts` | 100% | 75% | 100% | 100% |
| `composables/useFacilityMeta.ts` | 87.69% | 72.72% | 87.5% | 87.69% |
| `composables/useGeolocation.ts` | 91.66% | 88.23% | 80% | 91.66% |
| `composables/useRegionFacilities.ts` | 100% | 100% | 100% | 100% |
| `composables/useErrorHandler.ts` | 89.90% | 70.58% | 100% | 89.90% |

#### 🟡 Medium Coverage (50-79%)
| Component | Statements | Branches | Functions | Lines |
|-----------|-----------|----------|-----------|-------|
| `components/common/ErrorBoundary.vue` | 63.10% | 57.14% | 20% | 63.10% |
| `composables/useFacilitySearch.ts` | 79.45% | 71.42% | 33.33% | 79.45% |
| `composables/useRegions.ts` | 66.66% | 100% | 42.85% | 66.66% |
| `pages/search.vue` | 62.71% | 19.51% | 10% | 62.71% |
| `utils/formatters.ts` | 66.66% | 50% | 100% | 66.66% |

#### 🔴 Low Coverage (<50%) - Priority for Testing

##### Pages
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `pages/about.vue` | 0% | LOW | Static content page |
| `pages/privacy.vue` | 0% | LOW | Static legal page |
| `pages/terms.vue` | 0% | LOW | Static legal page |
| `pages/msw-demo.vue` | 0% | LOW | Development demo page |
| `pages/[city]/index.vue` | 0% | **HIGH** | City-level facility listing |
| `pages/[city]/[district]/index.vue` | 0% | **HIGH** | District-level listing |
| `pages/[city]/[district]/[category].vue` | 0% | **HIGH** | Category filtering by region |
| `pages/trash/[id].vue` | 0% | MEDIUM | Trash schedule detail page |

##### Components
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `components/common/CategoryIcon.vue` | 0% | MEDIUM | Icon rendering component |
| `components/common/CategoryTabs.vue` | 0% | MEDIUM | Tab navigation component |
| `components/common/SearchBar.vue` | 0% | MEDIUM | Search input component |
| `components/category/CategoryCards.vue` | 0% | MEDIUM | Category card grid |
| `components/facility/FacilityDetail.vue` | 0% | HIGH | Generic facility detail wrapper |
| `components/facility/WasteScheduleCard.vue` | 0% | HIGH | Waste collection schedule card |
| `components/facility/details/AedDetail.vue` | 0% | **HIGH** | AED detail view - safety critical |
| `components/facility/details/ClothesDetail.vue` | 0% | MEDIUM | Clothes collection detail |
| `components/facility/details/KioskDetail.vue` | 0% | MEDIUM | Kiosk detail view |
| `components/facility/details/LibraryDetail.vue` | 0% | MEDIUM | Library detail view |
| `components/facility/details/ParkingDetail.vue` | 0% | MEDIUM | Parking facility detail |
| `components/facility/details/TrashDetail.vue` | 0% | MEDIUM | Trash schedule detail |
| `components/facility/details/WifiDetail.vue` | 0% | MEDIUM | WiFi hotspot detail |
| `components/map/MapBottomSheet.vue` | 0% | MEDIUM | Mobile map overlay |
| `components/trash/RegionSelector.vue` | 0% | MEDIUM | Region dropdown selector |
| `components/trash/ScheduleList.vue` | 0% | MEDIUM | Waste schedule list |
| `components/trash/WasteTypeSection.vue` | 0% | MEDIUM | Waste type breakdown |

##### Composables
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `composables/useKakaoMap.ts` | 0% | **HIGH** | Core map integration logic |
| `composables/useWasteSchedule.ts` | 0% | **HIGH** | Waste schedule data fetching |
| `composables/useStructuredData.ts` | 37.42% | MEDIUM | SEO structured data (partial) |

##### Utilities & Plugins
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `utils/categoryIcons.ts` | 0% | LOW | Icon mapping utilities |
| `utils/facilityStatus.ts` | 35.29% | MEDIUM | Operating status logic |
| `utils/api/client.ts` | 0% | MEDIUM | API client wrapper |
| `plugins/analytics.client.ts` | 0% | LOW | GA4 analytics (client-side) |
| `plugins/msw.client.ts` | 0% | LOW | Mock service worker (dev only) |

##### Server Routes (Nuxt)
| File | Coverage | Priority | Reason |
|------|----------|----------|--------|
| `server/routes/sitemap.xml.ts` | 0% | MEDIUM | Dynamic sitemap generation |
| `server/routes/sitemap/[...].ts` | 0% | MEDIUM | Sitemap routing |
| `server/routes/sitemap/static.xml.ts` | 0% | MEDIUM | Static sitemap entries |
| `server/utils/sitemap.ts` | 0% | MEDIUM | Sitemap utilities |

---

## Test Coverage Goals

### Phase 1: Critical Path Coverage (Target: 60% overall)

#### Backend Priority Tasks
1. **Data Sync Scripts** (Highest Priority)
   - Add integration tests for `syncAed.ts` (AED is safety-critical)
   - Add integration tests for `syncToilet.ts` (core feature)
   - Add integration tests for `syncParking.ts`
   - Add integration tests for `syncClothes.ts`
   - Add integration tests for `syncWifi.ts`

2. **Service Layer**
   - Test `wasteScheduleService.ts` (public API)
   - Test remaining sync services

3. **Routes**
   - Test `wasteSchedules.ts` endpoint (20% → 80%+)

#### Frontend Priority Tasks
1. **Core Pages** (Highest Priority)
   - Test region-based pages (`[city]`, `[district]`)
   - Test `useKakaoMap` composable (map integration)
   - Test `useWasteSchedule` composable (waste schedules)

2. **Detail Components**
   - Test `AedDetail.vue` (safety-critical)
   - Test `FacilityDetail.vue` (generic wrapper)
   - Test `WasteScheduleCard.vue`

3. **Map & Location**
   - Test `MapBottomSheet.vue`
   - Test `useKakaoMap.ts` composable

### Phase 2: Comprehensive Coverage (Target: 80% overall)

#### Backend
- Add edge case tests for CSV parsing (malformed data)
- Add error handling tests for API failures
- Add performance tests for large datasets
- Add tests for sitemap generation

#### Frontend
- Add E2E tests with Playwright for user flows
- Add accessibility tests (a11y)
- Add responsive design tests (mobile/desktop)
- Complete detail component coverage
- Add SEO meta tag verification tests

---

## Testing Strategy Recommendations

### 1. Backend Testing
- **Unit Tests**: Schema validation, utility functions
- **Integration Tests**: API endpoints, database operations
- **E2E Tests**: Full data sync workflows

### 2. Frontend Testing
- **Unit Tests**: Composables, utilities
- **Component Tests**: Vue components with Vue Test Utils
- **E2E Tests**: User journeys with Playwright

### 3. Test Data Management
- Use factories/fixtures for consistent test data
- Use MSW (Mock Service Worker) for API mocking
- Use in-memory database for backend integration tests

### 4. CI/CD Integration
- Run tests on every PR
- Block merges if coverage drops below threshold
- Generate coverage badges for README

---

## Known Issues & Warnings

### Backend
- None critical - all 275 tests passing

### Frontend
- **Search page watch warnings**: Mock composables return plain objects instead of refs (cosmetic issue, tests pass)
- **Missing component stubs**: Some Nuxt components need stubs (`NuxtErrorBoundary`, `FacilityCard` in lists)
- **$fetch undefined warnings**: `index.vue` stats fetching (doesn't affect test results)

---

## Next Steps

1. **Immediate Actions**
   - Add tests for `syncAed.ts` (safety-critical)
   - Add tests for `wasteScheduleService.ts` and `wasteSchedules.ts` route
   - Add tests for `useKakaoMap` composable

2. **Short-term (1-2 weeks)**
   - Achieve 60% backend coverage
   - Achieve 40% frontend coverage
   - Set up coverage enforcement in CI

3. **Long-term (1-2 months)**
   - Achieve 80% backend coverage
   - Achieve 70% frontend coverage
   - Add E2E tests with Playwright
   - Add performance benchmarks

---

## Appendix: Commands

### Backend
```bash
cd backend
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
```

### Frontend
```bash
cd frontend
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # Generate coverage report
```

### View Coverage Reports
- **Backend**: `backend/coverage/index.html`
- **Frontend**: `frontend/coverage/index.html`

---

**Report End**
