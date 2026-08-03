# 헤더 네비게이션 통합 — 생활정보 메가메뉴 + 1200px 컨테이너 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데스크톱 헤더의 시설 4개 그룹 드롭다운을 하나의 "생활정보" 4단 메가메뉴로 통합하고, 헤더 내용을 본문과 같은 1200px 컨테이너로 정렬한다.

**Architecture:** `types/facility.ts`에 `NAV_LINK_GROUPS`(부동산·청약·임대)를 분리 추가하고 `NAV_GROUPS`는 동일 형태로 재구성(하위호환). `AppHeader.vue`는 `<header>`를 풀폭 유지하되 내부만 `max-w-[1200px]` 컨테이너로 감싸고, `NAV_LINK_GROUPS`는 개별 드롭다운, `CATEGORY_GROUPS`는 하나의 생활정보 메가메뉴로 렌더한다. 기존 `activeDropdown` 상태·호버/포커스/Escape 로직을 그대로 재사용한다.

**Tech Stack:** Nuxt 3 / Vue 3 SFC, TypeScript, TailwindCSS, Vitest (happy-dom) + @vue/test-utils.

---

## 전제 / 준비

- **Node 20 필수**: 모든 npm 명령 전 `nvm use 20`. lock 파일을 삭제/재생성하지 말 것(기존 유지).
- 작업 브랜치: `feature/header-nav-megamenu` (이미 생성됨, develop 기준).
- 테스트 실행 위치: `cd frontend`.
- 단일 테스트: `npx vitest run tests/types/navGroups.test.ts` / `npx vitest run tests/components/AppHeader.test.ts`.

## File Structure

| 파일 | 책임 | 변경 |
|------|------|------|
| `frontend/types/facility.ts` | 네비 그룹 데이터 정의 | `NAV_LINK_GROUPS` 추가, `NAV_GROUPS` 재구성 |
| `frontend/tests/types/navGroups.test.ts` | 네비 데이터 단위 테스트 | `NAV_LINK_GROUPS` 테스트 추가 |
| `frontend/components/common/AppHeader.vue` | 전역 헤더 (데스크톱 nav + 모바일 메뉴) | 컨테이너 정렬 + 생활정보 메가메뉴 + 모바일 통합 섹션 |
| `frontend/tests/components/AppHeader.test.ts` | 헤더 컴포넌트 테스트 | 그룹 수 6→3, 메가메뉴/모바일 통합 섹션 검증 |

---

## Task 1: 데이터 모델 — `NAV_LINK_GROUPS` 분리

**Files:**
- Modify: `frontend/types/facility.ts:536-571`
- Test: `frontend/tests/types/navGroups.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/tests/types/navGroups.test.ts` 상단 import에 `NAV_LINK_GROUPS`를 추가한다:

```ts
import {
  NAV_GROUPS,
  NAV_LINK_GROUPS,
  CATEGORY_GROUPS,
  isLinkGroup,
  type NavGroup,
  type LinkGroup,
} from '../../types/facility'
```

파일 맨 끝(마지막 `describe` 다음)에 새 `describe` 블록을 추가한다:

```ts
describe('NAV_LINK_GROUPS', () => {
  it('링크 그룹 2개(부동산, 청약·임대)만 포함한다', () => {
    expect(NAV_LINK_GROUPS).toHaveLength(2)
    expect(NAV_LINK_GROUPS.every((g) => isLinkGroup(g))).toBe(true)
  })

  it('첫째는 부동산, 둘째는 청약·임대여야 한다', () => {
    expect(NAV_LINK_GROUPS[0].title).toBe('부동산')
    expect(NAV_LINK_GROUPS[1].title).toBe('청약·임대')
  })

  it('NAV_GROUPS의 앞 2개가 NAV_LINK_GROUPS와 동일해야 한다', () => {
    expect(NAV_GROUPS.slice(0, 2)).toEqual([...NAV_LINK_GROUPS])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && nvm use 20 && npx vitest run tests/types/navGroups.test.ts`
Expected: FAIL — `NAV_LINK_GROUPS` is undefined / has no export.

- [ ] **Step 3: `NAV_LINK_GROUPS` 구현**

