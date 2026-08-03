# 마이크로카피 톤·잔여 빈값 (신뢰 디자인 격상 PR ⑥) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 머지된 PR ⑤(#561)가 §5-8에서 남긴 안전 항목을 마무리한다 — (A) 부동산 상세 히어로의 빈값 문구를 `정보 없음 · 현장 확인 필요`로 통일하고 모바일칩 커플링을 구조적으로 제거, (B) 콘텐츠 생성기 프롬프트에 해요체·상투어 금지 규칙 추가, (C) 공매 집행기관 카드 빈값 통일, (D) 어드민 기사 카드 날짜 점(.) 표기.

**Architecture:** 4개 독립 트랙. 프론트 3곳(부동산 상세 페이지 1, 공매 상세 컴포넌트 1, 어드민 카드 1)은 이미 존재하는 단일 소스 상수(`EMPTY_FIELD_TEXT`)·유틸(`formatDotDate`)을 **재사용**하는 최소 편집이다. 백엔드 1곳(생성기 2파일 4편집)은 OpenAI **user 프롬프트 문자열 안에만** 톤 규칙을 추가하며, DB·SSR·메타·JSON-LD를 일절 건드리지 않는다. 네 트랙은 서로 의존이 없다.

**Tech Stack:** Nuxt 3 + Vue 3(script setup) / Express 5 + TypeScript(ESM, OpenAI) / Vitest

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §5-8 (마이크로카피 원칙). 사용자 결정: 경계 항목 2건(공매 카드·어드민 날짜) **모두 포함**.

## ⚠️ 이미 반영됨 — 재작업 금지 (ground-truth: ledger + develop HEAD `4048c3be`)

