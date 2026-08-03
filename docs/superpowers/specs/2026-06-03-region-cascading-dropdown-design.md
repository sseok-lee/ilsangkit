# 지역 필터 통일 — RegionCascadingDropdown 설계 (Frontend Audit ⑤)

- **작성일:** 2026-06-03
- **출처:** `docs/superpowers/specs/2026-06-02-frontend-improvement-audit.md` ⑤ "지역 필터 3종"
- **분할:** 1 PR
- **검증:** 단위 테스트 + lint + build.

## 배경

청약(`SubscriptionListView`)·공공임대(`PublicRentalListView`) 목록은 시/도 `<select>`(하드코딩 17개) + **자유텍스트 "지역 (상세)" `<input>`**으로 지역을 거른다. 자유텍스트는 오타·표기 불일치로 매칭 실패 위험이 크다. subway는 이미 cascading 구/군 드롭다운(`useRegions` 기반)을 쓴다. 두 목록을 cascading으로 통일한다.

## 확인된 사실 (코드 재확인 완료)

- 백엔드 청약 필터: `subscriptionService.ts:86` `where.regionName = { contains: region }`. `regionName`은 `"서울 강남구"`(축약 시/도 + 구/군) 형태(`getRentalPriceStats` 주석 `:231` 확인). 공공임대도 동일 패턴.
- `frontend/shared/regionSlugs.ts`: `CITY_SLUGS = { 서울: 'seoul', 경기: 'gyeonggi', ... }`(축약명→slug). `CITY_SLUG_MAP`(slug→축약명, 예 `seoul`→`"서울"`)는 그 역.
- `useRegions()`: `citiesWithDistricts`(computed `{ slug, name(축약명), districts: { name }[] }[]`), `getDistrictsByCity(citySlug)`(구/군 `{ name }[]`), `loadRegions()`(useState 캐시).
- 따라서 `축약 시/도명 + 구/군명` = `"서울 강남구"` → 백엔드 `contains` 정확 매칭. **백엔드 변경 불필요.**
- `SubscriptionListView.vue`: `selectedRegion`(축약 시/도) + `regionDetail`(자유텍스트). 전송 `region = [selectedRegion, regionDetail].filter(Boolean).join(' ')`(`:176`). `watch([currentStatus, selectedRegion, regionDetail])`로 재조회(`:154`).
- `PublicRentalListView.vue`: `currentCity` + `districtDetail`(자유텍스트, 300ms 디바운스 `:154-162`). 동일 조립 패턴.
- subway/`[category]`도 cascading이나 본 PR 범위 외(이미 동작).

## 설계

### 신규 컴포넌트: `components/common/RegionCascadingDropdown.vue`

**역할:** 시/도→구/군 cascading 2-select. 한 곳에서 useRegions를 로드·캐시하고 cascading·리셋 로직을 캡슐화.

**인터페이스 (두 v-model):**
```ts
defineProps<{ city: string; district: string }>()       // city=축약명(""=전국), district=구/군명(""=전체)
defineEmits<{ 'update:city': [string]; 'update:district': [string] }>()
```

**내부 동작:**
- `const { loadRegions, citiesWithDistricts, getDistrictsByCity } = useRegions()`.
- regions 로드: `await useAsyncData('region-cascading-regions', () => loadRegions())`(useState 캐시라 다중 인스턴스/페이지 공유 안전).
- 시/도 옵션: `citiesWithDistricts`의 `{ slug, name }`. `<option :value>`는 **축약명(name)**.
- 선택된 축약 시/도명 → slug 변환: `citiesWithDistricts.find(c => c.name === props.city)?.slug`. 그 slug로 `getDistrictsByCity(slug)` → 구/군 옵션(name).
- 구/군 `<select>`는 `:disabled="!city"`. 시/도 변경 시 `update:district` `''` 방출(구/군 리셋).
- 빈 옵션: 시/도 `<option value="">전국</option>`, 구/군 `<option value="">전체</option>`. 구/군은 선택사항.

**스타일:** 기존 필터 select와 동일 — 컨테이너 `relative`, `<select class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">`, 우측 `<span class="material-symbols-outlined ... ">expand_more</span>`. 라벨 "지역", "구/군". 레이아웃 래퍼는 소비처가 제공(컴포넌트는 두 select만 렌더, `grid` 등은 호출부).

### 소비처 변경

**`SubscriptionListView.vue`**
- 템플릿: 기존 시/도 `<select>` + "지역 (상세)" `<input>` 블록을 `<RegionCascadingDropdown v-model:city="selectedRegion" v-model:district="selectedDistrict" />`로 교체.
- script: `regionDetail` ref → `selectedDistrict` ref로 교체. region 조립을 `[selectedRegion.value, selectedDistrict.value].filter(Boolean).join(' ') || undefined`로 유지. `watch` 의존성 `regionDetail`→`selectedDistrict`. 디바운스 불필요(select는 즉시) — 자유텍스트 디바운스 제거.

**`PublicRentalListView.vue`**
- 동일: `districtDetail`(자유텍스트) → `selectedDistrict`(드롭다운), 디바운스 `watch(districtDetail, …)` 제거. region/필터 조립 동일 형식 유지. 시/도 select도 컴포넌트로 흡수.

## 테스트

- **`tests/components/common/RegionCascadingDropdown.test.ts`**(신규): useRegions를 mock(또는 setup.ts 패턴)해 ⓐ 시/도 옵션 렌더 ⓑ 시/도 미선택 시 구/군 `disabled` ⓒ 시/도 선택 시 해당 구/군 옵션 채워짐 ⓓ 시/도 변경 시 `update:district` `''` emit ⓔ 시/도/구/군 선택 시 `update:city`/`update:district` emit.
- **소비처 회귀:** 기존 `SubscriptionListView`/`PublicRentalListView` 테스트가 region 파라미터를 단언하면 갱신. region 조립 형식(`"서울 강남구"`)이 동일하게 유지되는지 확인.
- 전체 `npm run test` green, lint 0 error, build exit 0.

## 효과

오타·매칭 실패 제거(드롭다운만 선택 가능), 세 목록의 지역 필터 UX 일관화, cascading 로직 단일 컴포넌트로 캡슐화(중복 감소).

## 비범위

- subway/`[category]` 마이그레이션(이미 cascading, 동작 중 — 회귀 위험 회피).
- 백엔드 region 필터/스키마 변경.
- 시/도만 선택 시 동작은 기존과 동일(구/군 선택사항).

## 커밋 분할 (단일 PR)
1. `feat(frontend): RegionCascadingDropdown 공유 컴포넌트 + 테스트`
2. `refactor(frontend): 청약·공공임대 목록 지역 자유텍스트 → cascading 드롭다운`
