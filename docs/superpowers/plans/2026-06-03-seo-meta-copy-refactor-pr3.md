# SEO 메타 리팩터 PR3 — raw useHead → setMeta 흡수 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 메타를 손으로 짠(raw `useHead`/`useSeoMeta`) 페이지들을 공통 게이트 `setMeta()`/`setRegionMeta()`로 흡수해, og:image/og:url/og:site_name/og:locale/twitter/canonical/브랜드/구분자를 일괄 통일하고 누락(특히 네이버 og)을 메운다.

**Architecture:** 각 페이지의 raw 메타 블록을 `useFacilityMeta().setMeta({...})` 호출로 교체. noindex/robots/canonical 분기 로직은 보존하되 canonical은 `setMeta`의 `canonical` 옵션으로 전달. `setMeta`에 `og:image:alt`를 추가(전 페이지 일괄 보강).

**Tech Stack:** Nuxt 3, Vitest. 테스트: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run <path>`.

**Spec:** `docs/superpowers/specs/2026-06-03-seo-meta-copy-refactor-design.md` §6.2, R1, R2

**선행:** PR1(SITE_TAGLINE/브랜드 통일) 머지 권장.

---

## 파일 구조 (대상 페이지)

- Modify: `frontend/composables/useFacilityMeta.ts` — `setMeta()`에 `ogImageAlt` 추가
- Modify: `frontend/pages/subway/index.vue`, `subway/[slug].vue`
- Modify: `frontend/pages/subscription/index.vue`, `sale/index.vue`, `sale/[type].vue`, `rent/index.vue`, `rent/[type].vue`, `[id].vue`
- Modify: `frontend/pages/public-rental/index.vue`, `[type]/index.vue`, `[type]/[id].vue`, `announcements/index.vue`, `announcements/[pblancId].vue`
- Modify: `frontend/pages/real-estate/index.vue`, `[realEstateType]/index.vue`, `[realEstateType]/[city]/index.vue`, `[realEstateType]/[city]/[district]/index.vue`
- Modify: `frontend/pages/[city]/index.vue`, `[city]/[district]/index.vue`
- Test: `frontend/tests/composables/useFacilityMeta.test.ts`, 페이지별 수동 SSR(curl)

---

## Task 1: setMeta에 og:image:alt 추가 (전 페이지 일괄 보강)

**Files:**
- Modify: `frontend/composables/useFacilityMeta.ts:68-79` (MetaOptions), `:246-268` (useSeoMeta)
- Test: `frontend/tests/composables/useFacilityMeta.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
describe('setMeta - og:image:alt', () => {
  it('ogImageAlt가 항상 설정된다 (기본=fullTitle)', () => {
    const { setMeta } = useFacilityMeta()
    setMeta({ title: '병원 찾기', description: '설명', path: '/hospital' })
    const call = mockUseSeoMeta.mock.calls[0][0]
    expect(call.ogImageAlt).toBe('병원 찾기 | 일상킷')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useFacilityMeta.test.ts -t 'og:image:alt'`
Expected: FAIL — `ogImageAlt` 미설정.

- [ ] **Step 3: 구현**

`MetaOptions`(68-79)에 옵션 추가: `imageAlt?: string`. `useSeoMeta(...)` 객체(246-268)에 추가:

```typescript
      ogImageAlt: options.imageAlt ?? fullTitle,
```

- [ ] **Step 4: 통과 확인 + 전체**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useFacilityMeta.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useFacilityMeta.ts frontend/tests/composables/useFacilityMeta.test.ts
git commit -m "feat(seo): add og:image:alt to setMeta (site-wide)"
```

---

## 마이그레이션 공통 패턴 (Task 2~N 공용)

각 페이지에서 아래 절차를 반복한다:

1. 해당 페이지의 현재 `useHead({...})` 또는 `useSeoMeta({...})` 메타 블록(title/description/og*/twitter/canonical link)을 **읽는다**.
2. `useFacilityMeta()` 구조분해에 `setMeta`(목록/허브) 또는 `setRegionMeta` 추가.
3. 메타 블록을 `setMeta({ title, description, path, image?, type?, canonical? })` 호출로 교체. 브랜드(` | 일상킷`)는 setMeta가 부착하므로 **title에서 수동 브랜드/구분자 제거**.
4. 기존 `noindex`/`robots` 분기는 별도 `useHead({ meta:[{name:'robots',content:'noindex, follow'}] })`로 보존하고, 그 경우 `setMeta({..., canonical: false})`.
5. og:image가 지도형(`/og-map`)이면 `image` + `imageWidth:1024`/`imageHeight:536` 전달, 아니면 생략(기본 `DEFAULT_OG_IMAGE`).
6. 도시명은 `compactCityName`/축약형 사용(R2).
7. 검증: `curl -s '<url>' | grep -oE '<title>[^<]*|<meta property="og:(image|url|site_name|locale)"[^>]*|<meta name="twitter:card"[^>]*'` 로 누락 필드가 채워졌는지 확인.

**title에서 브랜드 수동제거 주의:** 예) subway/index가 `${pageTitle} - 일상킷`(하이픈)였다면 `setMeta({ title: pageTitle, ... })`로만 넘긴다(setMeta가 ` | 일상킷` 부착).

---

## Task 2: subway/index.vue (가장 누락 심함 — og:image·dims·site_name·locale·twitter 전무)

**Files:**
- Modify: `frontend/pages/subway/index.vue:356-367`

- [ ] **Step 1: 현재 메타 블록 읽기** — `useSeoMeta`(356-363) + canonical `useHead`(365-367).
- [ ] **Step 2: 교체** — `useFacilityMeta()`에서 `setMeta` 가져와:

```typescript
setMeta({
  title: pageTitle.value,        // 예: '전국 지하철역' (브랜드/하이픈 제거)
  description: '전국 지하철역의 위치·노선·환승 정보를 지도에서 확인하세요. 환승역은 모든 노선이 함께 표시됩니다.',
  path: '/subway',
})
```

- [ ] **Step 3: 검증** — `curl -s localhost:3000/subway | grep -oE 'og:(image|site_name|locale)|twitter:card|<title>[^<]*'`
Expected: og:image(DEFAULT_OG_IMAGE)·og:site_name·og:locale·twitter:card 모두 존재, `<title>전국 지하철역 - 일상킷` → 이제 `… | 일상킷`로 통일.
- [ ] **Step 4: 커밋** `git commit -m "refactor(seo): migrate subway/index to setMeta (fills og/twitter gaps)"`

---

## Task 3: subway/[slug].vue (twitter:title/desc, og:site_name/locale 누락)

**Files:** Modify `frontend/pages/subway/[slug].vue:573-594`
- [ ] **Step 1:** 현재 `buildSubwayTitle/Description`(utils/subwayMeta.ts) 결과 + raw useHead 읽기.
- [ ] **Step 2:** `setMeta({ title, description, path: \`/subway/${slug}\`, image: ogMapUrl, imageWidth:1024, imageHeight:536 })` 로 교체. `buildSubwayTitle`이 ` | 일상킷`을 붙이고 있으면 그 접미사 제거(utils/subwayMeta.ts:6) — setMeta가 부착. description은 `buildSubwayDescription`을 산문형으로(PR4에서 다룰 수도) 그대로 전달.
- [ ] **Step 3:** 검증 curl — twitter:title/description, og:site_name, og:locale 존재.
- [ ] **Step 4:** 커밋.

---

## Task 4: subscription/* (6개 페이지)

각각 raw useHead/useSeoMeta → setMeta. 목표 title(브랜드 제외, setMeta가 부착):

| 페이지 | setMeta title | path |
|---|---|---|
| `subscription/index.vue` | `청약 일정·분양정보` | `/subscription` |
| `subscription/sale/index.vue` | `분양 청약 일정` | `/subscription/sale` |
| `subscription/sale/[type].vue` | `${typeMeta.label} 분양 청약 일정` | `/subscription/sale/${type}` |
| `subscription/rent/index.vue` | `임대 청약 일정` | `/subscription/rent` |
| `subscription/rent/[type].vue` | `${typeMeta.label} 임대 청약` | `/subscription/rent/${type}` |
| `subscription/[id].vue` | `${houseName} 청약 일정` | `/subscription/${id}` |

- [ ] **Step 1~6 (페이지당 반복):** 공통 패턴 적용. 특히:
  - `rent/index.vue`: 기존 `임대 청약 일정 - 공공임대·LH 임대 청약 정보`(하이픈+스터핑) → title은 `임대 청약 일정`만, 나머지 키워드는 description으로.
  - `[id].vue`: 기존 title `${houseName} 청약 일정 | ${location} ${type} ${status} | 일상킷`(38자 잘림) → `setMeta({ title: \`${houseName} 청약 일정\`, ... })`. 위치·상태는 description으로(`${location} ${type} ${houseName}, 현재 ${status}. 공급 …`). og:url 누락도 setMeta가 채움.
- [ ] **Step 7:** 각 페이지 curl 검증 + 페이지별 커밋.

---

## Task 5: public-rental/* (5개 페이지)

| 페이지 | setMeta title | path |
|---|---|---|
| `public-rental/index.vue` | `공공임대 매물` | `/public-rental` |
| `public-rental/[type]/index.vue` | `${typeMeta.label}` | `/public-rental/${type}` |
| `public-rental/[type]/[id].vue` | `${displayName} ${rentalType}` | `/public-rental/${type}/${id}` |
| `public-rental/announcements/index.vue` | `공공임대 모집공고` | `/public-rental/announcements` |
| `public-rental/announcements/[pblancId].vue` | `${pblancNm}` | `/public-rental/announcements/${id}` |

- [ ] **Step 1~N:** 공통 패턴. announcements 2개 페이지는 **twitter 카드 전무** → setMeta가 채움. `[pblancId].vue`는 `status==='closed'`면 기존 noindex 보존 + `setMeta({..., canonical:false})`. `[type]/[id].vue`는 og:image 지도형이면 1024×536 전달.
- [ ] **Step N+1:** 페이지별 curl 검증(twitter:card, og:locale) + 커밋.

---

## Task 6: real-estate 허브/목록 (4개) — 도시명 압축 + site_name/locale 보강

| 페이지 | setMeta title | 비고 |
|---|---|---|
| `real-estate/index.vue` | `부동산 실거래가` | 더블파이프 제거(`\| 아파트·빌라·오피스텔`는 description으로) |
| `[realEstateType]/index.vue` | `${propertyLabel} ${tab} 실거래가` | |
| `[realEstateType]/[city]/index.vue` | `${cityName} ${typeLabel} 실거래가` | cityName 압축형 |
| `[realEstateType]/[city]/[district]/index.vue` | `${cityName} ${districtName} ${typeLabel} 실거래가` | **og:site_name+locale 누락** → 보강 |

- [ ] **Step 1~N:** 공통 패턴. `real-estate/index.vue` description = `전국 아파트·빌라·오피스텔의 매매·전세·월세 실거래가를 지역별로 조회하세요. 국토교통부 공식 데이터로 단지별 시세 추이와 거래 내역을 확인할 수 있습니다.` 각 페이지 curl 검증 + 커밋.

---

## Task 7: [city]/index.vue, [city]/[district]/index.vue — 빈 허브 가드 + canonical 확인

**Files:** Modify `frontend/pages/[city]/index.vue`, `[city]/[district]/index.vue`
- [ ] **Step 1:** 현재 useHead(199-225 / 189-215) 읽기. (H1 `생활 정보`는 유지 — spec §3.2.)
- [ ] **Step 2:** `setMeta({ title: \`${cityName} 생활 정보\`, description, path })`로 교체(브랜드 수동 ` | 일상킷` 제거). cityName 압축형 확인.
- [ ] **Step 3:** 검증 curl — canonical self·og 전부 존재.
- [ ] **Step 4:** 커밋.

---

## Task 8: PR3 최종 검증 + PR 생성

- [ ] **Step 1:** 전체 테스트 + 린트 + 타입체크.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run && npm run lint && npx nuxi typecheck`
- [ ] **Step 2:** 누락 회귀 스모크 — 대상 페이지 전부 curl로 `og:image`,`og:url`,`og:site_name`,`og:locale`,`twitter:card` 존재 확인(셸 루프).
- [ ] **Step 3:** PR 생성 + CI 통과 후 머지(ground-truth 재확인).

```bash
gh pr create --base develop --title "refactor(seo) PR3: raw useHead → setMeta 흡수 (og 누락 일괄 해소)" --body "spec §6.2"
```

---

## Self-Review 메모
- **Spec 커버리지**: §6.2(raw→setMeta 흡수, og 누락 해소) ✓ Task2~7 / R1(브랜드 통일·하이픈 제거) ✓ 전 태스크 / R2(도시명 압축) ✓ Task6·7 / og:image:alt ✓ Task1.
- **noindex 보존**: `[pblancId]` closed, 페이지네이션 등은 robots 분기 + `canonical:false` 보존(공통 패턴 4항).
- **주의(비목표 경계)**: noindex/canonical *정합성*(사이트맵 대조 등)은 본 PR 범위 밖 — spec §8 후속.
- **반복 태스크**: subscription/public-rental/real-estate는 페이지 수가 많아 "현재 블록 읽기→setMeta 교체→curl 검증→커밋"을 페이지 단위로 1커밋씩. 서브에이전트 실행 시 페이지당 1태스크로 분할 권장.
