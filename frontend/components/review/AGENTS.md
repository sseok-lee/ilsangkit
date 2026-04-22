<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/review

## Purpose
사용자 리뷰 UI. 시설 상세/홈 페이지에서 노출.

## Key Files
| File | Description |
|------|-------------|
| `ReviewSection.vue` | 리뷰 목록 + 작성 폼 (시설 상세용) |
| `RecentReviewCard.vue` | 최근 리뷰 카드 (홈용) |

## For AI Agents

### Working In This Directory
- `useReviews` composable로 CRUD
- 리뷰 작성은 인증 없음 — 스팸 방지는 backend 레이트 리미트/검증에 위임
- 별점은 1-5, 필터링/정렬 기능 제공

### Testing Requirements
- 현재 전용 테스트 없음 — 페이지 테스트에서 간접 검증

### Common Patterns
- 낙관적 업데이트(optimistic update) 고려
- 빈 상태: "첫 리뷰를 작성해보세요" 문구

## Dependencies

### Internal
- `../../composables/useReviews.ts`
- `../../types/review.ts`

### External
- (없음)
