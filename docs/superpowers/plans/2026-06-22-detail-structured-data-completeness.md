# 상세페이지 구조화 데이터 완전화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세(리프) 페이지 9종에 공공데이터 출처 `Dataset`/provenance JSON-LD와 가시 "정보 업데이트" 타임스탬프를 추가하고, 전수감사로 드러난 구조화 스키마 누락 3건(지하철 BreadcrumbList · 공고 Article/Event · 토지 엔티티)을 보강한다.

**Architecture:** 프론트(Nuxt 3) `composables/useStructuredData.ts`에 (1) 기존 `setDatasetSchema`를 provenance/date 옵션으로 확장하고 (2) `resolveDataSource()` + noindex 가드를 캡슐화한 `setDetailProvenance()` 헬퍼를 추가한다. 각 상세 페이지는 이 헬퍼 1회 호출 + 기존 `DataSourceSection`에 `:last-sync-date` 연결로 끝난다. 백엔드 변경 없음.

**Tech Stack:** Nuxt 3 · Vue 3 · TypeScript · Vitest(happy-dom) · `useHead`(JSON-LD 주입) · 기존 `utils/dataSource.ts`(`resolveDataSource`) · `utils/formatters.ts`(`formatKstDate`).

## Global Constraints

- **광고(AdBanner/CoupangBanner) 개수·위치 불변.** 콘텐츠/스키마만 변경. (`feedback_adbanner_placement`)
- **noindex 페이지에는 Dataset 미출력.** 각 페이지의 기존 noindex 판정 변수를 `setDetailProvenance`의 `noindex`로 전달.
- **기존 `setDatasetSchema` 호출 하위호환.** 신규 옵션 미전달 시 출력 100% 불변(홈·목록·허브 영향 없음).
- **단일 h1 불변 / SSR 렌더 유지.** 스키마는 `useHead` `script`로만 주입.
- **날짜 포맷**: 가시 텍스트·JSON-LD `dateModified` 모두 `formatKstDate()` → `YYYY-MM-DD` (KST).
- **Node 20**에서 작업 (`nvm use 20`). lock 파일 삭제 금지.
- **PR 단위**: PR-A(Task A1~A2) → 머지 후 PR-B(B1~B6)·PR-C(C1~C3) 병렬 가능. 각 PR develop 경유 + CI green 후 머지. (`feedback_pr_workflow`)
- 커밋 전 `cd frontend && npm run test` green. (`feedback_test_verification`)

## File Structure

| 파일 | 책임 | PR |
|---|---|---|
| `frontend/composables/useStructuredData.ts` | `setDatasetSchema` 확장 + `setDetailProvenance` 신설 | A |
| `frontend/tests/composables/useStructuredData.test.ts` | 위 두 함수 단위 테스트 | A |
| `frontend/pages/[category]/[id].vue` | 시설: provenance 추가(타임스탬프 기구현) | B |
| `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` | 부동산 건물: provenance 추가(타임스탬프 기구현) | B |
| `frontend/pages/trash/[id].vue` | 쓰레기: provenance + 타임스탬프 | B |
| `frontend/pages/subscription/[id].vue` | 청약: provenance + 타임스탬프 | B |
| `frontend/pages/public-rental/[type]/[id].vue` | 공공임대: provenance + 타임스탬프 | B |
| `frontend/pages/auction/item/[cltrMngNo].vue` | 공매: provenance + 타임스탬프 | B |
| `frontend/pages/subway/[slug].vue` | 지하철: BreadcrumbList 버그 + provenance + 타임스탬프 | C |
| `frontend/pages/public-rental/announcements/[pblancId].vue` | 공고: Article/Event 버그 + provenance + DataSourceSection 신설 | C |
| `frontend/pages/real-estate/land/[city]/[district]/[dong].vue` | 토지: 엔티티 스키마 버그 + provenance | C |

> 가이드(`guide/[slug].vue`)는 공공데이터가 아니므로 본 계획 범위 밖 — 기존 `Article`(author/publisher provenance + `article:modified_time`) 유지, 변경 없음.

---

## PR-A — Composable 기반

### Task A1: `setDatasetSchema` provenance/date 옵션 확장

**Files:**
- Modify: `frontend/composables/useStructuredData.ts:768-822` (`setDatasetSchema`)
- Test: `frontend/tests/composables/useStructuredData.test.ts`

