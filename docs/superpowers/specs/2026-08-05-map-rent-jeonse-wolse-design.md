# 지도 전월세 — 전세·월세 병기 설계

**작성일**: 2026-08-05
**선행 문서**: [2026-08-04-real-estate-map-fullscreen-layout-design.md](./2026-08-04-real-estate-map-fullscreen-layout-design.md) §11.2 (범위 축소본)

---

## 1. 문제

지도 건물 계층은 `RealEstateBuildingSummary` 를 읽는다. 이 테이블은 `@@unique([type, buildingName, bjdCode])` 라 **건물당 최신 거래 1건**만 들고 있다. 전세와 월세가 한 행으로 뭉개진다.

결과적으로 전월세 탭 목록에서 어떤 건물은 전세가, 어떤 건물은 월세가 나온다. 같은 열에 다른 종류의 값이 섞여 세로 비교가 되지 않고, 최신 거래가 무엇이었느냐라는 사용자와 무관한 사정이 표시 내용을 결정한다.

**운영 스냅샷 실측(서울 강남구, 2026년 아파트 전월세)**

| 항목 | 값 |
|---|---|
| 전세·월세를 **둘 다** 가진 건물 | 12,237 / 23,774 = **51%** |
| 2026년 전월세 거래 | 월세 100,071 / 전세 95,024 |

절반의 건물이 둘 중 하나를 갖고 있는데도 지도에서는 하나만 보인다. 나머지 하나를 볼 방법이 지도에 없다.

구체적 사례 — 서울 신동아(bjdCode 11500): 최신 거래가 월세라 `보 3억/월 95만` 만 표시된다. 같은 건물의 전세 4억 5,000만은 지도 어디에도 없다.

---

## 2. 범위

### 포함

- 전월세 요약 행이 전세·월세 최신값을 **각각** 보관
- 목록에서 두 값을 두 줄로 병기, 없으면 "거래 없음"
- 마커 클릭 시 펼침 — 전월세는 두 값, 매매·전월세 공통으로 상세 보기 링크

### 제외 (명시적 결정)

- **탭 6종 유지.** 3종(아파트/오피스텔/빌라)으로 합치지 않는다. 합치면 `apt-rent`·`villa-rent`·`offitel-rent` 허브로 가는 내부 링크가 사이트 전체에서 사라진다(`MapFilterBar.vue:6` 주석 참조 — 하단 유형 카드 제거 후 이 칩이 유일한 경로다). 지역 버블의 기준(매매 평당가냐 전세 평당가냐)도 새로 정해야 한다. 둘 다 이번 범위 밖이다.
- **매매·전월세 행 병합 안 함.** 요약 grain 을 `(buildingName, bjdCode)` 로 바꾸면 사이트맵이 무너진다 — `sitemapService.ts:185` 가 **한 행 = 한 URL** 로 356,461개 URL 을 만들고 `type` 이 URL 세그먼트다. count-drop 가드(threshold 0.2)에도 걸린다.
- **거래 일자 미표시.** 사용자 결정. 새 컬럼에 `dealKey` 를 넣어 두어 나중에 표시하거나 "최근 N개월 이내만 채움" 정책으로 바꿀 수 있게만 한다.
- 지역 계층(시도/시군구/동) 집계는 무변경. 전세만 집계하는 현행 유지.

---

## 3. 데이터 모델

`RealEstateBuildingSummary` 에 nullable 컬럼 5개 추가. **기존 컬럼은 손대지 않는다.**

```prisma
/// 최신 전세 보증금(만원). 매매 타입과 전세 거래 없는 건물은 NULL.
jeonseDeposit    Int?
/// 위 거래일 YYYYMMDD. 현재 화면에 표시하지 않으나, 표시 전환·신선도 정책의 여지를 남긴다.
jeonseDealKey    Int?
/// 최신 월세 보증금(만원). 매매 타입과 월세 거래 없는 건물은 NULL.
wolseDeposit     Int?
/// 위 거래의 월세액(만원).
wolseMonthlyRent Int?
/// 위 거래일 YYYYMMDD.
wolseDealKey     Int?
```

`latestPrice` · `monthlyRent` · `latestDeal*` 를 유지하는 이유: 사이트맵 lastmod, 인근 단지(`realEstateService.ts:1011`), 건물 목록(`:463`), 검색 자동완성(`searchSuggestService.ts:73`) 이 전부 이 컬럼들을 읽는다. 새 컬럼은 지도만 읽는다.

인덱스 추가 없음 — 새 컬럼은 조회 조건이 아니라 표시값이다.

---

## 4. 동기화 (`refreshSummary`)

