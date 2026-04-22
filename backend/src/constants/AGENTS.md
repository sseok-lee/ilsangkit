<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/src/constants

## Purpose
프로젝트 전역 상수. 페이지네이션, 지리 경계, 동기화 배치 크기 등 매직넘버 제거용.

## Key Files
| File | Description |
|------|-------------|
| `index.ts` | 배럴 export |
| `pagination.ts` | `DEFAULT_PAGE=1`, `DEFAULT_LIMIT=20`, `MAX_LIMIT=100` |
| `geo.ts` | 한국 좌표 경계 (`KOREA_LAT_MIN=33`, `MAX=39`, `LNG_MIN=124`, `MAX=131`), 검색 반경 (`MIN=100`, `MAX=50000`, `DEFAULT=1000`) |
| `sync.ts` | 동기화 배치 크기(500), API 타임아웃(30초) |

## For AI Agents

### Working In This Directory
- **상수 변경은 전역 영향** — 모든 호출부 확인 필수
- `as const`로 리터럴 타입 고정
- 새 상수 추가 시 `index.ts`에 re-export

### Testing Requirements
- 상수 자체 테스트 없음 — 사용처 테스트에서 간접 검증

### Common Patterns
- 대문자 스네이크 네이밍 (`DEFAULT_LIMIT`)
- 관련 상수는 한 파일에 그룹화

## Dependencies

### Internal
- 모든 서비스/스키마/라우트

### External
- (없음)
