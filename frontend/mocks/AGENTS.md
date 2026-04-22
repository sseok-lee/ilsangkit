<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/mocks

## Purpose
MSW (Mock Service Worker) 핸들러와 모의 데이터. 개발 환경에서 backend API 없이 프론트 동작을 검증하며, 테스트 환경에서도 재사용된다. `NUXT_PUBLIC_DISABLE_MSW=true`로 비활성화.

## Key Files
| File | Description |
|------|-------------|
| `browser.ts` | MSW `setupWorker()` 엔트리포인트 |
| `README.md` | MSW 셋업/확장 가이드 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `handlers/` | 엔드포인트별 MSW 핸들러 (see `handlers/AGENTS.md`) |
| `data/` | 핸들러가 반환하는 목업 데이터 (see `data/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 핸들러 추가 시 `browser.ts`에 등록 필수
- 경로는 실제 backend API와 일치 (`/api/facilities`, `/api/real-estate` 등)
- 모의 데이터는 `data/`에 분리 — 핸들러 로직과 데이터 분리 유지
- 테스트에서는 `setupServer()` 재사용 (vitest 환경)

### Testing Requirements
- `tests/mocks/handlers.test.ts` — 핸들러 자체 검증

### Common Patterns
- `http.get('/api/xxx', ({ request }) => HttpResponse.json({...}))`
- 지연 시뮬레이션은 `await delay(200)`
- 에러 케이스 커버: 404, 500, 422 시나리오

## Dependencies

### Internal
- `../plugins/msw.client.ts` — 브라우저에서 MSW 기동
- `../types/` — 응답 타입 일치

### External
- `msw@2`
