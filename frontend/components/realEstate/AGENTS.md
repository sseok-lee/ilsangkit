<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/realEstate

## Purpose
부동산 섹션(6개 카테고리: 아파트/빌라/오피스텔 × 매매/전월세) 전용 UI. 검색 필터, 거래 테이블, 시계열 차트, 근처 시설, 카드.

## Key Files
| File | Description |
|------|-------------|
| `ComplexCard.vue` | 건물/단지 카드 |
| `TransactionTable.vue` | 거래 내역 테이블 (페이지네이션) |
| `TransactionModeTab.vue` | 매매/전월세 탭 |
| `PriceTrendChart.vue` | 시계열 가격 차트 |
| `RealEstateSearchFilter.vue` | 지역/면적/가격 필터 |
| `AreaSelector.vue` | 면적 범위 선택기 |
| `RentTypeToggle.vue` | 전월세 전환 토글 |
| `NearbyFacilities.vue` | 주변 시설 (교차 시너지) |

## For AI Agents

### Working In This Directory
- **부동산 slug 주의**: `offitel` (오피스텔) — `officetel` 아님. `../../types/realEstate.ts`의 타입과 일치
- **BigInt/Decimal**: backend에서 `serializeRow()`로 직렬화 — 프론트는 Number로 수신
- **Notepad 메모**: 부동산 색인 위기 (83K URL → 17개만 색인) — 빌라 buildingName이 지번 형태인 문제 + `noindex` 대상 판별 `../../utils/realEstateNoindex.ts`
- 거래 테이블은 가상 스크롤 고려 (수천 건 가능)
- URL 생성은 `../../utils/realEstateUrl.ts` 경유 — 직접 문자열 결합 금지

### Testing Requirements
- `tests/components/realEstate/` — 8개 (AreaSelector, ComplexCard, NearbyFacilities, PriceTrendChart, RealEstateSearchFilter, RentTypeToggle, TransactionModeTab, TransactionTable)

### Common Patterns
- 보증금/월세 포매팅은 `../../utils/formatDeposit.ts`
- 차트는 Chart.js 또는 ECharts (클라이언트 전용)

## Dependencies

### Internal
- `../../composables/useRealEstate.ts`, `useRealEstateMeta.ts`
- `../../types/realEstate.ts`
- `../../utils/realEstateUrl.ts`, `realEstateMeta.ts`, `realEstateBuildingName.ts`, `formatDeposit.ts`

### External
- Chart 라이브러리 (프로젝트 의존성에 따라)
