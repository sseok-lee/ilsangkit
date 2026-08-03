# 신뢰 디자인 격상 PR ⑨ — 헤더/GNB 텍스트-온리 + 홈 히어로 코발트 패널 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** GNB·메가메뉴·모바일 메뉴에서 장식 아이콘을 전면 제거해 텍스트-온리(C안)로 정리하고, 헤더에 데스크톱 마이크로 라벨을 추가하며, 홈 히어로를 흐릿한 사진 배경 대신 "날짜가 박힌" 단색 딥 코발트 데이터 패널로 재구성한다.

**Architecture:** 헤더/GNB는 단일 파일(`AppHeader.vue`)에서 렌더링 요소만 제거(데이터모델·링크·v-show 구조 불변). 홈 히어로는 `pages/index.vue`의 자체 마크업을 코발트 패널로 리스타일하고, 기존 3종 스탯에 "오늘 업데이트"를 추가하며, 기준일 스탬프는 기존 `useSyncStatus`(client, fail-open) 패턴을 재사용한다. 백엔드 변경 없음.

**Tech Stack:** Nuxt 3 SSR · Vue 3 script-setup · TailwindCSS(브랜드 토큰 dual-defined) · Vitest(happy-dom)

## Global Constraints

- **Node 20 필수.** `source ~/.nvm/nvm.sh && nvm use 20` 후 작업. `package-lock.json` 재생성 금지(기존 유지·`npm install`만).
- **백엔드 무변경.** 기준일 스탬프는 기존 `/api/meta/sync-status`(client fetch) 재사용 — 백엔드/Prisma/스키마 미접촉.
- **링크 수·구조 불변 (사이트링크 보호):** 데스크톱 `<nav>` 내부 leaf 앵커 **36개**(부동산 5 + 청약·임대 7 + 공매 7 + 생활시설 15 + 유틸 2) + 로고 앵커 1 = 37. 모바일 메뉴 링크 **40개**(19 + 15 + 정적 4 + 푸터 2). GNB의 `v-show`(v-if 아님) SSR 노출 구조 유지. `HardLink :to`·순서·`data-testid`·ARIA 라벨 전부 불변 — **렌더링 요소만 제거**한다.
- **데이터모델 미변경:** `frontend/types/facility.ts`의 `NAV_LINK_GROUPS`/`CATEGORY_GROUPS`의 `.icon` 필드는 **삭제하지 않는다**(렌더에서만 안 씀). `navGroups.test.ts`가 `.icon` 값을 assert하므로 데이터 변경 시 무관한 테스트가 깨진다.
- **유지 아이콘:** `expand_more` 캐럿(데스크톱 트리거 4곳), `arrow_back` 뒤로가기, `menu` 모바일 햄버거, `HeaderSearch.vue`의 `search`/`arrow_back`. **제거 대상 = GNB/메가메뉴/모바일 메뉴의 장식 아이콘만.**
- **`nuxt.config` icon_names·`.nuxt`/`.output` 미변경:** 제거되는 13종 glyph는 전부 타 페이지(faq·search·[city]·real-estate·subway 등)에서도 렌더됨 → GNB 제거로 unused 되는 icon_names 항목 0개. icon_names 편집·캐시 삭제 **불필요**(스펙 §6-1 "안 쓰게 된 심볼 제거" 단계는 이번 PR엔 해당 없음).
- **적용 범위 한정:** GNB·모바일 메뉴에만 해당. 홈 카테고리 그리드·시설 카드·섹션 헤더 등 GNB 외 아이콘 사용처는 유지.
- **히어로 색:** 단색 `--brand-press #16358F`(Tailwind `bg-primary-press`), **그라데이션 금지**.
- **단일 h1 유지:** 현행 `<h1 class="sr-only">부동산 실거래가·생활시설 통합 검색 - 일상킷</h1>` 그대로(카피·sr-only 불변). 화면상 큰 헤드라인은 기존대로 `<div>`(추가 h1 금지).
- **기존 카피 verbatim 유지:** 헤드라인("우리 동네 정보," / "일상킷에서 한번에." / "한번에.")·서브카피(데스크톱 "부동산 실거래가, 청약 정보, 생활시설을 한 곳에서." / 모바일 "부동산 · 청약 · 생활시설을 한 곳에서")를 문자 그대로 유지. 색상만 코발트용으로 변경(목업의 축약 카피를 도입하지 말 것 — 스펙 "H1 기존 카피 유지").
- **검색 배선 불변:** 히어로 검색 input `aria-label="단지명·동네·시설 검색"`, `placeholder="단지명, 지역, 시설 검색"`, `SearchAutocomplete` 배선·refs·핸들러(`onHeroInput`/`onHeroKeydown`/`handleSearch`) 전부 유지(테스트 키).
- **스탬프 fail-open 불변식:** `useSyncStatus`(server:false)로 실거래 6키 MAX(syncedAt). `isSyncStale(iso, RE_STALE_DAYS)`로 stale/null 시 **날짜만 생략**하고 "매일 자동 동기화" 라벨은 항상 SSR 텍스트로 노출. **날짜·fetch 실패가 noindex/canonical/렌더를 절대 게이팅하지 않음**(과거 SSR 풀고갈 사고 분리 원칙). 홈 페이지는 noindex 로직 없음 — 스탬프는 순수 표시용.
- **숫자 타이포:** 히어로 스탯 값에 `tabular-nums`(§6-4 일관성).
- **테스트 위생:** 직접 mount 컴포넌트는 `ref`/`computed`/`watch` 명시 import(vitest auto-import 함정). 기존 테스트가 제거된 아이콘/배경 요소를 assert하면 같은 커밋에서 갱신. flaky(SearchAutocomplete/localStorage)는 무시.
- **검증(승격 후 라이브, CI green ≠ 운영 정상):** SSR HTML 단일 h1·SSR 링크 수·모바일 390px 가로 넘침 없음. 홈은 nitro route cache(`/`=`swr:3600`) — 배포 후 `.nuxt/cache/nitro/routes/_/*.json` 삭제 또는 캐시 퍼지 후 히어로 확인.