### 결정: 기존 INSERT 를 건드리지 않고 UPDATE 패스를 뒤에 붙인다

`refreshSummary` 는 2026-04-18 에 단일 INSERT 가 버퍼풀을 10분 점유해 사이트를 무한로딩시킨 이력이 있는 함수다. 지금은 시·도 단위 DELETE+INSERT 로 쪼개고 배치마다 `innodb_lock_wait_timeout=15` + 5분 타임아웃을 건다.

두 방식을 로컬 운영 스냅샷(경기 apt-rent 67,477행)에서 실측했다.

| 방식 | 시간 | 결과 |
|---|---|---|
| 현행 INSERT | 3.13s | 6,218건 |
| 새 컬럼을 같은 쿼리에 통합 | **8.87s (2.8배)** | 6,218건 |
| 별도 경량 집계 | **0.58s** | 6,218건 |

통합안이 비싼 이유는 `SELECT *` 를 윈도우 두 겹에 통과시켜 넓은 행 집합을 두 번 실체화하기 때문이다. 별도 집계는 6개 좁은 컬럼만 윈도우 한 번 통과한다.

따라서 **city 배치마다 INSERT(무변경) 직후 UPDATE 를 하나 더 실행**한다. 배치당 증가분은 2.8배가 아니라 약 18% 다. 문장이 짧게 둘로 나뉘어 락 점유 시간도 통합안보다 짧다.

매매 타입은 이 패스를 **건너뛴다** (`SALE_TYPES`).

### 검증된 쿼리 형태

`rentType` 별 최신 1건을 뽑아 건물 단위로 접는다.

```sql
SELECT buildingName, bjdCode,
  MAX(CASE WHEN rentType='전세' THEN deposit END)      AS jDeposit,
  MAX(CASE WHEN rentType='전세' THEN dealKey END)      AS jDealKey,
  MAX(CASE WHEN rentType='월세' THEN deposit END)      AS wDeposit,
  MAX(CASE WHEN rentType='월세' THEN monthlyRent END)  AS wMonthly,
  MAX(CASE WHEN rentType='월세' THEN dealKey END)      AS wDealKey
FROM (
  SELECT buildingName, bjdCode, rentType, deposit, monthlyRent,
    dealYear*10000 + dealMonth*100 + COALESCE(dealDay,1) AS dealKey,
    ROW_NUMBER() OVER (
      PARTITION BY buildingName, bjdCode, rentType
      ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC
    ) AS rn
  FROM {table} WHERE city = ?
) a
WHERE rn = 1
GROUP BY buildingName, bjdCode
```

`rn=1` 로 종류별 최신을 고른 뒤 `MAX(CASE ...)` 로 한 행에 접는다. `MAX` 는 그룹당 후보가 1개뿐이라 실제 비교가 아니라 접기 용도다.

로컬 검증 결과(서울 apt-rent) — 신동아 11500: `latestPrice=30000, monthlyRent=95`(월세가 최신)인데 `jDeposit=45000` 이 별도로 잡힌다. 11380: `jDeposit=NULL`(전세 거래 없음).

### 남은 위험

로컬 스냅샷의 거래 테이블은 **운영의 부분 복사**다(AptRent 195,095행 vs 운영 3.1M, 약 6%). 위 절대 시간은 운영에 외삽되지 않는다. **비율(18%)만 유효하다.**

완화: 가장 작은 타입(`offitel-rent`, 요약 16,245행)부터 운영에 올려 배치 시간을 관측한 뒤 나머지로 확대한다.

---

## 5. API

`realEstateMapService.fetchBuildings` 의 SELECT 에 컬럼 5개 추가. `WHERE`·`ORDER BY`·`FORCE INDEX` 는 무변경이다.

`MapBuildingItem` 에 동일 필드 추가. 매매 타입에서는 전부 `null`.

---

## 6. 프론트엔드

### 6.1 목록 (`MapSidebar`)

건물 행의 우측 가격이 한 줄에서 두 줄이 된다.

```
래미안포레            전세 11억
자곡동                월세 9억 · 100만
```

- 전세 줄이 위, `text-primary` 강조
- 월세 줄이 아래, `text-slate-700` 보조 — 보증금·월세액을 가운뎃점으로 가른다
- 해당 종류 거래가 없으면 `거래 없음` (`text-slate-400`)
- 매매 탭은 지금 그대로 한 줄

모바일 바텀시트에서 행 높이가 약 11px 늘어 한 화면 노출이 6곳 → 5곳 수준이 된다. 수용한다.

### 6.2 마커 라벨 (`useMapOverlays`)