이미 머지된 **PR ⑤(#561)** 가 §5-8의 빈값(시설)·날짜·금액을 이미 처리했다(초기 메모리가 #561을 누락해 스테일했음 — SDD ledger로 확인). 아래 3건은 이 PR 대상이 아니다:
- **날짜(rule 3)** — PR ⑤(#561) Task 2·3에서 완료. `DataSourceSection`은 사전 포맷된 prop를 그대로 렌더(내부 날짜 호출 0), 5개 호출처 전부 `formatDotDate`, 거래 표는 이미 `YY.MM.DD`(`String(dealYear).slice(2)`). **손대지 말 것.**
- **금액(rule 2)** — PR ⑤(#561) 커밋 `3ba78da5`에서 완료. `search.vue` 로컬 `formatRealEstatePrice` 제거→`formatKoreanPrice`. 원-병기 위반 없음. **손대지 말 것.**
- **빈값 시설분(rule 4)** — PR ⑤(#561) Task 1에서 `EMPTY_FIELD_TEXT`(`frontend/utils/emptyField.ts`) 단일 소스를 `FieldGrid.vue`·`DetailBasicInfo.vue`·`DetailFacilityStatus.vue`(81곳)에 적용. 시설 상세는 대상 아님. **남은 건 부동산 히어로(Track A)뿐.**

## Global Constraints

- **Node 20 필수**: 모든 `npm`/`npx`/`vitest` 실행 앞에 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **SEO/SSR 불변식**: URL·단일 h1·title/meta 생성 로직·canonical·noindex 게이트·사이트맵 불변. SSR 텍스트는 **늘어나는 방향만** 허용. 아래 **센티널 `'-'` 절대 변경 금지**(`[buildingName].vue`): `fullAddress`(L793-798)·`areaRange`(L815-821)·`latestPrice`(L823-832)는 `!== '-'` 가드로 meta description·JSON-LD address에 소비되는 내부 센티널이다. 문구로 바꾸면 메타/구조화데이터가 깨진다. 메타 문자열은 `buildRealEstateDetailMeta`(detailMeta computed)에서 별도로 나오므로 히어로 `PLACEHOLDER` 변경과 무관.
- **날짜 3형 공존(rule 3)**: 본문 `YYYY.MM.DD`(점) / 표 `YY.MM.DD` / 메타·JSON-LD `YYYY-MM-DD`(대시)는 설계상 공존. `useStructuredData.ts`의 `formatKstDate`(datePublished/dateModified 등)·`subscription/[id].vue`의 SEO description 날짜는 **대시 유지**. 전역 find/replace 금지 — 지정된 렌더만 편집.
- **빈값 단일 소스**: 빈값 문구는 반드시 `import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'`로 가져와 쓴다. 리터럴 `'정보 없음 · 현장 확인 필요'`를 다시 타이핑하지 말 것.
- **생성기-프롬프트 한정(rule 1·5)**: 톤 규칙은 OpenAI user 프롬프트 문자열에만 추가. **DB row·SSR 렌더 문자열·FAQ 블록·JSON-LD/메타를 편집하지 않는다.** 기존 발행 콘텐츠 배치 수정(rule 5의 "기존 콘텐츠 배치 수정")은 SEO 위험(FAQ/메타 JSON-LD ~200곳)으로 **이번 범위 밖**(§11 Phase 3 후보).
- **광고 불변**: 광고 슬롯 수·위치·collapse 불변(이 PR은 광고 미변경).
- **커밋**: conventional commit 한국어(`feat(trust): …`). PR은 develop 대상, 자체 머지 금지.

## 브랜치

Task 1 Step 1에서 생성:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b feat/trust-microcopy-tone
```

---

### Task 1: 부동산 상세 히어로 빈값 → `EMPTY_FIELD_TEXT` 통일 (Track A)

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
  - import 추가(L419 `uiMessages` import 다음)
  - L842 `rentRatioLabel` 반환값 / L847 `heroStats` PLACEHOLDER / L867-869 `mobileHeaderStats` 필터+주석
- Test(create): `frontend/tests/pages/real-estate/buildingDetailHeroEmpty.test.ts`

**Interfaces:**
- Consumes: `EMPTY_FIELD_TEXT`(`~/utils/emptyField`, `export const EMPTY_FIELD_TEXT = '정보 없음 · 현장 확인 필요'`)
- Produces: 없음

**현재 구조(확인됨, develop `4048c3be`):** 히어로 빈값 리터럴은 **정확히 3곳(L842·L847·L869) + 주석 1곳(L867)**. `heroStats`의 `PLACEHOLDER`와 `mobileHeaderStats`의 필터가 각기 리터럴 `'정보 없음'`을 재타이핑 → 한쪽만 바뀌면 빈 칩 누출(커플링 버그). 셋 다 `EMPTY_FIELD_TEXT`를 참조시키면 버그가 **구조적으로 불가능**해진다.

- [ ] **Step 1: 브랜치 생성** (위 "브랜치" 블록 실행)

- [ ] **Step 2: 실패 테스트 작성(RED)** — `frontend/tests/pages/real-estate/buildingDetailHeroEmpty.test.ts` 신규:

```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

// 히어로 빈값 문구를 EMPTY_FIELD_TEXT 단일 소스로 통일 — 히어로·rentRatio·모바일칩 필터가
// 같은 상수를 참조하는지 소스로 락(커플링 회귀 방지). 페이지 마운트는 과도하므로 소스 가드 채택.
const SRC = readFileSync(
  fileURLToPath(
    new URL(
      '../../../pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue',
      import.meta.url,
    ),
  ),
  'utf-8',
)

describe('부동산 상세 히어로 빈값 — EMPTY_FIELD_TEXT 통일 (§5-8 rule4)', () => {
  it('EMPTY_FIELD_TEXT를 import한다', () => {
    expect(SRC).toContain("import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'")
  })
  it("bare '정보 없음' 리터럴이 남아있지 않다 (3곳 전부 상수화)", () => {
    expect(SRC).not.toContain("'정보 없음'")
  })
  it('모바일 헤더칩 필터가 EMPTY_FIELD_TEXT 상수를 참조한다 (커플링 구조적 보장)', () => {
    expect(SRC).toContain('s.value !== EMPTY_FIELD_TEXT')
  })
})
```

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/pages/real-estate/buildingDetailHeroEmpty.test.ts
```
Expected: FAIL — import 없음·`'정보 없음'` 리터럴 잔존.

- [ ] **Step 3: import 추가** — `[buildingName].vue` L419 `import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'` 바로 다음 줄에:

```ts
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'
```

- [ ] **Step 4: 3곳 리터럴 → 상수 치환** — 아래 3개 편집(정확히 이 문자열):

L842:
```ts
  if (rentRatioTotal.value === 0) return '정보 없음'
```
→
```ts
  if (rentRatioTotal.value === 0) return EMPTY_FIELD_TEXT
```

L847:
```ts
  const PLACEHOLDER = '정보 없음'
```
→
```ts
  const PLACEHOLDER = EMPTY_FIELD_TEXT
```

L867-869(주석 포함):
```ts
// 모바일 헤더 칩 — heroStats 재사용, '정보 없음' 항목 제외, 최대 4개
const mobileHeaderStats = computed(() =>
  heroStats.value.filter(s => s.value && s.value !== '정보 없음').slice(0, 4),
)
```
→
```ts
// 모바일 헤더 칩 — heroStats 재사용, 빈값(EMPTY_FIELD_TEXT) 항목 제외, 최대 4개
const mobileHeaderStats = computed(() =>
  heroStats.value.filter(s => s.value && s.value !== EMPTY_FIELD_TEXT).slice(0, 4),
)
```
(센티널 `areaRange`/`latestPrice`/`fullAddress`의 `'-'`는 **그대로**.)

- [ ] **Step 5: 테스트 통과(GREEN)**

```bash
npx vitest run tests/pages/real-estate/buildingDetailHeroEmpty.test.ts
```
Expected: PASS(3). 기존 페이지 테스트가 히어로 문자열을 assert하지 않으므로 회귀 없음 — 확인:
```bash
npx vitest run tests/pages/real-estate/buildingName.test.ts tests/pages/real-estate/realEstateBuildingDetail.test.ts tests/pages/real-estate/buildingDetailFailOpen.test.ts 2>&1 | tail -6
```
Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" tests/pages/real-estate/buildingDetailHeroEmpty.test.ts
git commit -m "feat(trust): 부동산 상세 히어로 빈값을 '정보 없음·현장 확인 필요'로 통일 + 모바일칩 커플링 제거 (PR⑥ Track A)"
```

---

### Task 2: 공매 집행기관 카드 빈값 통일 (Track C)

**Files:**
- Modify: `frontend/components/auction/AuctionDetailInfo.vue`
  - import 추가(L38 `SectionBlock` import 다음)
  - 템플릿 L53-56 집행기관 카드
- Test(create): `frontend/tests/components/auction/AuctionDetailInfo.test.ts`

**Interfaces:**
- Consumes: `EMPTY_FIELD_TEXT`(`~/utils/emptyField`), `AuctionItem`(`~/types/auction`)
- Produces: 없음

**현재 구조(확인됨):** L55 `<p class="text-base font-bold text-strong truncate">{{ item.orgNm ?? '-' }}</p>` — 3열 `text-center` 그리드 안이라 `truncate`가 걸려 있다. 빈값 문구(더 김)를 그대로 넣으면 잘리므로, **기관명이 있을 때만 truncate**, 없을 때는 `truncate` 없이 muted로 렌더한다.

- [ ] **Step 1: 실패 테스트 작성(RED)** — `frontend/tests/components/auction/AuctionDetailInfo.test.ts` 신규:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import AuctionDetailInfo from '~/components/auction/AuctionDetailInfo.vue'
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'
import type { AuctionItem } from '~/types/auction'

function makeItem(overrides: Partial<AuctionItem> = {}): AuctionItem {
  return {
    id: 1, cltrMngNo: '2024-00001-001', pbctCdtnNo: 'X', plnmNo: null,
    city: '서울특별시', district: '강남구', bjdCode: '1168000000', dongName: '역삼동',
    address: '서울 강남구 역삼동 123-4', usage: '아파트', usageGroup: 'residential',
    propertyType: '주거용', dpslMtdNm: '매각', bidMethod: null, competitionMethod: null,
    bidType: null, evictionResp: null, isShare: false, thumbnailUrl: null,
    landArea: null, bldArea: 84.5,
    apslAssAmt: 980000000, minBidPrc: 686000000, failCnt: 2, bidRound: 3,
    bidBeginDtm: null, bidCloseDtm: null, orgNm: '한국자산관리공사', pvctTrgtYn: false,
    status: 'ongoing', isClosed: false,
    resultType: null, winBidPrc: null, bidRate: null, resultDate: null,
    lat: 37.5, lng: 127.04,
    ...overrides,
  } as AuctionItem
}

const mountInfo = (item: AuctionItem) =>
  mount(AuctionDetailInfo, {
    props: { item },
    global: { stubs: { SectionBlock: { template: '<div><slot /></div>' } } },
  })

describe('AuctionDetailInfo — 집행기관 빈값 (§5-8 rule4)', () => {
  it('집행기관(orgNm)이 있으면 기관명을 노출한다', () => {
    const w = mountInfo(makeItem({ orgNm: '한국자산관리공사' }))
    expect(w.text()).toContain('한국자산관리공사')
    expect(w.text()).not.toContain(EMPTY_FIELD_TEXT)
  })

  it('집행기관이 없으면 빈값 문구를 truncate 없이 노출한다', () => {
    const w = mountInfo(makeItem({ orgNm: null }))
    expect(w.text()).toContain(EMPTY_FIELD_TEXT)
    const fallback = w.findAll('p').find(p => p.text() === EMPTY_FIELD_TEXT)
    expect(fallback).toBeTruthy()
    expect(fallback!.classes()).not.toContain('truncate')
  })
})
```

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/components/auction/AuctionDetailInfo.test.ts
```
Expected: FAIL — orgNm null일 때 `'-'`가 나오고 빈값 문구 없음.

- [ ] **Step 2: import 추가** — `AuctionDetailInfo.vue` `<script setup>` 내 L38 `import SectionBlock from '~/components/common/SectionBlock.vue'` 다음 줄에:

```ts
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'
```

- [ ] **Step 3: 집행기관 카드 조건부 렌더** — 템플릿 L53-56:

```html
      <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
        <p class="text-caption text-faint mb-1">집행기관</p>
        <p class="text-base font-bold text-strong truncate">{{ item.orgNm ?? '-' }}</p>
      </div>
```
→
```html
      <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
        <p class="text-caption text-faint mb-1">집행기관</p>
        <p v-if="item.orgNm" class="text-base font-bold text-strong truncate">{{ item.orgNm }}</p>
        <p v-else class="text-sm font-medium text-faint">{{ EMPTY_FIELD_TEXT }}</p>
      </div>
```

- [ ] **Step 4: 테스트 통과(GREEN) + 기존 공매 테스트 회귀 확인**

```bash
npx vitest run tests/components/auction/AuctionDetailInfo.test.ts tests/pages/auction/auctionItemDetail.test.ts 2>&1 | tail -6
```
Expected: 전부 PASS(기존 페이지 테스트 fixture는 `orgNm='한국자산관리공사'`라 실 기관명 경로 그대로).

- [ ] **Step 5: 커밋**

```bash
git add components/auction/AuctionDetailInfo.vue tests/components/auction/AuctionDetailInfo.test.ts
git commit -m "feat(trust): 공매 집행기관 카드 빈값을 '정보 없음·현장 확인 필요'로 통일(truncate 회피) (PR⑥ Track C)"
```

---

### Task 3: 어드민 기사 카드 날짜 점(.) 표기 (Track D)

**Files:**
- Modify: `frontend/components/admin/AdminArticleCard.vue` (L39 import, L32 렌더)
- Test(modify): `frontend/tests/components/admin/AdminArticleCard.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: `formatDotDate`(`~/utils/syncFreshness`, `formatDotDate(iso?): string | null` → KST `YYYY.MM.DD`)
- Produces: 없음

**현재 구조(확인됨):** L32 `{{ formatKstDate(article.createdAt) }}` → 대시형 `YYYY-MM-DD`. import은 L39. 어드민 전용(공개/SEO 무관), 순수 본문 날짜 일관성.

- [ ] **Step 1: 실패 테스트 추가(RED)** — `AdminArticleCard.test.ts` 파일 끝에 describe 추가(기존 `makeSummary`·import 재사용):

```ts
describe('AdminArticleCard — 날짜 점 표기 (§5-8 rule3)', () => {
  it('생성일을 YYYY.MM.DD(점)로 노출한다(대시 금지)', () => {
    const wrapper = mount(AdminArticleCard, {
      props: { article: makeSummary({ createdAt: '2026-07-07T00:00:00.000Z' }) },
    })
    expect(wrapper.text()).toContain('2026.07.07')
    expect(wrapper.text()).not.toContain('2026-07-07')
  })
})
```

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/components/admin/AdminArticleCard.test.ts
```
Expected: FAIL — 현재 `2026-07-07`(대시) 렌더.

- [ ] **Step 2: import 교체** — `AdminArticleCard.vue` L39:

```ts
import { formatKstDate } from '~/utils/formatters'
```
→
```ts
import { formatDotDate } from '~/utils/syncFreshness'
```

- [ ] **Step 3: 렌더 교체** — L32:

```html
      <p class="text-xs text-muted mt-1">{{ formatKstDate(article.createdAt) }}</p>
```
→
```html
      <p class="text-xs text-muted mt-1">{{ formatDotDate(article.createdAt) }}</p>
```

- [ ] **Step 4: 테스트 통과(GREEN)**

```bash
npx vitest run tests/components/admin/AdminArticleCard.test.ts
```
Expected: PASS(3 — 기존 정책 뱃지 2 + 신규 1). `formatKstDate` 미사용 import 잔존 없음 확인.

- [ ] **Step 5: 커밋**

```bash
git add components/admin/AdminArticleCard.vue tests/components/admin/AdminArticleCard.test.ts
git commit -m "feat(trust): 어드민 기사 카드 날짜를 점 표기(YYYY.MM.DD)로 통일 (PR⑥ Track D)"
```

---

### Task 4: 기사·정책 생성기 프롬프트 해요체·상투어 금지 (Track B-1)

**Files:**
- Modify: `backend/src/services/articleGenerationCore.ts`
  - 편집#1: `generateSectionBody`의 `<rules>` 톤 규칙(L475-482)
  - 편집#2: `generateArticleMeta` 프롬프트에 `<summary-rules>` 삽입(L366-368 사이)
- Test(modify): `backend/__tests__/services/articleGenerationCore.policy.test.ts`

**Interfaces:**
- Consumes(테스트): `generateSectionBody`(exported L432, `(openai, category, keyword, researchContext, section, meta)`), `generateArticleMeta`(exported L343)
- Produces: 없음(프롬프트 문자열만 변경)

**주의:** 프롬프트는 전부 단일 `role:'user'` 메시지. 테스트는 mock의 `mockChatCreate.mock.calls[i][0].messages[0].content`로 프롬프트를 검사한다(OpenAI mock이라 출력은 검증 불가 — 프롬프트에 규칙 포함만 락). 기존 assert 문자열(`title-rules`·`낚시`)은 보존. 타입: `SectionPlan={heading,description}`, `ArticleMeta={title,summary,keywords,sections:SectionPlan[]}`(확인됨).

- [ ] **Step 1: 실패 테스트 작성(RED)** — `articleGenerationCore.policy.test.ts` 편집 3곳.

(a) import 목록에 `generateSectionBody` 추가:
```ts
import {
  POLICY_FOCUS_CATEGORIES,
  formatPolicyContext,
  formatApproveDate,
  selectPolicyCandidate,
  generateArticleMeta,
} from '../../src/services/articleGenerationCore.js';
```
→
```ts
import {
  POLICY_FOCUS_CATEGORIES,
  formatPolicyContext,
  formatApproveDate,
  selectPolicyCandidate,
  generateArticleMeta,
  generateSectionBody,
} from '../../src/services/articleGenerationCore.js';
```

(b) 기존 `generateArticleMeta — 제목 규칙 강화` 테스트의 마지막 assert(`expect(sentPrompt).toContain('낚시');`) 다음 줄에 추가:
```ts
    // §5-8: summary 해요체 + 상투어 금지
    expect(sentPrompt).toContain('summary-rules');
    expect(sentPrompt).toContain('해요체');
    expect(sentPrompt).toContain('살펴봅니다');
```

(c) 파일 끝에 describe 신규:
```ts
describe('generateSectionBody — §5-8 해요체 톤 규칙', () => {
  beforeEach(() => mockChatCreate.mockReset());
  const openai = new OpenAI({ apiKey: 'test' });

  it('본문 프롬프트에 해요체·상투어 금지 규칙이 포함된다', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: '본문 예시입니다.' } }] });
    await generateSectionBody(
      openai,
      'subscription',
      '청약 개편',
      '[정책 원문] ...',
      { heading: '핵심 요약', description: '요점 먼저' },
      { title: '테스트 제목', summary: '요약', keywords: 'a, b', sections: [] },
    );
    const sent = String(mockChatCreate.mock.calls[0][0].messages[0].content);
    expect(sent).toContain('해요체');
    expect(sent).toContain('살펴봅니다');
  });
});
```

```bash
cd backend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/services/articleGenerationCore.policy.test.ts
```
Expected: FAIL — 프롬프트에 `해요체`/`summary-rules`/`살펴봅니다` 없음.

- [ ] **Step 2: 편집#1 — 본문 톤 규칙** — `articleGenerationCore.ts` L475-478:

```ts
- "${heading}" 섹션 본문만 작성 (섹션 제목 "## ${heading}" 라인은 출력 금지)
- 친절한 한국어 경어체
- 구체적 예시·사이트명·기관명·서류명·비용·절차 포함
```
→
```ts
- "${heading}" 섹션 본문만 작성 (섹션 제목 "## ${heading}" 라인은 출력 금지)
- 문장 종결은 '해요체'로 통일하세요 (예: "…해요", "…이에요", "…예요", "…돼요", "…있어요"). '합니다/습니다'체와 개조식 명사 종결('…함', '…임')은 쓰지 마세요.
- 상투적인 소개형 종결을 반복하지 마세요: "~를 안내합니다", "~를 살펴봅니다", "~를 알아봅니다" 같은 표현으로 문단을 열거나 닫지 말고, 곧바로 핵심 정보부터 제시하세요.
- 구체적 예시·사이트명·기관명·서류명·비용·절차 포함
```

- [ ] **Step 3: 편집#2 — summary 규칙 삽입** — `articleGenerationCore.ts` L366-368:

```ts
</title-rules>