`frontend/types/facility.ts`에서 현재 `NAV_GROUPS` 정의(536–571행)를 아래로 **통째 교체**한다. 부동산·청약·임대 객체 리터럴을 `NAV_LINK_GROUPS`로 빼내고, `NAV_GROUPS`는 spread로 재구성한다(형태·순서 동일).

```ts
// 개별 드롭다운으로 남는 링크 그룹 (부동산, 청약·임대)
export const NAV_LINK_GROUPS: readonly LinkGroup[] = [
  {
    title: '부동산',
    icon: 'apartment',
    links: [
      { to: '/real-estate', label: '부동산 전체', icon: 'apartment', iconImg: 'apt' },
      { to: '/real-estate/apt-sale', label: '아파트', icon: 'apartment', iconImg: 'apt' },
      { to: '/real-estate/villa-sale', label: '빌라', icon: 'holiday_village', iconImg: 'villa' },
      { to: '/real-estate/offitel-sale', label: '오피스텔', icon: 'business', iconImg: 'offitel' },
    ],
  },
  {
    title: '청약·임대',
    icon: 'calendar_month',
    // 다른 dropdown(부동산·시설)이 webp 컬러 일러스트 아이콘을 쓰므로 톤을 맞추기 위해
    // 청약·임대 도 webp 아이콘 사용. 같은 임대 sub-type 끼리 rent.webp 가 반복되는 건
    // 섹션 헤딩 텍스트가 충분히 구분해 줌.
    links: [
      // 청약홈 — 모든 청약(분양+임대) 최상위 hub. 섹션 없음(헤더 역할).
      { to: '/subscription', label: '청약홈', icon: 'calendar_month', iconImg: 'subscription' },
      // 분양 — 청약홈 분양 공고 sub-type. 9 링크 모두 다른 webp 로 시각 차별화.
      { to: '/subscription/sale/apt', label: '아파트 분양', icon: 'apartment', iconImg: 'apt', section: '분양' },
      { to: '/subscription/sale/offitel', label: '오피스텔·도시형', icon: 'domain', iconImg: 'offitel', section: '분양' },
      { to: '/subscription/sale/remaining', label: '무순위·잔여세대', icon: 'home_work', iconImg: 'sale', section: '분양' },
      { to: '/subscription/sale/optional', label: '임의공급', icon: 'redeem', iconImg: 'kiosk', section: '분양' },
      // 임대 청약 — 청약통장 사용
      { to: '/subscription/rent/public', label: '공공임대 청약', icon: 'home', iconImg: 'rent', section: '임대 청약' },
      { to: '/subscription/rent/private', label: '공공지원 민간임대', icon: 'bungalow', iconImg: 'villa', section: '임대 청약' },
      // 공공임대 입주 — 자격 기반 수시 신청 (LH/SH 등)
      { to: '/public-rental/announcements', label: '모집공고', icon: 'campaign', iconImg: 'subscription', section: '공공임대 입주' },
      { to: '/public-rental/buy-lease', label: '매입임대', icon: 'shopping_cart', iconImg: 'store', section: '공공임대 입주' },
      { to: '/public-rental/charter', label: '전세임대', icon: 'savings', iconImg: 'land', section: '공공임대 입주' },
    ],
  },
] as const

export const NAV_GROUPS: readonly NavGroup[] = [
  ...NAV_LINK_GROUPS,
  ...CATEGORY_GROUPS,
] as const
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/types/navGroups.test.ts`
Expected: PASS (신규 `NAV_LINK_GROUPS` 3개 + 기존 `NAV_GROUPS`/`CATEGORY_GROUPS` 테스트 전부).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/types/facility.ts frontend/tests/types/navGroups.test.ts
git commit -m "refactor(nav): NAV_LINK_GROUPS 분리 (부동산·청약·임대)"
```

---

## Task 2: AppHeader — 1200px 컨테이너 + 생활정보 메가메뉴 + 모바일 통합 섹션

**Files:**
- Modify: `frontend/components/common/AppHeader.vue` (template 전체 + script import 1줄)
- Test: `frontend/tests/components/AppHeader.test.ts`

### Step 1: 테스트 먼저 수정 (실패 상태로)

- [ ] **Step 1: `AppHeader.test.ts` 데스크톱/모바일 테스트 갱신**

(1) 기존 "should display group titles" 테스트(52–59행)를 아래로 **교체**한다:

```ts
    it('should display top-level nav buttons (부동산/청약·임대/생활정보)', () => {
      const nav = wrapper.find('nav.hidden.md\\:flex')
      const text = nav.text()
      expect(text).toContain('부동산')
      expect(text).toContain('청약·임대')
      expect(text).toContain('생활정보')
    })
