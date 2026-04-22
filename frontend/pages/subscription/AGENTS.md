<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/pages/subscription

## Purpose
청약 섹션. 공공/민간/특별공급 청약 목록과 상세. 매매(`sale`)와 임대(`rent`) 구분.

## Key Files
| File | Description |
|------|-------------|
| `index.vue` | 청약 허브 — 전체 청약 목록/필터 |
| `[id].vue` | 청약 상세 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `sale/` | 매매(분양) 전용 페이지 (see `sale/AGENTS.md`) |
| `rent/` | 임대(전월세) 전용 페이지 (see `rent/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 공공/민간/특별 청약 분류는 `../../utils/subscriptionMeta.ts` + backend `subscriptionUtils.ts`
- 일정 타임라인은 `../../components/subscription/TimelineItem.vue`
- 청약 유형 배지와 카드 디자인은 신뢰의 디자인 원칙 — 공급 유형·주소·일정을 명확히

### Testing Requirements
- `tests/pages/` 상위에서 간접 검증

### Common Patterns
- 필터: 지역/공급유형/공고날짜
- 상세 페이지: 공고문 링크, 쓰기/공유 버튼

## Dependencies

### Internal
- `../../composables/useSubscription.ts`, `useHomeSubscriptions.ts`
- `../../components/subscription/`

### External
- (없음)
