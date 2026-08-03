# 헤더 네비게이션 통합 — 생활정보 메가메뉴 + 1200px 컨테이너

- **날짜**: 2026-05-29
- **대상**: `frontend/components/common/AppHeader.vue`, `frontend/types/facility.ts`
- **유형**: 프론트엔드 UI 리팩터 (네비게이션 구조 / 헤더 레이아웃). 데이터·라우트·API 변경 없음.

## 1. 배경 / 문제

현재 데스크톱 헤더는 **6개의 드롭다운 버튼**을 가로로 나열한다:
`부동산`, `청약·임대`, 그리고 시설 4개 그룹(`교육/육아`, `건강/안전`, `생활/편의`, `환경/생활`).

두 가지 문제:

1. **버튼 과다**: 부동산·청약을 제외한 시설 4개 그룹이 각각 별도 버튼이라 헤더가 빽빽하다.
2. **헤더 폭 어긋남**: `layouts/default.vue`가 `<AppHeader />`를 풀폭으로 깔지만, 본문 페이지는 전부 `max-w-[1200px] mx-auto`(코드베이스 26곳 사용)로 가운데 정렬한다. 헤더 내용(로고·메뉴)이 화면 끝까지 펼쳐져 본문 컨텐츠 열과 어긋나고 "가로가 꽉 찬" 느낌을 준다.

## 2. 목표

- 부동산·청약·임대는 **개별 드롭다운 유지**.
- 시설 4개 그룹을 **하나의 `생활정보` 버튼**으로 통합하고, 열었을 때 **4단 메가메뉴**로 크게 보여준다.
- 헤더 내용을 본문과 동일한 **1200px 컨테이너**로 정렬하고, 로고+메뉴는 좌측, 유틸리티(가이드·검색·소개)는 우측으로 그룹화한다.
- 모바일 햄버거 메뉴는 데스크톱과 일관되게 `생활정보` **통합 섹션** 아래 4개 하위그룹을 펼쳐 보여준다.

## 3. 확정된 결정 (브레인스토밍)

| 항목 | 결정 |
|------|------|
| 드롭다운 레이아웃 | **4단 메가메뉴** (그룹당 1열) |
| 통합 버튼 라벨 | **생활정보** |
| 통합 버튼 아이콘 | `grid_view` (material symbol) |
| 모바일 처리 | **통합 섹션** (생활정보 상위 헤더 + 4개 하위그룹, 항상 펼침 — 현행 스타일 유지) |
| 구현 방식 | **A안: `AppHeader.vue` 인플레이스** (드롭다운 상태/로직 재사용) |
| 헤더 폭 | **1200px 컨테이너 + 좌측 그룹화** (데스크톱 한정) |

### 검토했으나 기각한 대안
- **B안 (`NavMegaMenu.vue` 컴포넌트 추출)**: `AppHeader`(405줄) 축소엔 좋으나, "한 번에 하나만 열림" 상태(`activeDropdown`)를 props/emit으로 끌어올려야 해 배선·신규 테스트 비용이 큼. 메가메뉴가 하나뿐이라 이득 대비 과함.
- **C안 (`type: 'dropdown' | 'mega'` 일반화 스키마)**: 가장 확장적이나 최대 리팩터. 메가메뉴가 단 하나라 YAGNI로 기각.

## 4. 데이터 모델 (`types/facility.ts`)

기존 export를 깨지 않고 최소 추가한다.

```ts
// 신규: 개별 드롭다운으로 남는 링크 그룹 2개
export const NAV_LINK_GROUPS: readonly LinkGroup[] = [
  /* 부동산 */,
  /* 청약·임대 */,
]

// CATEGORY_GROUPS: 변경 없음 (4개 그룹) — 메가메뉴/모바일 섹션의 소스
// 동시에 search.vue, faq.vue, [city]/[district]/[category].vue 가 계속 사용

// NAV_GROUPS: shape/순서 동일 유지 (navGroups.test.ts 그대로 통과)
export const NAV_GROUPS: readonly NavGroup[] = [
  ...NAV_LINK_GROUPS,
  ...CATEGORY_GROUPS,
] as const
```

- `LinkGroup` / `CategoryGroup` / `NavGroup` / `isLinkGroup` 타입은 그대로 사용.
- `NAV_GROUPS`는 하위호환을 위해 동일한 6개·동일 순서로 유지(테스트 보존). `AppHeader`는 더 이상 `NAV_GROUPS`를 평평하게 순회하지 않고 `NAV_LINK_GROUPS` + `CATEGORY_GROUPS`를 각각 사용한다.

## 5. 데스크톱 헤더 구조 (`AppHeader.vue`)

