# 부동산 지도 — 동(洞) 단계 추가 설계

**작성일**: 2026-08-04
**대상**: `/real-estate` 지도 탐색기
**선행 문서**: [2026-08-04-real-estate-map-fullscreen-layout-design.md](./2026-08-04-real-estate-map-fullscreen-layout-design.md) §11.1
**브랜치**: 신규 (base = `develop`, PR #712 머지 이후)

---

## 1. 배경

지도를 확대하면 시/도 → 구·군 → 건물 순으로 단위가 바뀐다. 구·군에서 건물로 한 번에 떨어지는 구간이 커서, 수도권처럼 건물이 조밀한 곳은 구·군 평균 하나만 보다가 갑자기 개별 단지 200개를 만난다. 그 사이에 동 단위를 넣어 "이 구 안에서 어느 동이 비싼가"를 볼 수 있게 한다.

## 2. 목표

- 줌 단계를 **시/도 → 구·군 → 동 → 건물** 4계층으로 늘린다.
- 동 단위 평균 평당가를 지도 버블과 좌측 목록에 표시한다.
- 기존 3계층의 동작·성능·크롤 경로를 그대로 유지한다.

## 3. 비목표

- **동 상세 페이지를 만들지 않는다.** 6개 유형에 동 라우트가 없고, 신설하면 2,877 × 6 ≈ 17,000개 URL 이 늘어 thin content 위험이 크다. 동 행은 링크가 아니라 지도를 확대하는 동작이다. (동 페이지가 있는 건 `land` 뿐 — `pages/real-estate/land/[city]/[district]/[dong].vue`)
- 건물 요약(`RealEstateBuildingSummary`) 변경. 이 설계는 지역 집계(거래 테이블 GROUP BY) 계층만 건드린다. 매매·전세·월세 병기(선행 문서 §11.2)는 요약 계층이라 별개다.
- 필터 축 변경. 6종 유지 — 필터바의 6개 `href` 가 `apt-rent`·`villa-rent`·`offitel-rent` 의 유일한 내부 링크다.

## 4. 실측 근거

2026-08-04, 운영 스냅샷을 로컬에 복사해 측정(아파트, 최근 3개월):

| | 값 |
|---|---|
| 동 수 | **2,877** |
| 구·군 수 | 251 |
| 거래 중 좌표 보유 비율 | **99.9%** |
| 구·군 집계 소요 | 0.20s |
| 동 집계 소요 | 0.37s |

동은 구·군의 11배지만 스캔 행 수는 같고 GROUP BY 그룹만 늘어 비용은 1.8배에 그친다. 좌표 보유율이 99.9% 라 동 중심을 거래 좌표 평균으로 잡아도 안정적이다.

## 5. 줌 레벨 배분

카카오맵 level 은 숫자가 클수록 축소된다(1=20m, 14=전국).

| 단위 | 현재 | **변경** | 대략 축척 |
|---|---|---|---|
| 시/도 | ≥ 11 | ≥ 11 | 16km~ |
| 구·군 | 8–10 | **9–10** | 2~4km |
| 동 | — | **7–8** | 0.5~1km |
| 건물 | ≤ 7 | **≤ 6** | ~250m |

`backend/src/schemas/realEstateMap.ts` 의 상수를 이렇게 둔다.

```
CITY_MIN_LEVEL = 11
DISTRICT_MIN_LEVEL = 9
DONG_MIN_LEVEL = 7
```

### 5.1 히스테리시스

경계에서 미세하게 줌하면 단위가 왕복하며 목록과 마커가 깜빡인다. 현재 코드는 "이미 어떤 단위에 있으면 경계를 한 칸 더 넘어야 전환"으로 막고 있고, 경계가 2개에서 **3개로 늘어난다.**

확대 방향(level 감소)에서 이전 단위를 한 칸 더 유지:
- `city` 인데 base 가 `district` 이고 level === 10 → `city`
- `district` 인데 base 가 `dong` 이고 level === 8 → `district`
- `dong` 인데 base 가 `building` 이고 level === 6 → `dong`

축소 방향(level 증가)도 대칭으로:
- `district` → `city` 는 level === 11 에서 `district` 유지
- `dong` → `district` 는 level === 9 에서 `dong` 유지
- `building` → `dong` 은 level === 7 에서 `building` 유지

### 5.1.1 한 칸씩 줌했을 때의 실제 전이 — 사각지대 없음 확인

경계가 3개로 늘면 밴드가 좁아져(구·군은 9–10 두 칸뿐) 어떤 단위가 건너뛰어지지 않는지 확인해야 한다. 위 규칙으로 추적한 결과다.

**확대(level 감소):**

| level | 12 | 11 | 10 | 9 | 8 | 7 | 6 | 5 |
|---|---|---|---|---|---|---|---|---|
| 단위 | city | city | city* | **district** | district* | **dong** | dong* | **building** |

**축소(level 증가):**

| level | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|
| 단위 | building | building | building* | **dong** | dong* | **district** | district* | **city** |

`*` 는 히스테리시스가 이전 단위를 유지시킨 칸이다. 각 단위가 양방향 모두 정확히 2칸을 차지하고 건너뛰는 단위가 없다. 상수를 바꿀 때 이 표를 다시 그려 확인한다.

### 5.2 드릴 목표 레벨 — 되돌림 밴드를 피한다

목록 행을 클릭할 때 설정할 레벨이다. 경계값을 그대로 쓰면 히스테리시스가 이전 단위로 되돌려 **클릭해도 아무 일이 없는 것처럼 보인다.**

| 클릭한 행 | 설정할 level | 피해야 할 값 |
|---|---|---|
| 시/도 | **9** | 10 (city 로 되돌림) |
| 구·군 | **7** | 8 (district 로 되돌림) |
| 동 | **5** | 6 (dong 으로 되돌림) |

`RealEstateMapExplorer.onSelect` 의 현재 매핑(city→9, district→6)을 city→9, district→7, dong→5 로 바꾼다.

## 6. 백엔드

### 6.1 `RegionLevel` 확장

`src/services/realEstateMapService.ts` 의 `type RegionLevel = 'city' | 'district'` 에 `'dong'` 을 더한다. `Granularity`(`schemas/realEstateMap.ts`)도 동일하게 `'dong'` 을 포함한다.

### 6.2 좌표 출처가 다르다

city/district 는 `Region` 테이블(구·군 267행)을 JOIN 해 좌표를 얻는다. **`Region` 에는 동이 없다**(`@@unique([city, district])`). 동은 거래 좌표의 평균을 쓴다.

```sql
SELECT t.city AS name, t.district AS district, t.dongName AS dong,
       AVG(t.lat) AS lat, AVG(t.lng) AS lng,
       ROUND(AVG(t.dealAmount / (t.exclusiveArea / 3.3058))) AS avgPricePerPyeong,
       COUNT(*) AS transactionCount
FROM AptSaleTransaction t
WHERE t.exclusiveArea > 0 AND t.lat IS NOT NULL AND t.lng IS NOT NULL
      AND <sargable 날짜 조건>
GROUP BY t.city, t.district, t.dongName
```

`lat IS NOT NULL` 조건이 필요하다 — 좌표 없는 거래(0.1%)가 평균에 NULL 을 섞지 않게 한다. 전월세는 기존과 동일하게 `deposit` + `monthlyRent = 0`(전세만) 규칙을 따른다.

**날짜 조건은 `recentMonthsCondition()` 을 그대로 쓴다.** 문자열 조립으로 `STR_TO_DATE` 를 만들면 인덱스를 못 타 33초가 걸린 이력이 있다.

### 6.3 `MapRegionItem` 에 `dong` 추가

현재 `{ name, district, lat, lng, avgPricePerPyeong, transactionCount }` 에 `dong: string | null` 을 더한다. city/district 레벨에서는 `null`.

`lat`/`lng` 는 이미 `number | null` 이다(선행 작업에서 폴백 좌표 사고로 변경). 그 규약을 유지한다.

### 6.4 캐시

캐시 키는 `${type}:${level}` 그대로다. 레벨이 3종이 되어 조합이 12개에서 **18개**로 는다. 여전히 상한이 있는 수다.

**bbox 를 캐시 키에 넣지 않는다.** 전국 1벌을 캐시하고 반환 직전에 `filterRegionsByBounds` 로 자르는 현재 구조를 그대로 쓴다. 동은 2,877개라 인메모리 필터 비용이 무시할 수준이고, bbox 를 키에 넣으면 뷰포트가 무한이라 캐시가 폭발한다.

### 6.5 라우트

`GET /:type/map` 의 지역 분기는 이미 `fetchRegions(type, granularity, bounds)` 를 호출한다. `granularity` 가 `'dong'` 일 때도 같은 경로를 타므로 라우트 변경은 없다. `total` 은 필터 후 개수 — 현재 동작 유지.

## 7. 프론트엔드

### 7.1 타입

`types/realEstateMap.ts` 의 `Granularity` 에 `'dong'` 추가, `MapRegionItem` 에 `dong: string | null` 추가.

### 7.2 목록 렌더 (`MapSidebar`)

`rows` computed 에 `dong` 분기를 더한다.

| 단위 | title | subtitle | 클릭 |
|---|---|---|---|
| city | 시/도명 | — | 링크(`/real-estate/{type}/{citySlug}`) + 드릴 |
| district | 구·군명 | 시/도명 | 링크(`/real-estate/{type}/{city}/{district}`) + 드릴 |
| **dong** | **동명** | **시/도 구·군** | **드릴만(링크 없음)** |
| building | 건물명 | 주소 | 링크(상세 페이지) |

동 행은 `<a href>` 가 아니라 `<button>` 이다. 갈 페이지가 없으므로 href 를 만들면 죽은 링크가 된다. 접근성상 클릭 가능한 비링크 요소는 `<button type="button">` 이 맞다.

헤딩 문구도 분기한다 — 현재 `granularity === 'building' ? '이 지역 건물' : '지역별 평균 평당가'`. 동 단계는 `'동별 평균 평당가'`.

### 7.3 페이지네이션

현재 `visibleRows` 는 `granularity !== 'city'` 일 때 20개씩 자른다. 동도 이 규칙에 자연히 포함된다 — bbox 필터로 화면 안 동만 오지만 수도권에서는 20개를 넘길 수 있다.

`city` 만 예외인 이유는 그대로다: `SIDO_CHIPS` 16개 링크는 이 페이지의 핵심 SSR 콘텐츠라 전부 HTML 에 있어야 한다.

## 8. 크롤 경로 영향

**없다.** SSR 은 항상 시/도 모드(level 13, 전국 bbox)로 렌더되므로 동 단계는 사용자가 줌인한 뒤의 클라이언트 상호작용이다. 필터바 6개 `href` 와 `SIDO_CHIPS` 16개 링크는 그대로다.

## 9. 테스트

### 9.1 백엔드

| 검증 | 되돌리면 실패할 것 |
|---|---|
| `resolveGranularity` 4단계 경계 | 상수를 되돌리면 실패 |
| 히스테리시스 3경계 양방향 | 각 특례를 지우면 실패 |
| 동 집계가 `dongName` 으로 GROUP BY | GROUP BY 를 구·군으로 되돌리면 실패 |
| 동 좌표가 거래 평균(Region JOIN 아님) | JOIN 으로 바꾸면 실패(Region 에 동이 없어 0행) |
| `lat IS NOT NULL` 필터 | 빼면 좌표 NULL 인 동이 섞여 실패 |
| 캐시 키가 `(type, level)` — 다른 bbox 가 재조회 안 함 | bbox 를 키에 넣으면 호출 수 증가로 실패 |
| 날짜 조건이 sargable | `STR_TO_DATE` 로 바꾸면 실패 |

### 9.2 프론트엔드

| 검증 | 되돌리면 실패할 것 |
|---|---|
| 동 행이 `<button>` 이고 `href` 가 없다 | `<a href>` 로 바꾸면 실패 |
| 동 행 클릭 시 level 5 | 6 으로 바꾸면 실패(되돌림 밴드) |
| 구·군 행 클릭 시 level 7 | 8 로 바꾸면 실패 |
| 동 모드 헤딩이 `동별 평균 평당가` | 분기를 지우면 실패 |
| 동 모드도 20개씩 자른다 | `granularity !== 'city'` 를 되돌리면 실패 |
| 시/도 16개는 여전히 안 잘린다 | city 를 예외에서 빼면 실패 |

### 9.3 라이브 검증

단위 테스트로 닿지 않는 것들이다. **운영 스냅샷이 로컬에 있어야 의미가 있다** — 데이터가 비면 목록이 비어 아무것도 드러나지 않는다.

1. 시/도 → 구·군 → 동 → 건물 4단계가 실제로 이어지는지, 각 단계에서 지도가 그 지역으로 이동하는지
2. 각 경계에서 미세 줌(휠 한 칸)을 왕복해도 단위가 깜빡이지 않는지 — 히스테리시스 실동작
3. 동 버블이 지도에 겹치지 않고 읽히는지(겹침 회피는 `useMapOverlays` 가 이미 처리)
4. 동 행 클릭이 페이지를 이탈하지 않는지
5. 수도권에서 동이 20개를 넘을 때 더보기가 뜨는지

## 10. 열린 사항

- **레벨 경계는 조정 가능하다.** 9–10 / 7–8 / ≤6 은 축척과 행정구역 크기로 정한 초안이다. 라이브에서 줌해보고 동 버블이 너무 일찍(또는 늦게) 뜨면 상수만 바꾸면 된다 — 히스테리시스 특례가 상수를 참조하도록 짜면 한 곳만 고치면 된다.
- **전월세 동 집계는 전세만 본다.** 기존 구·군과 동일한 규칙(`monthlyRent = 0`). 월세 보증금과 전세 보증금은 규모가 달라 섞으면 평균이 무의미해진다.