<section-rules>
```
→
```ts
</title-rules>

<summary-rules>
- summary 문장 종결은 '해요체'로 끝맺으세요 ("…해요/…이에요/…예요"). '합니다/습니다'체는 쓰지 마세요.
- "~를 안내합니다 / ~를 살펴봅니다 / ~를 알아봅니다" 같은 상투적 소개형 종결을 쓰지 말고, 핵심 결론·이득을 먼저 요약하세요.
</summary-rules>

<section-rules>
```

- [ ] **Step 4: 테스트 통과(GREEN)**

```bash
npx vitest run __tests__/services/articleGenerationCore.policy.test.ts __tests__/scripts/generateArticle.test.ts 2>&1 | tail -6
```
Expected: 전부 PASS. (`generateArticle.test.ts`는 라우팅 문자열만 assert → 보존.)

- [ ] **Step 5: 커밋**

```bash
git add src/services/articleGenerationCore.ts __tests__/services/articleGenerationCore.policy.test.ts
git commit -m "feat(trust): 기사·정책 생성기 프롬프트에 해요체·상투어 금지 규칙 추가 (PR⑥ Track B-1)"
```

---

### Task 5: 가이드 생성기 프롬프트 해요체·상투어 금지 (Track B-2)

**Files:**
- Modify: `backend/src/services/guideDraftGeneration.ts`
  - 편집#3: `generateGuideBody`의 `<규칙>` 톤 규칙(L176-182, FAQ `A.` 포함)
  - 편집#4: `generateGuideMeta`의 summary 규칙(L80-82)
- Test(modify): `backend/__tests__/services/guideDraftGeneration.test.ts`

**Interfaces:**
- Consumes(테스트): `generateGuideDraft`(exported, meta→body 순으로 `create` 2회 호출)
- Produces: 없음

**주의:** 테스트는 `create.mock.calls[0]`(=meta 프롬프트, 편집#4)·`calls[1]`(=body 프롬프트, 편집#3)을 검사. 기존 mock 본문(`HOWTO_MD`)이 '안내합니다'를 포함하나 그건 **출력 mock**이지 프롬프트가 아니므로 프롬프트 assert와 무관.

- [ ] **Step 1: 실패 테스트 추가(RED)** — `guideDraftGeneration.test.ts`의 `generateGuideDraft (OpenAI mock)` describe 안에 테스트 추가:

```ts
  it('§5-8: 메타·본문 프롬프트에 해요체·상투어 금지 규칙이 포함된다', async () => {
    const create = vi.fn()
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({
        title: '공영주차장 무료·할인 요금 받는 법',
        summary: '요약입니다.', keywords: 'a, b, c',
      }) } }] })
      .mockResolvedValueOnce({ choices: [{ message: { content: HOWTO_MD } }] });
    const openai = { chat: { completions: { create } } } as unknown as import('openai').default;

    await generateGuideDraft(openai, { category: 'parking', topic: 't', articleType: 'howto' });

    const metaPrompt = String(create.mock.calls[0][0].messages[0].content);
    const bodyPrompt = String(create.mock.calls[1][0].messages[0].content);
    expect(metaPrompt).toContain('해요체');    // generateGuideMeta summary 규칙 (편집#4)
    expect(bodyPrompt).toContain('해요체');     // generateGuideBody 규칙 (편집#3)
    expect(bodyPrompt).toContain('살펴봅니다'); // 상투어 금지
  });
