<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# [type]

## Purpose
공공임대 매물의 유형별 동적 라우트. 매입임대(buy-lease), 전세임대(charter) 등 type 파라미터에 따라 필터링된 매물 목록(`index.vue`)과 상세 페이지(`[id].vue`)를 제공한다.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 유형별 매물 목록 페이지 — type 메타 검증 + 제목/설명 + 필터 탭 + PublicRentalListView |
| `[id].vue` | 매물 상세 페이지 — 매물 데이터 조회 + 인근 시설/중복 매물 표시 + SEO |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- **동적 라우트 매개변수**: `route.params.type` (slug), `route.params.id` (숫자)
- **메타 검증**: `LH_RENTAL_TYPES[type]`으로 유효성 확인, 없으면 404 throw (`createError`)
- **API 호출**: `useApiBase()` composable로 API_BASE 취득, fetch로 매물 데이터 조회
- **타입 정의**: `~/types/publicRental.ts`에서 `PublicRentalComplex` 등 정의
- **SEO**: og/twitter 메타, canonical URL, breadcrumb 구조화 데이터 설정
- **컴포넌트**: `PublicRentalDetailView` (상세 뷰), `Breadcrumb` (네비게이션)

### Common Patterns
- URL 파라미터 검증 후 404 처리 (`if (!typeMeta)` → `createError`)
- API 응답 타입: `{ success: boolean, data: T }`
- 메타데이터 함수로 유형별 제목/설명 구성
- 상세 페이지: 형제 매물(siblings), 인근 시설(nearby) 쿼리 옵션 포함
- 비동기 데이터: `useAsyncData()` 또는 script setup에서 await fetch

## Dependencies

### Internal
- `frontend/components/publicRental/PublicRentalFilterTabs.vue` — 탭 (상위 ../../index.vue에서도 사용)
- `frontend/components/subscription/PublicRentalListView.vue` — 유형별 매물 목록
- `frontend/components/subscription/PublicRentalDetailView.vue` — 상세 정보 + 인근/형제
- `frontend/components/navigation/Breadcrumb.vue` — 경로 표시
- `frontend/utils/subscriptionMeta.ts` (LH_RENTAL_TYPES), `frontend/utils/seoConstants.ts`
- `frontend/utils/publicRentalMeta.ts` (fmtDeposit, fmtRent, isJeonseRental, rentalTypeToSlug)
- `frontend/utils/publicRentalContent.ts` (PUBLIC_RENTAL_FAQ)
- `frontend/composables/useStructuredData.ts`, `frontend/composables/useApiBase.ts`
- `frontend/types/publicRental.ts` (PublicRentalComplex)

### External
- Nuxt 3 (useRoute, createError, useHead)
- Vue 3 (computed)

<!-- MANUAL: -->
