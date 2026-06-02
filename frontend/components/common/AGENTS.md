<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-29 -->

# frontend/components/common

## Purpose
여러 도메인에서 재사용되는 공용 UI 컴포넌트. 헤더/푸터/페이지네이션 등 디자인 시스템 원자. 버튼/카드/입력은 별도 Vue 래퍼 없이 `assets/css/main.css`의 유틸 클래스(`.btn-primary`, `.btn-secondary`, `.card-base`, `.input-base`)로 표준화한다.

## Key Files
| File | Description |
|------|-------------|
| `AppHeader.vue` / `AppFooter.vue` | 전역 헤더/푸터 (레이아웃에서 사용) |
| `PageHero.vue` | 페이지 상단 히어로 섹션 |
| `SectionBlock.vue` | 섹션 래퍼 (제목 + 설명 + 콘텐츠) |
| `Pagination.vue` | 페이지네이션 |
| `CategoryIcon.vue` | 카테고리 → SVG 아이콘 (glyph auto-resolve) |
| `DataSourceSection.vue` | 공공데이터 출처/라이선스/갱신 안내 (도메인 인지 — full card + compact 허브 노트) |
| `StatusBadge.vue` | 운영 상태 뱃지 ("운영 중", "운영 종료") |
| `ErrorBoundary.vue` | Vue 에러 경계 — 하위 컴포넌트 오류 캐치 |

## For AI Agents

### Working In This Directory
- **디자인 원칙**: 정보 우선, 즉시 이해, 신뢰의 디자인 (CLAUDE.md의 Design Context)
- **안티패턴 주의**: 관공서 포털 스타일, 그라데이션 과다, 네온, 글래스모피즘 지양
- 버튼/카드/입력은 `.btn-primary`/`.card-base`/`.input-base` 유틸 클래스 사용 — 별도 Base* Vue 래퍼를 새로 만들지 말 것 (의도적으로 제거됨)
- `CategoryIcon`은 `category` prop만 받아 내부에서 아이콘 해석
- `DataSourceSection`은 "신뢰의 디자인" 원칙 — 데이터 출처 투명성. `:domain`(+facility는 `:category`)으로 출처를 내부 해석하고 항상 렌더. 페이지에서 `DataSourceInfo`를 직접 넘기지 말 것

### Testing Requirements
- `tests/components/` — `AppFooter`, `AppHeader` 커버
- `tests/components/common/DataSourceSection.test.ts`, `ErrorBoundary.test.ts` (resolver 유닛 테스트는 `tests`가 아닌 `utils/dataSource.test.ts`)

### Common Patterns
- `defineProps`에 default 값은 `withDefaults(defineProps<T>(), {...})`
- 이벤트는 `emits: ['update:xx', 'click']` 명시
- slot은 named slot 활용 (`#header`, `#footer`)

## Dependencies

### Internal
- `../../utils/categoryIcons.ts`, `categoryColors.ts`, `dataSource.ts`

### External
- `lucide-vue-next` (아이콘), Pretendard 폰트
