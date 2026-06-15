# [지하철 subway] 상세페이지 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `pages/subway/[slug].vue`를 공통 우선순위 사다리(T0→T6)에 맞춰 정리한다. 현행이 이미 사다리에 거의 부합하므로 큰 재배치는 없다. 4가지만 한다 — (1) 모바일 헤더를 구 `facility/detail/MobileDetailHeader`에서 공용 `common/MobileDetailHeader`로 교체(`category-label` → `eyebrow`), (2) T1 역정보 섹션 최상단에 노선 색상 배지를 **headline화**(dedupe된 노선을 큰 배지로 먼저 노출), (3) 데스크톱 사이드바 Actions에 `station.phoneNumber`가 있을 때만 `tel:` **전화 버튼 추가**, (4) `setFAQSchema(faqItems)`로 **FAQPage JSON-LD 발행**(현재 화면 `<details>`만 있고 JSON-LD는 TrainStation만 발행됨).

**Architecture:** 본 페이지는 단일 flex 컬럼 `<article>`(좌) + sticky `<aside>`(우, `hidden md:flex`) 2컬럼 grid다. **모바일과 데스크톱의 article 섹션 순서가 이미 동일**(T0 헤더 → 광고 → T1 역정보 → 광고 → T2 위치 → 광고 → T4 주변 → 광고 → T4 관련탐색 → T5 FAQ → 모바일쿠팡 → T6 출처)하므로 **spec §3.3 규칙에 따라 order 클래스를 추가하지 않는다**(소스 순서가 곧 렌더 순서, JIT 리스크 회피). 따라서 DataSourceSection wrapper order(§3.3 멀티루트)도 불필요. 데스크톱 위치(T2)는 우측 사이드바 지도로 분리되어 있고(시설·지하철 사이드바 예외, §5), 본문에는 로드뷰+모바일 라이브 지도가 남아 사다리 충돌이 없다. 단일 h1 불변식은 공용 헤더 literal `<h1>` + PageHero `title-tag="div"`(이미 적용됨)으로 유지된다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + happy-dom, TailwindCSS, `~/composables/useStructuredData`(setFAQSchema), `~/utils/subwayLineColors`(lineColor/lineLabel/dedupeLines), `~/utils/categoryFAQ`(CATEGORY_FAQ.subway).

**선행:** Foundation 플랜(공용 헤더) 먼저 적용 — `~/components/common/MobileDetailHeader.vue`가 존재해야 한다(`docs/superpowers/plans/2026-06-15-detail-ordering-00-foundation.md` Task 1 완료 필수). props: `title`(필수)·`eyebrow?`·`status?`·`stats?`·`phone?`·`copyable?`·`hideDirections?`·`kakaoMapUrl?`·`naverMapUrl?`, emits: `share`·`copy`·`directions(provider)`.

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` — §2 사다리, §3.1 단일 h1, §3.3 order 컨벤션(모바일=데스크톱이면 order 추가 금지), §3.4 headline-first, §4.2 지하철, §5 위치/FAQ/T1 그리드 내부배치, §6 결정4(FAQPage JSON-LD 통일).

**전제:** 작업 브랜치에서 진행. 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`).

**광고 현황(유지 — 추가·삭제 금지):** 본문 `<article>`에 `<AdBanner />` 4개(헤더 직후 / 역정보 뒤 / 위치 뒤 / 주변 뒤), 모바일 인라인 `<CoupangBanner class="md:hidden" />` 1개(FAQ 뒤·출처 앞). 데스크톱 `<aside>`에 `<CoupangBanner class="mt-3" />` 1개 + `<AdBanner />` 1개(sticky 별도 컬럼). **이 6개 인스턴스는 본 작업에서 단 한 개도 추가/삭제/이동하지 않는다.**

---

### Task 1: 모바일 헤더를 공용 `MobileDetailHeader`로 교체

현재 페이지는 구 `~/components/facility/detail/MobileDetailHeader.vue`를 import하고 `category-label` prop을 쓴다. 공용 헤더는 `eyebrow` prop을 쓰므로 import 경로 + prop명을 함께 교체한다. (Foundation Task 2는 시설 페이지만 다루므로 지하철은 별도 마이그레이션 필요.)

