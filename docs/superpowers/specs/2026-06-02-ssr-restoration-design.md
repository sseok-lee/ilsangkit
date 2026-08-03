# SSR 누락 복구 설계 (Frontend Audit ②)

- **작성일:** 2026-06-02
- **출처:** `docs/superpowers/specs/2026-06-02-frontend-improvement-audit.md` ② SSR 누락
- **범위:** #1 RelatedGuides · #2 PublicRentalListView · #4 주변시설. **#3 search.vue 제외**
- **PR:** 단일 PR("SSR 누락 복구"), 항목별 atomic 커밋
- **검증:** 단위 테스트(모킹) + 핵심 페이지 SSR HTML 수동 curl grep

## 배경 / 문제

`useAsyncData`는 SSR에서 resolve되어 HTML에 반영되지만, `onMounted` fetch와 `watch(..., immediate)` 콜백은 서버에서 실행/flush되지 않아 해당 콘텐츠·내부링크가 SSR HTML에 빠진다. 색인 손실과 hydration 시 깜빡임(CLS)을 유발한다.

`search.vue`는 `robots: noindex`(`:789`)라 색인 영향이 없고 hydration mismatch 위험이 가장 커, 이번 범위에서 제외하고 별도 UX 태스크로 분리한다.

## 보존 원칙 (회귀 금지)

- `useApiBase` 루프백 — SSR 자기-도메인 호출 색인 회귀 방어. 모든 신규 SSR fetch도 이를 경유.
- 이미지/OG URL은 `config.public.apiBase`(public base) 유지.
- `[category]/[id].vue` 메인 `facilityResponse`의 `lazy: true`(클라 네비 속도) — 변경하지 않음.
- 보조 콘텐츠(관련 가이드·주변시설)의 "실패해도 페이지는 정상 렌더" 성격 유지.

---

## #1 RelatedGuides → SSR

**문제:** `components/guide/RelatedGuides.vue`가 `onMounted`에서 fetch → 6개 사용처 전부 CSR-only. `guide/[slug].vue`는 추가로 `<ClientOnly>`로 감쌈.

**변경:**
1. `RelatedGuides.vue`: `onMounted` 비동기 fetch를 `useAsyncData`로 교체.
   - 키: `related-guides-${props.categories?.join('-') ?? props.category ?? 'all'}` (페이지 내 충돌 방지, prop 조합 기반).
   - 핸들러 내부 try/catch 유지 → 실패 시 `{ items: [] }` 반환(보조 콘텐츠 조용한 실패).
   - `fetchGuides`는 기존대로 `$fetch` + `useApiBase` 경유.
2. `pages/guide/[slug].vue:102-108`: 불필요해진 `<ClientOnly>` 래퍼 제거.

**효과:** 6개 사용처(`[category]/index`, `guide/[slug]`, `subscription/[id]`, `[buildingName]`, `DetailContextLinks`) 관련 가이드 링크가 SSR HTML에 포함.

**hydration:** `v-if="guides.length > 0"`가 SSR·클라 동일 데이터 → mismatch 없음.

---

## #2 PublicRentalListView → SSR (SubscriptionListView 패턴 정렬)

**문제:** `PublicRentalListView.vue:128`가 `onMounted`에서 초기 fetch. `usePublicRental` 반환 ref는 전부 `readonly()`라 SSR payload 시딩 불가.

**변경:**
1. `composables/usePublicRental.ts`: 비변경 getter 추가
   ```ts
   const getList = async (params: PublicRentalListQuery = {}): Promise<PublicRentalListResponse> => {
     const res = await $fetch<ApiEnvelope<PublicRentalListResponse>>(
       `${apiBase()}/api/public-rental`, { query: params },
     )
     if (res.success && res.data) return res.data
     return { items: [], pagination: { page: 1, limit: 18, total: 0, totalPages: 0 } }
   }
   ```
   기존 `fetchList`는 그대로 둔다(다른 호출부 영향 없음). 반환에 `getList` 추가.
2. `PublicRentalListView.vue`: composable readonly ref 대신 **로컬 ref**(`items`/`total`/`totalPages`/`currentPage`/`loading`/`error`)로 전환.
   - 초기 SSR: `useAsyncData(\`public-rental-${props.rentalTypeCode ?? 'all'}\`, () => getList({ rentalType: props.rentalTypeCode, page: 1, limit: 18 }))` → `data.value`로 로컬 ref 시딩.
   - 필터/페이지 watch·`reload`·`goToPage`는 `getList` 호출 후 로컬 ref 갱신(클라이언트).
   - `onMounted` 초기 reload 제거.

**hydration:** SSR 초기 데이터와 클라 첫 렌더 동일. 필터는 사용자 상호작용 시에만 변경되므로 mismatch 없음.

