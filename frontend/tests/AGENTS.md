<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests

## Purpose
Vitest (happy-dom) + Playwright 테스트. 파일시스템 구조가 `frontend/*` 본체를 반영하도록 배치 (`tests/composables/`, `tests/components/`, `tests/pages/`, `tests/server/` 등).

## Key Files
| File | Description |
|------|-------------|
| `setup.ts` | 전역 vitest 셋업 — Nuxt auto-import 함수 mock, 컴포넌트 stub |
| `example.test.ts` | 예시 테스트 (템플릿) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `components/` | 컴포넌트 단위 테스트 (see `components/AGENTS.md`) |
| `composables/` | composable 테스트 (see `composables/AGENTS.md`) |
| `pages/` | 페이지 테스트 (see `pages/AGENTS.md`) |
| `server/` | Nitro 서버 테스트 (see `server/AGENTS.md`) |
| `utils/` | 유틸 함수 테스트 (see `utils/AGENTS.md`) |
| `integration/` | 통합 테스트 (see `integration/AGENTS.md`) |
| `e2e/` | Playwright E2E 테스트 (see `e2e/AGENTS.md`) |
| `layouts/` | 레이아웃 테스트 (see `layouts/AGENTS.md`) |
| `mocks/` | MSW 핸들러 테스트 (see `mocks/AGENTS.md`) |
| `pwa/` | PWA/manifest 테스트 (see `pwa/AGENTS.md`) |
| `types/` | 타입 가드 테스트 (see `types/AGENTS.md`) |
| `assets/` | 에셋 최적화 테스트 (see `assets/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `npm run test` — 전체 (vitest, happy-dom)
- `npm run test:e2e` — Playwright 전체
- `npx vitest run tests/path/file.test.ts` — 단일 파일
- 테스트 파일명은 본체 파일명과 1:1 매칭 권장 (`useFacilitySearch.ts` ↔ `useFacilitySearch.test.ts`)
- Nuxt auto-import는 `tests/setup.ts`에서 mocking — 새 함수 추가 시 setup 업데이트 필요

### Testing Requirements
- 커밋 전 전체 `npm run test` 통과
- `test:coverage`로 커버리지 검토 가능
- E2E는 필요 시 로컬에서 `npm run dev` 실행 후 별도 실행

### Common Patterns
- Vue 컴포넌트: `mount(Component, { props })` + `@vue/test-utils`
- 외부 호출: `vi.mock('...')` 또는 MSW 핸들러 재사용
- `NuxtLink` 등은 `tests/setup.ts`에서 stub 됨

## Dependencies

### Internal
- 모든 `frontend/*` 본체 디렉터리
- `../mocks/` — MSW 핸들러 재사용

### External
- `vitest`, `happy-dom`, `@vue/test-utils`, `@nuxt/test-utils`
- `@playwright/test`
- `msw`
