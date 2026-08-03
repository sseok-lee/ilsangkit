# 부동산 핫스팟 디스커버리 — 메인페이지 시장 카드 재설계

- **상태**: Draft (사용자 리뷰 대기)
- **작성일**: 2026-05-20
- **대상 컴포넌트**: `frontend/components/home/HomeMarketStats.vue` (교체) → `HomeHotspotSignals.vue` (신규)
- **백엔드**: `backend/src/services/metaService.ts` 의 `getRealEstateTrends()` 확장
- **관련 메모리**: [SEO 트래픽 분석 2026-03], [부동산 URL 리팩터 완료 2026-05-03]

## 1. 배경

현재 메인페이지의 "오늘의 부동산 시장" 섹션은 **전국 평균 평당가**를 자산 3종 × 거래 3종 = 9 셀 매트릭스로 보여준다. 문제:

1. **모두에게 같은 숫자** — 사용자가 자기 지역/관심사를 찾을 동기가 약함
2. **클릭 동기 부족** — 9 셀이 모두 동일한 `/real-estate/{type}` 페이지로만 연결
3. **메인 지역명 노출 0건** — 지역 페이지(2026-05-03 4-segment URL 컷오버 이후) 색인 강화 기여 없음
4. **변화 신호 없음** — `changePct`가 있긴 하나 평균에 가려져 잘 안 보임

## 2. 목표

- **디스커버리 가치**: "오늘의 시장이 어떻게 움직이는지" 명확한 인사이트 제공
- **SEO 강화**: 시·군·구 지역명을 메인페이지 SSR HTML에 다수 노출, 지역 페이지 내부링크 증가
- **모바일 최우선**: 스크롤 짧고 인터랙션 즐거운 카드
- **재방문 가치**: 매주 랭킹이 바뀌어 freshness signal 형성

## 3. 비목표 (YAGNI)

- 시·도 광역 집계, 그래프/스파크라인, 위치 기반 개인화 — 1차 범위 제외
- `/real-estate` 허브 페이지 재설계 — 별도 작업
- 청약 데이터 통합 — 별도 섹션 유지

## 4. 디자인 결정 (확정)

| 결정 항목 | 값 | 근거 |
|---|---|---|
| 1차 그루핑 | 3가지 시그널 카드 | "오늘의 시장" 스토리를 만드는 가장 명확한 축 |
| 시그널 | 평당가 상승 TOP / 평당가 하락 TOP / 거래 급증 TOP | 방향성(상승/하락) + 활성도 변화(거래) 균형 |
| 집계 단위 | 시·군·구 | 약 230개, 롱테일 SEO, 사용자 인지도 가장 익숙 |
| 표본 임계값 | 최근 7일 거래 ≥ 30건 (시·군·구 × 거래유형 단위) | 노이즈 차단. 적은 값(예: 10건)은 우연 변동 큼 |
| TOP N | 각 카드 5행 | 모바일 한 화면에 카드 1장이 들어갈 길이 |
| 건물 유형 토글 | `RealEstatePropertyType`: apt / villa / offitel (기본: apt) | 기존 타입 그대로 사용 |
| 거래 토글 | 매매(`-sale`) / 전세(`-rent` + `rentType='전세'`) / 월세(`-rent` + `rentType='월세'`) (기본: 매매) | DB 구조 반영. RealEstateType 슬러그는 6개뿐, 전세/월세는 `rentType` 필드로 분기 |
| **월세 특수 처리** | 평당가 상승/하락 시그널 **제외**, 거래 급증 카드만 표시 | 월세 평당가 = 보증금 + 월세 두 변수라 단일 산식이 왜곡 큼. 거래 활동성이 더 의미 있는 지표 |
| 모바일 시그널 탭 기본 | **거래 급증** | 노이즈 적고 안정적, "시장 살아있다" 첫인상 |
| SSR 전략 | **선택 건물유형만** × 시그널 3 × 거래 3 × 5행 = 45행 | 옵션 B. 건물유형 토글 시 클라이언트 fetch |
| 건물유형 토글 데이터 | 클라이언트에서 별도 API 호출 (캐싱) | SSR 페이로드 최소화 (45행), 나머지 건물유형은 lazy |
| 데이터 윈도우 | 최근 7일 vs 직전 7일 | 기존 `getRealEstateTrends`와 동일 정책 |
| 색상 관례 | 상승 = red-500, 하락 = blue-500 (한국 부동산 관례) | 기존 컴포넌트와 일치 |

