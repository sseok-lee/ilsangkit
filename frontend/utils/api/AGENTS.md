<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/utils/api

## Purpose
API 클라이언트 래퍼. `$fetch` 기반 얇은 헬퍼를 제공.

## Key Files
| File | Description |
|------|-------------|
| `client.ts` | `apiFetch()` 래퍼 — baseURL/에러 공통 처리 |

## For AI Agents

### Working In This Directory
- `useRuntimeConfig().public.apiBase`를 반드시 참조
- 에러는 `useErrorHandler` composable로 전파 혹은 throw
- 타입은 `../../types/`의 `ApiResponse<T>` 활용

### Testing Requirements
- Composable 테스트가 간접 검증
- MSW로 네트워크 동작 모킹

### Common Patterns
- `async function apiFetch<T>(path, options): Promise<T>`

## Dependencies

### Internal
- `../../types/api.ts`

### External
- Nuxt 3 `$fetch` (ofetch 기반)
