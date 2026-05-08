<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# frontend/components

## Purpose
Nuxt auto-import되는 Vue 컴포넌트. 도메인(시설/부동산/청약/공공임대/가이드/쓰레기/지역)과 범용(common/navigation/search/ads/map) 기준으로 서브디렉터리에 배치된다.

## Key Files
(루트에는 컴포넌트가 없으며 모두 서브디렉터리에 존재)

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `ads/` | AdSense 배너 래퍼 (see `ads/AGENTS.md`) |
| `category/` | 카테고리 카드/칩/인트로 (see `category/AGENTS.md`) |
| `city/` | 도시 페이지 전용 (see `city/AGENTS.md`) |
| `common/` | 공용 UI (헤더/푸터/버튼/페이지네이션 등) (see `common/AGENTS.md`) |
| `facility/` | 시설 상세/목록/지도 관련 (see `facility/AGENTS.md`) |
| `guide/` | 가이드 페이지 관련 (see `guide/AGENTS.md`) |
| `map/` | 지도 컴포넌트 (Kakao Map) (see `map/AGENTS.md`) |
| `navigation/` | 네비게이션/Breadcrumb (see `navigation/AGENTS.md`) |
| `publicRental/` | 공공임대주택 필터/카드 (see `publicRental/AGENTS.md`) |
| `realEstate/` | 부동산 카드/차트/필터/테이블 (see `realEstate/AGENTS.md`) |
| `region/` | 지역 요약/근접 네비 (see `region/AGENTS.md`) |
| `search/` | 전역 검색 입력/필터 (see `search/AGENTS.md`) |
| `subscription/` | 청약 카드/타임라인 (see `subscription/AGENTS.md`) |
| `trash/` | 쓰레기 배출 스케줄 뷰 (see `trash/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- PascalCase 파일명 — Nuxt auto-import가 경로를 PascalCase 합성으로 노출 (`facility/FacilityCard.vue` → `<FacilityCard>`)
- `<script setup lang="ts">` 기본
- `defineProps<T>()`, `defineEmits<T>()`로 타입 지정
- SSR 가드: `if (!import.meta.client) return` (브라우저 API 접근 시)
- 세미콜론 없음 (frontend 컨벤션)

### Testing Requirements
- 각 컴포넌트 단위 테스트는 `tests/components/<subdir>/<Name>.test.ts` 매칭
- `@vue/test-utils` + `@nuxt/test-utils` 조합
- 글로벌 stub: `NuxtLink`, `CategoryIcon` (`tests/setup.ts` 참조)

### Common Patterns
- Props 인터페이스는 script setup 상단에 정의
- 스타일은 TailwindCSS 유틸 클래스 위주 (scoped CSS 지양)
- 상세 카테고리별 컴포넌트는 `facility/details/` 패턴 사용 — 새 카테고리 추가 시 여기에 `XxxDetail.vue` 추가

## Dependencies

### Internal
- `../composables/` — 데이터 fetch/상태 관리
- `../types/` — 타입
- `../utils/` — 포매팅 헬퍼

### External
- `vue@3`, `tailwindcss`, Pretendard 폰트