**Interfaces:**
- Consumes: 기존 `DataSourceInfo {datasetName, provider, url, kogl?}`, `SITE_NAME`, `SITE_URL`.
- Produces: `setDatasetSchema(options: { name, description, url, sources, keywords?, spatialCoverage?, dateModified?, datePublished?, isBasedOn?, sourceOrganization?, citation? })` — 신규 옵션 미전달 시 기존 출력 불변.

- [ ] **Step 1: 실패 테스트 작성** — `useStructuredData.test.ts` 끝에 추가:

```ts
describe('setDatasetSchema provenance/date 옵션', () => {
  const baseSource = { datasetName: '전국 공중화장실 표준데이터', provider: '행정안전부', url: 'https://www.data.go.kr/data/15012892/standard.do' }

  it('provenance 옵션 전달 시 isBasedOn/sourceOrganization/citation/dateModified/datePublished를 출력한다', () => {
    const { setDatasetSchema } = useStructuredData()
    setDatasetSchema({
      name: baseSource.datasetName, description: '설명', url: '/toilet/1', sources: [baseSource],
      isBasedOn: baseSource.url,
      sourceOrganization: { '@type': 'Organization', name: baseSource.provider },
      citation: { '@type': 'Dataset', name: baseSource.datasetName, url: baseSource.url },
      dateModified: '2026-06-20', datePublished: '2026-01-01',
    })
    const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
    expect(parsed.isBasedOn).toBe(baseSource.url)
    expect(parsed.sourceOrganization).toEqual({ '@type': 'Organization', name: '행정안전부' })
    expect(parsed.citation['@type']).toBe('Dataset')
    expect(parsed.dateModified).toBe('2026-06-20')
    expect(parsed.datePublished).toBe('2026-01-01')
  })

  it('provenance 옵션 미전달 시 새 필드는 출력되지 않는다 (하위호환)', () => {
    const { setDatasetSchema } = useStructuredData()
    setDatasetSchema({ name: baseSource.datasetName, description: '설명', url: '/toilet', sources: [baseSource] })
    const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
    expect(parsed.isBasedOn).toBeUndefined()
    expect(parsed.sourceOrganization).toBeUndefined()
    expect(parsed.dateModified).toBeUndefined()
    expect(parsed.datePublished).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useStructuredData.test.ts -t "provenance/date"`
Expected: FAIL (isBasedOn 등 undefined)

- [ ] **Step 3: 최소 구현** — `setDatasetSchema` 옵션 타입과 schema 객체 확장. 옵션 시그니처(768-775)에 추가:

```ts
  function setDatasetSchema(options: {
    name: string
    description: string
    url: string
    sources: DataSourceInfo[]
    keywords?: string[]
    spatialCoverage?: string
    dateModified?: string
    datePublished?: string
    isBasedOn?: string
    sourceOrganization?: { '@type': 'Organization'; name: string }
    citation?: { '@type': 'Dataset'; name: string; url: string }
  }) {
    const { name, description, url, sources, keywords, spatialCoverage,
      dateModified, datePublished, isBasedOn, sourceOrganization, citation } = options
```

그리고 `schema` 객체(780-808)의 `publisher` 다음에 조건부 필드 추가:

