<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/plugins

## Purpose
Nuxt 플러그인. 클라이언트 전용 통합(`google-analytics`, `msw`)을 Nuxt 부팅 단계에 주입한다.

## Key Files
| File | Description |
|------|-------------|
| `google-analytics.client.ts` | GA4 초기화 (`NUXT_PUBLIC_GA_ID` 사용) |
| `msw.client.ts` | MSW Service Worker 시작 (`NUXT_PUBLIC_DISABLE_MSW=true`로 비활성화) |

## For AI Agents

### Working In This Directory
- `.client.ts` 접미사 — 클라이언트에서만 실행
- `.server.ts`는 서버 전용
- `defineNuxtPlugin((nuxtApp) => { ... })` 패턴
- 환경변수는 `useRuntimeConfig().public`에서 읽기 — `process.env` 직접 참조 금지
- MSW는 `public/mockServiceWorker.js` 필요 (MSW CLI로 생성)

### Testing Requirements
- 플러그인 자체 단위 테스트는 없음 (통합 테스트/수동 검증)
- `tests/mocks/handlers.test.ts`에서 MSW 핸들러 검증

### Common Patterns
- 오류 시 `console.warn` 정도로만 로깅 (앱 크래시 방지)
- 개발/프로덕션 환경 분기는 `import.meta.dev`

## Dependencies

### Internal
- `../mocks/` — MSW 핸들러

### External
- `msw`, Google Analytics gtag.js (CDN 로드)