**Files:**
- Modify: `frontend/pages/subway/[slug].vue:285` (import 경로)
- Modify: `frontend/pages/subway/[slug].vue:77-87` (`<MobileDetailHeader>` 사용부 — `category-label` → `eyebrow`)
- Test: `frontend/tests/pages/subway-detail.test.ts` (정적 소스 가드 확장 — 신규 테스트 파일 불필요)

- [ ] **Step 1: 실패하는 가드 테스트 추가**

기존 `frontend/tests/pages/subway-detail.test.ts`는 파일 내용을 문자열로 읽어 정규식 가드한다(렌더 mount 아님). 같은 패턴으로 헤더 마이그레이션 가드를 추가한다. 파일 끝 `describe` 블록 뒤에 아래 describe를 추가:

```ts
describe('subway/[slug].vue 공용 헤더 마이그레이션', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('공용 common/MobileDetailHeader를 import한다', () => {
    expect(content).toMatch(/from '~\/components\/common\/MobileDetailHeader\.vue'/)
  })

  it('구 facility/detail/MobileDetailHeader는 더 이상 import하지 않는다', () => {
    expect(content).not.toMatch(/components\/facility\/detail\/MobileDetailHeader/)
  })

  it("헤더에 category-label 대신 eyebrow prop을 쓴다", () => {
    expect(content).not.toMatch(/category-label=/)
    expect(content).toMatch(/eyebrow="지하철역"/)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: FAIL — 신규 3 테스트 실패. 출력에 다음과 유사한 메시지:
```
FAIL  tests/pages/subway-detail.test.ts > subway/[slug].vue 공용 헤더 마이그레이션 > 공용 common/MobileDetailHeader를 import한다
AssertionError: expected '<...source...>' to match /from '~\/components\/common\/MobileDetailHeader\.vue'/
```
(기존 noindex 가드 4개는 계속 PASS)

- [ ] **Step 3: import 경로 교체**

`frontend/pages/subway/[slug].vue:285`:

```ts
// 변경 전
import MobileDetailHeader from '~/components/facility/detail/MobileDetailHeader.vue'
// 변경 후
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
```

- [ ] **Step 4: 템플릿 prop 교체 (`category-label` → `eyebrow`)**

`frontend/pages/subway/[slug].vue:77-87` 의 `<MobileDetailHeader>` 사용부를 변경. emits는 그대로 호환(`@share`/`@copy`/`@directions`). `phone`은 그대로 전달(전화 pill 자동 노출), `copyable`/`hideDirections` 미전달(복사 pill은 공용 헤더 기본 false라 숨김 — 현행 동작 유지를 위해 `copyable` 추가):

```vue
<!-- 변경 전 -->
<MobileDetailHeader
  :title="displayName"
  category-label="지하철역"
  :stats="heroStats"
  :phone="station.phoneNumber"
  :kakao-map-url="kakaoMapUrl"
  :naver-map-url="naverMapUrl"
  @share="handleShare"
  @copy="copyStationAddress"
  @directions="openDirections"
/>

<!-- 변경 후 -->
<MobileDetailHeader
  :title="displayName"
  eyebrow="지하철역"
  :stats="heroStats"
  :phone="station.phoneNumber"
  copyable
  :kakao-map-url="kakaoMapUrl"
  :naver-map-url="naverMapUrl"
  @share="handleShare"
  @copy="copyStationAddress"
  @directions="openDirections"
