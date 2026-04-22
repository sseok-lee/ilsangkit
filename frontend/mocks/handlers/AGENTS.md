<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/mocks/handlers

## Purpose
MSW 엔드포인트별 핸들러. backend API를 모킹하여 로컬/테스트 환경에서 재현 가능한 응답을 제공.

## Key Files
| File | Description |
|------|-------------|
| `facilities.ts` | `/api/facilities`, `/api/facilities/:id` 모킹 |
| `waste-schedules.ts` | `/api/waste-schedules` 모킹 |

## For AI Agents

### Working In This Directory
- 엔드포인트 추가 시 `../browser.ts`에서 import 후 setupWorker 배열에 포함
- 응답 타입은 실제 backend 응답과 일치 필수 — `../../types/api.ts`의 `ApiResponse<T>` 포맷
- 지연 시뮬레이션은 `await delay(200)` 정도로 현실감 부여

### Testing Requirements
- `tests/mocks/handlers.test.ts` — 핸들러 자체 검증

### Common Patterns
- `http.get('/api/xxx', ({ request, params }) => HttpResponse.json({ success: true, data: ... }))`
- 에러 시나리오: `new HttpResponse(null, { status: 404 })`

## Dependencies

### Internal
- `../data/` — 목업 데이터
- `../../types/api.ts`

### External
- `msw@2`