## 5. 데이터 모델

### 5.1 백엔드 응답 타입

```ts
// backend/src/types/homeDashboard.ts 확장
import type { RealEstatePropertyType } from '../schemas/realEstate.js';

export interface HotspotRegion {
  citySlug: string;        // 'seoul'
  city: string;            // '서울특별시'
  districtSlug: string;    // 'gangnam-gu'
  district: string;        // '강남구'
  pricePerPyeong: number | null;  // 평당가(만원). null = 데이터 없음
  txnCount: number;        // 최근 7일 거래건수
  changePct: number | null;     // 전주 대비 평당가 변동률(%). null = 직전 7일 표본 부족
  volumeChangePct: number | null; // 거래량 변동률(%) — "거래 급증" 카드용
}

export interface HotspotBundle {
  rising: HotspotRegion[];   // 평당가 상승 TOP. changePct desc, max 5
  falling: HotspotRegion[];  // 평당가 하락 TOP. changePct asc, max 5
  active: HotspotRegion[];   // 거래 급증 TOP. volumeChangePct desc, max 5
}

// 월세는 평당가 시그널 제외 — 거래 급증만 표시
export interface WolseHotspotBundle {
  active: HotspotRegion[];   // volumeChangePct desc, max 5. pricePerPyeong은 null로 채움
}

// 건물 유형별 핫스팟: 매매 / 전세 / 월세 3슬라이스
export interface PropertyHotspots {
  sale: HotspotBundle;            // *-sale 테이블 (예: AptSale). 3시그널 모두
  jeonse: HotspotBundle;          // *-rent 테이블 + rentType='전세'. 3시그널 모두
  wolse: WolseHotspotBundle;      // *-rent 테이블 + rentType='월세'. 거래 급증만
}

// 메인 SSR은 apt만 채움. 나머지 건물유형은 클라이언트 lazy fetch.
export type RealEstateHotspots = Partial<Record<RealEstatePropertyType, PropertyHotspots>>;
```

### 5.2 API 엔드포인트

**기존**: `GET /api/meta/home-dashboard` — `realEstateTrends`만 반환  
**신규**: `realEstateHotspots: RealEstateHotspots`(apt만 채워서) 필드를 같은 응답에 추가

**추가**: `GET /api/meta/hotspots?propertyType=offitel`
- `propertyType` 쿼리 파라미터: `RealEstatePropertyType` enum (`apt | villa | offitel`)
- 응답: `PropertyHotspots` (sale/jeonse/wolse 3슬라이스)
- 클라이언트가 건물유형 토글 시 호출
- 응답 캐시 헤더: `Cache-Control: public, max-age=3600` (1시간)

### 5.3 쿼리 패턴

건물 유형 1개당 3개 슬라이스를 만든다:
- `sale`: 매매 테이블 (`AptSale` / `VillaSale` / `OffitelSale`) 전체 → 3시그널(상승/하락/거래)
- `jeonse`: 전월세 테이블 (`AptRent` / `VillaRent` / `OffitelRent`) + `WHERE rentType = '전세'` → 3시그널
- `wolse`: 전월세 테이블 + `WHERE rentType = '월세'` → **거래 급증만** (평당가 산식 미적용)

**sale / jeonse 쿼리** — 시·군·구 그룹 by, 평당가 + 변동률 산정:

