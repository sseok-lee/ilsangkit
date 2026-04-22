<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/real-estate/[realEstateType]/[city]

## Purpose
타입 × 도시 레벨. 하위에 구/군 페이지.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[district]/` | 타입 × 도시 × 구/군 실제 페이지 (see `[district]/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 이 디렉터리에는 직접 페이지 파일이 없음
- `city` slug 양방향 매칭 필수 (backend에서 처리)

### Testing Requirements
- 하위 계층 페이지 테스트로 간접 검증

### Common Patterns
- catch-all 또는 중간 index가 없음 — 도시 허브는 `../../[city]/index.vue` 쪽 라우트로 처리됨

## Dependencies

### Internal
- `../../../../shared/regionSlugs.ts`

### External
- (없음)