**한 줄 유지.** 목록처럼 두 줄을 넣으면 라벨 폭이 두 배 가까이 되고, 충돌 판정이 `text.length` 로 상자를 잡으므로(`useMapOverlays.ts:134`) 점으로 접히는 마커가 늘어난다. 지도의 마커는 훑어보는 용도다.

**라벨 내용은 현행 유지 — `formatPriceLabel` (최근 거래 기준).** 초안은 "전세만"이었다. 전세가가 건물 간 비교되는 단일 숫자라 훑기에 적합하다는 이유였는데, 전세 거래가 없는 건물(월세 전용)을 어떻게 그릴지가 남는다. 대체안 두 가지(월세액으로 대체 / 점으로 표시)를 놓고 **2026-08-05 사용자 결정: 현행 유지**.

따라서 마커에는 전세·월세가 섞인 채로 남는다 — 이 설계가 해소하는 것은 **목록과 펼침 카드**이고, 마커는 범위 밖이다. 사용자가 정확한 값을 보려면 마커를 눌러 펼치거나 좌측 목록을 본다.

### 6.3 마커 클릭 — 펼침

**현재 건물 마커 클릭은 사실상 아무 일도 하지 않는다.** `onSelect` 는 지역 단계일 때만 `setLevel` 로 파고들고 `granularity === 'building'` 분기가 없다(`RealEstateMapExplorer.vue:228`). 지도가 그 건물로 가운데 정렬되는 게 전부다.

여기에 펼침을 붙인다.

```
┌──────────────────────┐
│ 은마                  │
│ 전세 9억 6,000만       │
│ 월세 7억 5,000만 · 340만│
│ ──────────────────── │
│ 상세 보기 →           │
└──────────────────────┘
```

- 다시 누르면 접힌다. 다른 마커를 누르면 이전 것이 접힌다.
- **매매 탭도 동일하게 반응**한다. 값은 한 줄이고 상세 보기만 붙는다. 두 탭의 클릭 동작이 같아진다.
- 상세 링크는 `toRealEstateUrl` (`utils/realEstateUrl.ts:71`)로 만든다. 슬러그 변환·NFC 정규화·인코딩이 전부 그 안에 있으므로 문자열을 직접 조립하지 않는다. 이를 위해 `useMapOverlays` 가 현재 받지 않는 `type` 을 받아야 한다.
- 선택된 항목을 렌더 순서 **맨 앞**에 놓는다. 충돌 로직이 `items` 순서를 우선순위로 쓰므로(`useMapOverlays.ts:122`) 사용자가 방금 지목한 라벨은 접히지 않는다.

**SEO 가치 없음을 명시한다.** 오버레이 렌더러는 `import.meta.server` 에서 즉시 반환하는 클라이언트 전용이다(`useMapOverlays.ts:102`). 이 링크는 SSR HTML 에 없어 크롤러에게 보이지 않는다. 순수한 사용자 동선 개선이고, 내부 링크 역할은 사이드바 행이 계속 담당한다.

---

## 7. 영향 없음을 확인한 것

| 소비처 | 근거 |
|---|---|
| 사이트맵 URL 356,461개 | 행 수·`type` 무변경 |
| 사이트맵 허브 1,463개 | 동일 |
| 검색 자동완성 | `reType` 그대로 |
| 인근 단지 | `latestPrice`·`monthlyRent` 무변경 |
| 건물 목록 페이지 | 동일 |
| 지도 bbox 인덱스 | `WHERE type = ?` 유지 → `FORCE INDEX` 그대로 유효 |
| 지역 버블 | 집계 경로 무변경 |

---

## 8. 테스트

- `refreshSummary` — 전세만/월세만/둘 다/둘 다 없음 4가지, 매매 타입은 5개 컬럼이 NULL
- `fetchBuildings` — 새 컬럼이 응답에 실리는지, 매매에서 null 인지
- `MapSidebar` — 두 줄 렌더, "거래 없음", 매매 한 줄
- `useMapOverlays` — 라벨 한 줄 유지, 선택 시 펼침, 상세 href 정확성, 선택 항목이 접히지 않음
- `RealEstateMapExplorer` — 토글, 다른 마커 선택 시 이전 것 접힘

---

## 9. 미해결 (이번 범위 밖)

- 탭 3종 축소 — 전월세 허브 3개의 대체 내부 링크 설계가 선행되어야 한다
- 매매·전월세 한 줄 병합 — 사이트맵 URL 구조 재설계가 선행되어야 한다
- 거래 일자 표시 / 신선도 정책 — 컬럼만 준비
- `hoveredKey` 하이라이트 연결 — 이번에 도입하는 `selectedKey` 배관을 재사용할 수 있으나 별건