/>
```

> **참고:** `copyStationAddress`는 이미 `<script>`에 존재(line 512). 공용 헤더가 `copyable`일 때만 복사 pill을 노출하므로, 현행처럼 주소 복사 동작을 유지하려면 `copyable`이 필요하다. 단 `station.address`/`roadAddress`가 항상 있는 건 아니므로 동작 자체는 `copyStationAddress` 내부 가드(`if (!address) return`)가 처리한다.

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: PASS (기존 4 + 신규 3 = 7 tests)

- [ ] **Step 6: 커밋**

```bash
git add frontend/pages/subway/\[slug\].vue frontend/tests/pages/subway-detail.test.ts
git commit -m "refactor(subway): 상세 헤더를 공용 MobileDetailHeader로 교체 (category-label→eyebrow)"
```

---

### Task 2: T1 역정보 섹션 — 노선 색상 배지 headline화

현재 역정보 섹션(`SectionBlock heading="역정보"`)은 `<dl>` 그리드 안에 노선/주소/운영기관/전화를 평면 나열한다. 노선이 `sm:col-span-2` 첫 항목이긴 하나 다른 라벨-값과 동급 크기다. spec §4.2 "노선 배지를 섹션 최상단 headline화" + §3.4 headline-first에 맞춰, **dedupe된 노선 색상 배지를 `<dl>` 위에 큰 headline 블록으로 분리**한다. 기존 `<dl>` 안의 노선 항목은 중복이므로 제거한다(headline으로 승격됨).

**Files:**
- Modify: `frontend/pages/subway/[slug].vue:100-133` (역정보 SectionBlock 내부)
- Test: `frontend/tests/pages/subway/subwayDetailRender.test.ts` (신규 — mount 렌더 가드)

- [ ] **Step 1: 실패하는 렌더 테스트 작성**

mount 기반으로 (a) h1 count===1, (b) 역정보 headline에 노선 배지가 `data-test="line-headline"` 안에 렌더되고, (c) 콘솔 에러 없음을 검증한다. 공용 헤더/지도 등 무거운 자식은 stub한다. `frontend/tests/pages/subway/subwayDetailRender.test.ts` 신규 작성:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// 역정보 headline 단위만 검증하는 경량 하니스.
// 페이지 전체 mount는 useAsyncData/$fetch/카카오맵 의존이 커서,
// headline 마크업(노선 dedupe 배지 + h1 단일성)을 재현한 SFC 스니펫으로 가드한다.
import { lineColor, lineLabel, dedupeLines } from '~/utils/subwayLineColors'

const StationHeadline = defineComponent({
  props: { rawLines: { type: Array, default: () => [] }, name: { type: String, default: '' } },
  setup(props) {
    const lines = dedupeLines(props.rawLines as string[])
    return () =>
      h('section', [
        h('h1', props.name),
        h(
          'div',
          { 'data-test': 'line-headline' },
          lines.map((ln) =>
            h('span', { key: ln, style: { backgroundColor: lineColor(ln) } }, lineLabel(ln)),
          ),
        ),
      ])
  },
})

afterEach(() => vi.restoreAllMocks())

describe('subway 역정보 headline', () => {
  it('단일 h1을 유지한다', () => {
    const w = mount(StationHeadline, { props: { name: '강남역', rawLines: ['2호선'] } })
    expect(w.findAll('h1').length).toBe(1)
  })

  it('환승 노선을 dedupe해 색상 배지로 headline에 노출한다', () => {
    const w = mount(StationHeadline, { props: { name: '종로3가역', rawLines: ['1호선', '3호선', '5호선', '1호선'] } })
    const headline = w.find('[data-test="line-headline"]')
    expect(headline.exists()).toBe(true)
    const badges = headline.findAll('span')
    expect(badges.length).toBe(3) // 중복 1호선 제거
    expect(headline.text()).toContain('1호선')
    expect(headline.text()).toContain('5호선')
    badges.forEach((b) => expect(b.attributes('style')).toMatch(/background-color/))
  })

  it('렌더 중 콘솔 에러가 없다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount(StationHeadline, { props: { name: '강남역', rawLines: ['2호선'] } })
    expect(spy).not.toHaveBeenCalled()
  })
})
```

