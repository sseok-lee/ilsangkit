# 지역 셀렉트 → 시/도 링크 칩 개편 설계

**작성일**: 2026-07-22
**상태**: 설계 확정 (브레인스토밍 완료, 플랜 대기)
**범위**: 시설 목록(`/[category]`) + 부동산 목록(`/real-estate/[realEstateType]`) — 검색/경매/청약 제외

## 1. 목표

목록 페이지의 **지역 셀렉트(시/도·구/군 드롭다운)**는 클라이언트에서만 목록을 재필터할 뿐 URL을 바꾸지 않아 **크롤 가능한 내부링크를 만들지 못한다(SEO 가치 0)**. 이를 **시/도 링크 칩(SSR `<NuxtLink>`)**으로 교체해:

1. 지역페이지로 향하는 **크롤 가능한 내부링크**를 목록 페이지에 신설 → 방금 완료한 지역 정규화/SSR 지역페이지 전략([전남광주통합특별시 정규화], [지역 목록 SSR화])을 강화.
2. 시설 목록의 `/{category}?city=slug` **thin-dup을 해소**(현재 self-canonical이나 SSR이 전국을 렌더).
3. UI 단순화(셀렉트+키워드 인풋 제거). "타이핑 검색"은 이미 있는 헤더 통합검색이 담당.

## 2. 배경 — 현재 상태 (실측)

### 2-1. 시설 목록 `pages/[category]/index.vue`
- **필터 UI**: 인라인 `<select>` 시/도(33–41행)·구/군(47–56행) + 키워드 인풋(65–71행). `RegionCascadingDropdown` 미사용.
- **동작 = 클라이언트 필터**: `@change` → `handleCityChange()`(700행)/`handleDistrictChange()`(726행) → `performSearch()`(639행) → `search()`가 `/api/facilities/search`에 **POST body로 city/district 전달**(648–655행). 셀렉트 변경 시 **URL을 바꾸지 않음**.
- **SSR**: page1 데이터를 `useAsyncData`로 서버 로드(347–352행). **단, 서버 fetch body는 `{ category, page, limit }`뿐 — `route.query.city`를 읽지 않음**(367행). → `/{category}?city=slug`는 SSR에서 **전국 목록**을 렌더하고 city 필터는 하이드레이션 후 클라이언트에서만 적용 = 크롤러엔 thin-dup.
- **canonical**(610–623행): `city+district` → `/{city}/{district}/{category}`; `city`만 → `/{category}?city={slug}`(self-canonical); 그 외 → self. **2-segment `/{city}/{category}` 라우트는 실재하지 않음**(주석 명시).
- **page2+ noindex**(627–636행): `pageQueryParam >= 2` → robots noindex + canonical 제거.
- **"인기 지역" 링크**(240–250행): `NuxtLink :to="/{citySlug}/{districtSlug}/{categoryParam}"` — **구/군 레벨** 지역×카테고리 페이지로 링크(SSR).

### 2-2. 부동산 목록 `pages/real-estate/[realEstateType]/index.vue`
- **필터 UI**: 컴포넌트 `components/realEstate/RealEstateSearchFilter.vue`(시/도+구/군+건물명). 옵션은 **정적 `REGIONS`**(`~/shared/regionSlugs`, API 아님). `@search` emit만.
- **동작 = 클라이언트 필터**: `@search="handleSearch"` → `handleSearch()`(300행) → `loadComplexes()`(313행) 재조회. **URL/쿼리 전혀 안 씀**.
- **SSR**: page1 목록 `useAsyncData`(230행).
- **"도시 허브" 링크**(129–138행): `NuxtLink` → `/real-estate/{type}/{citySlug}` — **깔끔한 2-segment city 라우트가 이미 존재**.
- page>1 noindex(260–269행).

### 2-3. 지역페이지(착지점, 그대로 유지)
- `pages/[city]/index.vue`(시/도 허브), `pages/[city]/[district]/index.vue`(구/군 허브), `pages/[city]/[district]/[category].vue`(지역×카테고리 목록, `useRegionFacilities`, SSR, `canonical:false`).
- 부동산: `pages/real-estate/[realEstateType]/[city]/`, `.../[city]/[district]/` 라우트 존재.

### 2-4. 재사용 자원
- **정적 지역 소스**: `shared/regionSlugs.ts` — `CITY_SLUGS`/`CITY_SLUG_MAP`/`REGIONS`. **jeonnamgwangju 포함**(전남광주 정규화 시 등록됨). API·클라이언트 fetch 불필요 → SSR-safe.
- **백엔드**: `/api/facilities/search`는 이미 `city`/`district` 인자 지원. `buildRegionFilter`가 city 변종 매칭.

## 3. 잠긴 설계 결정

