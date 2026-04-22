<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/real-estate/[realEstateType]

## Purpose
신규 부동산 경로 구조의 타입 계층. `[city]/[district]/[buildingName]` 순서로 내려간다.

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `[city]/` | 타입 × 도시 계층 (see `[city]/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- `realEstateType` 유효성 검증 — `../../types/realEstate.ts`
- 이 디렉터리에는 직접 페이지 파일이 없음 — 하위 계층만

### Testing Requirements
- 하위 계층 페이지 테스트로 간접 커버

### Common Patterns
- 각 계층에서 `useRoute().params`로 누적 파라미터 수집

## Dependencies

### Internal
- `../../../types/realEstate.ts`

### External
- (없음)
