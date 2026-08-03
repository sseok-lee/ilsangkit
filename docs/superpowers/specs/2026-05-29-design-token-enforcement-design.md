# 디자인 토큰 강제(Token Enforcement) — 1차 PR 설계

- 날짜: 2026-05-29
- 대상: `frontend/` (Nuxt 3 + Vue 3 + TailwindCSS v3)
- 범위: **색상 + 컴포넌트 토큰만**. 타이포그래피 토큰 마이그레이션은 별도 2차 PR로 분리.

## 배경 / 문제

디자인 감사 결과, 일상킷 프론트엔드는 AI 슬롭이 아니라 **기반이 탄탄한** 상태다(단일 블루 액센트, Pretendard, 포커스 링, `prefers-reduced-motion`, transform 기반 애니메이션, 시맨틱 HTML). 진짜 문제는 단 하나: **디자인 시스템이 정의돼 있지만 강제되지 않는 token drift**.

grep으로 확인한 사실:

| 정의된 토큰 | 실제 사용 |
|---|---|
| `.text-display-1/2/3`, `.text-eyebrow`, `.text-caption` | 전체 8회 (PageHero, SectionBlock, 상세 1곳) |
| `.btn-primary` / `.btn-secondary` | 0회 |
| `.card-base` / `.interactive-card` | 0회 |
| `.input-base` | 0회 |
| `<BaseButton>` / `<BaseCard>` / `<SearchBar>` (Vue) | 참조 0회, 테스트 0회 |
| `primary` 대신 raw `blue-*` | 39개 파일 (`text-blue-700` 25회, `bg-blue-100` 13회 등 100+ 인스턴스) |

`bg-blue-600`은 현재 우연히 `#2563eb`(=primary)와 같지만, 브랜드 컬러를 한 번이라도 바꾸면 100여 곳이 따로 논다. **목표는 "토큰 채택률 100%"가 아니라 "drift 제거"** — 토큰과 명백히 같은 의도인 것만 교체하고, 의도된 변형은 보존한다.

## 범위 밖 (Out of Scope)

- 타이포그래피 토큰 마이그레이션 (`.text-display-*` 등) → 2차 PR.
- **카테고리별 색상**(`toilet`=보라, `trash`=초록 …): tailwind.config + CLAUDE.md에 명시된 의도된 색상 아이덴티티. **절대 primary로 통일 금지.** grep 대상이 `blue-*`라 자동 보존됨.
- **AdBanner 배치/개수**: 사용자 수익 정책. 변경 금지.
- radius / shadow 스케일 통일 → 별도 PR 후보(이번 범위 아님).

## 설계

### 섹션 1 — 색상 토큰 치환 규칙 (기계적)

`blue-*` → `primary-*` 매핑. Tailwind 기본 blue 스케일과 tailwind.config의 primary 스케일이 사실상 동일하므로 시각적 무손실.

| raw 클래스 | 치환 | 색상 변화 |
|---|---|---|
| `{bg,text,border}-blue-{50,100,200,300,400}` | `…-primary-{50..400}` | 동일 |
| `…-blue-500` | `…-primary-500` | `#3b82f6` → `#3c83f6` (육안 식별 불가) |
| `…-blue-600` | `…-primary` (번호 없는 DEFAULT) | 동일. 기존 코드 관례(`text-primary`, `bg-primary`)와 일치 |
| `…-blue-700` | `…-primary-700` | 동일 (= `primary-dark`) |
| `…-blue-800` | `…-primary-800` | 동일 |
| `…-blue-900` | `…-primary-900` | 동일 |

적용 대상 접두사: `bg-`, `text-`, `border-`, 그리고 투명도 변형(`bg-blue-500/30` → `bg-primary-500/30`), hover/focus/group 변형(`hover:bg-blue-600` → `hover:bg-primary`) 포함.

**리뷰 체크포인트**: 혹시 "info 시맨틱"(config의 `info: #3b82f6`)으로 의도된 파랑이 raw 마크업에 있는지 수동 확인. 거의 없을 것으로 예상하나, 발견 시 해당 인스턴스는 보존하고 spec에 기록.

### 섹션 2 — 컴포넌트 클래스 적용 (수동 패스)

main.css에 정의된 유틸을 기존 마크업에 적용. **구조·props·slot 변경 없이 `class` 문자열만 교체.**