```

(2) 기존 "should show dropdown with category links on hover" 테스트(69–85행)를 아래로 **교체**한다:

```ts
    it('생활정보 메가메뉴는 4개 그룹 열과 시설 카테고리 링크를 보여준다', async () => {
      const groupButtons = wrapper.findAll('nav.hidden.md\\:flex .relative')
      // 부동산=0, 청약·임대=1, 생활정보=2 (총 3개)
      expect(groupButtons.length).toBe(3)

      await groupButtons[2].trigger('mouseenter')

      const mega = wrapper.find('[data-testid="nav-mega-menu"]')
      expect(mega.exists()).toBe(true)

      const text = mega.text()
      expect(text).toContain('교육/육아')
      expect(text).toContain('건강/안전')
      expect(text).toContain('생활/편의')
      expect(text).toContain('환경/생활')

      const hrefs = mega.findAll('a').map((l) => l.attributes('href'))
      expect(hrefs).toContain('/school')    // 교육/육아
      expect(hrefs).toContain('/hospital')  // 건강/안전
      expect(hrefs).toContain('/park')      // 생활/편의
      expect(hrefs).toContain('/clothes')   // 환경/생활
    })
```

(3) "should show 4 real estate links" / "청약·임대 드롭다운" 테스트(87–108행)는 **그대로 둔다** (index 0, 1 불변).

(4) Mobile Menu describe 안에 새 테스트를 추가한다(기존 "should display group headers in mobile menu" 바로 아래):

```ts
    it('모바일 메뉴에 생활정보 통합 섹션 헤더가 있어야 한다', async () => {
      const menuButton = wrapper.find('button[aria-label="메뉴"]')
      await menuButton.trigger('click')

      const mobileMenu = wrapper.find('[data-testid="mobile-menu"]')
      expect(mobileMenu.text()).toContain('생활정보')
    })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && nvm use 20 && npx vitest run tests/components/AppHeader.test.ts`
Expected: FAIL — `.relative` 개수가 6(현재)이라 `toBe(3)` 실패, `nav-mega-menu`/생활정보 미존재.

### Step 3: AppHeader.vue 구현

- [ ] **Step 3: `AppHeader.vue` 전체 교체**

`frontend/components/common/AppHeader.vue` 파일 전체를 아래 내용으로 **교체**한다. (`<script>`는 import 1줄만 바뀌고 나머지 로직은 동일, `<style>`은 동일.)

```vue
<template>
  <header
    :class="[
      'sticky top-0 z-50 px-4 md:px-6 h-14 md:h-16',
      'bg-background-light',
      'border-b border-transparent',
      'transition-colors duration-300',
      props.transparent ? 'bg-transparent border-transparent' : ''
    ]"
  >
    <div class="mx-auto flex h-full w-full max-w-[1200px] items-center">
      <!-- Left: Back Button (if enabled) or Logo -->
      <div class="flex items-center gap-2">
        <button
          v-if="props.showBackButton"
          class="flex size-11 items-center justify-center rounded-full hover:bg-black/5 transition-colors text-slate-900"
          aria-label="뒤로가기"
          @click="handleBack"
        >
          <span class="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>

        <HardLink v-if="!props.showBackButton" to="/" class="flex items-center">
          <img src="/icons/logo.webp" alt="일상킷" class="h-9 md:h-12 w-auto shrink-0" width="91" height="36" />
        </HardLink>
      </div>

      <!-- Center/Right: Desktop Navigation (single nav, fills remaining width) -->
      <nav class="hidden md:flex items-center flex-1 gap-1 ml-4">
        <!-- 개별 드롭다운: NAV_LINK_GROUPS (부동산, 청약·임대) -->
        <div
          v-for="group in NAV_LINK_GROUPS"
          :key="group.title"
          class="relative"
          @mouseenter="openDropdown(group.title)"
          @mouseleave="scheduleCloseDropdown"
          @focusout="handleDropdownFocusout($event, group.title)"
        >
          <button
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
            aria-haspopup="true"
            :aria-expanded="activeDropdown === group.title"
            @click="toggleDropdown(group.title)"
            @keydown.enter.prevent="openDropdown(group.title)"
            @keydown.space.prevent="openDropdown(group.title)"
          >
            <span class="material-symbols-outlined text-[18px]">{{ group.icon }}</span>
            {{ group.title }}
            <span class="material-symbols-outlined text-[16px] transition-transform" :class="{ 'rotate-180': activeDropdown === group.title }">expand_more</span>
          </button>
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="activeDropdown === group.title"
              class="absolute top-full left-0 mt-1 min-w-[180px] bg-white rounded-xl shadow-lg border border-slate-200 p-2 z-50"
              @mouseenter="cancelCloseDropdown"
              @mouseleave="scheduleCloseDropdown"
            >
              <template v-for="(link, idx) in group.links" :key="link.to">
                <!-- 섹션 시작점에 헤딩 표시 -->
                <template v-if="link.section && (idx === 0 || link.section !== group.links[idx - 1].section)">
                  <div
                    v-if="idx > 0"
                    data-testid="nav-section-divider"
                    class="h-px bg-slate-100 my-1 mx-2"
                  />
                  <div
                    data-testid="nav-section-heading"
                    class="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
                  >
                    {{ link.section }}
                  </div>
                </template>
                <HardLink
                  :to="link.to"
                  class="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-50 text-[15px] text-slate-700 transition-colors"
                  @click="closeDropdown"
                >
                  <img v-if="link.iconImg" :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-5 h-5" width="20" height="20" />
                  <span v-else class="material-symbols-outlined text-[18px] text-slate-400">{{ link.icon }}</span>
                  {{ link.label }}
                </HardLink>
              </template>
            </div>
          </Transition>
        </div>

        <!-- 생활정보: 시설 4개 그룹 통합 메가메뉴 -->
        <div
          class="relative"
          @mouseenter="openDropdown('생활정보')"
          @mouseleave="scheduleCloseDropdown"
          @focusout="handleDropdownFocusout($event, '생활정보')"
        >
          <button
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
            aria-haspopup="true"
            :aria-expanded="activeDropdown === '생활정보'"
            @click="toggleDropdown('생활정보')"
            @keydown.enter.prevent="openDropdown('생활정보')"
            @keydown.space.prevent="openDropdown('생활정보')"
          >
            <span class="material-symbols-outlined text-[18px]">grid_view</span>
            생활정보
            <span class="material-symbols-outlined text-[16px] transition-transform" :class="{ 'rotate-180': activeDropdown === '생활정보' }">expand_more</span>
          </button>
          <Transition
            enter-active-class="transition duration-150 ease-out"
            enter-from-class="opacity-0 scale-95 -translate-y-1"
            enter-to-class="opacity-100 scale-100 translate-y-0"
            leave-active-class="transition duration-100 ease-in"
            leave-from-class="opacity-100 scale-100 translate-y-0"
            leave-to-class="opacity-0 scale-95 -translate-y-1"
          >
            <div
              v-if="activeDropdown === '생활정보'"
              data-testid="nav-mega-menu"
              class="absolute top-full left-0 mt-1 grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-1 w-[640px] max-w-[calc(100vw-1.5rem)] bg-white rounded-xl shadow-lg border border-slate-200 p-4 z-50"
              @mouseenter="cancelCloseDropdown"
              @mouseleave="scheduleCloseDropdown"
            >
              <div v-for="group in CATEGORY_GROUPS" :key="group.title">
                <div class="flex items-center gap-1.5 px-2 pb-1.5 mb-1 border-b border-slate-100 text-[13px] font-bold text-slate-700">
                  <span class="material-symbols-outlined text-[18px] text-primary">{{ group.icon }}</span>
                  {{ group.title }}
                </div>
                <HardLink
                  v-for="catId in group.categories"
                  :key="catId"
                  :to="`/${catId}`"
                  class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-50 text-[15px] text-slate-700 transition-colors"
                  @click="closeDropdown"
                >
                  <CategoryIcon :category-id="catId" size="sm" />
                  {{ CATEGORY_META[catId].shortLabel }}
                </HardLink>
              </div>
            </div>
          </Transition>
        </div>

        <!-- Utility Links (오른쪽으로 밀기) -->
        <div class="ml-auto flex items-center gap-1">
          <div class="h-5 w-px bg-slate-200 mx-1"></div>
          <HardLink
            to="/guide"
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">menu_book</span>
            가이드
          </HardLink>
          <HardLink
            to="/search"
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">search</span>
            검색
          </HardLink>
          <HardLink
            to="/about"
            class="flex items-center gap-1.5 px-3 py-2 text-base font-medium text-slate-600 hover:text-primary rounded-lg hover:bg-slate-50 transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">info</span>
            소개
          </HardLink>
        </div>
      </nav>

      <!-- Mobile Menu Button -->
      <button
        class="md:hidden ml-auto flex size-11 cursor-pointer items-center justify-center overflow-hidden rounded-full hover:bg-black/5 transition-colors text-slate-900"
        aria-label="메뉴"
        :aria-expanded="isMobileMenuOpen"
        @click="toggleMobileMenu($event)"
      >
        <span class="material-symbols-outlined text-[28px]">menu</span>
      </button>
    </div>
  </header>

  <!-- Mobile Menu -->
  <Transition
    enter-active-class="transition-all duration-300 ease-out"
    enter-from-class="opacity-0 -translate-y-2"
    enter-to-class="opacity-100 translate-y-0"
    leave-active-class="transition-all duration-200 ease-in"
    leave-from-class="opacity-100 translate-y-0"
    leave-to-class="opacity-0 -translate-y-2"
  >
    <div
      v-if="isMobileMenuOpen"
      ref="mobileMenuRef"
      data-testid="mobile-menu"
      role="navigation"
      aria-label="모바일 메뉴"
      class="md:hidden fixed top-[56px] left-0 right-0 bottom-0 z-40 bg-background-light border-b border-slate-200 shadow-lg overflow-y-auto"
      @keydown.tab="handleMobileMenuTab"
    >
      <nav class="flex flex-col p-4 gap-1">
        <!-- 부동산 / 청약·임대 (link groups) -->
        <div v-for="group in NAV_LINK_GROUPS" :key="group.title" class="mb-1">
          <div class="px-4 py-2 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span class="material-symbols-outlined text-[16px] text-primary">{{ group.icon }}</span>
            {{ group.title }}
          </div>
          <template v-for="(link, idx) in group.links" :key="link.to">
            <div
              v-if="link.section && (idx === 0 || link.section !== group.links[idx - 1].section)"
              class="px-6 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400"
            >
              {{ link.section }}
            </div>
            <HardLink
              :to="link.to"
              class="pl-6 pr-4 py-2.5 text-slate-900 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
              @click="closeMobileMenu"
            >
              <img v-if="link.iconImg" :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-5 h-5" width="20" height="20" />
              <span v-else class="material-symbols-outlined text-[18px] text-slate-400">{{ link.icon }}</span>
              {{ link.label }}
            </HardLink>
          </template>
        </div>

        <!-- 생활정보 통합 섹션 (시설 4개 그룹) -->
        <div class="mb-1">
          <div class="px-4 py-2 flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span class="material-symbols-outlined text-[16px] text-primary">grid_view</span>
            생활정보
          </div>
          <div v-for="group in CATEGORY_GROUPS" :key="group.title">
            <div class="px-6 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              {{ group.title }}
            </div>
            <HardLink
              v-for="catId in group.categories"
              :key="catId"
              :to="`/${catId}`"
              class="pl-6 pr-4 py-2.5 text-slate-900 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium flex items-center gap-3"
              @click="closeMobileMenu"
            >
              <CategoryIcon :category-id="catId" size="sm" />
              {{ CATEGORY_META[catId].shortLabel }}
            </HardLink>
          </div>
        </div>

        <div class="h-px bg-slate-200 my-2"></div>
        <HardLink
          to="/"
          class="px-4 py-3 text-slate-900 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          홈
        </HardLink>
        <HardLink
          to="/search"
          class="px-4 py-3 text-slate-900 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          검색
        </HardLink>
        <HardLink
          to="/guide"
          class="px-4 py-3 text-slate-900 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          가이드
        </HardLink>
        <HardLink
          to="/about"
          class="px-4 py-3 text-slate-900 hover:bg-primary/10 hover:text-primary transition-colors rounded-lg font-medium"
          @click="closeMobileMenu"
        >
          소개
        </HardLink>
        <div class="h-px bg-slate-200 my-2"></div>
        <div class="flex flex-wrap gap-x-4 gap-y-1 px-4 py-2">
          <HardLink
            to="/privacy"
            class="text-xs text-slate-500 hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            개인정보처리방침
          </HardLink>
          <HardLink
            to="/terms"
            class="text-xs text-slate-500 hover:text-primary transition-colors"
            @click="closeMobileMenu"
          >
            이용약관
          </HardLink>
        </div>
      </nav>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { CATEGORY_META, NAV_LINK_GROUPS, CATEGORY_GROUPS } from '~/types/facility'
