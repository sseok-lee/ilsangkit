<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages

## Purpose
Nuxt 파일시스템 라우팅. 정적 페이지(`about`, `faq`, `privacy`, `terms`, `contact`)와 동적 라우트(`[category]`, `[city]/[district]`, `real-estate/*`, `subscription/*`, `guide/[slug]`) 양쪽을 포함한다.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 홈페이지 — 카테고리 카드, 최근 청약, 가이드 요약 |
| `[...slug].vue` | 404 대체/레거시 URL 처리 (catch-all) |
| `search.vue` | 통합 검색 결과 페이지 |
| `about.vue` / `contact.vue` / `faq.vue` / `privacy.vue` / `terms.vue` | 정적 정보 페이지 |
| `msw-demo.vue` | MSW 핸들러 데모 (개발 전용) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[category]/` | 카테고리 허브/상세 `/[category]/`, `/[category]/[id]` (see `[category]/AGENTS.md`) |
| `[city]/` | 지역 허브 `/[city]/`, `/[city]/[district]/...` (see `[city]/AGENTS.md`) |
| `real-estate/` | 부동산 섹션 (see `real-estate/AGENTS.md`) |
| `subscription/` | 청약 섹션 (see `subscription/AGENTS.md`) |
| `trash/` | 쓰레기 배출 상세 (see `trash/AGENTS.md`) |
| `guide/` | 가이드 목록/상세 (see `guide/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `useAsyncData`/`useFetch`로 SSR 호환 데이터 로드
- `useSeoMeta`/`useHead`로 메타 태그 설정 — 동적 값은 반드시 `computed`로
- 404는 `throw createError({ statusCode: 404 })`로 처리
- 리다이렉트는 Nitro 미들웨어(`server/middleware/`) 또는 `navigateTo({ redirectCode: 301 })`

### Testing Requirements
- 페이지 테스트는 `tests/pages/`에 위치
- 라우트 파라미터는 `useRoute().params.xxx`로 접근 — 테스트 시 mock 필요

### Common Patterns
- 페이지별 `definePageMeta({ layout, middleware })` 설정
- 구조화 데이터는 `useStructuredData` composable 활용
- 부동산/청약 URL은 `utils/realEstateUrl.ts`, `utils/subscriptionMeta.ts` 참조

## Dependencies

### Internal
- `../components/`, `../composables/`, `../utils/`, `../types/`
- `../server/middleware/redirects.ts`, `real-estate-redirect.ts` — URL 리다이렉트

### External
- Nuxt 3 라우팅, `useSeoMeta`, `useHead`