> **참고:** 페이지 전체 mount는 `useSubwayStation`(useAsyncData) + 카카오맵 async 컴포넌트 의존이 커서 비용 대비 가치가 낮다. 위 하니스는 headline의 실제 유틸(`dedupeLines`/`lineColor`/`lineLabel`)을 그대로 호출해 dedupe·색상 로직과 단일 h1을 검증한다. 페이지의 정적 마크업 존재 여부는 Task 2 Step 5의 소스 가드(subway-detail.test.ts)로 보완한다.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/subway/subwayDetailRender.test.ts`
Expected: FAIL 또는 통과 가능성 있음 — 이 하니스는 페이지 마크업이 아닌 재현 스니펫이라 즉시 PASS할 수 있다. **그 경우 Step 3로 진행하되, 페이지의 실제 headline 마크업은 Step 5 소스 가드로 강제한다.** (TDD 정신상 Step 5 소스 가드를 먼저 빨갛게 만드는 것이 핵심이므로, Step 2에서 `subway-detail.test.ts`도 함께 실행해 신규 소스 가드의 실패를 확인한다 — 아래 Step 5 참조.)

- [ ] **Step 3: 역정보 SectionBlock에 노선 headline 블록 추가**

`frontend/pages/subway/[slug].vue:100-133`. `SectionBlock heading="역정보"` 의 `<dl>` **위**에 노선 headline 블록을 추가하고, `<dl>` 안의 기존 노선 항목(line 102-114)을 제거한다(headline으로 승격되어 중복):

```vue
<!-- 변경 전 -->
<SectionBlock heading="역정보" subtext="위치·운영기관·연락처 정보">
  <dl class="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
    <div v-if="lines.length > 0" class="sm:col-span-2">
      <dt class="text-xs font-medium text-muted mb-1.5">노선</dt>
      <dd class="flex flex-wrap gap-1.5">
        <span
          v-for="ln in lines"
          :key="ln"
          class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full text-white"
          :style="{ backgroundColor: lineColor(ln) }"
        >
          {{ lineLabel(ln) }}
        </span>
      </dd>
    </div>

    <div v-if="station.roadAddress || station.address" class="sm:col-span-2">
      <dt class="text-xs font-medium text-muted mb-1">주소</dt>
      <dd class="text-sm text-strong">{{ station.roadAddress || station.address }}</dd>
    </div>

    <div v-if="station.operator">
      <dt class="text-xs font-medium text-muted mb-1">운영기관</dt>
      <dd class="text-sm text-strong">{{ station.operator }}</dd>
    </div>

    <div v-if="station.phoneNumber">
      <dt class="text-xs font-medium text-muted mb-1">전화번호</dt>
      <dd class="text-sm text-strong">
        <a :href="`tel:${station.phoneNumber}`" class="hover:text-primary hover:underline">{{ station.phoneNumber }}</a>
      </dd>
    </div>
  </dl>
</SectionBlock>

<!-- 변경 후 -->
<SectionBlock heading="역정보" subtext="위치·운영기관·연락처 정보">
  <!-- 노선 headline (대표 정보 1순위) -->
  <div v-if="lines.length > 0" data-test="line-headline" class="mb-4 flex flex-wrap gap-2">
    <span
      v-for="ln in lines"
      :key="ln"
      class="inline-flex items-center text-sm font-bold px-3.5 py-1.5 rounded-full text-white shadow-sm"
      :style="{ backgroundColor: lineColor(ln) }"
    >
      {{ lineLabel(ln) }}
    </span>
  </div>

  <dl class="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-8">
    <div v-if="station.roadAddress || station.address" class="sm:col-span-2">
      <dt class="text-xs font-medium text-muted mb-1">주소</dt>
      <dd class="text-sm text-strong">{{ station.roadAddress || station.address }}</dd>
    </div>

    <div v-if="station.operator">
      <dt class="text-xs font-medium text-muted mb-1">운영기관</dt>
      <dd class="text-sm text-strong">{{ station.operator }}</dd>
    </div>

    <div v-if="station.phoneNumber">
      <dt class="text-xs font-medium text-muted mb-1">전화번호</dt>
      <dd class="text-sm text-strong">
        <a :href="`tel:${station.phoneNumber}`" class="hover:text-primary hover:underline">{{ station.phoneNumber }}</a>
      </dd>
    </div>
  </dl>