```

```bash
cd backend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/services/guideDraftGeneration.test.ts
```
Expected: FAIL — 프롬프트에 `해요체`/`살펴봅니다` 없음.

- [ ] **Step 2: 편집#3 — 가이드 본문 톤 규칙** — `guideDraftGeneration.ts` L176-179:

```ts
- 위의 "## " 헤딩 문구와 "번호. **단계 이름**", "**Q. …**" / "A. …" 형식을 정확히 지킵니다(글자·기호 변경 금지).
- 친절한 한국어 경어체, 구체적이고 실용적으로.
- "YYYY년 N월 기준", "오늘 기준" 등 날짜 표기 금지(에버그린).
```
→
```ts
- 위의 "## " 헤딩 문구와 "번호. **단계 이름**", "**Q. …**" / "A. …" 형식을 정확히 지킵니다(글자·기호 변경 금지).
- 문장 종결은 '해요체'로 통일하세요 (예: "…해요", "…이에요", "…돼요", "…있어요"). '합니다/습니다'체와 개조식 명사 종결('…함', '…임')은 쓰지 마세요. FAQ의 'A.' 답변도 해요체로 씁니다.
- 상투적인 소개형 종결을 반복하지 마세요: "~를 안내합니다", "~를 살펴봅니다", "~를 알아봅니다" 같은 표현으로 문단을 열거나 닫지 말고, 구체적이고 실용적으로 핵심부터 제시하세요.
- "YYYY년 N월 기준", "오늘 기준" 등 날짜 표기 금지(에버그린).
```

- [ ] **Step 3: 편집#4 — 가이드 메타 summary 규칙** — `guideDraftGeneration.ts` L80-81:

```ts
- 특정 연도·시점에 의존하지 않는 "에버그린" 제목(연도/날짜 금지)
- 검색 의도에 바로 답하는 실용적 제목
```
→
```ts
- 특정 연도·시점에 의존하지 않는 "에버그린" 제목(연도/날짜 금지)
- 검색 의도에 바로 답하는 실용적 제목
- summary는 '해요체'로 끝맺고("…해요/…이에요"), "~를 안내합니다 / ~를 살펴봅니다" 같은 상투적 소개형 종결을 쓰지 마세요.
```

- [ ] **Step 4: 테스트 통과(GREEN)**

```bash
npx vitest run __tests__/services/guideDraftGeneration.test.ts __tests__/scripts/generateGuideDrafts.test.ts 2>&1 | tail -6
```
Expected: 전부 PASS. (`validateGuideDraftStructure` 케이스는 형식 검증이라 프롬프트 변경과 무관.)

- [ ] **Step 5: 커밋**

```bash
git add src/services/guideDraftGeneration.ts __tests__/services/guideDraftGeneration.test.ts
git commit -m "feat(trust): 가이드 생성기 프롬프트에 해요체·상투어 금지 규칙 추가(FAQ 포함) (PR⑥ Track B-2)"
```

---

### Task 6: 전체 검증 + PR 생성

**Files:** 없음

- [ ] **Step 1: 백엔드 lint + 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```
Expected: lint 신규 오류 0, 전체 PASS.

