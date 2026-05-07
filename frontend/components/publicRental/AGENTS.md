<!-- Parent: ../../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# publicRental

## Purpose
공공임대 관련 Vue 3 컴포넌트 모음. LH·SH 등 공공기관의 매입임대·전세임대 매물, 입주자 모집공고 등을 표시하는 재사용 가능한 UI 컴포넌트를 제공한다.

## Key Files
| File | Description |
|------|-------------|
| `PublicRentalFilterTabs.vue` | 공고/매입임대/전세임대 탭 네비게이션. 활성 상태 prop을 받아 스타일 적용 |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- **컴포넌트 명명**: PascalCase (예: `PublicRentalFilterTabs.vue`)
- **Props 타입**: TypeScript `defineProps<>()` 사용, 한글 주석으로 의도 명시
- **Styling**: TailwindCSS class binding, 활성/비활성 상태 분기
- **상대 경로**: `~/` alias (프로젝트 루트 기준)

### Common Patterns
- Nuxt `<NuxtLink>` 사용 (클라이언트 라우팅)
- Props로 활성 탭 식별자 수신 (`active?: string`)
- 탭 메타데이터는 컴포넌트 내 `TABS` 배열로 하드코딩
- 조건부 클래스: `active === tab.match ? 'bg-primary text-white' : 'bg-white...'`

## Dependencies

### Internal
- 상위: `frontend/pages/public-rental/` (index.vue, [type]/index.vue, announcements/index.vue에서 임포트)
- 형제: `frontend/components/subscription/PublicRentalDetailView.vue`, `frontend/components/publicRental/*` (향후 추가 컴포넌트)

### External
- Vue 3 (composition API)
- Nuxt 3 (NuxtLink)
- TailwindCSS

<!-- MANUAL: -->