---

## File Structure

- **Modify** `frontend/components/common/AppHeader.vue` — 마이크로 라벨(Task 1), 데스크톱 GNB 아이콘 제거(Task 2), 모바일 메뉴 아이콘 제거+위계/여백(Task 3).
- **Modify** `frontend/pages/index.vue` — 히어로 코발트 패널·배지·스탬프(Task 4), 4칸 스탯(Task 5).
- **Modify** `frontend/tests/components/AppHeader.test.ts` — 마이크로 라벨·아이콘 부재·링크 수 assert 추가, 깨지는 기존 assert 갱신.
- **Modify** `frontend/tests/pages/index.test.ts` — "Hero image optimization" describe를 코발트 패널 assert로 대체, 스탯/배지/스탬프 assert 추가.

**참고(변경 안 함):** `frontend/types/facility.ts`, `frontend/components/common/CategoryIcon.vue`, `frontend/components/common/HeaderSearch.vue`, `frontend/components/common/PageHero.vue`, `frontend/composables/useSyncStatus.ts`, `frontend/utils/syncFreshness.ts`, `frontend/nuxt.config.ts` icon_names.

---

## Task 1: 헤더 데스크톱 마이크로 라벨

**Files:**
- Modify: `frontend/components/common/AppHeader.vue` (로고 클러스터, 현재 라인 12-26)
- Test: `frontend/tests/components/AppHeader.test.ts`

**Interfaces:**
- Consumes: 없음(정적 텍스트)
- Produces: 데스크톱 전용 마이크로 라벨 `공공데이터 기반 생활정보` — Task 2가 같은 파일을 이어서 편집.

**현재 마크업** (라인 24-25, 로고 `HardLink`):
```html
        <HardLink v-if="!props.showBackButton" to="/" class="flex items-center">
          <img src="/icons/logo.webp" alt="일상킷" class="h-9 md:h-12 w-auto shrink-0" width="91" height="36" />
        </HardLink>
```
좌측 클러스터는 `<div class="flex items-center gap-2">`(라인 13-26)로 뒤로가기 버튼 또는 로고를 감싼다. 마이크로 라벨은 로고 `</HardLink>` 다음, 이 `div` 안의 새 형제로 추가한다.

- [ ] **Step 1: 실패 테스트 작성** — `frontend/tests/components/AppHeader.test.ts` 하단에 describe 추가

```ts
describe('데스크톱 마이크로 라벨', () => {
  it('로고 옆에 "공공데이터 기반 생활정보" 라벨을 데스크톱 전용으로 렌더한다', () => {
    const wrapper = mountHeader() // 이 파일의 기존 마운트 헬퍼 사용 (없으면 mount(AppHeader, { global: { stubs } }))
    const label = wrapper
      .findAll('span')
      .find((s) => s.text() === '공공데이터 기반 생활정보')
    expect(label).toBeTruthy()
    // 데스크톱 전용(모바일 숨김)
    expect(label!.classes()).toContain('hidden')
    expect(label!.classes().some((c) => c.startsWith('md:'))).toBe(true)
  })
})
```
> 이 파일의 기존 마운트 패턴(헬퍼 함수명·stubs)을 그대로 따를 것. `HardLink`/`CategoryIcon`은 기존 테스트가 이미 stub한다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts -t "마이크로 라벨"`
Expected: FAIL (라벨 미존재).

- [ ] **Step 3: 마이크로 라벨 추가** — 로고 `</HardLink>`(라인 25) 바로 다음, 닫는 `</div>`(라인 26) 앞에 삽입

```html
        <HardLink v-if="!props.showBackButton" to="/" class="flex items-center">
          <img src="/icons/logo.webp" alt="일상킷" class="h-9 md:h-12 w-auto shrink-0" width="91" height="36" />
        </HardLink>
        <span
          v-if="!props.showBackButton"
          class="hidden md:inline-flex items-center self-center pl-2.5 ml-1.5 border-l border-line-2 text-[11px] leading-none text-faint"
        >공공데이터 기반 생활정보</span>
