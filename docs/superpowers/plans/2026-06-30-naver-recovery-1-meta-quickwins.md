# 네이버 회복 1단계: 메타/색인 결함 quick-win Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 여전히 색인·출혈 중인 메타 결함 3종(AED 중복 제목 / 미래 title churn / subscription soft-404)을 저위험으로 차단한다.

**Architecture:** 프론트(Nuxt 3) SEO 메타 생성부만 손댄다. (1) `useFacilityMeta.ts`의 `buildDetailTitle`에 카테고리별 보조어(AED=`buildPlace`)를 추가해 동일 시설명 충돌을 분리, (2) 현재 title 포맷을 inline-snapshot으로 동결해 향후 churn을 테스트로 차단, (3) `subscription/[id].vue`에서 없는 레코드를 진짜 404로, 일시 장애는 soft-503으로 분기. 백엔드·DB·사이트맵 변경 없음.

**Tech Stack:** Nuxt 3 / Vue 3 / TypeScript, Vitest (happy-dom), Nuxt auto-import.

## Global Constraints

- Node 20 필수: 모든 npm/vitest 실행 전 `nvm use 20`. (Node 25에서 lock 불일치)
- 작업 브랜치: `fix/naver-dup-content-recovery` (develop 기준). main 직접 커밋 금지, PR·CI green 후 머지.
- 프론트 테스트: `cd frontend && npx vitest run <file>`. 커밋 전 관련 테스트 통과 필수.
- **title 포맷을 추가로 churn 금지** — Task 2의 freeze 테스트가 의도치 않은 포맷 변경을 막는다. AED 보조어 추가(Task 1)는 의도된 변경이므로 freeze는 Task 1 이후 생성.
- AED 보조어는 **aed 카테고리에만** 적용 — 다른 카테고리 title 불변.
- 커밋 메시지: 한국어 + conventional prefix(`fix:`/`test:`).

---

### Task 1: AED 제목에 buildPlace 보조어 추가 (중복 제목 분리)

같은 `name`(설치기관, 예: 'S-OIL(주)온산공장')을 공유하는 다수 AED가 byte-identical 제목으로 색인되는 문제. `details.buildPlace`(설치 상세위치, 100% 채워짐, 이미 description에 사용 중)를 제목에도 넣어 분리한다.

**Files:**
- Modify: `frontend/composables/useFacilityMeta.ts` (모듈 레벨에 `getTitleDisambiguator` 추가, `buildDetailTitle` 수정 — 현재 :375-391)
- Test: `frontend/tests/composables/useFacilityMeta.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: 기존 `cleanFacilityName(raw)` (모듈 레벨, :30), `getFacilityDisplayName(facility)` (:41), `CATEGORY_META`, `CATEGORY_SEO_INTENT`.
- Produces: `getTitleDisambiguator(facility: FacilityDetail, name: string): string` (모듈 레벨, 순수 함수). aed면 `cleanFacilityName(details.buildPlace)`를, name과 중복 시 `''` 반환. `buildDetailTitle`이 이를 name 뒤에 삽입.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/composables/useFacilityMeta.test.ts`의 `describe('useFacilityMeta', …)` 내부, `describe('setFacilityDetailMeta', …)` 블록 바로 뒤에 추가:

```ts
  describe('setFacilityDetailMeta - AED 중복 제목 분리', () => {
    function aedFacility(id: string, buildPlace: string): FacilityDetail {
      return {
        id,
        category: 'aed',
        name: 'S-OIL(주)온산공장',
        address: '울산 울주군',
        roadAddress: '울산광역시 울주군 온산읍 화산리 1',
        lat: 35.4,
        lng: 129.3,
        city: '울산광역시',
        district: '울주군',
        bjdCode: '31710',
        details: { buildPlace },
        sourceId: `src-${id}`,
        sourceUrl: null,
        viewCount: 0,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        syncedAt: '2024-01-01T00:00:00Z',
      }
    }

    it('같은 설치기관명이라도 buildPlace로 제목이 구분된다', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      setFacilityDetailMeta(aedFacility('a', '본관 1층 로비'))
      const titleA = (mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }).title
      setFacilityDetailMeta(aedFacility('b', '별관 경비실'))
      const titleB = (mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }).title

      expect(titleA).toContain('본관 1층 로비')
      expect(titleB).toContain('별관 경비실')
      expect(titleA).not.toBe(titleB)
    })

    it('buildPlace가 없으면 제목은 기존과 동일(설치기관명 + 카테고리 라벨)', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()

      setFacilityDetailMeta(aedFacility('c', ''))
      const title = (mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }).title

      expect(title).toContain('S-OIL(주)온산공장')
      expect(title).toContain(CATEGORY_META.aed.label)
      expect(title).not.toContain('  ') // 빈 보조어로 인한 이중 공백 없음
    })

    it('buildPlace가 이름과 중복되면 보조어를 생략한다', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      const f = aedFacility('d', 'S-OIL(주)온산공장')

      setFacilityDetailMeta(f)
      const title = (mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }).title

      expect(title).not.toContain('S-OIL(주)온산공장 S-OIL(주)온산공장')
    })
  })
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd frontend && npx vitest run tests/composables/useFacilityMeta.test.ts -t "AED 중복 제목 분리"
```
Expected: FAIL — `titleA`/`titleB`가 buildPlace를 포함하지 않아 동일(`not.toBe` 실패).