| # | 결정 | 값 |
|---|---|---|
| D1 | 범위 | 시설 목록 + 부동산 목록 (검색·경매·청약 제외) |
| D2 | 칩 깊이 | **시/도만**(17개 광역 + jeonnamgwangju). 구/군은 착지 지역페이지에서 드릴다운 |
| D3 | 키워드 인풋 | **제거**(칩만). 타이핑 검색은 헤더 통합검색 |
| D4 | 시설 칩 착지 | `/{category}?city={slug}` + **SSR 필터 수정** |
| D5 | 부동산 칩 착지 | `/real-estate/{type}/{citySlug}`(기존 라우트) |
| D6 | "인기 지역"(구/군) 링크 | **유지** — 시/도 칩(넓이) + 인기 구/군(깊이) 퍼널 |
| D7 | IP 위치 추정 힌트 | **v1 미포함**(순수 칩) |
| D8 | `?city=` 페이지 사이트맵 등재 | **후속**(v1은 내부링크만) |

## 4. 컴포넌트 설계

### 4-1. 신규 `components/common/RegionChips.vue`
시/도 링크 칩을 렌더하는 재사용 컴포넌트. **API 호출 없음**(정적 `shared/regionSlugs`) → SSR-safe.

- **Props**:
  - `hrefFor: (citySlug: string) => string` — 각 시/도 칩의 `to`를 만드는 빌더(시설·부동산이 서로 다른 URL을 주입).
  - `activeSlug?: string` — 현재 선택된 시/도(있으면 강조/‘전체’ 토글 표시).
  - `label?: string` — 칩 앞 라벨(기본 "지역별 보기").
- **렌더**: `<NuxtLink v-for>` 광역시/도 칩. 목록은 `shared/regionSlugs`의 광역 슬러그(`CITY_SLUGS` 중 광역 레벨) — jeonnamgwangju 포함. `activeSlug`가 있으면 "전체"(필터 해제) 칩을 앞에 둔다.
- **접근성**: `<nav aria-label="지역 선택">` 래핑, 활성 칩 `aria-current`.
- 스타일: 기존 "인기 지역" 칩 클래스 재사용(`bg-white border rounded-full hover:border-primary`).

### 4-2. 삭제(데드 코드)
- `components/search/SearchFilters.vue`(어디서도 import 안 됨).
- `components/trash/RegionSelector.vue`(미사용).

### 4-3. 범위 밖(변경 없음)
- `components/common/RegionCascadingDropdown.vue`(경매 `AuctionFilters`·청약 `SubscriptionListView`에서 사용) — 그대로.
- `components/realEstate/RealEstateSearchFilter.vue` — 부동산 목록에서 제거하지만 **파일 자체는 다른 사용처 확인 후 처리**(현재 목록 외 사용처 없으면 삭제, 있으면 유지).

## 5. 시설 목록 변경 (`pages/[category]/index.vue`)

### 5-1. UI
- 시/도·구/군 `<select>` 2개 + 키워드 인풋 **제거**.
- 그 자리에 `<RegionChips :href-for="(slug) => `/${categoryParam}?city=${slug}`" :active-slug="queryCitySlug" />`.
- **"인기 지역"(구/군) 링크는 유지**(240–250행).
- 셀렉트 전용 상태·핸들러(`selectedCity/selectedDistrict`, `handleCityChange/handleDistrictChange`, `cities/districtList`, `loadRegions/getCities`)와 키워드 상태 제거. `useRegions` 의존이 이 페이지에서만 쓰였다면 함께 정리.

### 5-2. SSR 필터 수정 (핵심)
`useAsyncData`가 `route.query.city`를 읽어 서버 fetch에 반영한다:
- `route.query.city`(slug) → **city명 해석**: `shared/regionSlugs`의 slug→city명 매핑으로 변환(백엔드 `/api/facilities/search`가 기대하는 값 = 클라이언트 필터가 지금 넘기는 값과 동일하게). 기존 `?city=` 딥링크 클라이언트 필터가 이미 하는 slug↔명 변환 로직을 재사용.
- 변환된 city를 `/api/facilities/search` body에 포함 → **SSR HTML이 city-필터된 목록**을 렌더.
- `useAsyncData` 키에 city를 포함(`cat-list-${category}-${citySlug}-p${page}`)해 캐시 분리.
- **fail-open**: `route.query.city`가 유효하지 않은 slug면 city 없이(전국) 렌더 — soft-404/에러 대신 fail-open(과거 SSR fail-closed 색인사고 교훈).
- trash 분기(`/api/waste-schedules`)는 city 파라미터 처리를 동일 원칙으로(백엔드 지원 범위 내). 지원 안 되면 trash는 칩 대상에서 제외하고 명시.