```
> `border-l border-line-2` = 좌측 보더 구분(파일 내 기존 구분선 토큰 `bg-line-2` 대응). `text-[11px] text-faint` = 11px faint(스펙). `hidden md:inline-flex` = 데스크톱 전용(모바일은 히어로 스탬프가 역할 대체). 뒤로가기 모드(showBackButton)에선 로고가 없으므로 라벨도 숨김.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts`
Expected: PASS (전체 파일 green — 기존 케이스 회귀 없음).

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/common/AppHeader.vue frontend/tests/components/AppHeader.test.ts
git commit -m "feat(header): 데스크톱 마이크로 라벨 '공공데이터 기반 생활정보' 추가"
```

---

## Task 2: 데스크톱 GNB·메가메뉴 아이콘 전면 제거 (텍스트-온리)

**Files:**
- Modify: `frontend/components/common/AppHeader.vue` (데스크톱 `<nav>`, 현재 라인 29-177)
- Test: `frontend/tests/components/AppHeader.test.ts`

**Interfaces:**
- Consumes: Task 1 후의 `AppHeader.vue`
- Produces: 아이콘 제거된 데스크톱 GNB — Task 3(모바일)이 같은 파일을 이어서 편집.

**제거 대상 (7곳, 캐럿·기능 아이콘은 유지):**

1. **탑레벨 트리거 아이콘** (라인 50, NAV_LINK_GROUPS 부동산/청약·임대/공매). 삭제:
```html
            <span class="material-symbols-outlined text-[18px]">{{ group.icon }}</span>
```
> 같은 `<button>`의 캐럿(라인 52 `expand_more`)은 **유지**.

2. **드롭다운 leaf 아이콘** (라인 89-90). 두 분기 모두 삭제하고 leaf `gap`을 제거:
```html
<!-- before -->
                <HardLink
                  :to="link.to"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-background-light text-[15px] text-ink transition-colors"
                  @click="closeDropdown"
                >
                  <img v-if="link.iconImg" :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-5 h-5" width="20" height="20" />
                  <span v-else class="material-symbols-outlined text-[18px] text-faint">{{ link.icon }}</span>
                  {{ link.label }}
                </HardLink>
<!-- after -->
                <HardLink
                  :to="link.to"
                  class="flex items-center px-3 py-2 rounded-lg hover:bg-background-light text-[15px] text-ink transition-colors"
                  @click="closeDropdown"
                >
                  {{ link.label }}
                </HardLink>
```

3. **생활시설 트리거 아이콘** (라인 114). 삭제(캐럿 라인 116 유지):
```html
            <span class="material-symbols-outlined text-[18px]">grid_view</span>
```

4. **메가패널 그룹 헤더 아이콘 + eyebrow 위계 강화** (라인 137-139). 아이콘 제거 + 헤더를 11px·uppercase·faint eyebrow로:
```html
<!-- before -->
                <div class="flex items-center gap-1.5 px-2 pb-1.5 mb-1 border-b border-line text-[13px] font-bold text-strong">
                  <span class="material-symbols-outlined text-[18px] text-primary">{{ group.icon }}</span>
                  {{ group.title }}
                </div>
<!-- after -->
                <div class="px-2 pb-1.5 mb-1 border-b border-line text-[11px] font-extrabold uppercase tracking-wider text-faint">
                  {{ group.title }}
                </div>
```
> 스펙 §6-1 "패널 그룹 헤더를 eyebrow 위계(11px·uppercase·faint)로 유지·강화". `border-b`는 스캔 리듬을 위해 유지. (uppercase는 한글엔 무효·Latin에만 적용 — 기존 모바일 eyebrow와 동일 관례.)

5. **메가패널 카테고리 leaf 아이콘** (라인 148, `CategoryIcon`). 삭제 + `gap-2` 제거:
```html
<!-- before -->
                <HardLink
                  v-for="catId in group.categories"
                  :key="catId"
                  :to="`/${catId}`"
                  class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-background-light text-[15px] text-ink transition-colors"
                  @click="closeDropdown"
                >
                  <CategoryIcon :category-id="catId" size="sm" />
                  {{ CATEGORY_META[catId].shortLabel }}
                </HardLink>
<!-- after -->
                <HardLink
                  v-for="catId in group.categories"
                  :key="catId"
                  :to="`/${catId}`"
                  class="flex items-center px-2 py-1.5 rounded-lg hover:bg-background-light text-[15px] text-ink transition-colors"
                  @click="closeDropdown"
                >
                  {{ CATEGORY_META[catId].shortLabel }}
                </HardLink>
```

6. **유틸 링크 가이드 아이콘** (라인 166). 삭제 + `gap-1.5` 제거:
```html
<!-- before -->
          <HardLink to="/guide" class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors">
            <span class="material-symbols-outlined text-[18px]">menu_book</span>
            가이드
          </HardLink>
<!-- after -->
          <HardLink to="/guide" class="flex items-center px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors">
            가이드
          </HardLink>
```

7. **유틸 링크 소개 아이콘** (라인 173). 삭제 + `gap-1.5` 제거:
```html
<!-- after -->
          <HardLink to="/about" class="flex items-center px-3 py-2 text-base font-medium text-muted hover:text-primary rounded-lg hover:bg-background-light transition-colors">
            소개
          </HardLink>
