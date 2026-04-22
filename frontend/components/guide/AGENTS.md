<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/guide

## Purpose
가이드 페이지 전용 컴포넌트. 상세 페이지 하단에 연관 가이드 섹션을 표시한다.

## Key Files
| File | Description |
|------|-------------|
| `RelatedGuides.vue` | 현재 카테고리/지역과 연관된 가이드 목록 |

## For AI Agents

### Working In This Directory
- `useGuides` composable로 관련 가이드 fetch (카테고리/지역 필터)
- 가이드 없으면 섹션 전체 숨김 (빈 컴포넌트 렌더링 지양)

### Testing Requirements
- 가이드 관련 페이지 테스트에서 간접 검증 (`tests/pages/guide-detail-links.test.ts`)

### Common Patterns
- `defineProps<{ category?: FacilityCategory; city?: string }>()`
- 최대 N개 노출 후 "더보기" 링크

## Dependencies

### Internal
- `../../composables/useGuides.ts`

### External
- (없음)