import CategoryIcon from '~/components/common/CategoryIcon.vue'

interface Props {
  transparent?: boolean
  showBackButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  transparent: false,
  showBackButton: false,
})

const emit = defineEmits<{
  back: []
}>()

const isMobileMenuOpen = ref(false)
const activeDropdown = ref<string | null>(null)
const mobileMenuRef = ref<HTMLElement | null>(null)
const mobileMenuTriggerRef = ref<HTMLElement | null>(null)
let dropdownTimer: ReturnType<typeof setTimeout> | null = null

const toggleMobileMenu = (event?: Event) => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
  if (event) {
    mobileMenuTriggerRef.value = event.currentTarget as HTMLElement
  }
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}

// Focus trap for mobile menu
watch(isMobileMenuOpen, async (isOpen) => {
  if (!import.meta.client) return
  if (isOpen) {
    document.body.setAttribute('aria-hidden', 'true')
    await nextTick()
    const firstFocusable = mobileMenuRef.value?.querySelector<HTMLElement>('a, button')
    firstFocusable?.focus()
  } else {
    document.body.removeAttribute('aria-hidden')
    mobileMenuTriggerRef.value?.focus()
  }
})

const handleMobileMenuTab = (event: KeyboardEvent) => {
  if (!mobileMenuRef.value) return
  const focusables = mobileMenuRef.value.querySelectorAll<HTMLElement>('a, button, input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (focusables.length === 0) return
  const first = focusables[0]
  const last = focusables[focusables.length - 1]
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

const toggleDropdown = (title: string) => {
  if (activeDropdown.value === title) {
    closeDropdown()
  } else {
    openDropdown(title)
  }
}

const handleDropdownFocusout = (event: FocusEvent, title: string) => {
  const container = (event.currentTarget as HTMLElement)
  if (!container.contains(event.relatedTarget as Node)) {
    if (activeDropdown.value === title) {
      activeDropdown.value = null
    }
  }
}

const openDropdown = (title: string) => {
  cancelCloseDropdown()
  activeDropdown.value = title
}

const scheduleCloseDropdown = () => {
  dropdownTimer = setTimeout(() => {
    activeDropdown.value = null
  }, 150)
}

const cancelCloseDropdown = () => {
  if (dropdownTimer) {
    clearTimeout(dropdownTimer)
    dropdownTimer = null
  }
}

const closeDropdown = () => {
  cancelCloseDropdown()
  activeDropdown.value = null
}

const handleBack = () => {
  emit('back')
}

// Escape 키로 모바일 메뉴/드롭다운 닫기
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    if (activeDropdown.value) {
      closeDropdown()
    } else if (isMobileMenuOpen.value) {
      closeMobileMenu()
    }
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  cancelCloseDropdown()
})
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
```

- [ ] **Step 4: 컴포넌트 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/AppHeader.test.ts`
Expected: PASS (데스크톱 3그룹/메가메뉴, 모바일 통합 섹션, 부동산/청약·임대 index 0·1, 유틸 링크 등 전부).

