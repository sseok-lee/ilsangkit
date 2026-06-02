<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components

## Purpose
컴포넌트 단위 테스트. `components/` 구조를 반영하여 서브디렉터리로 배치.

## Key Files
| File | Description |
|------|-------------|
| `AppFooter.test.ts` / `AppHeader.test.ts` / `BaseButton.test.ts` / `BaseCard.test.ts` | common 원자 (상위 편의 배치) |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `category/` | 카테고리 컴포넌트 (see `category/AGENTS.md`) |
| `common/` | DataSourceSection/ErrorBoundary (see `common/AGENTS.md`) |
| `facility/` | 시설 카드/목록 + details (see `facility/AGENTS.md`) |
| `map/` | 지도 컴포넌트 (see `map/AGENTS.md`) |
| `navigation/` | 브레드크럼 (see `navigation/AGENTS.md`) |
| `realEstate/` | 부동산 8종 (see `realEstate/AGENTS.md`) |
| `region/` | 지역 컴포넌트 (see `region/AGENTS.md`) |
| `search/` | 검색 입력/필터 (see `search/AGENTS.md`) |
| `subscription/` | 청약 (see `subscription/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- 상위에 `AppFooter`, `AppHeader`, `BaseButton`, `BaseCard` 테스트가 위치해 있지만 의미상 `common/`에 속함 — 단순 이동 리팩터링 대상 (주의: import 경로 영향)
- `@vue/test-utils`의 `mount` + props/slots/이벤트 검증
- `tests/setup.ts`에서 `NuxtLink`, `CategoryIcon` stub 등록됨

### Testing Requirements
- 각 테스트는 실제 컴포넌트 import — 컴포넌트 변경 시 함께 수정
- 스크린샷/E2E는 `tests/e2e/`로 분리

### Common Patterns
- `const wrapper = mount(Component, { props: { ... } })`
- `expect(wrapper.text()).toContain('...')`
- `wrapper.emitted('click')` 이벤트 검증

## Dependencies

### Internal
- `../../components/`, `../setup.ts`

### External
- `vitest`, `@vue/test-utils`
