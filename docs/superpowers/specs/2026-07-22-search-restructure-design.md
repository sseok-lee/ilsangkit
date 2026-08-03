# 검색 재구성 설계 — 컨텍스추얼 스코프 + 부동산 전용 /search

**작성일**: 2026-07-22
**상태**: 설계(브레인스토밍) — 스펙 리뷰 대기
**범위**: 검색 모델만(A). 홈 레이아웃 재구성(B)은 별도(기존 `feat/home-realestate-market-redesign` 이니셔티브).

## 1. 목표

검색을 **부동산 우선(B) + 카테고리 컨텍스추얼(C)** 모델로 재편한다:
- **헤더 검색창**이 "지금 어디에 있느냐"에 따라 검색 대상을 바꾼다 — 시설 카테고리 안이면 그 시설, 그 외(홈·부동산·지역 등)면 부동산.
- **`/search`를 부동산 전용 검색 결과 페이지**로 전환(현재는 시설+부동산 통합).
- **시설 카테고리 안에 키워드 검색 진입로를 헤더로 복원**(직전 리팩터가 카테고리 페이지의 키워드 인풋을 제거해 현재 시설 키워드 검색 진입로가 없음).
- 부산물: 검색 로깅 편향 해소(현재 `/search`에서만 로깅).

## 2. 배경 — 현재 상태 (실측)

- **헤더 검색**: `components/common/HeaderSearch.vue`(desktop 인라인/mobile 오버레이), `AppHeader.vue`에서 전 페이지 마운트. 제출 → `navigateTo('/search?keyword=...')` — **파라미터는 keyword 하나, 스코프(카테고리/지역) 개념 없음**. 자동완성 `SearchAutocomplete.vue` + `useSearchSuggest` → `GET /api/search/suggest`. (홈 히어로 검색 `pages/index.vue`도 동일하게 `/search?keyword=`로 라우팅.)
- **`/search`**(`pages/search.vue`): `performSearch`가 **시설 `searchGrouped()` + 부동산 `searchRealEstate()`(=`useRealEstate.searchAll`) 병렬** 호출. 상단 전체/부동산/생활시설 3-탭. Hero 키워드 인풋 + 시/도·구/군 셀렉트. **`robots: noindex, follow` 확정·canonical 미출력**. `/search?category=X` → `/X` 301.
- **자동완성**(`/api/search/suggest`): 지역+카테고리+**건물명(부동산 단지명)** 3종 혼합. select 라우팅 = region→지역페이지, category→카테고리페이지, building→부동산 상세, 그 외→`/search?keyword=`. 인기검색어 `/api/search/popular`(searchLog 집계·정적 폴백).
- **부동산 텍스트 검색**: `GET /api/real-estate/search` → `realEstateService.searchAll(keyword,city,district)` — buildingName startsWith + 지역, 6타입(apt/villa/offitel×sale/rent). 별도 부동산 검색 UI 없음(유일 진입 = 헤더→/search, 또는 autocomplete building suggest→상세).
- **시설 카테고리 페이지**(`pages/[category]/index.vue`): **키워드 인풋 제거됨**(RegionChips로 교체, `?city=`만). 카테고리 내 키워드 검색 진입로 **없음**. 시설 검색 백엔드는 `POST /api/facilities/search`(grouped/single, keyword 지원).
- **SearchLog 로깅**: write는 `POST /api/search/log` 하나뿐, 호출처는 **`pages/search.vue` 한 곳**. → `/search` 검색만 로깅, **부동산 단독·시설 카테고리·autocomplete 선택은 미로깅**(로그 편향의 원인).

## 3. 잠긴 설계 결정

| # | 결정 | 값 |
|---|---|---|
| D1 | 방향 | 부동산 우선(B) + 카테고리 컨텍스추얼(C) |
| D2 | `/search` | **부동산 전용**(시설 병렬 호출·3-탭 제거) |
| D3 | 헤더 스코프 | 시설 카테고리 컨텍스트=그 카테고리 / 그 외=부동산(옵션 iii) |
| D4 | 시설 컨텍스추얼 결과 | **카테고리 페이지에서**(헤더 검색이 `/{category}?keyword=`로 → 그 카테고리 목록을 키워드로 검색). Task 2가 뺀 키워드검색을 헤더로 복원 |
| D5 | 자동완성 | 스코프 인지(부동산 컨텍스트=지역+단지명 / 시설 컨텍스트=그 카테고리+지역) |
| D6 | 로깅 | 편향 해소 — 부동산 검색·시설 카테고리 검색도 로깅(scope/category 기록) |
| D7 | 범위 | 검색만. 홈 레이아웃·auction 검색은 범위 밖 |