### 5-3. canonical / robots
- `?city=` self-canonical 유지(이제 진짜 필터 페이지라 정당). `city+district` 조합 canonical(610–623행) 로직 유지.
- page2+ noindex(627–636행) 유지.

### 5-4. 빈 결과 회복
- 특정 시/도에서 결과 0건이면 "이 지역에는 등록된 {카테고리}가 없습니다" + `RegionChips`(다른 지역)로 회복 유도. 막다른 길 금지.

## 6. 부동산 목록 변경 (`pages/real-estate/[realEstateType]/index.vue`)

- `RealEstateSearchFilter`(셀렉트) 제거 → `<RegionChips :href-for="(slug) => `/real-estate/${realEstateType}/${slug}`" />`.
- 착지 = `/real-estate/{type}/{citySlug}`(이미 있는 라우트, 기존 "도시 허브" 링크 129–138행과 동일 타깃). 기존 "도시 허브" 링크와 중복되면 칩으로 일원화.
- **구현 시 확인**: `pages/real-estate/[realEstateType]/[city]/index.vue`가 SSR에서 city-필터 목록을 렌더하는지 검증(전용 라우트라 정상일 가능성 높음). 아니면 시설과 동일한 SSR 필터 수정 적용.
- `handleSearch/loadComplexes`의 셀렉트 연동 제거. 건물명 검색이 이 컴포넌트에 함께 있었다면 헤더 통합검색으로 위임(키워드 제거 원칙 D3과 일관).

## 7. SEO / URL 퍼널

```
/{category}  ──[시/도 칩]──▶  /{category}?city={slug}  ──[인기 구/군]──▶  /{city}/{district}/{category}
(목록)                       (시/도 레벨, SSR 필터)                      (지역×카테고리, 기존 SSR·색인)

/real-estate/{type}  ──[시/도 칩]──▶  /real-estate/{type}/{city}  ──▶  /real-estate/{type}/{city}/{district}
```
- 지역페이지는 **삭제·대체 없이 유지**되며 들어오는 내부링크가 늘어 색인에 유리.
- `?city=` 시/도×카테고리 페이지 **사이트맵 등재는 v1 범위 밖**(15카테고리 × 17시도 = 255+; 내부링크 우선, 등재는 노출 측정 후 후속 결정).

## 8. 에러 처리 / 엣지

- 유효하지 않은 city slug → fail-open(전국 렌더).
- SSR 캐시(nitro route cache): `?city=` 페이지는 URL이 다르므로 개별 캐시 엔트리 — 개인화 아님(정적 지역별 페이지) → 캐시 스큐 없음.
- jeonnamgwangju: 정적 소스에 이미 포함, 칩·URL 모두 자동 반영. 경기도 광주시(`gyeonggi/gwangju`)와 슬러그 혼동 없음(칩은 시/도 레벨만).

## 9. 테스트

- **RegionChips**(단위): `hrefFor` 주입대로 SSR `<a href>` 생성(시설 `/{cat}?city=seoul`, 부동산 `/real-estate/{type}/seoul`). 목록에 `jeonnamgwangju` 포함. `activeSlug` 강조.
- **시설 SSR 필터**(핵심): `/toilet?city=seoul` SSR HTML에 **서울-필터 항목만** 포함(전국 아님). `useAsyncData` fetch가 city 포함 body로 호출됨을 검증(mock). 유효하지 않은 slug → fail-open 전국.
- **canonical/robots**: `?city=seoul` self-canonical, page2+ noindex 유지.
- **회귀**: 셀렉트·키워드 제거 후 목록 렌더·페이지네이션 정상. "인기 지역" 링크 유지.
- **부동산**: 칩 href 정확, `/real-estate/{type}/{city}` SSR 필터 동작.
- 데드 컴포넌트 삭제 후 빌드/타입 통과.

## 10. 범위 밖 / 후속

- `/search`, 경매·청약 목록(RegionCascadingDropdown) — 변경 없음.
- `?city=` 페이지 사이트맵 등재 — 후속(노출 측정 후).
- IP 위치 추정 소프트 힌트 — 후속(선택).
- 정밀 "내 주변"(GPS 권한) — 별도 트랙(이번 개편과 분리).

## 11. 성공 기준

1. 시설·부동산 목록 상단에 **SSR·크롤 가능한 시/도 링크 칩** 노출(셀렉트·키워드 제거).
2. `/{category}?city={slug}`가 **SSR에서 필터된 목록**을 렌더(thin-dup 해소) — 라이브 SSR HTML로 검증.
3. 칩 → 시/도 페이지 → 구/군 지역페이지로 이어지는 내부링크 퍼널 형성(jeonnamgwangju 포함).
4. Node 20 · CI green · PR 경유 develop 머지.