```sql
-- 의사 SQL. Prisma raw query로 작성.
WITH recent AS (
  SELECT city, district,
         AVG(price / area_pyeong) AS price_per_pyeong,
         COUNT(*) AS txn_count
  FROM <model_table>
  WHERE deal_date >= NOW() - INTERVAL 7 DAY
  GROUP BY city, district
  HAVING COUNT(*) >= 30
),
prior AS (
  SELECT city, district,
         AVG(price / area_pyeong) AS prev_price,
         COUNT(*) AS prev_txn_count
  FROM <model_table>
  WHERE deal_date >= NOW() - INTERVAL 14 DAY
    AND deal_date <  NOW() - INTERVAL 7 DAY
  GROUP BY city, district
)
SELECT r.city, r.district, r.price_per_pyeong, r.txn_count,
       CASE WHEN p.prev_price IS NOT NULL AND p.prev_txn_count >= 30
            THEN (r.price_per_pyeong - p.prev_price) / p.prev_price * 100
            ELSE NULL END AS change_pct,
       CASE WHEN p.prev_txn_count > 0
            THEN (r.txn_count - p.prev_txn_count) / p.prev_txn_count * 100
            ELSE NULL END AS volume_change_pct
FROM recent r
LEFT JOIN prior p USING (city, district)
```

**wolse 쿼리** — 가격 산정 없이 거래량만:

```sql
WITH recent AS (
  SELECT city, district, COUNT(*) AS txn_count
  FROM <rent_table>
  WHERE rentType = '월세' AND deal_date >= NOW() - INTERVAL 7 DAY
  GROUP BY city, district
  HAVING COUNT(*) >= <threshold>
),
prior AS (
  SELECT city, district, COUNT(*) AS prev_txn_count
  FROM <rent_table>
  WHERE rentType = '월세' AND deal_date >= NOW() - INTERVAL 14 DAY AND deal_date < NOW() - INTERVAL 7 DAY
  GROUP BY city, district
)
SELECT r.city, r.district, NULL AS price_per_pyeong, r.txn_count,
       NULL AS change_pct,
       CASE WHEN p.prev_txn_count > 0
            THEN (r.txn_count - p.prev_txn_count) / p.prev_txn_count * 100
            ELSE NULL END AS volume_change_pct
FROM recent r LEFT JOIN prior p USING (city, district)
WHERE p.prev_txn_count > 0
ORDER BY volume_change_pct DESC
LIMIT 5
```

`pricePerPyeong` 은 항상 `null`로 반환 → 프론트엔드는 표시 안 함.

**주의**:
- 매매 테이블의 가격 컬럼은 `dealAmount` (만원), 전월세는 `deposit` (전세 보증금)
- 면적은 `exclusiveArea` (m²) → 평당가 산식 = `dealAmount(or deposit) / (exclusiveArea / 3.3058)`
- 월세는 평당가 산정 안 함 (위 결정)
- City 정규화 시 `buildRegionFilter()` / `CITY_SLUG_TO_FULL` 패턴 적용 (서울특별시/서울 혼재 대응)
- 거래일자 컬럼은 `dealYear`/`dealMonth`/`dealDay` 분리형 — `STR_TO_DATE` 또는 동등 처리
- `volume_change_pct` 가 null인 경우(직전 7일 표본 0) "active" 정렬에서 제외
- 빌라/오피스텔은 표본 적음 → 임계값 30건이 너무 빡빡할 수 있음. **건물유형별 임계값**: apt 30, offitel 15, villa 15. (config 상수화)

### 5.4 정렬 규칙

| 슬라이스 | 시그널 | 정렬 키 | 추가 필터 |
|---|---|---|---|
| sale / jeonse | rising | `change_pct DESC` | `change_pct IS NOT NULL AND change_pct > 0` |
| sale / jeonse | falling | `change_pct ASC` | `change_pct IS NOT NULL AND change_pct < 0` |
| sale / jeonse | active | `volume_change_pct DESC` | `volume_change_pct IS NOT NULL AND volume_change_pct > 0` |
| **wolse** | active만 | `volume_change_pct DESC` | 동일 (rising/falling 없음) |