## 4. 검색 스코프 모델 (핵심)

`resolveSearchScope(route)` → `{ kind: 'facility', category } | { kind: 'realestate' }`:

| 현재 위치(컨텍스트) | 스코프 | 헤더 제출 목적지 | placeholder |
|---|---|---|---|
| 시설 카테고리 index `/[category]` | facility(그 카테고리) | `/{category}?keyword={q}`(+기존 `city` 유지) | "{카테고리명} 이름·지역 검색" |
| 시설 상세 `/[category]/[id]` | facility(그 카테고리) | `/{category}?keyword={q}` | 동일 |
| 지역 시설목록 `/[city]/[district]/[category]` | facility(그 카테고리) | `/{category}?keyword={q}&city={citySlug}` | 동일 |
| 홈 `/`, 가이드, `/article`, 지역 허브 `/[city]`·`/[city]/[district]` | realestate | `/search?keyword={q}` | "아파트·단지·지역 검색" |
| 부동산 `/real-estate/**`, `/search` | realestate | `/search?keyword={q}` | 동일 |
| 그 외/판별 불가 | realestate(기본) | `/search?keyword={q}` | 동일 |

- **`[category]`가 15개 시설 카테고리 중 하나일 때만** facility 스코프. `trash`는 카테고리 페이지에서 키워드 검색을 지원하는 범위 내에서 포함(현재 trash는 keyword로 동/지역 검색 지원 — 유지).
- 스코프 판별은 **순수 함수**(route path/params 입력)로 두어 테스트 가능하게 한다. `frontend/utils/searchScope.ts` 신설.

## 5. 컴포넌트별 변경

### 5-1. 헤더 검색 (`HeaderSearch.vue` + `AppHeader.vue`)
- 현재 라우트에서 `resolveSearchScope`로 스코프 계산(reactive). placeholder를 스코프에 맞게 표시.
- 제출 `submit()`: 스코프에 따라 목적지 분기(§4 표). facility 스코프면 `/{category}?keyword=`(+ 컨텍스트에 city가 있으면 `&city=`), realestate면 `/search?keyword=`.
- 홈 히어로 검색(`pages/index.vue` handleSearch)도 동일 규칙 사용(홈=realestate → `/search`, 기존 동작과 동일하므로 홈 UI 무변경).

### 5-2. `/search` 부동산 전용화 (`pages/search.vue`)
- `performSearch`에서 **시설 `searchGrouped()` 병렬 호출 제거** → 부동산 `searchAll()`만.
- 상단 3-탭(전체/부동산/생활시설) 제거 → 부동산 결과만(건물유형 apt/villa/offitel 서브 그룹은 유지 가능). 시설 섹션·partial-empty 시설 문구 제거.
- Hero 키워드 인풋·지역 셀렉트는 유지(부동산 검색 재조회용). `noindex, follow`·canonical 미출력 유지.
- `/search?category=X` → `/X` 301 유지(시설 카테고리성 진입은 카테고리 페이지로).
- 0건: 부동산 0건 회복 문구(지역/단지명 예시 유도). 시설 회복 로직 제거.

### 5-3. 시설 카테고리 페이지 키워드 검색 복원 (`pages/[category]/index.vue`)
- `route.query.keyword`를 읽어 SSR/재조회 fetch에 반영(`buildListFetch` 확장 또는 performSearch에 keyword 추가). RegionChips(`?city=`)와 **결합**(city + keyword 동시). 
- 결과 헤더에 "'{keyword}' 검색 결과 · {카테고리}" 표시 + 검색 해제(×) 링크(=`/{category}` 또는 `?city=`만).
- **인-페이지 키워드 인풋은 신설하지 않는다**(헤더가 담당, D4). 즉 이 페이지의 키워드 진입로 = 헤더 검색뿐.
- 0건: RegionChips + "다른 지역/이름" 회복.