- **`.btn-primary`**: 패턴이 명백히 일치하는 1차 버튼에 적용.
- **`.btn-secondary`**: 회색 보조 버튼에 적용.
- **`.card-base`**: `p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md`와 일치하는 카드에 적용.
- **`.input-base`**: 10개 파일의 raw `<input>` 중 **일반 폼 인풋**에만 적용.

**보존 원칙 (억지로 끼워맞추지 않음)**:
- 크기·모양이 토큰과 다른 버튼(검색바 내부 버튼, 플로팅 CTA, pill 형태) → 그대로 둠.
- `border-line` + `shadow-card` + `rounded-xl` 조합(홈·시설 카드 등 의도된 변형) → 보존.
- 검색 히어로 등 의도된 특수 인풋 → 제외.

**`.btn-primary` 정의 보정 (승인됨)**: 현재 `.btn-primary`는 `bg-primary-500`(#3c83f6)이나 raw 1차 버튼 대부분은 `bg-primary`(#2563eb=primary-600)를 쓴다. 적용 시 버튼이 살짝 밝아지는 회귀를 막기 위해 main.css의 `.btn-primary` 정의를 다음으로 보정:

```css
/* before */
.btn-primary { @apply px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors active:scale-[0.98]; }
/* after */
.btn-primary { @apply px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors active:scale-[0.98]; }
```

(`bg-primary` = #2563eb, `bg-primary-dark` = #1d4ed8 = primary-700 — 현행 다수 버튼의 hover 관례와 일치.)

### 섹션 3 — 죽은 컴포넌트 삭제

- 삭제: `components/common/BaseButton.vue`, `components/common/BaseCard.vue`, `components/common/SearchBar.vue` (참조 0, 테스트 0).
- 삭제 후 `grep -rn "BaseButton\|BaseCard\|SearchBar"`로 잔여 import 0건 재확인.
- 표준이 CSS 유틸 클래스로 정해졌으므로 Vue 래퍼 컴포넌트 삭제가 일관적.

### 섹션 4 — 검증 · 테스트

CLAUDE.md 원칙(커밋 전 vitest 필수, 기존 실패 테스트 즉시 수정) 준수:

1. **클래스 단언 테스트 점검**: `npm run test`로 깨지는 테스트 확인. `bg-blue-*` 등 정확한 클래스를 단언하는 테스트는 새 토큰(`primary`)으로 업데이트.
2. **lint**: `npm run lint` 통과.
3. **빌드**: `npm run build` 성공 (Tailwind content purge 영향 없음 확인 — primary는 config에 등록돼 있어 안전).
4. **시각 스폿체크**: 핵심 3페이지(홈 `/`, 시설 리스트 `/[category]`, 시설 상세 `/[category]/[id]`)만 dev 서버에서 before/after 육안 확인. 색상 무손실이라 전수 스크린샷 생략.

## 커밋 구조 (PR 1개, 원자 커밋 3개)

PR 기반 워크플로우(새 브랜치 → CI 통과 → 머지) 준수. Node 20에서 작업.

1. `refactor(ui): blue-* → primary 토큰 치환` — 39파일, 기계적 색상 치환.
2. `refactor(ui): btn/card/input 유틸 클래스 채택 + .btn-primary 색 보정` — 수동 패스.
3. `chore(ui): 미사용 Base* 컴포넌트 삭제` — BaseButton/BaseCard/SearchBar.

## 성공 기준

- `grep -rn "blue-[0-9]" frontend/{pages,components}` → 0건 (의도적 info 시맨틱 예외는 spec에 기록된 것만 허용).
- `.btn-primary`/`.card-base`/`.input-base` 사용처 > 0, 명백히 같은 의도인 곳에 적용됨.
- 죽은 Vue 컴포넌트 3개 삭제, 잔여 import 0.
- `npm run test` + `npm run lint` + `npm run build` 전부 통과.
- 핵심 3페이지 시각 회귀 없음.

## 리스크 / 완화

- **시각 회귀**: 색상 매핑이 픽셀 동일(blue-500만 imperceptible)이라 낮음. `.btn-primary` 보정으로 버튼 밝기 회귀도 차단. 핵심 3페이지 스폿체크로 확인.
- **테스트 클래스 단언 깨짐**: 예상되는 영향. 검증 1번에서 업데이트.
- **과잉 적용으로 인한 회귀**: "drift 제거 ≠ 100% 채택" 원칙 + 보존 규칙으로 완화. 형태가 다르면 두는 것이 기본값.
