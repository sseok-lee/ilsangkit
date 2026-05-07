<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# frontend

## Purpose
Nuxt 3 SSR + Vue 3 + Pinia + TailwindCSS 기반 웹 프론트엔드. 포트 3000. `$fetch` + `useRuntimeConfig().public.apiBase`로 backend(8000)을 호출하며, `nuxt.config.ts`에서 `/api/**` 프록시를 설정한다. Nitro 서버 사이드에서 사이트맵/OG 이미지/리다이렉트를 직접 처리한다. 시설/부동산/청약/공공임대/가이드/쓰레기 등 다양한 도메인 페이지를 서빙한다.

## Key Files
| File | Description |
|------|-------------|
| `nuxt.config.ts` | Nuxt 설정 (SSR, runtime config, routeRules, head) |
| `package.json` | 스크립트(`dev`, `build`, `generate`, `test`, `test:e2e`, `lint`) |
| `tailwind.config.js` | 브랜드 컬러, 폰트, 컨테이너 설정 |
| `app.vue` / `error.vue` | 루트/에러 페이지 |
| `tsconfig.json` | `nuxt prepare`가 생성하는 `.nuxt/tsconfig.json` 확장 |
| `vitest.config.ts` | Vitest (happy-dom 환경) 설정 |
| `playwright.config.ts` | E2E 테스트 설정 |
| `README.md` | 로컬 개발/테스트 빠른 가이드 |
| `eslint.config.mjs` | ESLint flat config (세미콜론 없음) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `pages/` | 라우트 기반 페이지 (see `pages/AGENTS.md`) |
| `components/` | Vue 컴포넌트 (see `components/AGENTS.md`) |
| `composables/` | `useXxx` 함수 모음 (see `composables/AGENTS.md`) |
| `server/` | Nitro 서버 라우트/미들웨어 (see `server/AGENTS.md`) |
| `utils/` | 도메인별 헬퍼 함수 (see `utils/AGENTS.md`) |
| `types/` | 공용 타입 정의 (see `types/AGENTS.md`) |
| `tests/` | Vitest/Playwright 테스트 (see `tests/AGENTS.md`) |
| `layouts/` | Nuxt 레이아웃 (see `layouts/AGENTS.md`) |
| `plugins/` | Nuxt 플러그인 (GA, MSW) (see `plugins/AGENTS.md`) |
| `mocks/` | MSW 핸들러/모의 데이터 (see `mocks/AGENTS.md`) |
| `app/` | Nuxt `app` 디렉터리 확장 (see `app/AGENTS.md`) |
| `assets/` | 빌드 타임 CSS/이미지 (see `assets/AGENTS.md`) |
| `public/` | 정적 자산 (robots.txt, favicon, OG 이미지 등) |
| `scripts/` | 프론트 전용 패치 스크립트 (see `scripts/AGENTS.md`) |
| `shared/` | frontend/backend 사이 공유 가능한 유틸 |
| `docs/` | 프론트 한정 문서 (MSW 셋업, 가이드 등) |

## For AI Agents

### Working In This Directory
- **SSR 가드 필수**: `document`, `window` 등 브라우저 API 접근 시 `if (!import.meta.client) return` 가드 추가 — `watch`/`onMounted` 내부에서도 필요 (Hydration mismatch 방지)
- **세미콜론 사용 안 함** (backend와 반대)
- **$fetch 사용**: 외부 HTTP는 `$fetch` + `useRuntimeConfig().public.apiBase`. `fetch` 직접 사용 지양
- **readonly() 반환**: composable에서 상태 ref는 `readonly()`로 감싸 불변성 유지
- **Pinia 패치**: Nuxt 3 + Pinia 버전 이슈 대응용 `scripts/patch-pinia.mjs`가 postinstall 실행

### Testing Requirements
- `npm run test` — vitest (unit, happy-dom)
- `npm run test:e2e` — Playwright (`tests/e2e/`)
- `tests/setup.ts`가 Nuxt auto-import 함수들(`useAsyncData`, `$fetch`, `useRuntimeConfig`, `useSeoMeta`, `useHead` 등)을 글로벌 mock으로 등록

### Common Patterns
- 페이지 라우트: `/[category]/`, `/[category]/[id]`, `/[city]/[district]/[category]`, `/real-estate/[propertyType]/[buildingName]`
- MSW 토글: `NUXT_PUBLIC_DISABLE_MSW=true`로 비활성화
- Kakao 지도: `useKakaoMap` composable + `NUXT_PUBLIC_KAKAO_MAP_KEY`

## Dependencies

### Internal
- `backend/` — API 공급자 (`/api/**` 프록시)

### External
- `nuxt@3`, `vue@3`, `pinia`, `tailwindcss`
- `@nuxt/test-utils`, `vitest`, `@playwright/test`
- `msw`, Pretendard 폰트