```ts
      publisher: {
        '@type': 'Organization',
        name: SITE_NAME,
        url: SITE_URL,
      },
      ...(dateModified ? { dateModified } : {}),
      ...(datePublished ? { datePublished } : {}),
      ...(isBasedOn ? { isBasedOn } : {}),
      ...(sourceOrganization ? { sourceOrganization } : {}),
      ...(citation ? { citation } : {}),
    }
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useStructuredData.test.ts`
Expected: PASS (신규 2개 + 기존 전부)

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/composables/useStructuredData.ts frontend/tests/composables/useStructuredData.test.ts
git commit -m "feat(seo): setDatasetSchema에 provenance/date 옵션 추가 (하위호환)"
```

---

### Task A2: `setDetailProvenance` 헬퍼 신설

상세 페이지가 1회 호출로 출처 Dataset을 출력하도록 `resolveDataSource` + noindex 가드 + 날짜 포맷을 캡슐화한다.

**Files:**
- Modify: `frontend/composables/useStructuredData.ts` (import 추가 + 함수 추가 + return에 노출)
- Test: `frontend/tests/composables/useStructuredData.test.ts`

**Interfaces:**
- Consumes: `setDatasetSchema`(Task A1), `resolveDataSource({domain, category})`, `formatKstDate(iso)`.
- Produces: `setDetailProvenance(opts: { domain: DataSourceDomain; category?: FacilityCategory; path: string; description: string; updatedAt?: string | null; createdAt?: string | null; noindex?: boolean }): void`. `noindex===true`이거나 `resolveDataSource`가 null이면 아무것도 출력하지 않는다.

- [ ] **Step 1: 실패 테스트 작성** — 추가:

```ts
describe('setDetailProvenance', () => {
  it('facility/toilet에 대해 원본 데이터셋명·제공기관·dateModified를 가진 Dataset을 출력한다', () => {
    const { setDetailProvenance } = useStructuredData()
    setDetailProvenance({ domain: 'facility', category: 'toilet', path: '/toilet/1', description: '역삼동 공중화장실 위치·운영시간', updatedAt: '2026-06-20T03:00:00Z' })
    const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
    expect(parsed['@type']).toBe('Dataset')
    expect(parsed.name).toBe('전국 공중화장실 표준데이터')
    expect(parsed.sourceOrganization.name).toBe('행정안전부')
    expect(parsed.isBasedOn).toContain('data.go.kr')
    expect(parsed.dateModified).toBe('2026-06-20')
  })

  it('noindex=true면 아무것도 출력하지 않는다', () => {
    const { setDetailProvenance } = useStructuredData()
    setDetailProvenance({ domain: 'facility', category: 'toilet', path: '/toilet/1', description: 'x', noindex: true })
    expect(mockUseHead).not.toHaveBeenCalled()
  })

  it('출처가 없는 도메인(예: category 없는 facility)이면 출력하지 않는다', () => {
    const { setDetailProvenance } = useStructuredData()
    setDetailProvenance({ domain: 'facility', path: '/x', description: 'x' })
    expect(mockUseHead).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useStructuredData.test.ts -t "setDetailProvenance"`
Expected: FAIL ("setDetailProvenance is not a function")

- [ ] **Step 3: 최소 구현** — `useStructuredData.ts` 상단 import(4행 부근)에 추가:

```ts
import { resolveDataSource, type DataSourceDomain, type DataSourceInfo } from '~/utils/dataSource'
import { formatKstDate } from '~/utils/formatters'
```

> 기존 4행의 `import type { DataSourceInfo } from '~/utils/dataSource'`는 위 한 줄로 대체(중복 제거).

`setDatasetSchema` 정의 직후(822행 다음)에 함수 추가:

```ts
  /**
   * 상세 페이지 출처 Dataset (provenance) 일괄 출력 헬퍼.
   * 엔티티 스키마(Place/Event 등)는 페이지가 따로 출력하고, 여기서는
   * 이 페이지가 가공한 "원본 공공데이터셋"을 별도 Dataset 노드로 선언한다.
   * noindex 페이지/출처 미상이면 아무것도 출력하지 않는다.
   */
  function setDetailProvenance(opts: {
    domain: DataSourceDomain
    category?: FacilityCategory
    path: string
    description: string
    updatedAt?: string | null
    createdAt?: string | null
    noindex?: boolean
  }) {
    if (opts.noindex) return
    const src = resolveDataSource({ domain: opts.domain, category: opts.category })
    if (!src) return
    setDatasetSchema({
      name: src.datasetName,
      description: opts.description,
      url: opts.path,
      sources: [src],
      isBasedOn: src.url,
      sourceOrganization: { '@type': 'Organization', name: src.provider },
      citation: { '@type': 'Dataset', name: src.datasetName, url: src.url },
      ...(opts.updatedAt ? { dateModified: formatKstDate(opts.updatedAt) } : {}),
      ...(opts.createdAt ? { datePublished: formatKstDate(opts.createdAt) } : {}),
    })
  }
```

`return {...}`(824-840)에 `setDetailProvenance,` 추가.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useStructuredData.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/composables/useStructuredData.ts frontend/tests/composables/useStructuredData.test.ts
git commit -m "feat(seo): 상세 출처 Dataset 헬퍼 setDetailProvenance 추가"
```

> **PR-A 종료**: `git push` 후 develop으로 PR. CI green 확인 후 머지. 이후 PR-B·PR-C는 A 머지 브랜치에서 분기.

---

## PR-B — provenance + 타임스탬프 롤아웃 (구조 버그 없는 6종)

각 Task 공통 검증 절차(아래 "SSR 검증" 매크로):
```bash
cd frontend && NUXT_PUBLIC_DISABLE_MSW=true npm run dev   # 별도 터미널, port 3000
# 다른 터미널에서:
curl -s http://localhost:3000<해당경로> | grep -o '"@type":"Dataset"' | head
curl -s http://localhost:3000<해당경로> | grep -o '최근 동기화'
```

### Task B1: 시설 상세 — provenance 추가

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (구조화데이터 watchEffect 388-410)

**Interfaces:**
- Consumes: `setDetailProvenance`(A2). 기존 변수 `facility`(`.category`,`.updatedAt`,`.createdAt`), `isFacilityNoindex`(415-451), `route.path`.

- [ ] **Step 1: destructure에 헬퍼 추가** — 300행 수정:

```ts
const { setFacilitySchema, setBreadcrumbSchema, setVideoListSchema, setFAQSchema, setDetailProvenance } = useStructuredData()
```

- [ ] **Step 2: provenance 호출 추가** — `setFAQSchema(...)` 직후(408행 다음, watchEffect 내부, `facility.value` truthy 블록):

```ts
      setDetailProvenance({
        domain: 'facility',
        category: facility.value.category,
        path: route.path,
        description: `${facility.value.name} ${CATEGORY_META[facility.value.category]?.label ?? ''} 위치·운영정보 (공공데이터 기반)`,
        updatedAt: facility.value.updatedAt,
        createdAt: facility.value.createdAt,
        noindex: isFacilityNoindex.value,
      })
```

- [ ] **Step 3: 타입체크 + 기존 테스트**

Run: `cd frontend && npx vitest run && npx nuxi typecheck 2>/dev/null || npx vue-tsc --noEmit`
Expected: PASS (회귀 없음)

- [ ] **Step 4: SSR 검증** — 위 매크로로 `/toilet/<실제id>` 확인. `"@type":"Dataset"` 1건, wifi 상세(`/wifi/<id>`)에서는 **0건**(noindex 가드)인지 확인.

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/[category]/[id].vue
git commit -m "feat(seo): 시설 상세에 출처 Dataset provenance 추가"
```

### Task B2: 부동산 건물 상세 — provenance 추가

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (구조화데이터 1172-1210)

**Interfaces:**
- Consumes: `setDetailProvenance`(A2). 기존 변수 `noindex`(627), `lastSyncDate`(745-750, 이미 `formatKstDate` 적용된 표시값), 원본 sync timestamp.

- [ ] **Step 1: destructure에 `setDetailProvenance` 추가** (기존 `setBuildingPlaceSchema, setRealEstateListingSchema, setBreadcrumbSchema` 옆).

- [ ] **Step 2: 호출 추가** — `setRealEstateListingSchema(...)`(1184) 직후:

```ts
    setDetailProvenance({
      domain: 'real-estate',
      path: route.path,
      description: `${buildingName} 실거래가·시세 (국토교통부 공개 데이터 기반)`,
      updatedAt: syncStatusUpdatedAt.value,   // 745-750 lastSyncDate 산출 전의 원본 ISO timestamp
      noindex: noindex.value,
    })
```

> `syncStatusUpdatedAt`: 745-750에서 `formatKstDate()` 적용 **전**의 원본 ISO 값. 없으면 그 값을 별도 ref로 보존(예: `const syncStatusUpdatedAt = computed(() => rawSyncTs.value)`). 표시용 `lastSyncDate`와 동일 소스.

- [ ] **Step 3: 타입체크 + 테스트** — `cd frontend && npx vitest run`. Expected: PASS.
- [ ] **Step 4: SSR 검증** — `/real-estate/apt-sale/<city>/<district>/<건물>`에서 `"@type":"Dataset"` 1건. 지번 패턴/noindex 건물에서 0건.
- [ ] **Step 5: 커밋** — `git commit -m "feat(seo): 부동산 건물 상세에 출처 Dataset provenance 추가"`

### Task B3: 쓰레기 배출 상세 — provenance + 타임스탬프

**Files:**
- Modify: `frontend/pages/trash/[id].vue` (destructure 204, watchEffect 330-337, DataSourceSection 179)

**Interfaces:**
- Consumes: `setDetailProvenance`(A2). 변수 `schedule`(`.details.dataCreatedDate`/`.details.lastModified`), `formatKstDate`.

- [ ] **Step 1: DataSourceSection에 타임스탬프 연결** — 179행:

```vue
<DataSourceSection domain="facility" category="trash" :last-sync-date="lastSyncDate" />
```
그리고 `<script setup>`에 computed 추가:
```ts
import { formatKstDate } from '~/utils/formatters'
const lastSyncDate = computed(() => {
  const ts = schedule.value?.details?.lastModified ?? schedule.value?.details?.dataCreatedDate
  return ts ? formatKstDate(String(ts)) : null
})
```

- [ ] **Step 2: provenance 추가** — destructure(204)에 `setDetailProvenance` 추가 후 watchEffect(330-337) 내 `setWasteScheduleSchema(...)` 직후:

```ts
    setDetailProvenance({
      domain: 'facility', category: 'trash', path: `/trash/${schedule.value.id}`,
      description: `${schedule.value.region ?? ''} 생활폐기물 배출일정 (환경부 공공데이터 기반)`,
      updatedAt: schedule.value.details?.lastModified ?? schedule.value.details?.dataCreatedDate ?? null,
    })
```

> trash는 현재 색인 대상이라 noindex 미전달. **주의**: 후속 "중복색인 별도 스펙"이 trash를 noindex 처리하면, 그 PR에서 이 호출에 `noindex` 인자를 연결할 것(교차 의존, 스펙 §8).

- [ ] **Step 3: 테스트** — `cd frontend && npx vitest run`. Expected: PASS.
- [ ] **Step 4: SSR 검증** — `/trash/<id>`에서 `"@type":"Dataset"` 1건 + `최근 동기화` 텍스트 1건.
- [ ] **Step 5: 커밋** — `git commit -m "feat(seo): 쓰레기 상세에 출처 Dataset + 동기화일 추가"`

### Task B4: 청약 상세 — provenance + 타임스탬프

**Files:**
- Modify: `frontend/pages/subscription/[id].vue` (destructure 745, 호출 760-777, DataSourceSection)

**Interfaces:**
- Consumes: `setDetailProvenance`(A2). 변수 `subscription`(`.updatedAt`, `types/subscription.ts:39`).

- [ ] **Step 1: provenance 추가** — destructure(745)에 `setDetailProvenance` 추가, `setEventSchema(...)`(768-777) 블록 직후:

```ts
    setDetailProvenance({
      domain: 'subscription', path: `/subscription/${subscription.value.id}`,
      description: `${subscription.value.houseNm ?? '청약'} 청약 일정·정보 (한국부동산원 청약홈 기반)`,
      updatedAt: subscription.value.updatedAt ?? null,
    })
```

- [ ] **Step 2: 타임스탬프** — 페이지 내 `DataSourceSection`에 `:last-sync-date="subscription?.updatedAt ? formatKstDate(subscription.updatedAt) : null"` 연결(없으면 출처 섹션에 컴포넌트 추가, domain="subscription"). `import { formatKstDate }` 확인.
- [ ] **Step 3: 테스트** — `cd frontend && npx vitest run`. Expected: PASS.
- [ ] **Step 4: SSR 검증** — `/subscription/<id>`에서 Dataset 1건 + `최근 동기화`.
- [ ] **Step 5: 커밋** — `git commit -m "feat(seo): 청약 상세에 출처 Dataset + 갱신일 추가"`

### Task B5: 공공임대 상세 — provenance + 타임스탬프

**Files:**
- Modify: `frontend/pages/public-rental/[type]/[id].vue` (destructure 158-167)
- Modify: `frontend/components/...PublicRentalDetailView.vue` 사용처(이미 `:last-sync-date` prop 지원, line 76/105)

**Interfaces:**
- Consumes: `setDetailProvenance`(A2). 변수 `detail`(`.updatedAt`), `canonicalUrl`(91-94), noindex 없음.

- [ ] **Step 1: provenance 추가** — 158-167 블록에 `setDetailProvenance` 호출:

```ts
    setDetailProvenance({
      domain: 'public-rental', path: canonicalUrl.value.replace(SITE_URL, ''),
      description: `${detail.value?.name ?? '공공임대'} 공급 정보 (LH·SH 공공데이터 기반)`,
      updatedAt: detail.value?.updatedAt ?? null,
    })
```

- [ ] **Step 2: 타임스탬프 prop 전달** — `<PublicRentalDetailView ... :last-sync-date="detail?.updatedAt ? formatKstDate(detail.updatedAt) : null" />`.
- [ ] **Step 3: 테스트** — `cd frontend && npx vitest run`. Expected: PASS.
- [ ] **Step 4: SSR 검증** — `/public-rental/<type>/<id>`에서 Dataset 1건 + `최근 동기화`.
- [ ] **Step 5: 커밋** — `git commit -m "feat(seo): 공공임대 상세에 출처 Dataset + 갱신일 추가"`

### Task B6: 공매 물건 상세 — provenance + 타임스탬프

**Files:**
- Modify: `frontend/pages/auction/item/[cltrMngNo].vue` (destructure/호출 138-139)

**Interfaces:**
- Consumes: `setDetailProvenance`(A2). 변수 `item`(`.updatedAt`), `isAuctionItemIndexable(item)`(auctionHead.ts:28 — noindex 판정의 반대).

- [ ] **Step 1: provenance 추가** — destructure(139)에 `setDetailProvenance` 추가, `setBreadcrumbSchema(...)` 직후:

```ts
    setDetailProvenance({
      domain: 'auction', path: `/auction/item/${item.value.cltrMngNo}`,
      description: `${item.value.cltrNm ?? '공매 물건'} 온비드 공매 정보 (한국자산관리공사 기반)`,
      updatedAt: item.value.updatedAt ?? null,
      noindex: !isAuctionItemIndexable(item.value),
    })
```

- [ ] **Step 2: 타임스탬프** — 페이지 `DataSourceSection`(domain="auction")에 `:last-sync-date="item?.updatedAt ? formatKstDate(item.updatedAt) : null"` 연결.
- [ ] **Step 3: 테스트** — `cd frontend && npx vitest run`. Expected: PASS.
- [ ] **Step 4: SSR 검증** — `/auction/item/<no>`에서 Dataset 1건(인덱서블 물건) + `최근 동기화`. 취소/만료 물건에서 0건.
- [ ] **Step 5: 커밋** — `git commit -m "feat(seo): 공매 상세에 출처 Dataset + 갱신일 추가"`

> **PR-B 종료**: push → develop PR → CI green → 머지. 운영 반영은 main 승격 시 + 라이브 검증.

---

## PR-C — 구조화 스키마 누락 보강 (3종)

### Task C1: 지하철 상세 — BreadcrumbList + provenance + 타임스탬프

**Files:**
- Modify: `frontend/pages/subway/[slug].vue` (destructure 575, 호출 575-585, DataSourceSection 212)

**Interfaces:**
- Consumes: `setBreadcrumbSchema`(기존), `setDetailProvenance`(A2). 변수 `breadcrumbItems`(65행 UI에 쓰이는 `{name, url}` 배열), `station`(`.updatedAt`), `slug`.

- [ ] **Step 1: 실패 검증 기준 명시** — 현재 `/subway/<slug>` SSR에 `"@type":"BreadcrumbList"`가 **없음**을 확인:

Run: `curl -s http://localhost:3000/subway/<slug> | grep -o '"@type":"BreadcrumbList"'`
Expected: (빈 출력)

- [ ] **Step 2: BreadcrumbList 추가** — destructure(575)를 수정:

```ts
const { setFAQSchema, setBreadcrumbSchema, setDetailProvenance } = useStructuredData()
```
`setFAQSchema(faqItems.value)` 호출 블록(575-585) 내에 추가(breadcrumbItems가 `{name, label}` 형태면 `{name, url}`로 매핑):

```ts
  setBreadcrumbSchema(breadcrumbItems.value.map(b => ({ name: b.name, url: b.url })))
```
> `breadcrumbItems`의 실제 필드명(아이템이 `to`/`label`을 쓰는지 `url`/`name`을 쓰는지)을 65행 `<Breadcrumb :items>` 정의에서 확인 후 매핑 키 맞출 것.

- [ ] **Step 3: provenance + 타임스탬프 추가** — 같은 블록에:

```ts
  setDetailProvenance({
    domain: 'facility', category: 'subway' as any, path: `/subway/${slug.value}`,
    description: `${station.value.name} 지하철역 정보 (국토교통부 도시철도역사 표준데이터 기반)`,
    updatedAt: station.value.updatedAt ?? null,
  })
```
> `resolveDataSource`는 `category: 'subway'`를 `FACILITY_DATA_SOURCE.subway`(전국도시철도역사정보표준데이터, 국토교통부)로 해석. `subway`가 `FacilityCategory` 유니온에 없으면 `as any` 또는 dataSource 타입 확장(`subway`는 dataSource.ts:103-107에 이미 존재).

212행 DataSourceSection에 `:last-sync-date="station?.updatedAt ? formatKstDate(station.updatedAt) : null"` 연결 + `import { formatKstDate }`.

- [ ] **Step 4: 통과 검증** — Step 1 curl 재실행 → `"@type":"BreadcrumbList"` 1건, `"@type":"Dataset"` 1건, `최근 동기화` 1건. `cd frontend && npx vitest run` green.
- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/subway/[slug].vue
git commit -m "fix(seo): 지하철 상세 BreadcrumbList 누락 보강 + 출처 Dataset/갱신일"
```

### Task C2: 공공임대 공고 — Article/Event + provenance + DataSourceSection

**Files:**
- Modify: `frontend/pages/public-rental/announcements/[pblancId].vue` (destructure 190, 호출 246-251, meta 236, template)

**Interfaces:**
- Consumes: `setBreadcrumbSchema`(기존), `setArticleSchema`/`setEventSchema`(기존), `setDetailProvenance`(A2). 변수 `detail`(`.updatedAt` `types/publicRentalAnnouncement.ts:65`, 접수기간 `receptionStart`/`receptionEnd`, 공고일), `canonicalUrl`(225), `isClosed`(238).

- [ ] **Step 1: 실패 검증 기준** — 현재 SSR에 `"@type":"Article"`/`"@type":"Event"`가 없음 확인:

Run: `curl -s http://localhost:3000/public-rental/announcements/<id> | grep -oE '"@type":"(Article|Event)"'`
Expected: (빈 출력)

- [ ] **Step 2: Article/Event 추가** — destructure(190)를 수정:

```ts
const { setBreadcrumbSchema, setArticleSchema, setEventSchema, setDetailProvenance } = useStructuredData()
```
246-251 블록(`setBreadcrumbSchema` 직후)에 분기 추가:

```ts
  if (detail.value.receptionStart && detail.value.receptionEnd) {
    setEventSchema({
      name: detail.value.title, description: detail.value.summary ?? detail.value.title,
      startDate: detail.value.receptionStart, endDate: detail.value.receptionEnd,
      location: detail.value.regionName ?? undefined, url: canonicalUrl.value,
      eventStatus: isClosed.value ? 'EventCancelled' : 'EventScheduled',
    })
  } else {
    setArticleSchema({
      headline: detail.value.title, description: detail.value.summary ?? detail.value.title,
      datePublished: detail.value.announceDate ?? detail.value.createdAt,
      dateModified: detail.value.updatedAt ?? undefined, url: canonicalUrl.value,
    })
  }
```
> `receptionStart`/`receptionEnd`/`announceDate`/`summary`/`regionName`의 실제 필드명은 `types/publicRentalAnnouncement.ts`에서 확인 후 맞출 것(없는 필드는 가용 대체값 사용).

- [ ] **Step 3: provenance + DataSourceSection 추가** — Step 2 블록에:

```ts
  setDetailProvenance({
    domain: 'public-rental', path: `/public-rental/announcements/${pblancId.value}`,
    description: `${detail.value.title} 공공임대 공고 (LH·SH 공공데이터 기반)`,
    updatedAt: detail.value.updatedAt ?? null,
    noindex: isClosed.value,
  })
```
template 출처 영역(없으면 본문 하단)에 컴포넌트 추가:
```vue
<DataSourceSection domain="public-rental" :last-sync-date="detail?.updatedAt ? formatKstDate(detail.updatedAt) : null" />
```
`import DataSourceSection from '~/components/common/DataSourceSection.vue'` 및 `import { formatKstDate }` 확인(auto-import면 생략).

- [ ] **Step 4: 통과 검증** — Step 1 curl 재실행 → 접수기간 있으면 `Event`, 없으면 `Article` 1건 + `Dataset` 1건(미마감 시) + `최근 동기화`. `cd frontend && npx vitest run` green.
- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/public-rental/announcements/[pblancId].vue
git commit -m "fix(seo): 공고 상세 Article/Event 누락 보강 + 출처 Dataset/출처섹션"
```

### Task C3: 토지 동상세 — 엔티티 스키마 + provenance

**Files:**
- Modify: `frontend/pages/real-estate/land/[city]/[district]/[dong].vue` (호출 404-415, DataSourceSection 214, noindex 389)

**Interfaces:**
- Consumes: `setBreadcrumbSchema`/`setFAQSchema`(기존), `setDetailProvenance`(A2). 변수 `noindex`(389), `citySlug`/`districtSlug`/`dong`, 좌표 없음(366 주석).

- [ ] **Step 1: provenance 추가** — destructure(404 부근)에 `setDetailProvenance` 추가, `setFAQSchema(...)`(415) 직후:

```ts
    setDetailProvenance({
      domain: 'real-estate',
      path: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}`,
      description: `${dong} 토지 실거래가·지목·용도지역 (국토교통부 토지 실거래가 기반)`,
      updatedAt: landSummaryUpdatedAt.value ?? null,
      noindex: noindex.value,
    })
```
> `landSummaryUpdatedAt`: 토지 요약 데이터의 갱신 timestamp. `LandRegionSummary`에 해당 필드가 있으면 사용, 없으면 `updatedAt` 미전달(생략). 필드 존재 여부를 `types`에서 확인.

- [ ] **Step 2: 엔티티 스키마(minimal Place) 추가** — 좌표가 없으므로 주소 기반 Place를 `mainEntity`로. 같은 블록에:

```ts
    setBreadcrumbSchema(/* 기존 인자 유지 */)  // 변경 없음 — 위치 참고용
    // 신규: 동 자체를 나타내는 좌표 없는 Place
    useHead({ script: [{ key: 'jsonld-land-place', type: 'application/ld+json', innerHTML: JSON.stringify({
      '@context': 'https://schema.org', '@type': 'Place', name: `${districtName} ${dong}`,
      address: { '@type': 'PostalAddress', addressCountry: 'KR', addressRegion: cityName, addressLocality: `${districtName} ${dong}` },
    }) }] })
```
> `cityName`/`districtName`/`dong`은 페이지에 이미 존재하는 표시용 한글명 사용. (좌표 없는 행정구역이므로 `geo` 생략.)

- [ ] **Step 3: 타임스탬프** — 214행 DataSourceSection에 `:last-sync-date="landSummaryUpdatedAt ? formatKstDate(landSummaryUpdatedAt) : null"` 연결(필드 없으면 생략).
- [ ] **Step 4: 통과 검증** — `/real-estate/land/<city>/<district>/<dong>`에서 `"@type":"Place"` 1건 + `"@type":"Dataset"` 1건(인덱서블 시). noindex 동에서 Dataset 0건. `cd frontend && npx vitest run` green.
- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/real-estate/land/[city]/[district]/[dong].vue
git commit -m "fix(seo): 토지 동상세 엔티티(Place) 스키마 + 출처 Dataset 추가"
```

> **PR-C 종료**: push → develop PR → CI green → 머지. 운영 반영은 main 승격 시 + 라이브 검증(타입별 JSON-LD @type 집합 스냅샷).

---

## Self-Review

**1. 스펙 커버리지**
- 갭1 Dataset/provenance → A1·A2 헬퍼 + B1~B6·C1~C3 호출(공공데이터 9종). 가이드 제외(스펙대로). ✅
- 갭2 freshness(가시 타임스탬프 + dateModified) → B3~B6·C1~C3 타임스탬프 연결 + `setDetailProvenance`의 `dateModified`. 시설·부동산건물은 타임스탬프 기구현이라 provenance만(B1·B2). ✅
- 버그 3건 → C1(지하철 breadcrumb)·C2(공고 Article/Event)·C3(토지 엔티티). ✅
- noindex 가드 → `setDetailProvenance.noindex` + 각 페이지 noindex 변수 전달. ✅
- 광고 불변 → 광고 파일 미수정. ✅

**2. Placeholder 스캔**: 코드 단계는 실제 코드 포함. "필드명 확인" 단계는 실제 검증 액션(타입 파일 확인)이며 placeholder 아님 — B2 `syncStatusUpdatedAt`, C1 breadcrumb 키, C2 공고 필드명, C3 land updatedAt은 각 Step에 확인 지시 명시. ✅

**3. 타입 일관성**: `setDetailProvenance` 시그니처(A2)와 모든 호출부(B·C) 일치 — `{domain, category?, path, description, updatedAt?, createdAt?, noindex?}`. `setDatasetSchema` 확장 옵션(A1)과 헬퍼 사용 일치. `DataSourceDomain` 값(`facility|real-estate|subscription|public-rental|auction`)만 사용. ✅

**미해결(스펙 §8 후속, 본 계획 범위 밖)**: 중복색인(clothes/trash noindex) 별도 스펙 · 가이드 thin content · 토지/쓰레기 지도. trash noindex 도입 시 B3 호출에 `noindex` 연결 필요(교차 의존 명시됨).
