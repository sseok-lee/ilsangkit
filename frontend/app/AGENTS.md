<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/app

## Purpose
Nuxt 3 `app/` 디렉터리. 현재는 Vue Router 옵션 오버라이드 한 파일만 존재하여, 라우팅 동작을 커스터마이즈한다.

## Key Files
| File | Description |
|------|-------------|
| `router.options.ts` | Vue Router 옵션 (scrollBehavior, routes 커스텀 등) |

## For AI Agents

### Working In This Directory
- `router.options.ts`의 export 이름은 `default`로 고정 — Nuxt가 자동 감지
- `scrollBehavior`는 SSR 호환 작성
- 라우트 자체 선언은 `pages/`에서 — 여기서는 동작만 오버라이드

### Testing Requirements
- 라우터 옵션 변경은 페이지 테스트(`tests/pages/`)에서 간접 검증

### Common Patterns
- 해시/앵커 스크롤 유지
- 모바일 뒤로가기 복원

## Dependencies

### Internal
- `../pages/` — 라우트 정의

### External
- Vue Router 4 API (Nuxt 3 내장)