- [ ] **Step 3: 구현**

`frontend/composables/useFacilityMeta.ts`의 모듈 레벨 `cleanFacilityName`(:30) 함수 바로 뒤에 추가:

```ts
/**
 * 동일 시설명이 여러 레코드에 공유될 때(예: 한 건물의 AED 다수, 한 보건소의 여러 설치점)
 * 제목을 구분하는 카테고리별 보조어. 이름과 중복되면 '' 반환.
 * aed 외 카테고리는 별도 플랜에서 확장한다(현재는 빈 문자열 반환).
 */
function getTitleDisambiguator(facility: FacilityDetail, name: string): string {
  const d = (facility.details ?? {}) as Record<string, unknown>
  let raw: string | null = null
  if (facility.category === 'aed') {
    raw = cleanFacilityName(d.buildPlace as string | null | undefined)
  }
  if (!raw) return ''
  if (name.includes(raw) || raw.includes(name)) return ''
  return raw
}
```

그리고 `buildDetailTitle`(:375-391)의 `const name = getFacilityDisplayName(facility)` 줄(현재 :380)을 다음으로 교체:

```ts
    const name = getFacilityDisplayName(facility)
    const disamb = getTitleDisambiguator(facility, name)
    const displayName = disamb ? `${name} ${disamb}` : name
    const meta = CATEGORY_META[facility.category]
    const categoryName = meta?.label || facility.category
    const intent = CATEGORY_SEO_INTENT[facility.category]
    const inName = displayName.includes(categoryName) || (!!meta?.shortLabel && displayName.includes(meta.shortLabel))
    const head = inName ? displayName : `${displayName} ${categoryName}`
    return intent ? `${head} ${intent} | ${loc}` : `${head} | ${loc}`
```

> 주의: 기존 :381-390의 `meta`/`categoryName`/`intent`/`inName`/`head`/`return` 줄을 위 블록으로 **대체**한다(중복 선언 금지). `name`만 쓰던 자리를 `displayName`으로 바꾸는 것이 핵심.

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run tests/composables/useFacilityMeta.test.ts
```
Expected: PASS (신규 3개 + 기존 setFacilityDetailMeta 테스트 모두 — toilet/park는 aed가 아니므로 불변).

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useFacilityMeta.ts frontend/tests/composables/useFacilityMeta.test.ts
git commit -m "fix: AED 상세 제목에 buildPlace 보조어 추가 (중복 제목 분리)"
```

---

### Task 2: title 포맷 동결 (inline-snapshot 가드)

6월에 facility/trash 제목 포맷이 ~6회 churn → 네이버가 URL당 3~4개 stale 포맷 보유. 현재(=Task 1 반영 후) 포맷을 inline snapshot으로 고정해, 이후 의도치 않은 포맷 변경이 테스트를 깨도록 한다.

