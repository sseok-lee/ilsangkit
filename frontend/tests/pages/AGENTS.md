<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/pages

## Purpose
페이지 단위 테스트 (SSR/메타/라우트/링크).

## Key Files
| File | Description |
|------|-------------|
| `index.test.ts` | 홈 |
| `category.test.ts` | 카테고리 허브 |
| `category-cross-links.test.ts` | 카테고리-지역 크로스링크 |
| `detail.test.ts` | 시설 상세 |
| `facility-detail-links.test.ts` | 시설 상세 내부링크 |
| `region.test.ts` | 지역 허브 |
| `district-real-estate.test.ts` | 구/군 부동산 요약 |
| `real-estate-hub.test.ts` | 부동산 허브 |
| `search.test.ts` | 검색 결과 |
| `trash-detail.test.ts` | 쓰레기 상세 |
| `guide-detail-links.test.ts` | 가이드 내부링크 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `real-estate/` | 부동산 상세 페이지 통합 테스트 (see `real-estate/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 페이지 테스트는 `useRoute`, `useAsyncData`, `$fetch` mock 필수 — `tests/setup.ts`
- 메타(title/description) 검증 시 `useSeoMeta` mock 호출 인자 확인
- 내부링크 테스트는 rendered HTML에서 `a[href]` 추출

### Testing Requirements
- 모든 주요 라우트 커버 — 404/빈 데이터/에러 케이스 포함

### Common Patterns
- `mount(await import('~/pages/xxx.vue').default, { global: { stubs: ... } })`

## Dependencies

### Internal
- `../../pages/`, `../../composables/`, `../../components/`

### External
- `vitest`, `@vue/test-utils`, `@nuxt/test-utils`