- [ ] **Step 2: 프론트 lint + 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```
Expected: lint 0, 전체 PASS. SearchAutocomplete/localStorage 계열 flaky가 보이면 **클린 재실행**으로 확인(이 저장소 알려진 flaky, 이번 변경과 무관).

- [ ] **Step 3: lock 무변경·범위 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git diff develop --stat -- '**/package-lock.json'   # 출력 없어야 함
git diff develop --stat
git status --porcelain=v1   # RESEARCH/·nuxt-config-eval.json·prod-home.jpeg 등 stray는 커밋 금지
```
Expected: package-lock 무변경. 변경 파일은 프론트 3(+테스트 3)·백엔드 2(+테스트 2)뿐. **`DataSourceSection`·`TransactionTable`·`search.vue`·센티널·meta/JSON-LD 파일이 diff에 없음**을 확인(PR ⑤ 기반영분 재작업 방지). stray untracked 파일은 커밋에 포함하지 말 것.

- [ ] **Step 4: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-microcopy-tone
gh pr create --base develop \
  --title "feat(trust): 마이크로카피 톤·잔여 빈값 — 히어로/공매 빈값 + 생성기 해요체 (PR ⑥)" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) §5-8 마이크로카피 중 **이미 머지된 PR ⑤(#561)가 남긴 안전 항목**을 마무리.

- Track A: 부동산 상세 히어로 빈값 → `정보 없음 · 현장 확인 필요`(EMPTY_FIELD_TEXT 단일 소스) 통일 + 모바일칩 커플링 구조 제거
- Track B: 콘텐츠 생성기 프롬프트에 해요체·상투어("~를 안내합니다/살펴봅니다") 금지 규칙 추가(기사·정책·가이드, FAQ 포함)
- Track C: 공매 집행기관 카드 빈값 통일(truncate 회피)
- Track D: 어드민 기사 카드 날짜 → 점 표기(YYYY.MM.DD)

## 이미 반영돼 있어 이 PR 대상 아님
- 날짜(rule3)·금액(rule2)·빈값 시설분(rule4) = **이미 머지된 PR ⑤(#561)** 에서 완료 (이 PR은 #561이 남긴 잔여 항목)

## 불변식
- 센티널 `'-'`(fullAddress/areaRange/latestPrice) 및 meta·JSON-LD 날짜(대시) 불변 — 히어로 PLACEHOLDER는 메타 경로와 분리 확인
- 생성기-프롬프트 한정: DB row·SSR·FAQ·JSON-LD 미편집. 기존 콘텐츠 배치 수정은 SEO 위험으로 범위 밖(Phase 3)
- 광고·Node 20·package-lock 무변경

## 테스트
- 신규: 히어로 빈값 상수화 소스 가드 / 공매 orgNm null 폴백 / 어드민 날짜 점 표기 / 생성기 프롬프트 해요체·상투어 규칙(article·section·guide meta·body)
- 백엔드·프론트 vitest 전체 PASS, lint 0

## 근거
- 토스 UX 라이팅: 일관·비문 없는 문장이 Reliable 브랜드 감정의 구현체(§5-8)

## 범위 외(기록)
- 기존 발행 콘텐츠 해요체 배치 수정(FAQ/메타 JSON-LD ~200곳, SEO 위험)
- 억/만 단일-유틸 완전 통합(formatRegionAvgPrice·formatDeposit·subscription 로컬·PriceTrendChart는 렌더 텍스트가 달라 제외)
EOF
)"
```
Expected: PR URL. CI green 확인 후 사용자 머지 판단.

---

## 플랜 메모

- **왜 PR ⑥인가:** 마이크로카피 §5-8은 이미 **PR ⑤(#561)** 로 대부분 머지됨(빈값 시설·날짜·금액). 초기 메모리가 #561을 누락해 스테일했고 SDD ledger(ground-truth)로 확인. 이 PR은 #561이 남긴 §5-8 잔여 안전항목(부동산 히어로 빈값 + 생성기 프롬프트 톤 + 승인된 경계 2건).
- **톤 규칙은 프롬프트-only·best-effort:** 후처리 정규화기(`stripDateMarkers`는 날짜만) 없음 → 100% 준수·유닛검증 불가. 어드민 검토·발행 플로우가 백스톱. 테스트는 "프롬프트에 규칙 포함"만 락한다.
- **히어로 테스트가 소스 가드인 이유:** `[buildingName].vue`는 무거운 Nuxt 페이지(공매 페이지 테스트 수준의 광범위 mock 필요). 커플링 버그는 "히어로·필터가 같은 상수 참조"로 구조적으로 제거되므로 소스 가드가 그 클래스에 충분(PR④ AdBanner min-height 가드 선례와 동일 패턴).
- **경계 2건 포함(사용자 결정):** 공매 집행기관 카드(인접 도메인·truncate 회피 셀 처리 동반), 어드민 날짜(어드민 전용·공개/SEO 무관).
- **다음:** Phase 2 — PR ⑦ 숫자 타이포+카운터 밴드 / PR ⑧ 히어로+헤더+GNB C안 / PR ⑨ 로고 코발트. (SourceStamp 규격은 이미 PR①에서 완비 — 카운터밴드·히어로 스탬프 선행 충족.)
