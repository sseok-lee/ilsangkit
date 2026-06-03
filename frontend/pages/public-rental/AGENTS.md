<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# public-rental

## Purpose
공공임대 (LH·SH 수시모집 매물) 관련 Nuxt 페이지 라우트 그룹. 매물 목록 허브(`index.vue`), 유형별 목록(`[type]/`), 모집공고 목록(`announcements/`) 페이지를 포함한다.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 공공임대 홈 — 필터 탭 + 목록 뷰 + 데이터 출처 카드, SEO 메타/구조화 데이터 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[type]/` | 매입임대/전세임대별 동적 라우트 (see `[type]/AGENTS.md`) |
| `announcements/` | 입주자 모집공고 목록/상세 라우트 (see `announcements/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **라우트 구조**: Nuxt 파일 기반 라우팅. `/public-rental` → `index.vue`, `/public-rental/buy-lease` → `[type]/index.vue`
- **메타 데이터**: `useHead()` + `useStructuredData()` 사용하여 og, twitter, canonical, breadcrumb, itemList schema 설정
- **컴포넌트 임포트**: `~/components/publicRental/`, `~/components/subscription/`, `~/components/common/` 경로
- **SEO 상수**: `~/utils/seoConstants` (SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE)
- **타입**: `~/utils/subscriptionMeta` (LH_RENTAL_TYPES), `~/utils/dataSource` (PUBLIC_RENTAL_DATA_SOURCE)

### Common Patterns
- 페이지 제목/설명 → meta 태그 + og 태그
- Breadcrumb + ItemList 구조화 데이터 (JSON-LD)
- 자식 라우트(`[type]/`, `announcements/`)에서 활성 탭 상태를 prop으로 전달 (`PublicRentalFilterTabs :active="..."`
- 데이터 출처 공시 (DataSourceSection + 법적 고지문)

## Dependencies

### Internal
- `frontend/components/publicRental/PublicRentalFilterTabs.vue` — 탭 네비게이션
- `frontend/components/subscription/PublicRentalListView.vue` — 매물 목록
- `frontend/components/common/DataSourceSection.vue` — 출처 표기 (도메인 인지)
- `frontend/utils/seoConstants.ts`, `frontend/utils/subscriptionMeta.ts`, `frontend/utils/dataSource.ts`
- `frontend/composables/useStructuredData.ts` — 구조화 데이터 관리
- `frontend/pages/public-rental/[type]/` (자식)
- `frontend/pages/public-rental/announcements/` (자식)

### External
- Nuxt 3 (pages, routing, useHead, useRoute, createError)
- Vue 3 (reactive, computed)

<!-- MANUAL: -->