```
> 유틸 앞 세로 구분선(라인 161 `<div class="h-5 w-px bg-line-2 mx-1">`)은 아이콘이 아니라 구분 rule — **유지**.

**주의:** 편집은 데스크톱 `<nav>`(라인 29-177) 범위 **한정**. 모바일 메뉴(라인 194-309)의 거의 동일한 v-for 블록은 Task 3에서 별도 처리 — 이번 태스크에서 건드리지 말 것.

- [ ] **Step 1: 실패 테스트 작성** — `AppHeader.test.ts`에 describe 추가

```ts
describe('데스크톱 GNB 텍스트-온리', () => {
  const REMOVED_GLYPHS = [
    'apartment', 'calendar_month', 'gavel', 'grid_view',
    'local_library', 'health_and_safety', 'home', 'eco', 'menu_book', 'info',
  ]

  it('데스크톱 nav에서 장식 material-symbols 아이콘을 제거한다(캐럿 expand_more만 유지)', () => {
    const wrapper = mountHeader()
    const nav = wrapper.find('nav.hidden.md\\:flex')
    const glyphs = nav.findAll('.material-symbols-outlined').map((s) => s.text().trim())
    for (const g of REMOVED_GLYPHS) expect(glyphs).not.toContain(g)
    // 캐럿은 유지 (탑레벨 트리거 4개)
    expect(glyphs.filter((g) => g === 'expand_more').length).toBe(4)
  })

  it('데스크톱 nav 메가패널에 카테고리 webp 아이콘(img)이 없다', () => {
    const wrapper = mountHeader()
    const nav = wrapper.find('nav.hidden.md\\:flex')
    expect(nav.findAll('img[src*="/icons/category/"]').length).toBe(0)
  })

  it('사이트링크 보호: 데스크톱 nav leaf 앵커 수가 36개로 유지된다', () => {
    const wrapper = mountHeader()
    const nav = wrapper.find('nav.hidden.md\\:flex')
    expect(nav.findAll('a').length).toBe(36)
  })
})
```
> `HardLink` stub이 `<a>`로 렌더된다고 가정(기존 테스트가 hrefs를 `a`/`HardLink`로 검사하는 방식에 맞출 것 — 다르면 기존 셀렉터 관례를 따르라). 앵커 수 36은 부동산5+청약임대7+공매7+생활시설15+유틸2.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts -t "GNB 텍스트-온리"`
Expected: FAIL (아이콘 현존).

- [ ] **Step 3: 위 7곳 아이콘 제거 적용** (본문 상단 before/after대로)

- [ ] **Step 4: 통과 + 회귀 확인** — 새 케이스 통과 + 기존 AppHeader 케이스(hrefs·text·data-testid·ordering) 유지. 기존 케이스가 제거된 아이콘/eyebrow 클래스를 assert해서 깨지면, **링크·href·text·testid 커버리지는 보존한 채** 해당 assert만 갱신.

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts`
Expected: PASS (전체 green).

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/common/AppHeader.vue frontend/tests/components/AppHeader.test.ts
git commit -m "feat(gnb): 데스크톱 GNB·메가메뉴 장식 아이콘 전면 제거(텍스트-온리, 링크·캐럿 불변)"
```

---

## Task 3: 모바일 메뉴 아이콘 제거 + 3단 위계·여백 보강

**Files:**
- Modify: `frontend/components/common/AppHeader.vue` (모바일 메뉴, 현재 라인 194-309)
- Test: `frontend/tests/components/AppHeader.test.ts`

**Interfaces:**
- Consumes: Task 2 후의 `AppHeader.vue`
- Produces: 아이콘 제거된 모바일 메뉴 — 헤더/GNB 파트 완료.

**제거 대상 (4곳) + 위계/여백 보강 (햄버거 아이콘 라인 188은 유지):**

1. **NAV_LINK_GROUPS 그룹 eyebrow 아이콘** (라인 216). 삭제:
```html
            <span class="material-symbols-outlined text-[16px] text-primary">{{ group.icon }}</span>
```

2. **NAV_LINK_GROUPS leaf 아이콘** (라인 231-232, img+span 두 분기 모두). 삭제 + `gap-3` 제거 + `min-h-[42px]` 명시:
```html
<!-- before -->
            <HardLink
              :to="link.to"
              class="pl-6 pr-4 py-2.5 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
              @click="closeMobileMenu"
            >
              <img v-if="link.iconImg" :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-5 h-5" width="20" height="20" />
              <span v-else class="material-symbols-outlined text-[18px] text-faint">{{ link.icon }}</span>
              {{ link.label }}
            </HardLink>
<!-- after -->
            <HardLink
              :to="link.to"
              class="pl-6 pr-4 py-2.5 min-h-[42px] text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center"
              @click="closeMobileMenu"
            >
              {{ link.label }}
            </HardLink>
```
> `pl-6` 들여쓰기 **유지**(목업: "텍스트가 왼쪽으로 당겨지지 않아 탭 위치 기억 유지"). `min-h-[42px]`로 터치 타깃 명시. `hover:bg-primary/10 hover:text-primary` 틴트 유지.

3. **생활시설 섹션 eyebrow 아이콘** (라인 241). 삭제:
```html
            <span class="material-symbols-outlined text-[16px] text-primary">grid_view</span>
```