### 5.1 컨테이너 (폭 정렬)

`<header>`는 sticky 배경·하단 보더를 위해 **풀폭 유지**. 내부 내용만 1200px 컨테이너로 감싼다.

```
<header class="sticky top-0 z-50 ... h-14 md:h-16 px-4 md:px-6 bg-background-light border-b ...">
  <div class="mx-auto w-full max-w-[1200px] h-full flex items-center">
    <!-- LEFT: 로고(또는 뒤로가기) -->
    <div class="flex items-center gap-2"> … 로고/back button … </div>

    <!-- DESKTOP NAV: 단일 <nav>, flex-1로 잔여폭 차지 -->
    <nav class="hidden md:flex items-center flex-1 gap-1">
      <!-- 좌측: 개별 드롭다운 (NAV_LINK_GROUPS) + 생활정보 메가메뉴 -->
      … 부동산 ▾ · 청약·임대 ▾ · 생활정보 ▾ …
      <!-- 우측으로 밀기 -->
      <div class="ml-auto flex items-center gap-1">
        가이드 · 검색 · 소개
      </div>
    </nav>

    <!-- MOBILE: 햄버거 (md:hidden, ml-auto) -->
    <button class="md:hidden ml-auto ..." aria-label="메뉴"> … </button>
  </div>
</header>
```

- **단일 `nav.hidden.md:flex` 유지**가 핵심: 기존 테스트(`wrapper.find('nav.hidden.md\\:flex')`, "utility links for search and about")가 같은 nav 안에서 검색/소개를 찾으므로 깨지지 않는다.
- 유틸리티 묶음은 `ml-auto`로 우측 정렬. (기존 `h-5 w-px bg-slate-200` 구분선은 유지 가능.)
- 1200px보다 좁은 화면에선 컨테이너가 자연히 풀폭이 되어 모바일/태블릿 영향 없음.

### 5.2 개별 드롭다운 (부동산 · 청약·임대)

`NAV_LINK_GROUPS`를 `v-for`로 순회 — **기존 단일열 드롭다운 마크업 그대로**. `isLinkGroup` 분기, 섹션 헤딩(`nav-section-heading`/`nav-section-divider`), 아이콘 이미지 처리 모두 변경 없음.

### 5.3 생활정보 메가메뉴

`NAV_LINK_GROUPS` 다음에 단 하나의 `생활정보` 버튼을 추가한다.

- 버튼: `<span class="material-symbols-outlined">grid_view</span> 생활정보 <expand_more>`, `aria-haspopup`, `aria-expanded`.
- 상태: 기존 `activeDropdown` ref 재사용 — `activeDropdown === '생활정보'`일 때 패널 표시. 신규 상태 머신 불필요.
- 호버 open / 150ms close 타이머 / `focusout` / `Escape` 로직 전부 기존 것 재사용.
- 패널(드롭다운):

```
<div class="absolute top-full left-0 mt-1 grid grid-cols-4 gap-x-4 gap-y-1
            w-[640px] max-w-[calc(100vw-1.5rem)]
            bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-50"
     data-testid="nav-mega-menu">
  <!-- CATEGORY_GROUPS v-for: 그룹당 1열 -->
  <div v-for="group in CATEGORY_GROUPS" :key="group.title">
    <div class="...열 헤더(non-link): group.icon + group.title...">…</div>
    <HardLink v-for="catId in group.categories" :to="`/${catId}`" @click="closeDropdown">
      <CategoryIcon :category-id="catId" size="sm" /> {{ CATEGORY_META[catId].shortLabel }}
    </HardLink>
  </div>
</div>
```

- 열 헤더는 **링크 아님**(라벨). 카테고리 항목만 `/{catId}`로 링크 — 기존 데스크톱 동작과 동일.
- 폭 ~640px(4열 × 약 150px), `left-0` 앵커. 생활정보가 좌측에 위치하므로 1200px·뷰포트 내에 안전. `max-w-[calc(100vw-1.5rem)]`로 좁은 데스크톱(≈768–1024px)에서 우측 오버플로 방지. 필요 시 좁은 폭에서 `grid-cols-2`로 래핑.

## 6. 모바일 메뉴 (통합 섹션)

- 부동산·청약·임대: `NAV_LINK_GROUPS` 순회 — 기존 링크 그룹 마크업 그대로(섹션 헤딩 포함).
- **신규 `생활정보` 상위 섹션 헤더** 1개 추가, 그 아래 `CATEGORY_GROUPS`를 순회하여 각 그룹의 **하위 헤더(교육/육아 …) + 카테고리 링크**를 기존 마크업으로 렌더(항상 펼침).
- 순서: 부동산 → 청약·임대 → 생활정보(4개 하위그룹) → 구분선 → 홈/검색/가이드/소개 → 개인정보/약관.
- 결과적으로 4개 그룹 제목과 카테고리 링크가 모두 존재하므로 기존 모바일 테스트(그룹 헤더/카테고리 링크/순서) 유지.