표본 임계값은 메인 쿼리(HAVING)에서 적용.

각 리스트 최대 5개.

## 6. 프론트엔드 구조

### 6.1 컴포넌트 트리

```
HomeHotspotSignals.vue (신규)
├─ HomeHotspotSignals.Header           // 제목 + "전체 보기" 링크
├─ HomeHotspotSignals.PropertyToggle   // 아파트/오피스텔/빌라
├─ HomeHotspotSignals.MobileSignalTabs // 모바일: 상승/하락/거래 탭 (lg: 이상에서 hidden)
├─ HomeHotspotSignals.CardGrid
│   ├─ HotspotCard (rising)
│   │   ├─ TxnTypeMiniTabs             // 매매/전세/월세
│   │   └─ HotspotRow × 5
│   ├─ HotspotCard (falling)
│   └─ HotspotCard (active)
└─ HomeHotspotSignals.Footer           // 데이터 출처
```

3개 시그널 카드는 **항상 SSR로 렌더링**된다 (모바일에서도). 모바일에선 CSS로 활성 탭 외 카드를 `hidden` 처리 (display:none 아닌 Tailwind `lg:hidden` + `hidden lg:block` 패턴).

**월세 탭 선택 시 특수 동작**:
- 시그널 카드는 `active` 1장만 렌더링 (상승/하락 카드 자체가 SSR HTML에 없음)
- 데스크톱: 1장 카드를 max-width 제약으로 가운데 정렬 또는 첫 컬럼에 배치
- 모바일: 시그널 탭(상승/하락/거래) 자체를 hidden 처리 — 거래만 의미 있으므로 탭 UI 불필요
- 카드 헤더 옆에 "월세는 거래량 시그널만 제공해요" 한 줄 캡션 (사용자 혼란 방지)

### 6.2 상태 관리

```ts
import type { RealEstatePropertyType } from '~/types/realEstate';

type TxnKey = 'sale' | 'jeonse' | 'wolse';
type SignalKey = 'rising' | 'falling' | 'active';

// 클라이언트 상태
const propertyType = ref<RealEstatePropertyType>('apt');
const txnType = ref<TxnKey>('sale');
const mobileSignal = ref<SignalKey>('active'); // 모바일 기본

// 데이터: SSR로 받은 초기값 + 건물유형 전환 시 lazy fetch
const hotspotData = ref<RealEstateHotspots>(initialFromSSR);

watch(propertyType, async (next) => {
  if (hotspotData.value[next]) return; // 이미 fetch함
  const data = await $fetch(`/api/meta/hotspots?propertyType=${next}`);
  hotspotData.value[next] = data;
});
```

### 6.3 링크 동선

**현재 라우팅 제약** (CLAUDE.md 기준):
- `/[city]/[district]/[category]` 의 `[category]` 는 facility 15종 한정 (toilet, parking 등) — 부동산 불가
- 부동산 라우트: `/real-estate/[realEstateType]/` (파일명 그대로)

**1차 결정**: 각 행은 `RealEstateType` 슬러그 페이지로 보낸다. 지역과 전세/월세 구분은 쿼리 파라미터로 전달, 페이지에서 필터 프리셀렉트.

```
매매: /real-estate/apt-sale?city=seoul&district=gangnam-gu
전세: /real-estate/apt-rent?city=seoul&district=gangnam-gu&rentType=전세
월세: /real-estate/apt-rent?city=seoul&district=gangnam-gu&rentType=월세
```

- 슬러그 생성: `toApiSlug(propertyType, mode)` 헬퍼 사용 (`mode` = `'sale' | 'rent'`)
- `txnType === 'sale'` → `mode = 'sale'`, 그 외 → `mode = 'rent'`
- `city`, `district`: slug 형태 (`CITY_SLUG_TO_FULL` 역방향)
- `rentType`: DB 필드명 그대로 `'전세' | '월세'` (한글)

