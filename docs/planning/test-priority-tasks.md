# Test Priority Tasks (Coverage < 80%)

Generated from test coverage analysis on 2026-02-12

## Backend: High Priority (0% coverage)

### Data Sync Scripts (Critical - Core Feature)
- [ ] `src/scripts/syncAed.ts` - AED location sync (SAFETY CRITICAL)
- [ ] `src/scripts/syncToilet.ts` - Public toilet sync (CORE FEATURE)
- [ ] `src/scripts/syncParking.ts` - Parking facility sync
- [ ] `src/scripts/syncClothes.ts` - Clothes collection sync
- [ ] `src/scripts/syncAll.ts` - Orchestrator for all syncs

### Service Layer (Business Logic)
- [ ] `src/services/aedSyncService.ts` - AED sync service
- [ ] `src/services/wasteScheduleService.ts` - Waste schedule lookup (PUBLIC API)
- [ ] `src/services/clothesSyncService.ts` - Clothes sync service
- [ ] `src/services/kioskSyncService.ts` - Kiosk sync service
- [ ] `src/services/parkingSyncService.ts` - Parking sync service
- [ ] `src/services/toiletSyncService.ts` - Toilet sync service

### Routes (API Endpoints)
- [ ] `src/routes/wasteSchedules.ts` - Waste schedule endpoint (20% → 80%+)

## Frontend: High Priority (0% coverage)

### Pages (User-Facing)
- [ ] `pages/[city]/index.vue` - City facility listing
- [ ] `pages/[city]/[district]/index.vue` - District listing
- [ ] `pages/[city]/[district]/[category].vue` - Region + category filter

### Composables (Business Logic)
- [ ] `composables/useKakaoMap.ts` - Map integration (CORE FEATURE)
- [ ] `composables/useWasteSchedule.ts` - Waste schedule API

### Components (Detail Views)
- [ ] `components/facility/details/AedDetail.vue` - AED detail (SAFETY CRITICAL)
- [ ] `components/facility/FacilityDetail.vue` - Generic detail wrapper
- [ ] `components/facility/WasteScheduleCard.vue` - Waste schedule card

## Medium Priority

### Backend
- [ ] `src/scripts/syncWifi.ts` (16.93% → 80%+)
- [ ] `src/lib/csvParser.ts` (61.06% → 80%+)
- [ ] `src/services/csvParser.ts` (77.15% → 80%+)
- [ ] `src/routes/sitemap.ts` (33.33% → 80%+)

### Frontend
- [ ] `pages/search.vue` (62.71% → 80%+)
- [ ] `composables/useStructuredData.ts` (37.42% → 80%+)
- [ ] `utils/facilityStatus.ts` (35.29% → 80%+)
- [ ] All remaining detail components (Parking, Library, Kiosk, WiFi, Clothes, Trash)

## Estimated Effort

| Priority | Files | Est. Hours |
|----------|-------|------------|
| Backend High | 13 files | 20-24h |
| Frontend High | 8 files | 12-16h |
| Backend Medium | 4 files | 4-6h |
| Frontend Medium | 10+ files | 12-16h |
| **Total** | **35+ files** | **48-62h** |

## Success Metrics

- Backend: 45.44% → 80%+ coverage
- Frontend: 18.28% → 70%+ coverage
- All critical paths tested (sync scripts, API endpoints)
- No failing tests in CI/CD

