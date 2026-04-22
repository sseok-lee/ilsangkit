<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/navigation

## Purpose
페이지 내 내비게이션 요소.

## Key Files
| File | Description |
|------|-------------|
| `Breadcrumb.vue` | 브레드크럼 — 페이지 계층/지역 경로 표시 |

## For AI Agents

### Working In This Directory
- 브레드크럼 항목은 `{ label, to }` 형태 배열로 전달
- JSON-LD `BreadcrumbList` 구조화 데이터 연계 — `useStructuredData` composable 활용
- `NuxtLink`로 내부 이동, 접근성(`aria-label="breadcrumb"`) 유지

### Testing Requirements
- `tests/components/navigation/Breadcrumb.test.ts`

### Common Patterns
- `defineProps<{ items: { label: string; to?: string }[] }>()`
- 마지막 항목은 링크 없이 현재 페이지로 표시

## Dependencies

### Internal
- `../../composables/useStructuredData.ts`

### External
- (없음)