**구현 작업**: `/real-estate/[realEstateType]/index.vue` 가 `city`, `district`, `rentType` 쿼리 파라미터를 읽어 목록 필터를 프리셀렉트하는 기능 추가. (현재 지원 여부는 코드 확인 필요 — 미지원이면 본 spec 1단계에 포함)

**향후 옵션 (별도 spec)**: `/real-estate/{realEstateType}/{citySlug}/{districtSlug}` 같은 4-segment 경로의 지역 허브 페이지 신설 → SEO 색인 면적 확대. 본 spec 범위 밖.

### 6.4 반응형 레이아웃

- **데스크톱 (lg+)**: 3 카드 가로 그리드. `grid-cols-3 gap-px`
- **태블릿 (md~lg)**: 3 카드 유지하되 폰트/패딩 축소
- **모바일 (<md)**: 시그널 탭 1개 활성, 나머지 2 카드 hidden. 카드 폭 100%

### 6.5 SSR/하이드레이션 가드

- 자산 토글의 lazy fetch는 `if (!import.meta.client) return` 가드 적용
- 초기 SSR HTML이 `propertyType=apt`로 고정되므로 hydration mismatch 없음

### 6.6 SEO / 색인 고려

- 시그널 카드 3개는 모두 SSR HTML에 텍스트로 존재 → 모바일 hidden은 CSS-level, HTML 텍스트는 보임
- TxnTypeMiniTabs도 매매/전세/월세 3개 리스트를 모두 SSR (선택된 건물유형 1개 한정) → 45행 텍스트
- 건물유형 토글 시 클라이언트에서만 추가 fetch → 색인 영향 없음 (메인 건물유형 = apt가 색인됨)
- 각 행에서 지역 페이지로의 내부 링크 = 약 45개 (건물유형 1개 × 시그널 3 × 거래 3 × TOP5)
  - **중복 가능**: 동일 지역이 매매/전세/월세 모두에 나올 수 있음. 그래도 SEO 측면에선 문제 없음

## 7. 디자인 토큰 / 시각 언어

기존 컴포넌트와 동일:
- `bg-white border border-line rounded-2xl shadow-card`
- 텍스트: `text-slate-900` (강조), `text-slate-500` (보조), `text-[11px]` (캡션)
- 색상: 상승 `text-red-500 bg-red-50`, 하락 `text-blue-500 bg-blue-50`, 활발 `text-violet-600 bg-violet-50`
- 아이콘: material-symbols-outlined `local_fire_department`, `trending_down`, `bolt`
- 폰트 무게: 가격/지역명 `font-bold`, 캡션 `font-medium`

목업 참고: `/tmp/ilsangkit-hotspot-mockup.html` (브라우저 검증 완료)

## 8. 에러/엣지 케이스

| 상황 | 동작 |
|---|---|
| 시그널 리스트가 5개 미만 (예: 빌라 매매 상승 지역 3개뿐) | 있는 만큼 표시. "더 많은 데이터 수집 중" 같은 placeholder 행 추가 X (실리감 깨짐) |
| 시그널 리스트가 0개 | 카드 자체는 유지, 본문에 "이번 주는 유의미한 변동이 없어요" 한 줄 |
| 건물유형 fetch 실패 | 토글 UI는 활성 유지하되 토스트로 "데이터를 불러오지 못했어요". 이전 건물유형 데이터 유지 |
| `changePct = null` 인 항목 | "rising"/"falling" 카드에 포함시키지 않음 (이미 5.4의 필터로 처리) |
| **월세 탭의 카드 행** | `pricePerPyeong = null` → 가격 슬롯에 표시 안 함. 거래건수와 거래 변동률만 표시 |
| 동일 표본 부족(거래 30건 < 임계값인 시·군·구) | 모든 시그널에서 제외 |
| SSR 시 백엔드 다운 | `useAsyncData(...catch(() => null))` 패턴으로 컴포넌트 전체 숨김 (기존 `HomeMarketStats`와 동일 정책) |