- [ ] **Step 5: 전체 프론트엔드 테스트 + 린트**

Run: `cd frontend && npx vitest run && npm run lint`
Expected: 전체 PASS, lint 에러 없음. (실패 시: import 누락/오타·`grid-cols` 클래스 확인.)

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/common/AppHeader.vue frontend/tests/components/AppHeader.test.ts
git commit -m "feat(nav): 생활정보 4단 메가메뉴 통합 + 헤더 1200px 컨테이너"
```

---

## Task 3: 최종 검증 + PR

**Files:** 없음 (검증/배포만)

- [ ] **Step 1: 빌드 확인 (SSR 안전성)**

Run: `cd frontend && nvm use 20 && npm run build`
Expected: nuxt build 성공 (타입 에러/미사용 import 없음).

- [ ] **Step 2: 수동 확인 (선택, dev 서버)**

Run: `cd frontend && npm run dev` 후 브라우저 확인
- 데스크톱(≥1024px): 헤더 로고·메뉴가 본문 1200px와 정렬, 양옆 여백. `생활정보` 호버 시 4단 메가메뉴.
- 모바일: 햄버거 → `생활정보` 통합 섹션 아래 4개 하위그룹.
- 1024~768px: 메가 패널이 우측으로 넘치지 않고 2열로 래핑.

- [ ] **Step 3: 브랜치 푸시 + PR 생성 (develop 대상)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin feature/header-nav-megamenu
gh pr create --base develop --head feature/header-nav-megamenu \
  --title "feat(nav): 헤더 네비 통합 — 생활정보 메가메뉴 + 1200px 컨테이너" \
  --body "$(cat <<'EOF'
## Summary
- 시설 4개 그룹 드롭다운 → 단일 **생활정보** 4단 메가메뉴로 통합 (부동산·청약·임대는 개별 드롭다운 유지)
- 헤더 내용을 본문과 동일한 **max-w-[1200px]** 컨테이너로 정렬 + 좌(로고·메뉴)/우(가이드·검색·소개) 그룹화
- 모바일: 생활정보 통합 섹션 아래 4개 하위그룹 펼침

## Data
- `types/facility.ts`: `NAV_LINK_GROUPS`(부동산·청약·임대) 분리, `NAV_GROUPS`는 형태 동일 유지

## Tests
- `navGroups.test.ts`: `NAV_LINK_GROUPS` 추가, 기존 전부 통과
- `AppHeader.test.ts`: 데스크톱 그룹 수 6→3 + 메가메뉴/모바일 통합 섹션 검증

Spec: docs/superpowers/specs/2026-05-29-header-nav-megamenu-design.md (로컬)
EOF
)"
```