**Files:**
- Test: `frontend/tests/composables/useFacilityMeta.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: `useFacilityMeta()`의 `setFacilityDetailMeta`(facility 제목) 및 `setWasteScheduleDetailMeta`(trash 제목), 모킹된 `mockUseSeoMeta`.
- Produces: 없음(가드 테스트). 향후 포맷 변경 시 `-u`로 의도적으로만 갱신.

- [ ] **Step 1: 동결 테스트 작성 (snapshot 비움 상태로)**

`frontend/tests/composables/useFacilityMeta.test.ts`에 추가:

```ts
  describe('title 포맷 동결 (churn 방지 — 변경 시 의도 확인 후 -u)', () => {
    function facility(partial: Partial<FacilityDetail> & Pick<FacilityDetail, 'category' | 'name' | 'city' | 'district'>): FacilityDetail {
      return {
        id: 'freeze', address: '', roadAddress: null, lat: null, lng: null,
        bjdCode: '00000', details: {}, sourceId: 'freeze', sourceUrl: null, viewCount: 0,
        createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z', syncedAt: '2024-01-01T00:00:00Z',
        ...partial,
      } as FacilityDetail
    }
    const titleOf = () => (mockUseSeoMeta.mock.calls.at(-1)![0] as { title: string }).title

    it('wifi 제목 포맷', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(facility({ category: 'wifi', name: '황성공원', city: '경상북도', district: '경주시' }))
      expect(titleOf()).toMatchInlineSnapshot()
    })

    it('aed 제목 포맷 (buildPlace 보조어 포함)', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(facility({ category: 'aed', name: 'S-OIL(주)온산공장', city: '울산광역시', district: '울주군', details: { buildPlace: '본관 1층 로비' } }))
      expect(titleOf()).toMatchInlineSnapshot()
    })

    it('parking 제목 포맷', () => {
      const { setFacilityDetailMeta } = useFacilityMeta()
      setFacilityDetailMeta(facility({ category: 'parking', name: '조천읍 공영주차장', city: '제주특별자치도', district: '제주시' }))
      expect(titleOf()).toMatchInlineSnapshot()
    })

    it('trash 제목 포맷', () => {
      const { setWasteScheduleDetailMeta } = useFacilityMeta()
      setWasteScheduleDetailMeta({ id: 1, city: '전북특별자치도', district: '고창군', targetRegion: '흥덕면' })
      expect(titleOf()).toMatchInlineSnapshot()
    })
  })
```

- [ ] **Step 2: snapshot 채우기 (현재 포맷으로 동결)**

```bash
cd frontend && npx vitest run tests/composables/useFacilityMeta.test.ts -t "title 포맷 동결" -u
```
Expected: PASS — 4개 `toMatchInlineSnapshot()`가 현재 출력 문자열로 채워진다. 채워진 값에 `… | 일상킷` 접미사와 카테고리 라벨이 포함됐는지 육안 확인.

- [ ] **Step 3: 동결 동작 검증 (실패 확인 후 되돌리기)**

`buildDetailTitle`의 wifi 출력이 바뀌면 깨지는지 확인하기 위해, 임시로 아무 포맷이나 바꿔 테스트가 FAIL하는지 본 뒤 되돌린다. (실수 churn 차단이 동작함을 확인)

```bash
cd frontend && npx vitest run tests/composables/useFacilityMeta.test.ts -t "title 포맷 동결"
```
Expected: PASS (변경 안 했을 때). 이 가드는 이후 포맷 변경 PR에서 자동으로 FAIL하여 의도 확인을 강제한다.

- [ ] **Step 4: 커밋**

```bash
git add frontend/tests/composables/useFacilityMeta.test.ts
git commit -m "test: 시설/쓰레기 title 포맷 inline-snapshot 동결 (churn 방지)"
```

---

### Task 3: subscription soft-404 차단 (없는 레코드 → 진짜 404, 일시장애 → soft-503)

없는 청약 id가 `HTTP 200 + '청약 일정' + index,follow`로 색인되는 라이브 soft-404. 없는 레코드는 404, 백엔드 일시 장애(5xx)는 soft-503으로 분기(404 오인 색인 방지 — 6/20 fail-open 패턴과 일치).

**Files:**
- Modify: `frontend/pages/subscription/[id].vue` (useAsyncData 직후, 현재 :733-735)

**Interfaces:**
- Consumes: `useAsyncData`(`data`, `error`), Nuxt auto-import `createError`, auto-import `markDegradedResponse`(`composables/useDegradedResponse.ts`, 6/20 도입 — 다른 fail-open 페이지에서 동일 호출).
- Produces: 없음(페이지 동작). 없는 id → 404 + error.vue noindex,nofollow. 일시 5xx → 503 no-store.

> 참고: `getSubscriptionDetail`은 not-found에 throw가 아니라 null을 반환한다(라이브 증거: bogus id가 error 아닌 200+빈제목 렌더). 따라서 `error.value`는 transient/5xx에서만 set → `!data.value && !error.value`가 진짜 not-found. 이 페이지 가드는 레포 관례상(다른 createError(404) 페이지들도 단위테스트 없음) **build + 수동 검증**으로 확인한다. 공용 fail-vector 헬퍼 추출·단위테스트는 Plan 2에서.

- [ ] **Step 1: 가드 추가**

`frontend/pages/subscription/[id].vue`의 현재 :733-735:

```ts
const { data } = await useAsyncData(`subscription-${id}`, () =>
  getSubscriptionDetail(id)
)
```

를 다음으로 교체:

```ts
const { data, error } = await useAsyncData(`subscription-${id}`, () =>
  getSubscriptionDetail(id)
)