4. **CATEGORY_GROUPS leaf 아이콘** (라인 255, `CategoryIcon`). 삭제 + `gap-3` 제거 + `min-h-[42px]` 명시(라인 252 클래스):
```html
<!-- before -->
            <HardLink
              v-for="catId in group.categories"
              :key="catId"
              :to="`/${catId}`"
              class="pl-6 pr-4 py-2.5 text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
              @click="closeMobileMenu"
            >
              <CategoryIcon :category-id="catId" size="sm" />
              {{ CATEGORY_META[catId].shortLabel }}
            </HardLink>
<!-- after -->
            <HardLink
              v-for="catId in group.categories"
              :key="catId"
              :to="`/${catId}`"
              class="pl-6 pr-4 py-2.5 min-h-[42px] text-strong hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center"
              @click="closeMobileMenu"
            >
              {{ CATEGORY_META[catId].shortLabel }}
            </HardLink>
```

5. **그룹 간 여백 한 단계 확대** — 그룹 래퍼 `mb-1` → `mb-4` (2곳: 라인 214 NAV_LINK_GROUPS 래퍼, 라인 239 생활시설 래퍼):
```html
<!-- 라인 214 -->  <div v-for="group in NAV_LINK_GROUPS" :key="group.title" class="mb-4">
<!-- 라인 239 -->  <div class="mb-4">
```
> 스펙 §6-1 "그룹 간 상단 여백을 한 단계 확대해 3단 타이포 위계가 스캔을 담당". 3단 위계는 유지: 그룹 eyebrow(라인 215 `text-xs font-bold text-muted uppercase`) → 서브그룹(라인 245 `text-[11px] text-faint`) → 항목. 정적 링크(홈/검색/가이드/소개, 라인 262-289)·푸터 법적 링크는 **변경 없음**(이미 아이콘 없음).

- [ ] **Step 1: 실패 테스트 작성** — `AppHeader.test.ts`에 describe 추가. 모바일 메뉴는 토글 후 렌더되므로 기존 모바일 테스트의 오픈 패턴을 재사용.

```ts
describe('모바일 메뉴 텍스트-온리', () => {
  it('모바일 메뉴에서 카테고리 아이콘(CategoryIcon/webp img)과 그룹 eyebrow 아이콘을 제거한다', async () => {
    const wrapper = mountHeader()
    await wrapper.find('button[aria-label="메뉴"]').trigger('click') // 기존 테스트의 오픈 방식에 맞출 것
    const menu = wrapper.find('[data-testid="mobile-menu"]')
    expect(menu.findAll('img[src*="/icons/category/"]').length).toBe(0)
    // 그룹/leaf 아이콘으로 쓰이던 glyph 부재 (grid_view 등)
    const glyphs = menu.findAll('.material-symbols-outlined').map((s) => s.text().trim())
    expect(glyphs).not.toContain('grid_view')
    expect(glyphs).not.toContain('apartment')
  })

  it('사이트링크 보호: 모바일 메뉴 링크 수가 40개로 유지된다', async () => {
    const wrapper = mountHeader()
    await wrapper.find('button[aria-label="메뉴"]').trigger('click')
    const menu = wrapper.find('[data-testid="mobile-menu"]')
    expect(menu.findAll('a').length).toBe(40)
  })
})
```
> 오픈 트리거·`data-testid` 셀렉터는 기존 모바일 테스트 관례를 그대로 따를 것(이 파일에 이미 mobile-menu 토글 테스트가 있음). 링크 40 = NAV_LINK_GROUPS 19 + CATEGORY_GROUPS 15 + 정적 4 + 푸터 2.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts -t "모바일 메뉴 텍스트-온리"`
Expected: FAIL.

- [ ] **Step 3: 위 4곳 아이콘 제거 + mb-4 여백 + min-h-[42px] 적용**

- [ ] **Step 4: 통과 + 회귀 확인** — 기존 모바일 테스트(카테고리 hrefs·그룹 헤더 텍스트·순서·44px 터치·ARIA) 유지. 깨지면 링크/텍스트/순서 커버리지 보존한 채 assert만 갱신.

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/common/AppHeader.vue frontend/tests/components/AppHeader.test.ts
git commit -m "feat(gnb): 모바일 메뉴 장식 아이콘 제거 + 3단 위계·그룹 여백 보강(터치 타깃 유지)"
```

---

## Task 4: 홈 히어로 코발트 패널 — 배경 교체 + 출처 배지 + 기준일 스탬프

**Files:**
- Modify: `frontend/pages/index.vue` (히어로 `<section>` 현재 라인 4-73, script preload 라인 331-336 + 스탬프 배선 추가)
- Test: `frontend/tests/pages/index.test.ts`

**Interfaces:**
- Consumes: 없음(기존 `dashboard` 데이터 재사용)
- Produces: `reSyncedAt`/`stampDate` computed, 코발트 패널 셸 — Task 5(스탯)가 같은 히어로를 이어서 편집. `newlyListedToday` computed는 유지(Task 5가 스탯으로 사용).

**A. 배경 제거.** 현재 라인 4-9:
```html
<section class="relative overflow-hidden px-4 sm:px-6 pb-8 pt-6 md:pt-14 md:pb-12">
  <!-- 배경 이미지 레이어 -->
  <div class="absolute inset-0 opacity-10 md:opacity-[0.08]">
    <img src="/images/hero-bg-light.webp" ... aria-hidden="true" ... />
  </div>
  <div class="absolute bottom-0 left-0 right-0 h-10 md:h-12 bg-background-light/80"></div>
```
→ 배경 `<div>`(img 레이어)와 fade `<div>` 모두 삭제. 스크립트 preload(라인 331-336 `useHead({ link: [{ rel: 'preload', href: '/images/hero-bg-light.webp', ... }] })`)도 삭제.