</SectionBlock>
```

> **변경 요약:** 노선 배지가 `<dl>` 첫 항목(작은 `text-xs` 라벨 아래)에서 `<dl>` 위 headline(`text-sm font-bold` + `px-3.5 py-1.5` 큰 배지)로 승격. dedupe는 기존 `lines` computed(`dedupeLines` 사용, line 321-325)가 그대로 처리하므로 로직 변경 없음. `lineColor`/`lineLabel`은 이미 import됨(line 286).

- [ ] **Step 4: 렌더 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/subway/subwayDetailRender.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: 소스 가드 추가 + 통과 확인 (headline 마크업 강제)**

`frontend/tests/pages/subway-detail.test.ts` 의 "공용 헤더 마이그레이션" describe 아래에 headline 소스 가드 describe를 추가:

```ts
describe('subway/[slug].vue 역정보 headline', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('노선 배지를 line-headline 블록으로 노출한다', () => {
    expect(content).toMatch(/data-test="line-headline"/)
  })

  it('노선 배지는 dedupe된 lines computed를 순회한다', () => {
    expect(content).toMatch(/v-for="ln in lines"/)
    expect(content).toMatch(/lineColor\(ln\)/)
  })
})
```

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: PASS (Task1 7 + 신규 2 = 9 tests). (만약 Step 3 적용 전에 이 가드를 먼저 실행했다면 `data-test="line-headline"` 미매치로 FAIL → Step 3 적용 후 PASS.)

- [ ] **Step 6: 커밋**

```bash
git add frontend/pages/subway/\[slug\].vue frontend/tests/pages/subway-detail.test.ts frontend/tests/pages/subway/subwayDetailRender.test.ts
git commit -m "feat(subway): 역정보 섹션 노선 색상 배지 headline화 (T1 headline-first)"
```

---

### Task 3: 데스크톱 사이드바 Actions에 `tel:` 전화 버튼 추가

현재 데스크톱 `<aside>` Actions(line 231-259)는 "공유하기" + "길찾기" 2버튼뿐이다. spec §5 헤더 패턴(CTA: 공유 항상·전화 phone조건·길찾기 좌표조건)에 맞춰 `station.phoneNumber`가 있을 때만 `tel:` 전화 버튼을 추가한다. 모바일은 공용 헤더가 이미 전화 pill을 처리하므로 데스크톱만 보완.

**Files:**
- Modify: `frontend/pages/subway/[slug].vue:231-239` (Actions 컨테이너 — 공유 버튼 앞에 전화 버튼 삽입)
- Test: `frontend/tests/pages/subway-detail.test.ts` (소스 가드 확장)

- [ ] **Step 1: 실패하는 소스 가드 추가**

`frontend/tests/pages/subway-detail.test.ts` 끝에 describe 추가:

```ts
describe('subway/[slug].vue 데스크톱 전화 버튼', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('사이드바 Actions에 station.phoneNumber 조건부 tel: 버튼이 있다', () => {
    expect(content).toMatch(/data-test="sidebar-call"/)
    expect(content).toMatch(/:href="`tel:\$\{station\.phoneNumber\}`"/)
  })

  it('전화 버튼은 phoneNumber가 있을 때만 렌더된다 (v-if 가드)', () => {
    expect(content).toMatch(/v-if="station\.phoneNumber"[^>]*data-test="sidebar-call"|data-test="sidebar-call"[\s\S]{0,200}?v-if="station\.phoneNumber"/)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: FAIL — 신규 2 테스트:
```
AssertionError: expected '<...source...>' to match /data-test="sidebar-call"/
```

- [ ] **Step 3: 사이드바 Actions에 전화 버튼 삽입**

`frontend/pages/subway/[slug].vue:231-239`. Actions 컨테이너의 "공유하기" 버튼 **앞**에 전화 버튼을 추가. 전화 버튼은 `flex-1`로 공유 버튼과 동급 폭(길찾기는 `flex-[2]` 유지):

```vue
<!-- 변경 전 -->
<!-- Actions -->
<div class="mt-3 p-4 bg-white border border-line-2 flex gap-3 shadow-card rounded-xl">
  <button
    class="flex-1 h-12 rounded-xl bg-background-light text-strong font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
    aria-label="공유하기"
    @click="handleShare"
  >
    <span class="material-symbols-outlined">share</span>
    공유하기
  </button>

<!-- 변경 후 -->
<!-- Actions -->
<div class="mt-3 p-4 bg-white border border-line-2 flex gap-3 shadow-card rounded-xl">
  <a
    v-if="station.phoneNumber"
    data-test="sidebar-call"
    :href="`tel:${station.phoneNumber}`"
    class="flex-1 h-12 rounded-xl bg-background-light text-strong font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
    aria-label="전화 걸기"
  >
    <span class="material-symbols-outlined">call</span>
    전화
  </a>
  <button
    class="flex-1 h-12 rounded-xl bg-background-light text-strong font-bold text-base hover:bg-gray-200 transition-colors flex items-center justify-center gap-2 border border-gray-200"
    aria-label="공유하기"
    @click="handleShare"
  >
    <span class="material-symbols-outlined">share</span>
    공유하기
  </button>
```

> **참고:** 닫는 태그 구조 변경 없음 — 기존 길찾기 블록(`<div class="relative flex-[2]">...`)과 컨테이너 닫는 `</div>`(line 259)는 그대로 둔다. 전화(`flex-1`) + 공유(`flex-1`) + 길찾기(`flex-[2]`)가 한 줄에 들어가며, phoneNumber 없으면 공유+길찾기만 노출(현행 동일).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: PASS (Task2까지 9 + 신규 2 = 11 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/subway/\[slug\].vue frontend/tests/pages/subway-detail.test.ts
git commit -m "feat(subway): 데스크톱 사이드바에 전화번호 조건부 tel: 버튼 추가"
```

---

### Task 4: FAQPage JSON-LD 발행 (`setFAQSchema`)

현재 페이지는 화면에 `<details>` FAQ만 렌더하고(line 200-207, `faqItems` = `CATEGORY_FAQ.subway`), JSON-LD는 `buildSubwayJsonLd`(TrainStation)만 발행한다(line 564-571). spec §5 FAQ + §6 결정4("FAQ 있는 페이지는 FAQPage JSON-LD 발행 통일")에 맞춰 `setFAQSchema(faqItems.value)`를 추가한다. `setFAQSchema`는 별도 `key: 'jsonld-faq'` script를 발행하므로 기존 TrainStation JSON-LD와 충돌하지 않는다(spec: 화면 노출만으론 SEO 가치 없음).

**Files:**
- Modify: `frontend/pages/subway/[slug].vue:275-294` (import에 `useStructuredData` 추가)
- Modify: `frontend/pages/subway/[slug].vue:564-571` 부근 (FAQ 스키마 발행 호출 추가)
- Test: `frontend/tests/pages/subway-detail.test.ts` (소스 가드 확장)

- [ ] **Step 1: 실패하는 소스 가드 추가**

`frontend/tests/pages/subway-detail.test.ts` 끝에 describe 추가:

```ts
describe('subway/[slug].vue FAQPage JSON-LD', () => {
  const filePath = resolve(__dirname, '../../pages/subway/[slug].vue')
  const content = readFileSync(filePath, 'utf-8')

  it('useStructuredData를 import한다', () => {
    expect(content).toMatch(/useStructuredData/)
  })

  it('setFAQSchema에 faqItems를 전달해 발행한다', () => {
    expect(content).toMatch(/setFAQSchema\(\s*faqItems\.value\s*\)/)
  })

  it('TrainStation JSON-LD(buildSubwayJsonLd)도 함께 유지한다', () => {
    expect(content).toMatch(/buildSubwayJsonLd/)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: FAIL — `useStructuredData`/`setFAQSchema` 미존재:
```
AssertionError: expected '<...source...>' to match /useStructuredData/
```

- [ ] **Step 3: `useStructuredData` import + 호출 추가**

(a) `frontend/pages/subway/[slug].vue:294` 부근, import 블록 끝(`import { CATEGORY_FAQ } from '~/utils/categoryFAQ'` 다음 줄)에 추가:

```ts
// 변경 전 (line 294)
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
// 변경 후 (다음 줄 추가)
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { useStructuredData } from '~/composables/useStructuredData'
```

(b) `frontend/pages/subway/[slug].vue` 의 기존 TrainStation `useHead({ script: [...] })` 블록(line 564-571) **앞**에 FAQ 스키마 발행 추가. `faqItems`는 이미 정의됨(line 370):

```ts
// 변경 전 (line 564~)
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify(buildSubwayJsonLd(station.value))),
    },
  ],
})

// 변경 후 (위에 setFAQSchema 추가)
// FAQPage JSON-LD (spec §6 결정4: FAQ 있는 페이지는 스키마 발행 통일)
const { setFAQSchema } = useStructuredData()
setFAQSchema(faqItems.value)

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: computed(() => JSON.stringify(buildSubwayJsonLd(station.value))),
    },
  ],
})
```

> **참고:** `setFAQSchema`는 내부에서 `faqs.length === 0`이면 early-return하므로 빈 FAQ 안전. `key: 'jsonld-faq'`로 발행되어 기존 무키 TrainStation script와 별개 `<script>` 태그가 된다(중복 JSON-LD 아님 — 서로 다른 @type). `faqItems`는 정적 `CATEGORY_FAQ.subway`라 `.value`로 한 번 평가하면 충분(역마다 동일).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts`
Expected: PASS (11 + 신규 3 = 14 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/subway/\[slug\].vue frontend/tests/pages/subway-detail.test.ts
git commit -m "feat(subway): FAQPage JSON-LD 발행 (setFAQSchema 통일)"
```

---

### Task 5: 전체 검증 (h1 단일성 · 빌드 · 회귀)

본 페이지는 모바일=데스크톱 순서가 동일해 order 클래스를 추가하지 않았다(spec §3.3). 마지막으로 단일 h1 불변식, 빌드, 전체 테스트를 검증한다.

**Files:**
- Test: 전체 프론트 테스트 + 빌드 (수정 없음)

- [ ] **Step 1: subway 관련 테스트 전부 실행**

Run: `cd frontend && npx vitest run tests/pages/subway-detail.test.ts tests/pages/subway/subwayDetailRender.test.ts tests/pages/subwaySlugCanonical.test.ts tests/utils/subwayLineColors.test.ts tests/utils/subwayMeta.test.ts`
Expected: 전부 PASS. subway-detail.test.ts는 14 tests, subwayDetailRender 3 tests, 나머지 기존대로 PASS.

- [ ] **Step 2: 단일 h1 불변식 정적 가드 확인**

이 페이지는 공용 헤더(literal `<h1>`, line 122 of common header) + PageHero `title-tag="div"`(line 90, `hidden md:block`)로 어느 뷰포트든 literal h1 1개다. 정적 확인:

```bash
cd frontend && grep -n 'title-tag="div"' pages/subway/\[slug\].vue
```
Expected: 1건 매치(`<PageHero class="hidden md:block" title-tag="div" ...`). 페이지 템플릿에 literal `<h1`은 없어야 함(헤더 컴포넌트가 소유):
```bash
cd frontend && grep -c '<h1' pages/subway/\[slug\].vue
```
Expected: `0` (에러 상태 `<h2>`만 있고 페이지 본문 h1은 공용 헤더 컴포넌트 내부 — 페이지 파일 자체엔 literal `<h1` 없음).

- [ ] **Step 3: 전체 프론트 테스트 + 빌드**

Run: `cd frontend && npx vitest run && npm run build`
Expected: 전체 테스트 PASS, 빌드 성공(공용 헤더 resolve 에러 없음, 구 facility 헤더 참조 잔존 없음).

- [ ] **Step 4: (수동 스모크, 선택) Nitro 캐시 삭제 후 dev 확인**

spec §3.3: 재배치 검증 시 Nitro route cache 삭제 필요. 본 페이지는 SSR 캐시 헤더 영향을 받을 수 있으므로 dev 스모크 전 캐시 삭제 권장:
```bash
cd frontend && rm -rf .nuxt/cache/nitro/routes && npm run dev
```
브라우저에서 `/subway/<임의-슬러그>` 접속 → (a) 모바일 폭에서 헤더 1개 + 노선 배지 headline, (b) 데스크톱 폭에서 사이드바에 전화(phoneNumber 있는 역)·공유·길찾기 3버튼, (c) DevTools Elements에서 `h1` 1개, (d) `<script type="application/ld+json">` 중 FAQPage 1개 + TrainStation 1개 확인. 콘솔 에러 없음.

- [ ] **Step 5: 최종 커밋(없으면 생략)**

검증만 했으면 코드 변경 없음 → 커밋 불필요. (검증 중 발견된 회귀가 있으면 해당 Task로 돌아가 수정 후 재검증.)

---

## Self-Review

- **Spec §4.2 (지하철) 커버:**
  - "T1 = 역정보 — 노선 색상 배지(환승 dedupe) + 주소 + 운영기관 + 전화. 노선 배지를 섹션 최상단 headline화" → **Task 2** (dedupe는 기존 `lines` computed의 `dedupeLines` 재사용, headline은 `<dl>` 위 큰 배지 블록).
  - "현행이 이미 사다리에 거의 부합 / 데스크톱 지도는 우측 사이드바 / 순서: 브레드크럼+공유 → T0 → 광고 → T1 → 광고 → T2 위치 → 광고 → T4 주변 → 광고 → T4 관련탐색 → T5 FAQ → 모바일쿠팡 → T6 출처" → **이미 부합**. spec §3.3 "모바일=데스크톱 순서가 같으면 order 클래스 추가 말고 소스 순서 유지"에 따라 order 클래스 미추가(Architecture에 명시).
  - "데스크톱 사이드바 Actions에 tel: 전화 버튼 추가(현재 공유+길찾기만)" → **Task 3** (phoneNumber 조건부).
  - spec §6 결정4 "FAQ 있는 페이지는 FAQPage JSON-LD 발행 통일"(원 목표 "setFAQSchema(categoryFAQ.subway) 주입, 현재 화면 details만, JSON-LD는 TrainStation만") → **Task 4** (`setFAQSchema(faqItems.value)`, faqItems = CATEGORY_FAQ.subway).
  - "모바일 헤더는 이미 공용 헤더 사용 중" — 정정: 실제 소스(line 285)는 **구 `facility/detail/MobileDetailHeader`**를 import하고 `category-label` prop을 쓰고 있었음. **Task 1**에서 공용 `common/MobileDetailHeader`로 교체 + `eyebrow`로 prop명 정정(원 목표의 "공용 헤더 사용 중" 전제와 실제 소스 불일치를 바로잡음 — Foundation 선행 필수).
- **spec §3.1 단일 h1:** Task 5 Step 2에서 정적 가드(공용 헤더 literal h1 + PageHero `title-tag="div"` + 페이지 파일 자체 literal `<h1` 0개) 확인. Task 2 렌더 하니스에서도 h1 count===1 검증.
- **광고 불변(§3.2):** 본문 AdBanner 4 + 모바일 CoupangBanner 1 + 사이드바 CoupangBanner 1 + AdBanner 1 = 총 6 인스턴스. **어느 Task도 광고를 추가/삭제/이동하지 않음**(Task 3는 Actions div 내부 버튼만 추가, 광고와 무관). order 미사용이라 광고-콘텐츠 인접 관계 그대로 보존.
- **플레이스홀더 스캔:** "적절히 처리/TODO/위와 유사" 없음. 모든 마크업 변경은 실제 before→after 코드 블록으로 제시(Task 1 prop, Task 2 노선 headline, Task 3 전화 버튼, Task 4 import+setFAQSchema). vitest 명령은 정확한 경로(`tests/pages/subway-detail.test.ts` 등). 커밋 메시지 명시.
- **타입/prop 일관성:** 공용 헤더 prop명(`title`/`eyebrow`/`stats`/`phone`/`copyable`/`kakao-map-url`/`naver-map-url`)·emits(`share`/`copy`/`directions`)는 Foundation Task 1 정의와 일치. `lines`/`lineColor`/`lineLabel`/`dedupeLines`는 기존 import·computed 재사용(신규 의존 없음). `setFAQSchema(faqs: {question,answer}[])` 시그니처에 `faqItems.value`(= `CATEGORY_FAQ.subway`, `{question,answer}[]`) 형 일치. `useStructuredData`는 `~/composables/useStructuredData`에서 named export 확인됨.
- **리스크:** (1) Task 1에서 `copyable` 누락 시 복사 pill이 사라져 현행 복사 동작 회귀 → `copyable` 명시로 방지. (2) Task 2에서 `<dl>` 안 노선 항목 제거 누락 시 노선 중복 노출 → before/after에서 명시적으로 제거. (3) Task 4에서 `faqItems`를 reactive로 안 감싸지만 정적 데이터라 안전(역마다 동일). (4) Nitro route cache로 dev 검증 시 변경 미반영 가능 → Task 5 Step 4에서 캐시 삭제 명시.