## 7. 동작 / 접근성

- `생활정보` 버튼: `aria-haspopup="true"`, `aria-expanded` 바인딩, `expand_more` 회전 인디케이터.
- 호버 진입 open, 이탈 150ms 후 close(`scheduleCloseDropdown`/`cancelCloseDropdown`), `focusout` 시 컨테이너 밖이면 close, `Escape`로 드롭다운→모바일 메뉴 순 닫기 — **전부 기존 로직 재사용**.
- 모바일 햄버거 터치 타깃 `size-11`(44px) 유지, 포커스 트랩 유지.

## 8. 엣지 케이스

- **메가 패널 우측 오버플로**: `max-w-[calc(100vw-1.5rem)]` + 좁은 폭 `grid-cols-2` 래핑으로 방지.
- **풀폭 sticky 배경**: `<header>`는 풀폭 유지하므로 sticky 시 배경/보더가 뷰포트 전체에 그려진다(컨테이너만 1200px). 시각적 어긋남 없음.
- **`transparent` / `showBackButton` props**: 컨테이너 추가가 두 prop 동작에 영향 없음(배경은 `<header>`, back button은 좌측 클러스터).
- **카테고리 증감**: 메가메뉴/모바일이 `CATEGORY_GROUPS`를 순회하므로 카테고리 추가 시 자동 반영(별도 수정 불필요).

## 9. 테스트 계획

### `tests/components/AppHeader.test.ts` (수정)
- 데스크톱 `.relative` 그룹 수: **6 → 3** (부동산·청약·임대·생활정보).
- 인덱스 가정: 부동산=0, 청약·임대=1, **생활정보=2**. 기존 부동산(0)·청약·임대(1) 드롭다운 테스트는 인덱스 그대로 통과.
- "should display group titles" 재작성: 닫힌 상태 nav에는 그룹 제목이 없으므로, **생활정보 메가메뉴를 연 뒤** 4개 열 헤더(교육/육아·건강/안전·생활/편의·환경/생활) + 카테고리 hrefs(`/park`,`/market`,`/toilet` 등)가 `nav-mega-menu` 안에 있는지 검증.
- "utility links for search and about" 유지(단일 nav 안에 검색/소개 존재).
- 신규: 생활정보 메가메뉴(`data-testid="nav-mega-menu"`)에 4개 열 + 전체 시설 카테고리 링크가 렌더되는지.
- 모바일: 그룹 헤더/카테고리 링크/순서 테스트 유지. 신규로 `생활정보` 상위 섹션 헤더 존재 검증.

### `tests/types/navGroups.test.ts` (대부분 유지 + 추가)
- `NAV_GROUPS` 6개·순서·CATEGORY_GROUPS 일치 테스트 전부 그대로 통과.
- 신규: `NAV_LINK_GROUPS`가 길이 2이고 모두 `isLinkGroup`이며 첫째=부동산·둘째=청약·임대인지.

### 검증
- `cd frontend && npm run test` (vitest) 통과, `npm run lint` 통과.
- (선택) 데스크톱/모바일 수동 확인: 1200px 정렬, 메가메뉴 4단, 모바일 통합 섹션.

## 10. 범위 밖 (Out of scope)

- 카테고리/라우트/API/데이터 변경 없음.
- 헤더 외 시각 리디자인 없음(색/타이포 토큰 등 별건).
- `AppFooter` 폭 정렬은 본 작업 범위 아님.
- 메가메뉴 아이콘은 실제 `CategoryIcon`/material symbol 사용(브레인스토밍 목업의 이모지는 자리표시자).

## 11. 변경 파일 요약

1. `frontend/types/facility.ts` — `NAV_LINK_GROUPS` 추가, `NAV_GROUPS`를 `[...NAV_LINK_GROUPS, ...CATEGORY_GROUPS]`로 구성.
2. `frontend/components/common/AppHeader.vue` — 1200px 컨테이너 래핑 + 좌/우 그룹화, 개별 드롭다운은 `NAV_LINK_GROUPS` 순회, `생활정보` 4단 메가메뉴 추가, 모바일 통합 섹션.
3. `frontend/tests/components/AppHeader.test.ts` — 위 테스트 갱신.
4. `frontend/tests/types/navGroups.test.ts` — `NAV_LINK_GROUPS` 테스트 추가.