**B. 스탬프 배선.** `<script setup>` 상단 import 구역에 추가:
```ts
import { useSyncStatus } from '~/composables/useSyncStatus'
import { isSyncStale, formatDotDate, RE_STALE_DAYS } from '~/utils/syncFreshness'
```
데이터 computed 구역(기존 `stats`/`newlyListedToday` 근처)에 추가:
```ts
const RE_SYNC_KEYS = ['aptSale', 'aptRent', 'villaSale', 'villaRent', 'offitelSale', 'offitelRent'] as const
const { syncStatus } = useSyncStatus()
// 실거래 6개 테이블 중 가장 최근 동기화 시각(ISO 사전순 = 시간순)
const reSyncedAt = computed<string | null>(() => {
  const s = syncStatus.value
  if (!s) return null
  const dates = RE_SYNC_KEYS.map((k) => s[k]).filter((v): v is string => !!v)
  return dates.length ? [...dates].sort().at(-1) ?? null : null
})
// stale/null이면 날짜 생략(fail-open). "매일 자동 동기화" 라벨은 항상 노출.
const stampDate = computed<string | null>(() => {
  const iso = reSyncedAt.value
  return iso && !isSyncStale(iso, RE_STALE_DAYS) ? formatDotDate(iso) : null
})
```
> `useSyncStatus`는 `server:false` — SSR/첫 페인트에 `syncStatus=null` → `stampDate=null` → "매일 자동 동기화" 라벨만 SSR 노출, 날짜는 하이드레이션 후. noindex 로직 없음(홈).

**C. 패널 셸 + 배지/스탬프 + 헤드라인/서브 재색.** 히어로 `<section>` 전체를 아래로 교체(검색창은 기존 것을 그대로 이 패널 안에 유지 — Task 5의 스탯 자리는 주석으로 표시):
```html
<section class="px-4 sm:px-6 pt-4 md:pt-8 pb-8 md:pb-12">
  <div class="relative overflow-hidden bg-primary-press text-white -mx-4 sm:-mx-6 md:mx-0 px-4 sm:px-6 md:px-8 py-6 md:py-9 md:rounded-2xl">
    <!-- 출처 배지 + 기준일 스탬프 -->
    <div class="flex items-center gap-2 flex-wrap">
      <span class="hidden md:inline-flex items-center text-[11.5px] font-bold bg-white/[0.12] border border-white/20 px-2.5 py-1 rounded-full text-[#DCE6FD]">공공데이터포털</span>
      <span class="hidden md:inline-flex items-center text-[11.5px] font-bold bg-white/[0.12] border border-white/20 px-2.5 py-1 rounded-full text-[#DCE6FD]">국토교통부 실거래가</span>
      <span class="md:hidden inline-flex items-center text-[10px] font-bold bg-white/[0.12] border border-white/20 px-2 py-0.5 rounded-full text-[#DCE6FD]">공공데이터 기반</span>
      <span class="ml-auto text-[10.5px] md:text-xs font-semibold text-[#B9C9F8]">
        <template v-if="stampDate">
          <b class="text-white font-extrabold tabular-nums">{{ stampDate }} 기준</b><span class="hidden md:inline"> · 매일 자동 동기화</span>
        </template>
        <template v-else>매일 자동 동기화</template>
      </span>
    </div>

    <h1 class="sr-only">부동산 실거래가·생활시설 통합 검색 - 일상킷</h1>
    <div class="tracking-tight font-bold leading-[1.15] mt-4">
      <div class="text-white text-[38px] md:text-[62px] md:font-black">우리 동네 정보,</div>
      <div class="text-[38px] md:text-[62px] md:font-black">
        <span class="md:hidden text-[#9DB4F5]">한번에.</span>
        <span class="hidden md:inline"><span class="text-[#9DB4F5]">일상킷에서</span><span class="text-white"> 한번에.</span></span>
      </div>
    </div>
    <p class="md:hidden text-[#C9D6FA] text-[15px] mt-1">부동산 · 청약 · 생활시설을 한 곳에서</p>
    <p class="hidden md:block text-[#C9D6FA] text-lg mt-1">부동산 실거래가, 청약 정보, 생활시설을 한 곳에서.</p>

    <!-- 검색: 기존 마크업(라인 42-73) 그대로 이 위치에 유지 (input aria-label/placeholder/SearchAutocomplete 배선 불변). 컨테이너에 mt-4 md:mt-5 추가 -->
    <div class="w-full md:max-w-[580px] mt-4 md:mt-5">
      <label class="relative block">
        <!-- ...기존 검색 input 블록 그대로... -->
      </label>
    </div>

    <!-- 스탯 4칸: Task 5에서 이 자리에 삽입 -->
  </div>
</section>
```
> 모바일: `-mx-4 sm:-mx-6`로 풀블리드, `rounded` 없음. 데스크톱: `md:mx-0 md:rounded-2xl`로 라운드 카드. 배지 스타일 `bg-white/[0.12] border-white/20 rounded-full text-[#DCE6FD]`(=목업 `--brand-tint-2`). 헤드라인/서브 **카피 불변**, 색만 코발트용. 스탬프 위치 `ml-auto`(배지 행 우측). 기존 "오늘 신규 등록" pill(현재 라인 18-24)은 이 교체로 제거됨 — 데이터(`newlyListedToday`)는 Task 5 스탯으로 이동.

