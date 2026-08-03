# 깔때기 내부링크 보강 설계 (Frontend Audit ⑤)

- **작성일:** 2026-06-03
- **출처:** audit ⑤ — "깔때기 중간 단절"
- **분할:** 2 PR — **PR1 = 지역 허브 카테고리 진입 링크**, **PR2 = 부동산 시 허브 단지 카드**
- **순서:** PR1 먼저.
- **검증:** 단위 테스트 + SSR curl + build/lint.

## 배경

- `pages/[city]/index.vue`(지역 허브, 예 `/seoul`)의 시설 네비게이션은 **구/군 그리드뿐** → 도시 단계에서 카테고리로 바로 갈 길이 없어 깔때기가 좁아짐. (현재 구조: 히어로 → 구/군 선택 → 생활 가이드 → 부동산 교차CTA → 데이터 출처)
- `pages/real-estate/[realEstateType]/[city]/index.vue`는 구/군 그리드만 → 단지까지 3~4홉.

## 확인된 사실

- `[category]/index.vue`는 `route.query.city`를 **슬러그**로 인식(`CITY_SLUG_MAP[query.city]` :478)하고 도시-aware 제목/설명을 생성("서울 약국"). canonical은 `setMeta({ path: '/${category}' })`(:486)로 **base(쿼리 없음)** → `/pharmacy?city=seoul`은 `/pharmacy`로 정리되어 쿼리 중복 색인 없음.
- `[city]` 라우트 파라미터 `city`는 슬러그(예 `seoul`).
- `[city]/index.vue`의 `cityData`엔 구별 `facilityTotal`만 있고 **카테고리별 카운트 없음**.

---

# PR1 — 지역 허브 카테고리 진입 링크

**대상:** `pages/[city]/index.vue` (+ 테스트)

## P1-1. 카테고리별 바로가기 섹션 추가
- `[city]/index.vue`에 "카테고리별 바로가기" 섹션 추가. `CATEGORY_GROUPS`(3그룹 시설 카테고리)를 아이콘+라벨 칩/카드 그리드로 렌더.
- 각 링크 타깃: `/${cat}?city=${city}` (`city` = 라우트 슬러그). 예: `/pharmacy?city=seoul`.
- 아이콘/라벨은 `CATEGORY_META[cat].icon`/`.label`(또는 shortLabel) 재사용. 사이트 톤 일관.
- 배치: 구/군 선택 섹션 다음, 생활 가이드 앞.
- 카운트는 표시하지 않음(데이터 없음) — 링크만.

## P1-2. 링크 타깃 정확성
- `[category]/index`가 슬러그를 기대하므로 `?city=`에는 **라우트 슬러그 그대로** 전달(한글명 아님).
- `trash`는 `CATEGORY_GROUPS`에 미포함 → 자동 제외(일관). (CATEGORY_GROUPS가 다루는 카테고리만 노출.)

## PR1 테스트
- `[city]/index` 마운트(cityData mock) → 카테고리 바로가기 섹션 렌더, 각 카테고리 링크가 `/{cat}?city={slug}` 형태로 존재(예: pharmacy 링크의 to가 `/pharmacy?city=seoul`).
- 기존 구/군 그리드·가이드·CTA 블록은 그대로(회귀 없음).

## PR1 커밋 분할
1. `feat(frontend): 지역 허브에 카테고리 진입 링크 섹션 추가`

## PR1 검증(SSR curl)
- `curl -s localhost:3000/seoul | grep -c 'href="/pharmacy?city=seoul"'` ≥1 등 카테고리 링크 SSR 포함.

---

# PR2 — 부동산 시 허브 단지 카드 (후속, 별도 plan)

**대상:** `pages/real-estate/[realEstateType]/[city]/index.vue`
- 시 허브에 "주요 단지" 섹션 — `getComplexList(type, city, undefined, ...)` 상위 N개를 `ComplexCard`로 SSR 렌더, 4-segment 단지 상세 직링크. (구/군 그리드 유지.)
- 별도 spec 보강 + plan에서 데이터 패칭/카드 상세 설계.

---

## 비범위

- 카테고리별 카운트 집계(신규 API), `/[city]/[category]` 신규 라우트.
- RegionCascadingDropdown, 목록/지역 지도+정렬, PageHero 타이포 통일.
