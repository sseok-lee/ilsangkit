# 깔때기 보강 Part 2 — 부동산 시 허브 주요 단지 카드 설계 (Frontend Audit ⑤)

- **작성일:** 2026-06-03
- **출처:** audit ⑤ 깔때기 (`docs/superpowers/specs/2026-06-03-funnel-internal-links-design.md` PR2)
- **분할:** 1 PR
- **검증:** 단위 테스트 + SSR curl + build/lint.

## 배경

`pages/real-estate/[realEstateType]/[city]/index.vue`(부동산 시 허브, 예 `/real-estate/apt-sale/seoul`)는 인트로 + 구/군 그리드뿐 → 단지까지 type→city→district→building 3~4홉 강제. 단지로 바로 가는 단축 동선 + 내부링크가 없음.

## 확인된 사실

- `useRealEstate().getComplexList(type, city?, district?, buildingName?, page=1, limit=15): Promise<ComplexListResponse>` — `/api/real-estate/${type}/complexes?city=...&...` 호출. city는 쿼리 파라미터.
- 시 허브 script: `realEstateTypeParam`(예 `apt-sale`, `isRealEstateUrlType` 검증됨), `citySlugParam`(예 `seoul`), `cityName = CITY_SLUG_MAP[citySlugParam]`(한글명), `[propertyTypePart, tabPart] = realEstateTypeParam.split('-')`(예 `apt`/`sale`).
- `ComplexCard` props: `complex: ComplexInfo`, `propertyType: RealEstatePropertyType`, `tab: TransactionMode`, `minTransactionCount?`(기본 0). 4-segment 단지 상세로 링크(시/구 있을 때), 시/구 없으면 미렌더(PR ④에서 추가된 가드).
- 현재 시 허브는 데이터 패칭 없는 정적 페이지(`districts`는 `REGIONS` 상수).

## 설계

**`pages/real-estate/[realEstateType]/[city]/index.vue`에 "주요 단지" 섹션 추가:**

1. **SSR 데이터 패칭:**
```ts
const { getComplexList } = useRealEstate()
const { data: topComplexes } = await useAsyncData(
  `re-city-complexes-${realEstateTypeParam}-${citySlugParam}`,
  () => getComplexList(realEstateTypeParam, cityName, undefined, undefined, 1, 6)
    .then(r => r.items)
    .catch(() => []),
  { default: () => [] },
)
```
   - city는 `cityName`(한글) 전달. 백엔드 지역 매칭은 서버에서 처리(서울/서울특별시 변형 포함). 구현 시 실제 응답 확인.
   - 상위 6개. 정렬은 getComplexList 기본순(보통 거래 많은 순).

2. **렌더:** `topComplexes`가 있으면 "주요 단지" SectionBlock에 `ComplexCard` 그리드:
```vue
<SectionBlock v-if="topComplexes.length > 0" heading="주요 단지" :subtext="`${cityName} ${typeLabel} 거래가 활발한 단지`">
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <ComplexCard
      v-for="c in topComplexes"
      :key="`${c.buildingName}-${c.bjdCode}`"
      :complex="c"
      :property-type="propertyTypePart"
      :tab="tabPart"
    />
  </div>
</SectionBlock>
```
   - `ComplexCard` import 추가.

3. **배치:** 인트로 → 구/군 그리드(SectionBlock) → **주요 단지(신규)** → 데이터 출처(DataSourceSection). 구/군 그리드는 1차 네비 유지, 주요 단지는 단축 동선.

4. **빈/에러:** 패칭 실패·단지 없음 → `topComplexes=[]` → 섹션 미렌더. 페이지 핵심(인트로·구/군)은 정상 SSR.

## 효과

type→city→단지 직행(홉 단축) + 시당 단지 내부링크 추가(색인/전환). 구/군 그리드와 상호보완.

## 테스트

- `useAsyncData`/`getComplexList` mock으로 `topComplexes`에 샘플 ComplexInfo 주입 → "주요 단지" 섹션 + `ComplexCard`(4-segment 링크) 렌더 단언. 빈 배열이면 섹션 미렌더 단언.
- 기존 인트로·구/군 그리드 회귀 없음.
- SSR curl: `/real-estate/apt-sale/seoul` HTML에 단지 링크(`/real-estate/apt-sale/seoul/<district>/<building>`) + "주요 단지" 포함(데이터 있을 때).

## 커밋 분할
1. `feat(frontend): 부동산 시 허브에 주요 단지 카드 섹션(SSR) 추가`

## 비범위

- 단지 정렬 옵션/정렬 UI, 페이지네이션(상위 6개 고정).
- `getComplexList` 자체 변경, 카운트/시세 표기 변경(ComplexCard 기존 유지).