- [ ] **Step 1: 실패 테스트 작성** — `frontend/tests/pages/index.test.ts`의 "Hero image optimization" describe(현재 라인 235-277)를 아래로 **교체**

```ts
describe('히어로 코발트 패널', () => {
  it('흐릿한 배경 사진(hero-bg webp)을 제거한다', () => {
    const wrapper = mountIndex() // 이 파일 기존 마운트 헬퍼
    expect(wrapper.findAll('img[src*="hero-bg"]').length).toBe(0)
  })
  it('단색 코발트 패널(bg-primary-press)로 렌더한다', () => {
    const wrapper = mountIndex()
    expect(wrapper.find('.bg-primary-press').exists()).toBe(true)
  })
  it('출처 배지와 "매일 자동 동기화" 스탬프 라벨을 SSR 텍스트로 노출한다', () => {
    const wrapper = mountIndex()
    const text = wrapper.text()
    expect(text).toContain('국토교통부 실거래가')
    expect(text).toContain('매일 자동 동기화')
  })
  it('단일 h1을 유지한다', () => {
    const wrapper = mountIndex()
    expect(wrapper.findAll('h1').length).toBe(1)
    expect(wrapper.find('h1').text()).toBe('부동산 실거래가·생활시설 통합 검색 - 일상킷')
  })
})
```
> `mountIndex` = 이 파일이 이미 쓰는 마운트 방식. `useSyncStatus`는 테스트 환경에서 `useAsyncData` 전역 mock으로 `data=null` → `stampDate=null` → "매일 자동 동기화"만 노출(결정적). `[city]/index.vue`가 동일 컴포저블로 통과 중이므로 하네스 지원됨.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/index.test.ts -t "코발트 패널"`
Expected: FAIL.

- [ ] **Step 3: A(배경 제거)·B(스탬프 배선)·C(패널 셸) 적용**

- [ ] **Step 4: 통과 + 회귀 확인** — 새 케이스 + 기존 index.test.ts(헤드라인 텍스트·검색 input·섹션·광고 슬롯 수·인기 지역·검색 네비게이션)·`indexHeroAutocomplete.test.ts`(aria-label 검색) 전부 green.

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/index.test.ts tests/pages/indexHeroAutocomplete.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/index.vue frontend/tests/pages/index.test.ts
git commit -m "feat(home): 히어로 코발트 패널 + 출처 배지 + 기준일 스탬프(fail-open, 배경사진 제거)"
```

---

## Task 5: 홈 히어로 4칸 스탯 — "오늘 업데이트" 추가

**Files:**
- Modify: `frontend/pages/index.vue` (히어로 스탯 블록, Task 4 후 패널 내 "스탯 4칸" 자리)
- Test: `frontend/tests/pages/index.test.ts`

**Interfaces:**
- Consumes: Task 4 후의 히어로 패널, 기존 `buildingCountKor`/`stats.subscriptionActiveCount`/`facilityCountKor`/`newlyListedToday` computed
- Produces: 히어로 완성(헤더/GNB + 히어로 전부 완료)

**스탯 블록.** Task 4 패널의 "스탯 4칸" 주석 자리에 삽입:
```html
    <div class="mt-5 md:mt-6 border-t border-white/[0.16] pt-4">
      <div class="grid grid-cols-2 md:grid-cols-4 gap-y-4 md:gap-y-0 md:divide-x md:divide-white/[0.14]">
        <div class="flex flex-col md:px-4 md:first:pl-0">
          <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">{{ buildingCountKor }}만</strong>
          <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">실거래 부동산</span>
        </div>
        <div class="flex flex-col md:px-4">
          <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">{{ stats.subscriptionActiveCount }}건</strong>
          <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">진행중 청약</span>
        </div>
        <div class="flex flex-col md:px-4">
          <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">{{ facilityCountKor }}만</strong>
          <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">등록 시설</span>
        </div>
        <div class="flex flex-col md:px-4">
          <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">
            {{ newlyListedToday.toLocaleString('ko-KR') }}<span v-if="newlyListedToday > 0" class="text-[10px] md:text-xs font-bold text-[#7EE3B8] ml-1 align-middle"><span class="md:hidden">오늘</span><span class="hidden md:inline">오늘 신규</span></span>
          </strong>
          <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">오늘 업데이트</span>
        </div>
      </div>
    </div>
```
> 모바일 `grid-cols-2`(2×2)·데스크톱 `grid-cols-4`+`divide-x`(세로 구분). 값은 전부 `tabular-nums`. 4번째 셀 = 기존 `newlyListedToday` 재사용, 초록 "오늘 신규"(데스크톱)/"오늘"(모바일) 배지는 `> 0`일 때만(0이면 숫자만, 셀은 항상 렌더). 라벨 `실거래 부동산 / 진행중 청약 / 등록 시설 / 오늘 업데이트`.

- [ ] **Step 1: 실패 테스트 작성** — `index.test.ts`에 describe 추가

