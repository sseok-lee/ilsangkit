# 부동산 지도 허브 전체화면 레이아웃 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/real-estate` 를 페이지 스크롤이 0인 지도 전용 화면으로 바꾸고, 하단 콘텐츠가 담당하던 크롤 경로와 푸터를 손실 없이 옮긴다.

**Architecture:** 헤더만 있는 신규 레이아웃(`layouts/map.vue`)이 루트를 `h-screen overflow-hidden` 으로 잠가 페이지 스크롤을 구조적으로 없앤다. 사라지는 하단 콘텐츠의 두 역할은 각각 이관한다 — 유형 카드의 크롤 경로는 지도 필터바를 `<a href>` 로 바꿔서, 푸터는 사이드바 목록 하단으로. 목록은 초기 20개만 그려 푸터가 200개 뒤에 묻히지 않게 한다.

**Tech Stack:** Nuxt 3 (SSR) · Vue 3 `<script setup>` · TailwindCSS · Vitest + @vue/test-utils (happy-dom)

**설계 문서:** [docs/superpowers/specs/2026-08-04-real-estate-map-fullscreen-layout-design.md](../specs/2026-08-04-real-estate-map-fullscreen-layout-design.md)

**브랜치:** `feat/real-estate-map-explorer` (PR #712 위에 이어서 커밋)

## Global Constraints

- **Node 20 필수.** 시스템 기본은 v25.5.0 이고, 그대로 돌리면 이 변경과 무관한 프론트 테스트 27건이 거짓 실패한다(Node 20 에서는 2,093건 통과). **`nvm use 20` 은 쓰지 않는다** — Bash 도구는 호출마다 독립 셸이라 셸 상태가 유지되지 않는다. 테스트·린트를 돌리는 모든 명령 앞에 PATH 를 직접 얹는다:
  ```bash
  export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
  ```
  각 명령 블록마다 이 줄을 포함해야 한다. `node --version` 이 `v20.19.5` 인지 먼저 확인하고 진행한다.
- **작업 디렉터리는 `frontend/`.** 이 계획의 모든 경로와 명령은 `frontend/` 기준이다. 백엔드 변경은 없다.
- **SSR 가드는 `import.meta.server` 극성을 쓴다.** `!import.meta.client` 는 vitest 에서 두 플래그가 모두 `undefined` 라 코드가 실행되지 않아 테스트가 불가능해진다.
- **광고 배치를 임의로 바꾸지 않는다.** 이 페이지 광고는 사이드바 인피드 1개로 확정됐다(사용자 결정). 개수·위치를 조정하지 않는다.
- **커밋 전 반드시 관련 테스트를 돌린다.** 기존 실패도 즉시 고친다.
- **`main` 에 직접 커밋하지 않는다.** 모든 변경은 위 브랜치에 쌓는다.
- **`docs/` 는 `.gitignore` 대상이다.** 문서를 커밋할 일이 있으면 `git add -f <파일경로>` 로 파일 하나씩 추가한다. `git add -A docs/` 는 금지 — 과거 무관한 184개 파일이 쓸려 들어갔다.
- **Tailwind 클래스 문자열은 스펙에 적힌 값을 그대로 쓴다.** 임의로 다른 유틸리티로 바꾸지 않는다.

---

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `layouts/map.vue` | 헤더만 있는 전체화면 레이아웃. 페이지 스크롤 차단 | 신규 (Task 3) |
| `components/common/AppHeader.vue` | `wide` prop 으로 폭 제한 해제 | 수정 (Task 1) |
| `components/common/AppFooter.vue` | `compact` prop 으로 1열 렌더 | 수정 (Task 2) |
| `components/realEstate/map/MapFilterBar.vue` | 6종 전환 + 크롤 경로 제공 | 수정 (Task 4) |
| `components/realEstate/map/MapSidebar.vue` | 목록 페이지네이션 (Task 5), 푸터 슬롯 (Task 6) | 수정 |
| `components/realEstate/map/RealEstateMapExplorer.vue` | 높이·폭, `showFooter` 배선 | 수정 (Task 7) |
| `pages/real-estate/index.vue` | 하단 콘텐츠 제거, 레이아웃 지정, ItemList 6종 | 수정 (Task 8) |
| `components/realEstate/RealEstateCategoryCards.vue` | 사용처 소멸 → 삭제 | 삭제 (Task 8) |

---

### Task 1: AppHeader `wide` prop

**Files:**
- Modify: `components/common/AppHeader.vue` (template 11행, `<script setup>` 의 `interface Props` / `withDefaults`)
- Test: `tests/components/common/AppHeaderWide.test.ts` (신규)

**Interfaces:**
- Consumes: 없음
- Produces: `AppHeader` 가 `wide?: boolean` (기본 `false`) 를 받는다. `true` 면 내부 래퍼 div 에서 `max-w-[1200px]` 가 빠진다. Task 3 이 `<AppHeader wide />` 로 소비한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/components/common/AppHeaderWide.test.ts` 를 새로 만든다.

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppHeader from '~/components/common/AppHeader.vue'

// AppHeader 는 HeaderSearch·HardLink·CategoryIcon 과 useRoute 를 물고 있다.
// 기존 관례(tests/components/common/AppHeaderSearch.test.ts)를 그대로 따른다.
function mountHeader(props: Record<string, unknown> = {}) {
  return mount(AppHeader, {
    props,
    global: {
      stubs: { HardLink: true, CategoryIcon: true, HeaderSearch: true },
      mocks: { useRoute: () => ({ path: '/real-estate', params: {}, query: {} }) },
    },
  })
}

/** 헤더 내부의 폭을 결정하는 래퍼 div */
function wrapperClasses(props: Record<string, unknown> = {}) {
  return mountHeader(props).find('header > div').classes()
}

describe('AppHeader wide', () => {
  it('기본값은 max-w-[1200px] 로 폭을 묶는다', () => {
    expect(wrapperClasses()).toContain('max-w-[1200px]')
  })

  it('wide 면 폭 제한을 풀어 화면 전체를 채운다', () => {
    // 지도 페이지는 지도 폭을 줄이지 않으면서 헤더와 좌우 경계를 맞춰야 한다.
    // 지도를 1200px 로 좁히는 대신 헤더의 제한을 푸는 방향을 택했다(설계문서 5.2).
    expect(wrapperClasses({ wide: true })).not.toContain('max-w-[1200px]')
  })

  it('wide 여부와 무관하게 정렬·레이아웃 클래스는 유지한다', () => {
    for (const wide of [false, true]) {
      expect(wrapperClasses({ wide })).toEqual(
        expect.arrayContaining(['mx-auto', 'flex', 'h-full', 'w-full', 'items-center']),
      )
    }
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/common/AppHeaderWide.test.ts
```

Expected: FAIL — `wide` prop 이 없어 `max-w-[1200px]` 가 항상 남으므로 두 번째 테스트가 실패한다.

- [ ] **Step 3: 템플릿을 고친다**

`components/common/AppHeader.vue` 11행을 바꾼다.

변경 전:
```vue
    <div class="mx-auto flex h-full w-full max-w-[1200px] items-center">
```

변경 후:
```vue
    <div :class="['mx-auto flex h-full w-full items-center', props.wide ? '' : 'max-w-[1200px]']">
```

- [ ] **Step 4: props 를 추가한다**

같은 파일 `<script setup>` 의 `interface Props` 와 `withDefaults` 를 바꾼다.

변경 전:
```ts
interface Props {
  transparent?: boolean
  showBackButton?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  transparent: false,
  showBackButton: false,
})
```

변경 후:
```ts
interface Props {
  transparent?: boolean
  showBackButton?: boolean
  /**
   * 헤더 폭 제한(max-w-[1200px])을 푼다. 지도처럼 화면 전체를 쓰는 페이지에서
   * 본문과 헤더의 좌우 경계를 맞추기 위한 것이다 — layouts/map.vue 전용.
   */
  wide?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  transparent: false,
  showBackButton: false,
  wide: false,
})
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/components/common/AppHeaderWide.test.ts
```

Expected: PASS (3 tests)

- [ ] **Step 6: 헤더를 쓰는 기존 테스트가 깨지지 않았는지 확인한다**

```bash
npx vitest run tests/components/common/
```

Expected: PASS — 기존 호출부는 `wide` 를 넘기지 않아 기본값 `false` 로 종전과 동일하게 동작한다.

- [ ] **Step 7: 커밋한다**

```bash
git add components/common/AppHeader.vue tests/components/common/AppHeaderWide.test.ts
git commit -m "feat(header): wide prop 으로 폭 제한 해제 — 지도 페이지 경계 정렬용"
```

---

### Task 2: AppFooter `compact` prop

**Files:**
- Modify: `components/common/AppFooter.vue` (2행 `<footer>`, 3행 컨테이너 div, 5행 그리드 div, `<script setup>` 에 props 추가)
- Test: `tests/components/common/AppFooterCompact.test.ts` (신규)

**Interfaces:**
- Consumes: 없음
- Produces: `AppFooter` 가 `compact?: boolean` (기본 `false`) 를 받는다. `true` 면 4열 → 1열, 여백 축소, 폭 제한 제거. **링크·문구는 어느 모드에서도 동일하다.** Task 6 이 `<AppFooter compact />` 로 소비한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/components/common/AppFooterCompact.test.ts` 를 새로 만든다.

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AppFooter from '~/components/common/AppFooter.vue'

// AppFooter 는 useSyncStatus 를 쓰지만 그 안의 useAsyncData/$fetch/useApiBase 는
// tests/setup.ts 에서 전역 mock 되어 있어 추가 준비가 필요 없다.
function mountFooter(props: Record<string, unknown> = {}) {
  return mount(AppFooter, {
    props,
    global: {
      stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } },
    },
  })
}

/** 모든 링크의 href 를 정렬해 반환 — 모드별 내용 동일성 비교용 */
function hrefs(wrapper: ReturnType<typeof mountFooter>): string[] {
  return wrapper.findAll('a[href]').map((a) => a.attributes('href') ?? '').sort()
}

describe('AppFooter compact', () => {
  it('기본은 4열 그리드다', () => {
    expect(mountFooter().find('footer div.grid').classes()).toContain('md:grid-cols-4')
  })

  it('compact 는 1열 그리드다', () => {
    // 사이드바 폭이 320px 이라 4열 그리드가 들어가지 않는다(설계문서 7.2).
    const cls = mountFooter({ compact: true }).find('footer div.grid').classes()
    expect(cls).toContain('grid-cols-1')
    expect(cls).not.toContain('md:grid-cols-4')
    expect(cls).not.toContain('grid-cols-2')
  })

  it('compact 는 컨테이너·내부 폭 제한을 걸지 않는다', () => {
    const w = mountFooter({ compact: true })
    expect(w.find('footer > div').classes()).not.toContain('container')
    expect(w.find('footer div.grid').classes()).not.toContain('max-w-4xl')
  })

  it('compact 는 세로 여백을 줄인다', () => {
    expect(mountFooter({ compact: true }).find('footer').classes()).toContain('py-5')
    expect(mountFooter().find('footer').classes()).toContain('md:py-10')
  })

  // 이 푸터는 다른 페이지 푸터와 내용이 같아야 한다. 레이아웃만 바뀐다.
  it('compact 여도 링크와 고지문은 기본 모드와 완전히 같다', () => {
    const base = mountFooter()
    const compact = mountFooter({ compact: true })
    expect(hrefs(compact)).toEqual(hrefs(base))
    expect(hrefs(compact)).toContain('/privacy')
    expect(hrefs(compact)).toContain('/terms')
    expect(compact.text()).toContain('공공누리')
    expect(compact.text()).toContain('All rights reserved')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/common/AppFooterCompact.test.ts
```

Expected: FAIL — `compact` prop 이 없어 1열 관련 테스트 3개가 실패한다.

- [ ] **Step 3: 템플릿의 세 요소를 조건부 클래스로 바꾼다**

`components/common/AppFooter.vue` 2~5행을 바꾼다.

변경 전:
```vue
  <footer class="bg-background-light border-t border-line-2 py-6 md:py-10">
    <div class="container mx-auto px-4">
      <!-- 4-column grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 max-w-4xl mx-auto">
```

변경 후:
```vue
  <footer :class="['bg-background-light border-t border-line-2', props.compact ? 'py-5' : 'py-6 md:py-10']">
    <div :class="props.compact ? 'px-4' : 'container mx-auto px-4'">
      <!-- 기본 4열 / compact 1열 (사이드바 320px 폭에 4열은 들어가지 않는다) -->
      <div :class="['grid gap-8', props.compact ? 'grid-cols-1 mb-5' : 'grid-cols-2 md:grid-cols-4 mb-8 max-w-4xl mx-auto']">
```

- [ ] **Step 4: props 를 추가한다**

같은 파일 `<script setup lang="ts">` 안, `import` 문들 바로 아래에 넣는다.

```ts
/**
 * 좁은 컨테이너(지도 사이드바 320px)용 1열 렌더.
 * 링크·문구는 바꾸지 않는다 — 다른 페이지 푸터와 내용이 같아야 한다.
 */
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/components/common/AppFooterCompact.test.ts
```

Expected: PASS (5 tests)

- [ ] **Step 6: 푸터를 렌더하는 기존 테스트가 깨지지 않았는지 확인한다**

```bash
npx vitest run tests/components/common/ tests/pages/
```

Expected: PASS — 기존 호출부는 `compact` 를 넘기지 않아 기본값으로 종전과 동일하다.

- [ ] **Step 7: 커밋한다**

```bash
git add components/common/AppFooter.vue tests/components/common/AppFooterCompact.test.ts
git commit -m "feat(footer): compact prop 으로 1열 렌더 — 지도 사이드바 이식용"
```

---

### Task 3: 지도 전용 레이아웃

**Files:**
- Create: `layouts/map.vue`
- Test: `tests/layouts/mapLayout.test.ts` (신규 디렉터리)

**Interfaces:**
- Consumes: Task 1 의 `AppHeader` `wide` prop
- Produces: `layout: 'map'` 으로 지정 가능한 레이아웃. 루트가 `h-screen overflow-hidden flex flex-col`, `main` 이 `flex-1 min-h-0`. `TrustLine`·`AppFooter` 를 렌더하지 않는다. Task 8 이 `definePageMeta({ layout: 'map' })` 로 소비한다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/layouts/mapLayout.test.ts` 를 새로 만든다(디렉터리도 함께 생성).

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import MapLayout from '~/layouts/map.vue'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setOrganizationSchema: vi.fn() }),
}))

function mountLayout() {
  return mount(MapLayout, {
    slots: { default: '<div data-testid="page-content" />' },
    global: {
      // stub 에 name 을 반드시 준다 — name 이 없으면 findComponent({ name }) 가
      // 아무것도 찾지 못해 prop 검증이 조용히 무력해진다.
      stubs: {
        AppHeader: { name: 'AppHeader', template: '<header data-testid="app-header" />', props: ['wide'] },
      },
      mocks: { useRoute: () => ({ path: '/real-estate', params: {}, query: {} }) },
    },
  })
}

describe('layouts/map.vue', () => {
  it('루트를 h-screen overflow-hidden 으로 잠가 페이지 스크롤을 없앤다', () => {
    // 높이 계산이 어긋나도 스크롤바가 생기지 않게 구조로 막는다(설계문서 5.1).
    expect(mountLayout().find('div').classes()).toEqual(
      expect.arrayContaining(['h-screen', 'overflow-hidden', 'flex', 'flex-col']),
    )
  })

  it('main 에 flex-1 min-h-0 을 준다', () => {
    // min-h-0 이 없으면 flex 자식의 기본 min-height:auto 때문에
    // 내부 오버플로가 부모를 밀어내 overflow-hidden 이 무력해진다.
    expect(mountLayout().find('main').classes()).toEqual(expect.arrayContaining(['flex-1', 'min-h-0']))
  })

  it('스킵 링크가 동작하도록 main 에 id·tabindex 를 준다', () => {
    const main = mountLayout().find('main')
    expect(main.attributes('id')).toBe('main')
    expect(main.attributes('tabindex')).toBe('-1')
  })

  it('본문 바로가기 스킵 링크를 유지한다', () => {
    const skip = mountLayout().find('a[href="#main"]')
    expect(skip.exists()).toBe(true)
    expect(skip.text()).toBe('본문 바로가기')
  })

  it('푸터와 TrustLine 을 렌더하지 않는다', () => {
    // 이 둘이 남아 있으면 페이지 스크롤을 0으로 만들 수 없다(실측 합계 약 410px).
    // 푸터는 사이드바 목록 하단이 대신한다.
    const w = mountLayout()
    expect(w.find('footer').exists()).toBe(false)
    expect(w.text()).not.toContain('공공데이터 기반 서비스')
  })

  it('헤더에 wide 를 넘긴다', () => {
    expect(mountLayout().findComponent({ name: 'AppHeader' }).props('wide')).toBe(true)
  })

  it('슬롯 콘텐츠를 main 안에 렌더한다', () => {
    expect(mountLayout().find('main [data-testid="page-content"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/layouts/mapLayout.test.ts
```

Expected: FAIL — `layouts/map.vue` 가 없어 import 에서 실패한다.

- [ ] **Step 3: 레이아웃을 만든다**

`layouts/map.vue` 를 새로 만든다.

```vue
<template>
  <!--
    지도 전용 레이아웃. default 레이아웃과 다른 점은 두 가지다.
    1) 루트가 h-screen overflow-hidden — 페이지 스크롤이 구조적으로 0이다.
    2) TrustLine·AppFooter 를 렌더하지 않는다. 둘이 남으면 지도 아래로 약 410px 의
       스크롤이 생긴다. 푸터는 지도 사이드바 목록 하단으로 옮겼다(설계문서 7).
  -->
  <div class="h-screen overflow-hidden flex flex-col">
    <!-- 본문 바로가기(스킵 링크): 키보드 포커스 시에만 노출 -->
    <a
      href="#main"
      class="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-primary focus:text-white focus:shadow-lg"
    >본문 바로가기</a>

    <!-- wide: 헤더 폭 제한을 풀어 아래 지도·사이드바와 좌우 경계를 맞춘다 -->
    <AppHeader wide />

    <!-- min-h-0 이 없으면 내부 오버플로가 부모를 밀어내 overflow-hidden 이 무력해진다 -->
    <main id="main" tabindex="-1" class="flex-1 min-h-0">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import AppHeader from '~/components/common/AppHeader.vue'
import { useStructuredData } from '~/composables/useStructuredData'

// default 레이아웃과 동일하게 Organization 스키마를 심는다.
const { setOrganizationSchema } = useStructuredData()
setOrganizationSchema()
</script>
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/layouts/mapLayout.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 5: 커밋한다**

```bash
git add layouts/map.vue tests/layouts/mapLayout.test.ts
git commit -m "feat(layout): 지도 전용 레이아웃 — 페이지 스크롤 0, 푸터/TrustLine 제외"
```

---

### Task 4: 필터바 링크화

**Files:**
- Modify: `components/realEstate/map/MapFilterBar.vue` (template 전체)
- Test: `tests/components/realEstate/map/MapFilterBar.test.ts` (신규)

**Interfaces:**
- Consumes: 없음
- Produces: 변화 없음. `props: { type: string }`, `emit('update:type', value)` 는 그대로다. 마크업만 `<button>` → `<a href>` 로 바뀐다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/components/realEstate/map/MapFilterBar.test.ts` 를 새로 만든다.

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapFilterBar from '~/components/realEstate/map/MapFilterBar.vue'

const TYPES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']

function mountBar(type = 'apt-sale') {
  return mount(MapFilterBar, { props: { type } })
}

describe('MapFilterBar', () => {
  // 하단 유형 카드를 제거하면 apt-rent·villa-rent·offitel-rent 허브로 가는 내부 링크는
  // 사이트 전체에서 여기가 유일해진다(GNB 드롭다운은 매매 4종만 싣는다).
  it('6종 전부를 href 있는 링크로 렌더한다', () => {
    const hrefs = mountBar().findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toEqual(TYPES.map((t) => `/real-estate/${t}`))
  })

  it('button 을 남기지 않는다 — button 은 크롤 경로가 아니다', () => {
    expect(mountBar().findAll('button')).toHaveLength(0)
  })

  it('토지는 넣지 않는다 — 지도가 다루지 않는 유형이라 클릭해도 반응할 수 없다', () => {
    const hrefs = mountBar().findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).not.toContain('/real-estate/land')
  })

  it('평범한 클릭은 기본 동작을 막고 타입 전환만 emit 한다', async () => {
    const w = mountBar()
    await w.findAll('a')[1].trigger('click')
    expect(w.emitted('update:type')).toEqual([['apt-rent']])
  })

  it('⌘/Ctrl+클릭은 가로채지 않는다 — 새 탭으로 열려야 한다', async () => {
    // @click.prevent 만 쓰면 수식 키 클릭까지 막혀 새 탭 열기가 죽는다. .exact 가 필요하다.
    const w = mountBar()
    await w.findAll('a')[1].trigger('click', { metaKey: true })
    await w.findAll('a')[1].trigger('click', { ctrlKey: true })
    expect(w.emitted('update:type')).toBeUndefined()
  })

  it('선택된 항목만 aria-current 를 갖는다', () => {
    // aria-pressed 는 토글 버튼 전용 속성이라 링크에 쓰면 무효다.
    const links = mountBar('villa-rent').findAll('a')
    const current = links.filter((a) => a.attributes('aria-current') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0].text()).toBe('빌라 전월세')
    expect(links.some((a) => a.attributes('aria-pressed') !== undefined)).toBe(false)
  })

  it('터치 타깃 44px 을 유지한다', () => {
    expect(mountBar().findAll('a').every((a) => a.classes().includes('min-h-[44px]'))).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/MapFilterBar.test.ts
```

Expected: FAIL — 현재는 `<button>` 이라 `findAll('a')` 가 빈 배열이다.

- [ ] **Step 3: 템플릿을 링크로 바꾼다**

`components/realEstate/map/MapFilterBar.vue` 의 `<template>` 전체를 바꾼다.

```vue
<template>
  <div class="flex flex-wrap gap-1.5 p-2 bg-white/95 backdrop-blur rounded-xl border border-line shadow-card">
    <!--
      button 이 아니라 a 다. 하단 유형 카드를 제거한 뒤로는 apt-rent·villa-rent·offitel-rent
      허브로 가는 내부 링크가 사이트 전체에서 여기뿐이다(GNB 드롭다운은 매매 4종만 싣는다).
      button 이면 SSR HTML 에 href 가 없어 그 3개가 내부 링크 0인 페이지가 된다.

      NuxtLink 를 쓰지 않는 이유: 클릭은 항상 preventDefault 로 가로채 클라이언트 전환하므로
      링크의 역할은 크롤러에게 href 를 보여주는 것뿐인데, NuxtLink 는 prefetch 로 6개 라우트를
      불필요하게 미리 받는다.
    -->
    <a
      v-for="opt in OPTIONS"
      :key="opt.value"
      :href="`/real-estate/${opt.value}`"
      class="px-3 py-1.5 min-h-[44px] flex items-center justify-center rounded-lg text-sm font-medium transition-colors"
      :class="opt.value === props.type
        ? 'bg-primary text-white'
        : 'bg-background-light text-slate-700 hover:bg-slate-200'"
      :aria-current="opt.value === props.type ? 'true' : undefined"
      @click.exact.prevent="emit('update:type', opt.value)"
    >
      {{ opt.label }}
    </a>
  </div>
</template>
```

`.exact` 가 없으면 ⌘/Ctrl+클릭까지 `preventDefault` 되어 새 탭 열기가 죽는다. `aria-pressed` 는 링크에 무효라 `aria-current` 로 바꾼다.

- [ ] **Step 4: `<script setup>` 의 OPTIONS 에 주석을 보강한다**

`OPTIONS` 배열 위 주석에 한 줄을 더한다(배열 내용은 바꾸지 않는다).

변경 전:
```ts
// 거래 축은 매매/전월세 2종이다. 전세/월세로 나누지 않는 이유는 설계문서 4장 참조 —
// summary 가 건물당 최신 1건만 보유해 전세 필터 시 아파트 44.6%·오피스텔 56.4%가 누락된다.
```

변경 후:
```ts
// 거래 축은 매매/전월세 2종이다. 전세/월세로 나누지 않는 이유는 설계문서 4장 참조 —
// summary 가 건물당 최신 1건만 보유해 전세 필터 시 아파트 44.6%·오피스텔 56.4%가 누락된다.
//
// 토지는 넣지 않는다. 별도 모델(면적·지목 단위)이라 지도 탐색기가 다루지 않으므로
// 여기 추가하면 클릭해도 지도가 반응할 수 없다. 토지 링크는 GNB 드롭다운이 담당한다.
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/components/realEstate/map/MapFilterBar.test.ts
```

Expected: PASS (7 tests)

- [ ] **Step 6: 지도 컴포넌트 전체 테스트를 돌린다**

```bash
npx vitest run tests/components/realEstate/map/
```

Expected: PASS — `RealEstateMapExplorer` 는 `@update:type` 만 듣고 있어 마크업 변경의 영향을 받지 않는다.

- [ ] **Step 7: 커밋한다**

```bash
git add components/realEstate/map/MapFilterBar.vue tests/components/realEstate/map/MapFilterBar.test.ts
git commit -m "feat(map): 필터바를 링크로 전환 — 전월세 3개 허브의 크롤 경로 보전"
```

---

### Task 5: 목록 더보기 페이지네이션

**Files:**
- Modify: `components/realEstate/map/MapSidebar.vue` (template 3~38행, `<script setup>`)
- Test: `tests/components/realEstate/map/MapSidebar.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `MapSidebar` 의 props 시그니처는 그대로다. 내부적으로 건물 모드일 때만 `PAGE_SIZE = 20` 단위로 잘라 렌더하고, 잘렸으면 `data-testid="map-sidebar-more"` 버튼을 낸다. Task 6 이 같은 파일에 푸터를 덧붙인다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/components/realEstate/map/MapSidebar.test.ts` 파일 **맨 아래**에 다음 블록을 추가한다(기존 테스트는 그대로 둔다).

```ts
/** 건물 아이템 n 개를 만든다 — 이름만 다르고 나머지는 동일하다. */
function manyBuildings(n: number): MapItem[] {
  return Array.from({ length: n }, (_, i) => ({
    buildingName: `건물${i}`, city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 100000 + i, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 200 - i,
  }))
}

function mountBuildings(items: MapItem[], over = {}) {
  return mount(MapSidebar, {
    props: {
      items, granularity: 'building', total: items.length, exact: true, pending: false,
      type: 'apt-sale', ...over,
    },
  })
}

// 목록을 전부 그리면(최대 200개, 항목 약 62px = 12,400px) 그 아래 푸터에 도달할 수 없다.
// 데스크톱 사이드바에서도 12화면을 내려야 한다(설계문서 7.5).
describe('MapSidebar 더보기', () => {
  it('건물 200개 중 초기 20개만 렌더한다', () => {
    const w = mountBuildings(manyBuildings(200))
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
  })

  it('더보기를 누르면 20개씩 늘어난다', async () => {
    const w = mountBuildings(manyBuildings(200))
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(40)
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(60)
  })

  it('20개 이하면 더보기 버튼이 없다', () => {
    const w = mountBuildings(manyBuildings(12))
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(12)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(false)
  })

  it('끝까지 펼치면 더보기 버튼이 사라진다', async () => {
    const w = mountBuildings(manyBuildings(25))
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(true)
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(25)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(false)
  })

  it('지역 모드는 자르지 않는다 — SIDO_CHIPS 16개는 전부 SSR HTML 에 있어야 한다', () => {
    const w = mount(MapSidebar, {
      props: { items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false, type: 'apt-sale' },
    })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(16)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(false)
  })

  it('목록이 새로 오면 표시 개수가 20으로 돌아간다', async () => {
    // 안 그러면 강남에서 100개까지 늘려 둔 상태가 제주로 옮겨가도 남는다.
    const w = mountBuildings(manyBuildings(200))
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(40)

    await w.setProps({ items: manyBuildings(200), total: 200 })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
  })

  it('표시 개수가 전체보다 적으면 두 수를 함께 알린다', () => {
    // 목록 20개인데 지도엔 최대 200개 라벨이 뜨는 이유가 화면에 드러나야 한다.
    const w = mountBuildings(manyBuildings(200), { total: 1234, exact: false })
    expect(w.text()).toContain('이 영역에 1,234곳')
    expect(w.text()).toContain('상위 20곳 표시')
  })

  it('전부 보이면 개수 안내를 띄우지 않는다', () => {
    const w = mountBuildings(manyBuildings(12))
    expect(w.text()).not.toContain('상위')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: FAIL — 현재는 200개를 전부 렌더하고 `map-sidebar-more` 가 없다.

- [ ] **Step 3: `<script setup>` 에 슬라이스 로직을 추가한다**

`components/realEstate/map/MapSidebar.vue` 의 `<script setup>` 에서 두 곳을 고친다.

먼저 첫 줄 import 를 바꾼다.

변경 전:
```ts
import { computed } from 'vue'
```

변경 후:
```ts
import { computed, ref, watch } from 'vue'
```

그리고 `rows` computed 정의 **뒤에** 다음을 추가한다(파일 맨 끝, `</script>` 직전).

```ts
/** 건물 목록 초기 표시 개수. 이보다 길면 [더보기] 로 이만큼씩 늘린다. */
const PAGE_SIZE = 20

const shown = ref(PAGE_SIZE)

// 뷰포트가 바뀌어 목록이 새로 오면 처음부터 다시 보여준다.
// 안 그러면 이전 지역에서 늘려 둔 개수가 새 지역에 그대로 남는다.
watch(() => props.items, () => { shown.value = PAGE_SIZE })

/**
 * 화면에 그릴 행.
 *
 * 건물 모드만 자른다. 목록을 전부 그리면(최대 200개, 항목 약 62px = 12,400px) 그 아래
 * 푸터에 도달할 수 없다 — 데스크톱 사이드바에서도 12화면을 내려야 한다.
 * 지역 모드(최대 16개)는 자르지 않는다. SIDO_CHIPS 링크는 이 페이지의 핵심 SSR 콘텐츠라
 * 전부 HTML 에 있어야 한다.
 */
const visibleRows = computed<Row[]>(() =>
  props.granularity === 'building' ? rows.value.slice(0, shown.value) : rows.value,
)

const hasMore = computed(() => visibleRows.value.length < rows.value.length)

function showMore(): void {
  shown.value += PAGE_SIZE
}

/**
 * 표시 개수가 bbox 전체 개수보다 적으면 항상 알린다.
 * 목록은 20개인데 지도엔 최대 200개 라벨이 뜨므로, 그 차이의 이유가 화면에 드러나야 한다.
 *
 * props.exact 는 이 판정에 쓰지 않는다 — exact=false(전체>200)면 어차피
 * visibleRows.length < total 이 참이라 조건이 중복된다. prop 자체는 호출부 호환을 위해 남긴다.
 */
const showCountNote = computed(() => visibleRows.value.length < props.total)
```

- [ ] **Step 4: 템플릿에서 `visibleRows` 를 쓰고 더보기 버튼을 단다**

같은 파일 template 의 헤더 문구와 `<ul>` 을 바꾼다.

변경 전:
```vue
      <p v-if="!props.exact" class="text-xs text-slate-600 mt-0.5">
        이 영역에 {{ props.total.toLocaleString('ko-KR') }}곳 — 거래량 상위만 표시합니다
      </p>
```

변경 후:
```vue
      <p v-if="showCountNote" class="text-xs text-slate-600 mt-0.5">
        이 영역에 {{ props.total.toLocaleString('ko-KR') }}곳 — 상위 {{ visibleRows.length.toLocaleString('ko-KR') }}곳 표시
      </p>
```

변경 전:
```vue
      <template v-for="(row, idx) in rows" :key="row.key">
```

변경 후:
```vue
      <template v-for="(row, idx) in visibleRows" :key="row.key">
```

그리고 `</ul>` **바로 앞**(마지막 `</template>` 다음)에 더보기 버튼을 넣는다.

```vue
        <li v-if="hasMore" class="p-3">
          <button
            type="button"
            data-testid="map-sidebar-more"
            class="w-full min-h-[44px] flex items-center justify-center rounded-lg border border-line bg-white text-sm font-medium text-slate-700 hover:bg-background-light transition-colors"
            @click="showMore"
          >
            더보기
          </button>
        </li>
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: PASS — 기존 테스트 + 새 8개.

- [ ] **Step 6: 커밋한다**

```bash
git add components/realEstate/map/MapSidebar.vue tests/components/realEstate/map/MapSidebar.test.ts
git commit -m "feat(map): 건물 목록 더보기 페이지네이션 — 초기 20개, 푸터 도달성 확보"
```

---

### Task 6: 사이드바 하단 푸터

**Files:**
- Modify: `components/realEstate/map/MapSidebar.vue` (template `</ul>` 뒤, props 에 `showFooter` 추가)
- Test: `tests/components/realEstate/map/MapSidebar.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 2 의 `AppFooter` `compact` prop
- Produces: `MapSidebar` 가 `showFooter?: boolean` (기본 **`false`**) 를 받는다. `true` 일 때만 목록 아래에 `<AppFooter compact />` 를 렌더한다. Task 7 이 데스크톱/모바일 사본에 반대 조건으로 넘긴다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/components/realEstate/map/MapSidebar.test.ts` 맨 아래에 추가한다.

```ts
describe('MapSidebar 푸터', () => {
  const footerStub = {
    AppFooter: { name: 'AppFooter', template: '<footer data-testid="sidebar-footer" />', props: ['compact'] },
  }

  function mountWithFooter(showFooter: boolean) {
    return mount(MapSidebar, {
      props: {
        items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false,
        type: 'apt-sale', showFooter,
      },
      global: { stubs: footerStub },
    })
  }

  // MapSidebar 는 데스크톱 aside 와 모바일 바텀시트 두 사본이 항상 동시에 마운트된다
  // (안 보이는 쪽은 CSS hidden 일 뿐 DOM 에 남는다). 기본값이 true 면 두 사본이 모두
  // 푸터를 그려 링크 8개와 data-testid="footer-links" 가 2벌 생긴다.
  it('기본값은 렌더하지 않는다', () => {
    const w = mount(MapSidebar, {
      props: { items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false, type: 'apt-sale' },
      global: { stubs: footerStub },
    })
    expect(w.find('[data-testid="sidebar-footer"]').exists()).toBe(false)
  })

  it('showFooter 면 목록 아래에 푸터를 렌더한다', () => {
    expect(mountWithFooter(true).find('[data-testid="sidebar-footer"]').exists()).toBe(true)
  })

  it('푸터에 compact 를 넘긴다 — 320px 폭에 4열 그리드는 들어가지 않는다', () => {
    expect(mountWithFooter(true).findComponent({ name: 'AppFooter' }).props('compact')).toBe(true)
  })

  it('푸터는 목록 뒤에 온다', () => {
    const html = mountWithFooter(true).html()
    expect(html.indexOf('map-sidebar-item')).toBeLessThan(html.indexOf('sidebar-footer'))
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: FAIL — `showFooter` prop 이 없어 푸터가 절대 렌더되지 않는다.

- [ ] **Step 3: props 에 `showFooter` 를 추가한다**

`components/realEstate/map/MapSidebar.vue` 의 `withDefaults` 블록을 바꾼다.

변경 전:
```ts
  showAd?: boolean
}>(), {
  showAd: true,
})
```

변경 후:
```ts
  showAd?: boolean
  /**
   * 이 사본에 푸터를 렌더할지. showAd 와 같은 이유로 게이트가 필요하다 — 두 사본이
   * 동시에 마운트되므로 그냥 두면 링크 8개와 data-testid="footer-links" 가 2벌 생긴다.
   *
   * 기본값은 false 다. showAd 처럼 true 로 두면 게이트를 잊은 호출부에서 조용히 2벌이 된다.
   */
  showFooter?: boolean
}>(), {
  showAd: true,
  showFooter: false,
})
```

- [ ] **Step 4: import 와 템플릿에 푸터를 추가한다**

같은 파일 `<script setup>` 의 마지막 import 아래에 추가한다.

변경 전:
```ts
import AdBanner from '~/components/ads/AdBanner.vue'
```

변경 후:
```ts
import AdBanner from '~/components/ads/AdBanner.vue'
import AppFooter from '~/components/common/AppFooter.vue'
```

그리고 template 에서 `</ul>` **바로 뒤**, 바깥 `</div>` 앞에 넣는다.

```vue
    <!--
      전역 푸터는 layouts/map.vue 에 없다(페이지 스크롤을 0으로 만들기 위해). 대신 여기
      목록 하단에 둬 사이드바 스크롤 끝에서 도달하게 한다. 목록이 짧으면 위 ul 의 flex-1 이
      밀어내 컨테이너 바닥에 붙는다.
    -->
    <AppFooter v-if="props.showFooter" compact />
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: PASS — 기존 테스트 + Task 5 의 8개 + 새 4개.

- [ ] **Step 6: 커밋한다**

```bash
git add components/realEstate/map/MapSidebar.vue tests/components/realEstate/map/MapSidebar.test.ts
git commit -m "feat(map): 사이드바 목록 하단에 compact 푸터 — 중복 마운트는 게이트로 차단"
```

---

### Task 7: 탐색기 높이·폭과 푸터 배선

**Files:**
- Modify: `components/realEstate/map/RealEstateMapExplorer.vue` (template 3·5·19행, MapSidebar 두 사본)
- Test: `tests/components/realEstate/map/RealEstateMapExplorer.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 6 의 `MapSidebar` `showFooter` prop
- Produces: 탐색기 컨테이너가 `h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)]`, 사이드바가 `lg:w-[320px] lg:shrink-0`. 데스크톱/모바일 사본에 `showFooter` 가 반대 조건으로 들어간다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`tests/components/realEstate/map/RealEstateMapExplorer.test.ts` 맨 아래에 추가한다.

이 파일에는 이미 `mountExplorer()` 헬퍼가 있다(`RealEstateMapCanvas` 만 stub). 여기서는 `MapSidebar` 의 props 를 읽어야 하므로 **다른 이름의 헬퍼**를 새로 만든다 — 기존 것을 고치면 다른 테스트가 영향을 받는다. 상수 `ITEMS` 는 파일 상단의 것을 그대로 쓴다.

```ts
describe('RealEstateMapExplorer 레이아웃', () => {
  // MapSidebar 의 props 를 읽기 위한 전용 헬퍼. stub 에 name 을 반드시 준다 —
  // name 이 없으면 findAllComponents({ name }) 가 아무것도 찾지 못해 검증이 조용히 무력해진다.
  function mountForLayout() {
    return mount(RealEstateMapExplorer, {
      props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
      global: {
        stubs: {
          MapSidebar: {
            name: 'MapSidebar',
            template: '<div />',
            props: ['items', 'granularity', 'total', 'exact', 'pending', 'type', 'showAd', 'showFooter'],
          },
          MapFilterBar: { name: 'MapFilterBar', template: '<div />', props: ['type'] },
          RealEstateMapCanvas: { name: 'RealEstateMapCanvas', template: '<div />', props: ['items', 'center', 'level'] },
          MapBottomSheet: { name: 'MapBottomSheet', template: '<div><slot /></div>' },
          ClientOnly: { template: '<div><slot /></div>' },
        },
      },
    })
  }

  it('컨테이너 높이를 dvh 로 잡고 헤더 높이를 브레이크포인트별로 뺀다', () => {
    // vh 는 모바일 주소창이 접힐 때 갱신되지 않아 스크롤 0이 깨진다.
    // 헤더는 h-14 lg:h-16(56px/64px)이라 두 값이 필요하다.
    const cls = mountForLayout().find('section > div').classes()
    expect(cls).toContain('h-[calc(100dvh-3.5rem)]')
    expect(cls).toContain('lg:h-[calc(100dvh-4rem)]')
    expect(cls.some((c) => c.includes('100vh'))).toBe(false)
  })

  it('사이드바를 고정폭으로 잡는다', () => {
    const cls = mountForLayout().find('aside').classes()
    expect(cls).toContain('lg:w-[320px]')
    expect(cls).toContain('lg:shrink-0')
  })

  it('데스크톱·모바일 두 사본에 showFooter 를 넘긴다', () => {
    // isDesktop 초기값이 null 이라 마운트 직후엔 양쪽 모두 false — SSR 출력과 일치해
    // 하이드레이션 mismatch 가 없다. matchMedia 결과가 들어오면 정확히 한쪽만 켜진다.
    const sidebars = mountForLayout().findAllComponents({ name: 'MapSidebar' })
    expect(sidebars).toHaveLength(2)
    expect(sidebars.map((s) => s.props('showFooter'))).toEqual([false, false])
  })

  it('showAd 와 showFooter 가 같은 사본에서 같은 값이다', () => {
    // 둘 다 "보이는 뷰포트 한쪽에만" 규칙을 따른다. 서로 어긋나면 한쪽에만 광고가,
    // 다른 쪽에만 푸터가 뜬다. isDesktop === true 하나만 쓰면 모바일 푸터가 영영 사라진다.
    for (const s of mountForLayout().findAllComponents({ name: 'MapSidebar' })) {
      expect(s.props('showFooter')).toBe(s.props('showAd'))
    }
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/components/realEstate/map/RealEstateMapExplorer.test.ts
```

Expected: FAIL — 현재 클래스는 `lg:h-[calc(100vh-4rem)]`, `lg:w-[22%]` 이고 `showFooter` 는 넘어가지 않는다.

- [ ] **Step 3: 컨테이너와 사이드바 클래스를 바꾼다**

`components/realEstate/map/RealEstateMapExplorer.vue` template 3·5행을 바꾼다.

변경 전:
```vue
    <div class="lg:flex lg:h-[calc(100vh-4rem)] lg:min-h-[560px]">
      <!-- 좌측: 이 페이지의 유일한 SSR 콘텐츠. ClientOnly 로 감싸지 않는다. -->
      <aside class="hidden lg:block lg:w-[22%] lg:min-w-[280px] lg:max-w-[360px] border-r border-line">
```

변경 후:
```vue
    <!--
      dvh 를 쓴다. vh 는 모바일 주소창이 접히고 펼쳐질 때 갱신되지 않아 스크롤 0이 깨진다.
      헤더가 h-14 lg:h-16(56px/64px)이라 빼는 값도 브레이크포인트별로 다르다.
    -->
    <div class="lg:flex h-[calc(100dvh-3.5rem)] lg:h-[calc(100dvh-4rem)] lg:min-h-[560px]">
      <!-- 좌측: 이 페이지의 유일한 SSR 콘텐츠. ClientOnly 로 감싸지 않는다.
           고정폭 — 화면 폭에 따라 목록 항목의 줄바꿈 지점이 달라질 이유가 없다. -->
      <aside class="hidden lg:block lg:w-[320px] lg:shrink-0 border-r border-line">
```

- [ ] **Step 4: 지도 영역이 컨테이너를 채우게 바꾼다**

같은 파일 19행을 바꾼다.

변경 전:
```vue
      <div class="relative flex-1 h-[60vh] lg:h-auto">
```

변경 후:
```vue
      <div class="relative flex-1 h-full lg:h-auto">
```

모바일에서 지도가 컨테이너를 꽉 채우고, 바텀시트는 `fixed` 라 그 위에 겹친다.

- [ ] **Step 5: 두 사본에 `showFooter` 를 배선한다**

같은 파일의 `MapSidebar` 두 곳을 바꾼다.

데스크톱(aside 안):
```vue
        <MapSidebar
          :items="items as MapItem[]"
          :granularity="granularity"
          :total="total"
          :exact="exact"
          :pending="pending"
          :type="type"
          :show-ad="isDesktop === true"
          :show-footer="isDesktop === true"
          @hover="hoveredKey = $event"
          @select="onSelect"
        />
```

모바일(MapBottomSheet 안):
```vue
      <MapSidebar
        :items="items as MapItem[]"
        :granularity="granularity"
        :total="total"
        :exact="exact"
        :pending="pending"
        :type="type"
        :show-ad="isDesktop === false"
        :show-footer="isDesktop === false"
        @hover="hoveredKey = $event"
        @select="onSelect"
      />
```

`isDesktop === true` 하나만 쓰면 모바일에서 푸터가 영영 사라진다. 반드시 반대 조건으로 양쪽에 넘긴다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
npx vitest run tests/components/realEstate/map/
```

Expected: PASS

- [ ] **Step 7: 커밋한다**

```bash
git add components/realEstate/map/RealEstateMapExplorer.vue tests/components/realEstate/map/RealEstateMapExplorer.test.ts
git commit -m "feat(map): 전체화면 높이(dvh)·사이드바 고정폭·푸터 게이트 배선"
```

---

### Task 8: 페이지 정리 — 하단 콘텐츠 제거와 토지 분리

**Files:**
- Modify: `pages/real-estate/index.vue` (전체 재작성)
- Delete: `components/realEstate/RealEstateCategoryCards.vue`, `tests/components/realEstate/RealEstateCategoryCards.test.ts`
- Delete: `tests/pages/real-estate-hub.test.ts` (파일 전체가 하단 콘텐츠 검증이다)
- Modify: `tests/pages/realEstateMapPage.test.ts`, `tests/pages/real-estate/realEstateHub.test.ts`
- Test: `tests/types/navGroups.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: Task 3 의 `layouts/map.vue`, Task 4 의 필터바 링크
- Produces: 없음 (최종 태스크)

- [ ] **Step 1: GNB 토지 링크 존치 회귀 테스트를 작성한다**

`tests/types/navGroups.test.ts` 맨 아래에 추가한다.

```ts
// 하단 유형 카드를 제거한 뒤로 /real-estate/land 의 내부 링크는 이 GNB 항목 하나뿐이다.
// 이걸 지우면 토지 허브와 그 아래 시/도·구군·동 페이지 전체가 내부 링크 0이 된다.
describe('GNB 토지 링크 존치', () => {
  it('부동산 드롭다운에 /real-estate/land 가 있다', () => {
    const realEstate = NAV_LINK_GROUPS.find((g) => g.title === '부동산')
    expect(realEstate).toBeDefined()
    expect(realEstate!.links.map((l) => l.to)).toContain('/real-estate/land')
  })
})
```

`NAV_LINK_GROUPS` 는 이 파일이 이미 import 하고 있다. `describe`/`it`/`expect` 도 이미 import 되어 있다.

- [ ] **Step 2: 테스트가 통과하는지 확인한다(기존 상태를 고정하는 가드다)**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
npx vitest run tests/types/navGroups.test.ts
```

Expected: PASS — 지금은 링크가 있으므로 통과한다. 이 테스트는 앞으로의 삭제를 막는 가드다.

- [ ] **Step 3: 페이지를 재작성한다**

`pages/real-estate/index.vue` 전체를 다음으로 바꾼다.

```vue
<template>
  <RealEstateMapExplorer
    :initial-type="INITIAL_TYPE"
    :initial-items="regions ?? []"
    initial-granularity="city"
  />
</template>

<script setup lang="ts">
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { MapRegionItem, MapResponse } from '~/types/realEstateMap'

// 지도 전용 레이아웃: 헤더만 있고 TrustLine·AppFooter 가 없어 페이지 스크롤이 0이다.
// 푸터는 지도 사이드바 목록 하단으로 옮겼다(MapSidebar showFooter).
definePageMeta({ layout: 'map' })

const INITIAL_TYPE = 'apt-sale'
const apiBase = useApiBase()

// 지도는 SSR 불가라 이 집계가 이 페이지의 유일한 SSR 데이터다.
// 실패해도 [] 를 주면 MapSidebar 가 SIDO_CHIPS 16개 링크를 상수에서 렌더한다(fail-open).
const { data: regions } = await useAsyncData<MapRegionItem[]>(
  'real-estate-map-city',
  async () => {
    try {
      const res = await $fetch<MapResponse>(`${apiBase}/api/real-estate/${INITIAL_TYPE}/map`, {
        params: { level: 13, swLat: 33, swLng: 124, neLat: 39, neLng: 132 },
      })
      return res.data.items as MapRegionItem[]
    } catch {
      return []
    }
  },
  { default: () => [] },
)

const { setMeta } = useFacilityMeta()
setMeta({
  title: '부동산 실거래가 지도',
  description: '전국 아파트·빌라·오피스텔의 매매·전월세 실거래가를 지도에서 확인하세요. 지역별 평균 평당가와 건물별 최근 실거래가를 국토교통부 데이터로 제공합니다.',
  path: '/real-estate',
})

// 정적 FAQ 와 FAQPage 스키마는 제거했다 — 보일러플레이트가 GSC 색인 감소 진단의
// 지목 대상이었고 상세 페이지에서는 이미 제거(#625)됐다. 지역 평균 평당가 실데이터가 대체한다.
const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
])
// 토지는 넣지 않는다. 지도 탐색기가 6종만 다루므로 구조화 데이터도 6종이어야 페이지가
// 알리는 목록과 실제 내용이 일치한다. 토지 접근 경로는 GNB 드롭다운이 담당한다.
setItemListSchema([
  { name: '아파트 매매', url: '/real-estate/apt-sale' },
  { name: '아파트 전월세', url: '/real-estate/apt-rent' },
  { name: '오피스텔 매매', url: '/real-estate/offitel-sale' },
  { name: '오피스텔 전월세', url: '/real-estate/offitel-rent' },
  { name: '빌라 매매', url: '/real-estate/villa-sale' },
  { name: '빌라 전월세', url: '/real-estate/villa-rent' },
])
setDatasetSchema({
  name: '전국 부동산 실거래가 데이터',
  description: '국토교통부 실거래가 공개시스템 기반 전국 아파트·빌라·오피스텔의 매매·전월세 거래 데이터입니다. 지역별 평균 평당가와 건물별 최근 실거래가를 지도로 제공합니다.',
  url: '/real-estate',
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: ['부동산', '실거래가', '아파트', '빌라', '오피스텔', '평당가', '지도', '국토교통부'],
})
</script>
```

`REAL_ESTATE_DATA_SOURCE` 는 `setDatasetSchema` 가 계속 쓰므로 import 를 남긴다. `<script setup>` 상단 import 에 다음 한 줄이 있어야 한다.

```ts
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
```

- [ ] **Step 4: dead code 를 삭제한다**

```bash
git rm components/realEstate/RealEstateCategoryCards.vue tests/components/realEstate/RealEstateCategoryCards.test.ts
```

- [ ] **Step 5: 다른 사용처가 남아 있지 않은지 확인한다**

```bash
grep -rn "RealEstateCategoryCards" pages components tests utils types || echo "사용처 없음"
```

Expected: `사용처 없음` (`components/realEstate/AGENTS.md` 등 문서에만 남는 건 무방하다)

- [ ] **Step 6: `tests/pages/realEstateMapPage.test.ts` 를 갱신한다**

이 파일은 `pages/real-estate/index.vue` 소스를 문자열로 읽어 검사한다. 세 개의 `it` 블록을 바꾼다.

변경 전:
```ts
  it('크롤 경로인 유형 카드와 ItemList 스키마는 유지한다', () => {
    expect(src).toContain('RealEstateCategoryCards')
    expect(src).toContain('setItemListSchema')
  })

  it('Dataset·Breadcrumb 스키마와 출처 섹션을 유지한다', () => {
    expect(src).toContain('setDatasetSchema')
    expect(src).toContain('setBreadcrumbSchema')
    expect(src).toContain('DataSourceSection')
  })

  it('기존 AdBanner 를 남긴다 (광고 축소 금지)', () => {
    expect(src).toContain('AdBanner')
  })
```

변경 후:
```ts
  it('하단 콘텐츠를 전부 제거했다 — 지도만 남는다', () => {
    // 스크롤하면 유형 카드·설명문·출처 블록이 뷰포트를 채워 지도가 사라지던 구성을 걷어냈다.
    expect(src).not.toContain('RealEstateCategoryCards')
    expect(src).not.toContain('DataSourceSection')
    expect(src).not.toContain('BelowFoldContent')
    expect(src).not.toContain('hub-summary')
  })

  it('지도 전용 레이아웃을 지정한다', () => {
    // 이게 없으면 default 레이아웃의 TrustLine·AppFooter 가 붙어 스크롤이 0이 되지 않는다.
    expect(src).toContain("layout: 'map'")
  })

  it('ItemList 는 6종이고 토지를 포함하지 않는다', () => {
    // 지도가 6종만 다루므로 구조화 데이터도 6종이어야 한다. 토지는 GNB 담당.
    expect(src).toContain('setItemListSchema')
    expect(src).not.toContain("'/real-estate/land'")
    for (const t of ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']) {
      expect(src).toContain(`/real-estate/${t}`)
    }
  })

  it('Dataset·Breadcrumb 스키마는 유지한다', () => {
    expect(src).toContain('setDatasetSchema')
    expect(src).toContain('setBreadcrumbSchema')
  })

  it('페이지 본문에 광고를 두지 않는다 — 인피드 광고는 사이드바가 담당한다', () => {
    expect(src).not.toContain('AdBanner')
  })
```

- [ ] **Step 7: `tests/pages/real-estate-hub.test.ts` 를 삭제한다**

이 파일은 `describe('/real-estate 허브 페이지 하단 콘텐츠')` 하나뿐이고, 그 안의 `it` 3개가 전부 이번에 제거하는 대상을 검증한다 — "부동산 유형별 실거래가" H2, "부동산 실거래가란?" H2, 토지 카드 링크. 살릴 단언이 없다.

```bash
git rm tests/pages/real-estate-hub.test.ts
```

세 단언이 검증하던 것은 각각 다른 곳으로 옮겨졌다. 하단 콘텐츠 **부재**는 `realEstateMapPage.test.ts`(Step 6)가, 토지 링크 존치는 `navGroups.test.ts`(Step 1)가 맡는다.

- [ ] **Step 8: `tests/pages/real-estate/realEstateHub.test.ts` 를 갱신한다**

이 파일은 `setItemListSchema` 호출 내용을 검증한다. 세 곳을 고친다.

**(a) `globalStubs` 에서 사라진 컴포넌트 stub 다섯 줄을 지운다.**

지울 줄(객체의 나머지 항목 — `RealEstateMapExplorer` stub 등 — 은 그대로 둔다):
```ts
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /></section>' },
  AdBanner: { template: '<div />' },
  RealEstateCategoryCards: { template: '<div />' },
  DataSourceSection: { template: '<div />' },
```

**(b) canonical URL 검증에서 토지 단언을 뒤집는다.** `it('setItemListSchema가 canonical realEstateType URL로 호출되어야 한다', ...)` 안의 마지막 단언을 바꾼다.

변경 전:
```ts
    expect(urls).toContain('/real-estate/land')
```

변경 후:
```ts
    // 지도 탐색기가 6종만 다루므로 구조화 데이터도 6종이어야 한다. 토지는 GNB 담당.
    expect(urls).not.toContain('/real-estate/land')
```

그 위 6줄(`apt-sale` ~ `offitel-rent` 의 `toContain`)은 그대로 둔다.

**(c) 개수 단언을 6으로 고친다.**

변경 전:
```ts
  it('setItemListSchema 항목이 7개여야 한다 (매매+전월세 × 3 주택유형 + 토지)', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    await mountSuspended(m.default)
    const items = mockSetItemListSchema.mock.calls[0][0]
    expect(items).toHaveLength(7)
  })
```

변경 후:
```ts
  it('setItemListSchema 항목이 6개여야 한다 (매매+전월세 × 3 주택유형)', async () => {
    const m = await import('~/pages/real-estate/index.vue')
    await mountSuspended(m.default)
    const items = mockSetItemListSchema.mock.calls[0][0]
    expect(items).toHaveLength(6)
  })
```

`it('setItemListSchema가 레거시 hub URL을 포함하지 않아야 한다', ...)` 와 `it('컴포넌트가 존재해야 한다', ...)` 는 손대지 않는다.

**(d) `definePageMeta` 를 스텁한다. 이걸 빼면 이 파일 전체가 실패한다.**

`definePageMeta` 는 Nuxt 컴파일러 매크로라 vitest 전역에 없다. Step 3 에서 페이지에 추가했으므로, 페이지를 `import` 하는 이 파일은 스텁이 필요하다. 기존 관례(`tests/pages/detail.test.ts:48`)를 그대로 따라 `vi.mock(...)` 호출들 **바로 아래**에 한 줄 넣는다.

```ts
// definePageMeta 는 Nuxt 컴파일러 매크로다. 페이지가 layout: 'map' 지정에 쓰므로
// 이 스텁이 없으면 import 시점에 ReferenceError 가 난다.
vi.stubGlobal('definePageMeta', vi.fn())
```

- [ ] **Step 9: 관련 테스트를 모두 돌린다**

```bash
npx vitest run tests/pages/ tests/types/ tests/components/realEstate/
```

Expected: PASS

- [ ] **Step 10: 프론트 전체 테스트와 린트를 돌린다**

```bash
npx vitest run
npm run lint
```

Expected: 전부 PASS. **Node 20 인지 반드시 확인한다** — Node 25 면 무관한 27건이 거짓 실패한다.

- [ ] **Step 11: 커밋한다**

```bash
git add pages/real-estate/index.vue tests/pages/ tests/types/navGroups.test.ts
git commit -m "feat(real-estate): 허브를 지도 전용 화면으로 — 하단 콘텐츠 제거, 토지는 GNB 담당"
```

---

## 라이브 확인 (전체 태스크 완료 후)

단위 테스트로 도달할 수 없는 항목이다. 이번 PR 에서 이미 세 건(광고 슬롯 중복, 패닝 발산, 해시 복원)이 이 경로로만 잡혔다. `npm run dev` 로 띄우고 브라우저에서 확인한다.

- [ ] **데스크톱 스크롤 0** — `document.documentElement.scrollHeight === document.documentElement.clientHeight`
- [ ] **모바일 스크롤 0** — 뷰포트를 390×844 로 줄이고 같은 식으로 확인
- [ ] **경계 정렬** — `header > div` 와 `aside`, 지도 컨테이너의 `getBoundingClientRect().left` / `.right` 가 일치
- [ ] **푸터 1벌** — `document.querySelectorAll('[data-testid="footer-links"]').length === 1`
- [ ] **모바일 푸터 도달** — 바텀시트를 펼치고 목록 끝까지 스크롤해 푸터가 나오는지. **건물 모드(줌인해서 200개 구간)에서 확인한다.** 지역 모드 16개만 보고 통과시키면 페이지네이션이 풀려는 문제를 그대로 놓친다
- [ ] **주소창 대응** — 모바일에서 주소창을 접었다 펴도 스크롤이 0으로 유지되는지(`dvh` 검증)
- [ ] **필터바 새 탭** — 필터 링크를 ⌘+클릭해 새 탭이 열리는지, 평범한 클릭은 페이지 이동 없이 지도만 바뀌는지
- [ ] **SSR 크롤 경로** — `curl -s localhost:3000/real-estate | grep -o 'href="/real-estate/[a-z-]*"' | sort -u` 로 6종 href 가 모두 나오는지