if (error.value) {
  // 백엔드 일시 장애(5xx) — soft-503 fail-open (404 오인 색인 방지)
  if (import.meta.server) markDegradedResponse()
} else if (!data.value) {
  // 존재하지 않는 청약 → 진짜 404 (soft-404 색인 방지)
  throw createError({ statusCode: 404, statusMessage: '존재하지 않는 청약 정보입니다' })
}
```

(바로 아래 기존 `if (data.value) { … }` 블록은 그대로 둔다 — 방어적.)

- [ ] **Step 2: 타입/빌드 검증**

```bash
cd frontend && nvm use 20 && npm run lint && npx nuxi typecheck 2>/dev/null || npm run build 2>&1 | tail -15
```
Expected: lint 통과, 타입 에러 없음(`markDegradedResponse`/`createError` 인식).

- [ ] **Step 3: 수동 검증 (dev 서버)**

```bash
cd frontend && nvm use 20 && (npm run dev > /tmp/sub-dev.log 2>&1 &) && sleep 8
# 없는 id → 404 기대
curl -s -o /dev/null -w "missing=%{http_code}\n" http://localhost:3000/subscription/this-id-does-not-exist
# 실제 존재하는 id 하나로 → 200 기대 (DB 시드 또는 백엔드 필요; 백엔드 없으면 이 줄은 스킵 후 PR 리뷰에서 스테이징 확인)
```
Expected: `missing=404`. (백엔드/시드 미가동 시 200 케이스는 PR 환경에서 확인.)

- [ ] **Step 4: 커밋**

```bash
git add frontend/pages/subscription/[id].vue
git commit -m "fix: subscription 상세 soft-404 차단 (없는 청약 404 / 일시장애 soft-503)"
```

---

## Self-Review

- **Spec coverage:** 본 플랜은 스펙 §4.1 subscription soft-404 + §4.2 AED + §4.3 title 포맷 동결을 구현. 스펙의 나머지(fail-vector 하드닝 전체, TRASH 집계, WIFI 허브, parking/clothes, 운영 캐시퍼지, Part D 백엔드)는 후속 플랜/PR. (의도된 staging — 핸드오프에서 명시)
- **Placeholder scan:** 모든 step에 실제 코드/명령 포함. "적절히 처리" 류 없음. Task 3의 수동검증은 레포가 페이지를 단위테스트하지 않는 실제 관례를 반영(헬퍼 추출은 Plan 2로 명시 연기) — 빈 자리표가 아님.
- **Type consistency:** `getTitleDisambiguator(facility, name)` 시그니처가 Task 1 구현·사용에서 일치. `displayName`이 `name`을 대체하는 지점 명시. `error`/`data`가 useAsyncData 반환과 일치.

## 후속 플랜 (예고 — 본 플랜 범위 아님)
- **Plan 2**: fail-vector 하드닝 — 공용 detail-fetch 헬퍼(단위테스트 가능) 추출 후 facility `[category]/[id]`(5xx→200빈), land `[dong]`·auction `item`(5xx→404)에 적용 + subscription 리팩터.
- **Plan 3**: TRASH city+구+targetRegion 집계 페이지 + 개별 301/noindex (백엔드 사이트맵 + 프론트 라우팅).
- **Plan 4**: WIFI 개별 noindex 확정 + 동/구 지역 허브 색인.
- **Plan 5**: parking/clothes 보조어(`getTitleDisambiguator` 확장).
- **운영/Part D**: 캐시 퍼지+재제출, 백엔드 pool/sync(서버 접근 필요).