**사용처 영향:** 3개 페이지(`public-rental/[type]/index`, `public-rental/index`, `subscription/rent/[type]`). 키에 `rentalTypeCode` 포함으로 구분.

---

## #4 주변시설 → SSR (`pages/[category]/[id].vue:906-922`)

**문제:** `watch(() => facility.value, ..., { immediate: true })`로 `searchNearby`(반경, 좌표 필요)+`searchNearbyCross`(category,id) 호출. 서버는 watcher를 flush하지 않고, setup 시점 lazy facility가 아직 null이라 SSR 누락.

**변경:** 전용 `useAsyncData`로 교체.
```ts
const { data: nearbyData } = await useAsyncData(
  `nearby-${category.value}-${id.value}`,
  async () => {
    // 메인 facility가 lazy라 좌표 미확보 → 상세 1회 재패칭(결정사항: detail 재패칭)
    const detail = await $fetch<{ data: FacilityDetail }>(
      `${apiBase}/api/facilities/${category.value}/${id.value}`,
    ).catch(() => null)
    const f = detail?.data
    const crossP = $fetch(`${apiBase}/api/facilities/${category.value}/${id.value}/nearby`)
    const nearbyP = (f?.lat && f?.lng)
      ? $fetch(`${apiBase}/api/facilities/search`, { method: 'POST', body: { category: f.category, lat: f.lat, lng: f.lng, radius: 1000, page: 1, limit: 100 } })
      : Promise.resolve(null)
    const [nearbyR, crossR] = await Promise.allSettled([nearbyP, crossP])
    return {
      nearby: nearbyR.status === 'fulfilled' ? (nearbyR.value?.data?.items ?? []) : [],
      cross:  crossR.status  === 'fulfilled' ? (crossR.value?.data?.items  ?? []) : [],
    }
  },
  { lazy: true, default: () => ({ nearby: [], cross: [] }) },
)
```
- `nearbyFiltered` / `crossFacilitiesGrouped` computed는 `nearbyData.value.nearby` / `.cross`를 읽도록 변경.
- `useFacilitySearch`의 nearby 관련 destructure(`searchNearby`/`nearbyFacilities`/`nearbyLoading`/`searchNearbyCross`/`crossFacilities`/`crossLoading`)와 `watch(facility, immediate)` 블록 제거.

**좌표 확보:** nearby 핸들러 내부에서 상세 1회 재패칭(결정). 백엔드 상세 호출 1회 추가(캐시/빠름). 메인 `lazy` 동작 불변.

**hydration:** `useAsyncData`가 SSR·클라 동일 결과 → mismatch 없음. radius 검색 한도는 100 유지(기존 `searchNearby`와 동일), 표시는 `.slice(0,4)`.

---

## 테스트 / 검증

**단위 테스트 (vitest, 기존 모킹 인프라 재사용):**
- `RelatedGuides.vue`: `useAsyncData` 모킹으로 데이터 있을 때 링크 N개 렌더, 빈 배열일 때 `v-if` 미렌더, `excludeSlug` 필터 동작.
- `PublicRentalListView.vue`: 초기 데이터 시딩 렌더, 필터 변경 시 `getList` 호출 + 목록 갱신, 빈/에러 상태.
- `[category]/[id].vue` 주변시설: `nearbyData` 모킹으로 `nearbyFiltered`(자기 자신 제외, 4개 제한)·`crossFacilitiesGrouped` 계산 검증.

**수동 SSR 검증 (curl + grep, JS 미실행 상태의 HTML):**
- `curl -s localhost:3000/guide/<slug> | grep -c '/guide/'` → 관련 가이드 링크 SSR 포함.
- `curl -s localhost:3000/public-rental/<type> | grep -i 'PublicRentalCard 산출물 마커'` → 목록 카드 SSR 포함.
- `curl -s localhost:3000/<category>/<id> | grep '주변'` → 주변시설 블록 SSR 포함.

**회귀:** `npm run lint` + 백엔드/프론트 `vitest run`(메모리: 작업 후 테스트 확인 필수). Node 20(`nvm use 20`).

## 커밋 분할 (atomic)

1. `feat(frontend): RelatedGuides SSR 패칭 전환 + guide/[slug] ClientOnly 제거`
2. `feat(frontend): usePublicRental getList 추가 + PublicRentalListView SSR 전환`
3. `feat(frontend): [category]/[id] 주변시설 useAsyncData SSR 합류`
4. `test(frontend): SSR 복구 3건 단위 테스트`

## 비범위 (Out of scope)

- #3 `search.vue` SSR 프리페치 — noindex라 색인 무관, hydration 리스크 큼. 별도 UX 태스크.
- 백엔드 `/nearby` 엔드포인트에 반경 결과 병합(중복 fetch 제거) — 별도 검토.
- audit ③④⑤⑥ 항목.