### 5-4. 자동완성 스코프화 (`SearchAutocomplete.vue` + `useSearchSuggest` + `/api/search/suggest`)
- suggest 호출에 **scope 파라미터** 추가(`GET /api/search/suggest?q=&scope=realestate|facility:{category}`).
  - `realestate`: 지역 + 건물명(단지명) 추천(카테고리 추천 억제).
  - `facility:{category}`: 그 카테고리 시설명 + 지역 추천(부동산 단지명 억제).
- select 라우팅(§2)은 유지하되, facility 스코프에서 freeText 선택 시 `/{category}?keyword=`로.
- 백엔드 `searchSuggestService`에 scope 분기 추가(현 3종 혼합을 scope로 필터).

### 5-5. 백엔드
- **부동산 검색**: 기존 `GET /api/real-estate/search`(`searchAll`) 그대로 사용(신규 불필요).
- **suggest**: scope 파라미터 수용(§5-4).
- **로깅(D6)**: `POST /api/search/log` 확장 — `/search`(부동산) 검색 + 시설 카테고리 검색 양쪽에서 호출. SearchLog의 기존 `category`/`city`/`district`/`resultCount` 필드에 스코프·카테고리 기록. (부동산은 category=null 또는 `realestate` 태그 규약 하나로 통일 — 구현 시 확정.) → 이후 로그가 실제 검색 분포(시설 vs 부동산)를 편향 없이 반영.

## 6. SEO / robots

- `/search`: `noindex, follow` 유지(부동산 검색 결과도 색인 안 함).
- **시설 카테고리 페이지에 `?keyword=`가 있으면 `noindex`**(검색 결과 상태). `?city=`만 있는 경우는 기존대로(self-canonical, 색인 가능) 유지 — keyword 유무로 분기. page2+ noindex 기존 정책과 통일.
- autocomplete/ suggest는 SSR 무관(색인 영향 없음).

## 7. 에러 / 엣지

- 스코프 판별 실패 → 기본 realestate(fail-safe, §4).
- 시설 카테고리에서 keyword 0건 → 페이지 유지 + RegionChips 회복(막다른 길 금지).
- `/search` 부동산 0건 → 지역/단지명 유도 문구.
- IME/한글 입력: 기존 `SearchAutocomplete` native input 보정 로직 유지.

## 8. 범위 밖 / 후속

- **홈 레이아웃 재구성**(히어로 최소화·시설 슬림 스트립·RE 메인) — 별도, `feat/home-realestate-market-redesign`과 통합 검토.
- 공매(auction) 텍스트 검색, 지하철 검색 — 이번 범위 밖(스코프 판별에서 realestate 기본).
- `?city=&keyword=` 조합의 사이트맵/색인 정책 미세조정(기본 noindex라 안전).

## 9. 성공 기준

1. 헤더 검색이 컨텍스트에 따라 스코프·placeholder·목적지가 바뀐다(시설 카테고리=그 카테고리, 그 외=부동산). 순수 함수 `resolveSearchScope` 테스트 통과.
2. `/search`가 부동산 전용(시설 결과·3-탭 없음). `noindex` 유지.
3. 시설 카테고리 페이지에서 헤더로 키워드 검색 가능(`?keyword=`), RegionChips와 결합, keyword 시 noindex.
4. 자동완성이 스코프에 맞는 추천(부동산=지역+단지명 / 시설=그 카테고리+지역).
5. 부동산·시설 검색 양쪽 로깅 → 로그 편향 해소.
6. Node 20 · CI green · PR develop.

## 10. 테스트

- `resolveSearchScope`(단위): 각 라우트 → 올바른 스코프.
- 헤더 `submit` 목적지(단위/컴포넌트): 시설 카테고리→`/{category}?keyword=`, 그 외→`/search?keyword=`.
- `/search` 부동산 전용: 시설 호출 없음(searchGrouped 미호출), 부동산 결과만.
- 시설 카테고리 `?keyword=`: SSR fetch에 keyword 반영 + noindex. `?city=`만은 기존대로 색인.
- suggest scope: realestate→단지명 포함·카테고리 억제 / facility→그 카테고리·단지명 억제.
- 로깅: 부동산·시설 검색이 `/log` 호출.