## 9. 성능 고려

- SSR 페이로드 증가량: 기존 `realEstateTrends` 9 row → `realEstateHotspots.apt` 45 row. JSON 약 5–8 KB 증가
- DB 부하: 건물유형 3종 × 슬라이스 3종 = 9개 쿼리 (sale은 매매 테이블, jeonse/wolse는 같은 rent 테이블 분기). 각각 CTE 1회. 인덱스 = `(city, district, dealYear, dealMonth, dealDay)` 또는 동등 (없으면 마이그레이션 추가)
- 캐시: backend에서 건물유형별 `PropertyHotspots`를 in-memory LRU 캐시 (TTL 1시간). 매 요청 DB 히트 방지
- Lazy fetch 엔드포인트는 1시간 max-age CDN 캐시 가능

## 10. 테스트 전략

### 10.1 백엔드 (vitest)

- `getRealEstateHotspots('apt')` — 더미 데이터로 rising/falling/active 정렬 검증
- 표본 임계값 미달 지역이 제외되는지
- `changePct = null` 행이 rising/falling에서 제외, active에는 영향 없는지
- 직전 7일 표본 0 → `changePct = null` 반환
- `city` 정규화: 서울특별시/서울 양쪽 매칭

### 10.2 프론트엔드 (vitest)

- `HomeHotspotSignals` 마운트 → 3개 시그널 카드 렌더링
- 자산 토글 클릭 시 `$fetch` 호출 (msw로 mock)
- 모바일 시그널 탭 전환 동작
- `hotspots = null` 일 때 컴포넌트 미렌더
- TxnTypeMiniTabs 클릭 시 표시 데이터 전환

### 10.3 E2E (playwright)

- 메인페이지 진입 → 시그널 카드 3장 존재
- 첫 번째 행 클릭 → 지역 페이지 이동 + URL 쿼리 파라미터 확인
- 모바일 viewport → 1개 시그널 카드만 보임, 탭 전환 작동

## 11. 마이그레이션 / 롤아웃

1. 백엔드 신규 함수 + 엔드포인트 추가 (기존 `getRealEstateTrends` 유지)
2. 프론트엔드 신규 컴포넌트 `HomeHotspotSignals.vue` 작성
3. `pages/index.vue` 에서 `HomeMarketStats` → `HomeHotspotSignals` 교체 (한 PR)
4. 1주 모니터링 후 `HomeMarketStats.vue` 및 `getRealEstateTrends()` 제거 (별도 PR)
5. 지역 페이지 쿼리 파라미터 프리셀렉트 미구현이면 별도 작업으로 분리

## 12. 미해결/추후 결정

- `/real-estate/[realEstateType]` 페이지가 `city`/`district`/`rentType` 쿼리 파라미터 필터를 지원하는지 코드 확인 — 미지원 시 본 spec 1단계에 포함
- 지역 부동산 전용 페이지(`/real-estate/{realEstateType}/{citySlug}/{districtSlug}`) 신설 여부 — SEO 임팩트 분석 후 별도 spec
- 빌라/오피스텔 임계값 (15건이 적절한지) — 실데이터로 분포 확인 후 조정
- 캐시 무효화 전략 — sync 스크립트가 부동산 데이터 새로 적재했을 때 캐시 강제 갱신할지

## 13. 성공 지표

- 메인페이지 → 부동산 지역 페이지 클릭률 (CTR) — 4주 후 대비
- 부동산 지역 페이지의 색인 페이지 수 — GSC 측정
- 직접 트래픽으로의 영향 — 영향 없어야 함 (메인 ↔ /real-estate 허브는 그대로)