- [ ] **Step 4: CI 통과 확인**

Run: `gh pr checks --watch`
Expected: Test 워크플로우(lint+test+build) 통과. 실패 시 수정 후 재푸시.

---

## Self-Review (작성자 체크 결과)

**1. Spec coverage** — spec 각 항목 → 태스크 매핑:
- §4 데이터(NAV_LINK_GROUPS) → Task 1 ✓
- §5.1 1200px 컨테이너/좌우 그룹화 → Task 2 template(컨테이너 + ml-auto 유틸) ✓
- §5.2 개별 드롭다운(NAV_LINK_GROUPS) → Task 2 ✓
- §5.3 생활정보 4단 메가메뉴(grid_view, CATEGORY_GROUPS, nav-mega-menu) → Task 2 ✓
- §6 모바일 통합 섹션 → Task 2 모바일 블록 ✓
- §7 a11y/동작(기존 로직 재사용) → script 불변 ✓
- §8 엣지(max-w-[calc] + grid-cols-2 래핑, 풀폭 header) → Task 2 클래스 ✓
- §9 테스트 계획 → Task 1·2 테스트 단계 ✓
- 갭 없음.

**2. Placeholder scan** — "TBD/TODO/적절히 처리" 없음. 모든 코드 블록 완전 기재(전체 SFC 포함). ✓

**3. Type consistency** — `NAV_LINK_GROUPS: readonly LinkGroup[]`, `CATEGORY_GROUPS`(기존), `activeDropdown: string | null`(`'생활정보'` 문자열 사용 일치), import 심볼(`CATEGORY_META`/`NAV_LINK_GROUPS`/`CATEGORY_GROUPS`)이 template 사용과 일치. `isLinkGroup`/`NAV_GROUPS`는 AppHeader에서 제거(미사용), facility.ts·navGroups.test.ts에는 잔존. ✓