```ts
describe('히어로 4칸 스탯', () => {
  it('4개 스탯 라벨을 렌더한다', () => {
    const wrapper = mountIndex()
    const t = wrapper.text()
    for (const label of ['실거래 부동산', '진행중 청약', '등록 시설', '오늘 업데이트']) {
      expect(t).toContain(label)
    }
  })
  it('오늘 업데이트 수치를 렌더한다(newlyListedToday 재사용)', () => {
    const wrapper = mountIndex() // 기존 mock dashboard의 newlyListedToday 값 기준
    // 값 존재(구체 수치는 이 파일의 mock 픽스처에 맞춰 assert)
    expect(wrapper.text()).toContain('오늘 업데이트')
  })
  it('스탯 값에 tabular-nums를 적용한다', () => {
    const wrapper = mountIndex()
    expect(wrapper.findAll('strong.tabular-nums').length).toBeGreaterThanOrEqual(4)
  })
})
```
> `newlyListedToday=0` 제로 케이스 배지 부재 assert가 가능하면(mock 조정) 추가. 기존 mock에서 값이 양수면 "오늘 신규"/"오늘" 배지 존재도 assert 가능.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/index.test.ts -t "4칸 스탯"`
Expected: FAIL (4번째 스탯 미존재).

- [ ] **Step 3: 스탯 블록 삽입**

- [ ] **Step 4: 통과 + 회귀 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/pages/index.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/index.vue frontend/tests/pages/index.test.ts
git commit -m "feat(home): 히어로 스탯 4칸화 + '오늘 업데이트' 신선도 지표 추가(2×2 모바일)"
```

---

## Task 6: 전체 검증 + PR

**Files:** 없음(검증·PR)

- [ ] **Step 1: 전체 lint + vitest**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && node -v \
  && npm run lint 2>&1 | tail -3 \
  && npx vitest run 2>&1 | tail -8
```
Expected: lint 0 errors, 전체 테스트 green(기존 flaky SearchAutocomplete/localStorage만 재실행). 실패 시 수정 후 재실행.

- [ ] **Step 2: whole-branch 리뷰 (opus)** — `scripts/review-package $(git merge-base develop HEAD) HEAD`로 패키지 생성 후 최상위 모델 리뷰 디스패치. 리뷰 렌즈(Global Constraints 요약):
  - 링크 수 불변(데스크톱 36+로고, 모바일 40)·v-show 유지·데이터모델 `.icon` 미삭제
  - 유지 아이콘(expand_more/arrow_back/menu/HeaderSearch) 온전
  - 스탬프 fail-open(server:false·stale/null 날짜 생략·"매일 자동 동기화" SSR·noindex 미게이팅)
  - 단일 h1·H1 카피 불변·기존 헤드라인/서브 카피 verbatim·검색 aria-label/placeholder/배선 불변
  - 코발트 `bg-primary-press` 단색(그라데이션 없음)·tabular-nums 스탯
  - 4번째 스탯 제로 케이스(배지 숨김·셀 유지)

- [ ] **Step 3: Minor fix wave** — Critical/Important는 단일 fix 서브에이전트로 일괄 수정 후 재검증. Minor는 ledger 기록.

- [ ] **Step 4: PR 오픈 → develop**

```bash
git push -u origin feat/trust-hero-header
gh pr create --base develop --title "신뢰 디자인 격상 PR ⑨ — 헤더/GNB 텍스트-온리 + 홈 히어로 코발트 패널" --body "..."
```
CI(test-frontend·test-backend·lighthouse) green 실측 후 사용자에게 머지 확인.

**승격 후 라이브 검증 체크리스트(main 승격 시):** SSR HTML 단일 h1·SSR 링크 수(36/40)·SourceStamp/스탬프 라벨 텍스트 존재·모바일 390px 가로 넘침 없음·nitro route cache(`/`) 퍼지 후 히어로 코발트 확인.

---

## Self-Review (작성자 체크)

- **스펙 §6-1 커버:** 마이크로 라벨(T1)·탑레벨+유틸 아이콘 제거(T2)·메가패널 아이콘+eyebrow(T2)·모바일 텍스트-온리+여백+터치(T3)·caret 유지(T2)·v-show/링크 불변(T2/T3 테스트)·icon_names 미변경(Global Constraints, recon 근거). ✅
- **스펙 §6-2 커버:** 배경 제거(T4)·단색 코발트(T4)·배지 2/1(T4)·스탬프 stale 가드(T4)·4번째 스탯(T5)·모바일 2×2(T5)·단일 h1/SSR 텍스트(T4). ✅
- **범위 외 확인:** §6-5 상세 스펙 스트립·§6-6 로고 코발트는 이 PR 제외(로고=PR ⑩). ✅
- **타입 일관성:** `reSyncedAt`/`stampDate`/`RE_SYNC_KEYS`/`syncStatus` = `[city]/index.vue` 검증된 패턴과 동일 시그니처. `formatDotDate`/`isSyncStale`/`RE_STALE_DAYS` = `syncFreshness.ts` 실제 export. ✅
- **플레이스홀더 스캔:** 각 스텝에 실제 마크업/테스트/명령 포함. 마운트 헬퍼는 "기존 파일 관례를 따르라"로 위임(파일별 상이). ✅
