<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# announcements

## Purpose
공공기관(LH·SH·GH 등) 입주자 모집공고의 목록(`index.vue`)과 상세 페이지(`[pblancId].vue`)를 제공한다. 진행중/예정/마감 상태별 필터링, 검색 기능을 포함한다.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 공고 목록 페이지 — 상태 필터 + 검색 + 페이지네이션 + 그리드 표시 |
| `[pblancId].vue` | 공고 상세 페이지 — 공고명/기관/일정/자격 등 + 관련 시설 매물 + SEO |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- **동적 라우트 매개변수**: `route.params.pblancId` (공고 ID, 문자열)
- **상태 필터**: `status` state (active, upcoming, closed, 또는 undefined)
- **검색**: `q` state (공고명·단지명·기관명), enter 또는 버튼으로 reload
- **페이지네이션**: offset/limit 기반 구현 (optional)
- **API 호출**: GET `/api/public-rental/announcements?status=...&q=...` 형태
- **목록 페이지**: loading/error/empty 상태 분기 처리
- **상세 페이지**: 공고 정보 표시 + 관련 매물 정보 조회

### Common Patterns
- 상태 필터 옵션: STATUS_FILTERS 배열 (모집중/예정/마감)
- 검색 입력: v-model + @keydown.enter로 reload 함수 호출
- 목록: grid 또는 list 스타일로 렌더
- 링크: NuxtLink로 상세 페이지 이동 (`:to="`/public-rental/announcements/${ann.pblancId}`"`)
- SEO: 목록/상세 모두 og/twitter/canonical + breadcrumb 구조화 데이터

## Dependencies

### Internal
- `frontend/components/publicRental/PublicRentalFilterTabs.vue` — 탭 (active="announcements")
- `frontend/utils/seoConstants.ts` (SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE)
- `frontend/composables/useStructuredData.ts` (setBreadcrumbSchema)
- `frontend/types/publicRental.ts` (공고 타입 정의)
- `frontend/composables/useApiBase.ts` (API_BASE)

### External
- Nuxt 3 (useRoute, useHead, useAsyncData, navigateTo)
- Vue 3 (ref, computed, watch)

<!-- MANUAL: -->
