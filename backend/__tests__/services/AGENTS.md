<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/__tests__/services

## Purpose
서비스 레이어 단위 테스트. `src/services/` 각 파일과 대응하며 Prisma mock 기반이 대다수.

## Key Files
| File | Description |
|------|-------------|
| `facilityService.test.ts` | 시설 공통 CRUD + CATEGORY_REGISTRY |
| `realEstateService.test.ts` / `realEstateServiceGetBuildingInfo.test.ts` / `realEstateStats.test.ts` / `realEstateSummaryService.test.ts` | 부동산 서비스 (BigInt/Decimal 직렬화 포함) |
| `syncRealEstateBase.test.ts` | 부동산 동기화 공통 유틸 |
| `toiletSync.test.ts` / `trashSync.test.ts` / `wifiSync.test.ts` / `clothesSync.test.ts` / `parkingSync.test.ts` / `parkSyncService.test.ts` / `schoolSyncService.test.ts` / `marketSyncService.test.ts` / `sportsSyncService.test.ts` / `childcareSyncService.test.ts` / `evChargerSyncService.test.ts` / `evChargerStatus.test.ts` | 카테고리별 동기화 |
| `regionSync.test.ts` / `areaSummaryService.test.ts` | 지역 |
| `metaService-regionByBjd.test.ts` / `sitemapService.test.ts` / `geocodingService.test.ts` / `csvParser.test.ts` / `indexNowService.test.ts` / `subscriptionService.test.ts` | 기타 |

## For AI Agents

### Working In This Directory
- Prisma client mock은 `vi.mock('../../src/lib/prisma.js', ...)` 패턴
- 공공 API 호출은 `vi.spyOn(publicApiClient, 'fetchXxx')`로 가로채기
- XML/CSV 파서 테스트는 실제 샘플 fixture 사용
- 날짜 의존 로직은 `vi.setSystemTime()`으로 고정

### Testing Requirements
- 전체: `npm run test`
- 단일: `npx vitest run __tests__/services/<file>.test.ts`

### Common Patterns
- `beforeEach(() => { vi.clearAllMocks() })`
- BigInt/Decimal 검증 시 `toJSON` 확인

## Dependencies

### Internal
- `../../src/services/`, `../../src/lib/`

### External
- `vitest`
