# 메인 페이지 리디자인 — 오늘의 부동산·청약 강화

- 작성일: 2026-05-20
- 작성자: 사용자(@sksdlaudtjr) + Claude (brainstorming)
- 관련 목업: [2026-05-20-home-redesign-mockup.html](./2026-05-20-home-redesign-mockup.html)
- 영향 영역: `frontend/pages/index.vue`, `backend/src/services/metaService.ts`, `backend/src/routes/meta.ts`

## 1. 배경과 목적

부동산 실거래/청약 데이터가 일 단위로 sync되는데 현재 메인 페이지에서는 정적 카운트(전체 N만 건)만 노출된다. 매일 변하는 시장 신호를 메인에 노출해 (1) 재방문 동기, (2) SEO daily-fresh 시그널, (3) 부동산/청약 상세 페이지로의 내부 링크 유입을 동시에 강화한다.

## 2. 페이지 최종 구조

```
1. Hero                       (라이브 뱃지 추가 — 오늘 신규 등록 N건)
2. 오늘의 부동산 시장 [신규]   (통계 3카드)
3. 이번 주 인기 단지 [신규]    (매매·전세·월세 3컬럼, 각 TOP 5)
4. AdBanner ★
5. 청약 한눈에 [강화]          (요약 1줄 + D-3 임박 + 카드 4+4 + 누락 메타)
6. AdBanner ★
7. 빠른 생활시설 찾기          (기존 유지)
8. 인기 지역                  (기존 유지)
9. 생활 가이드                (기존 유지)
10. AdBanner ★
11. 데이터 출처               (기존 유지)
```

**제거되는 섹션:**
- 기존 "오늘 확인할 정보" 3카드 (실거래/청약/시설 진입 카드) — 새 상단이 역할 대체
- 기존 "부동산 실거래가" 3카드 (아파트/빌라/오피스텔 진입 카드) — 새 통계 카드로 흡수

**광고:** 3개 유지, 위치 재정렬 (인기 단지 뒤 / 청약 뒤 / 가이드 뒤).

## 3. 백엔드 — 단일 endpoint

신규 endpoint `GET /api/meta/home-dashboard` 추가.

```ts
{
  // 기존 stats 흡수 (기존 /api/meta/stats 는 유지하되 home-dashboard 가 superset)
  total: number,
  buildingCount: number,
  realEstateBuildings: { apt: number, villa: number, offitel: number },
  subscriptionActiveCount: number,

  // [신규] 오늘 sync 라이브 뱃지
  newlyListedToday: number,           // createdAt >= 오늘 00:00 KST 인 실거래 row 수 (sale+rent 합산)

  // [신규] 부동산 통계 — 슬롯 3개 (apt-sale, apt-rent-jeonse, offitel-sale)
  realEstateTrends: Array<{
    key: 'apt-sale' | 'apt-rent-jeonse' | 'offitel-sale',
    label: string,                     // '아파트 매매' 등
    avgPrice: number | null,           // 단위: 만원. 최근 7일 거래일(contractDate) 기준 평균
    txnCount: number,                  // 최근 7일 거래 건수
    prevAvgPrice: number | null,       // 직전 7일(8~14일 전) 평균
    changePct: number | null,          // (avg - prev) / prev * 100. prev=0 또는 null이면 null
  }>,

  // [신규] 인기 단지 TOP — 매매·전세·월세 3분할
  trendingBuildings: {
    sale: TrendingBuilding[],           // AptSaleTransaction GROUP BY (buildingName, city, district)
    jeonse: TrendingBuilding[],         // AptRentTransaction WHERE rentType='전세'
    wolse: TrendingBuilding[],          // AptRentTransaction WHERE rentType='월세'
  },

  // [신규] 청약 요약
  subscriptionSummary: {
    closingThisWeek: number,           // receptionEndDate ∈ [오늘, 오늘+7일]
    upcomingNextWeek: number,          // receptionStartDate ∈ [오늘+1, 오늘+14일]
    avgSupplyPrice: number | null,     // 활성 공고 평균 분양가 (만원). 없으면 null
    imminent: Array<{                  // receptionEndDate ∈ [오늘, 오늘+3일]
      id: number,
      houseName: string,
      regionName: string,
      endDate: string,                 // ISO date
    }>,
  },
}

type TrendingBuilding = {
  buildingName: string,
  city: string,                        // 정식명 ('서울특별시')
  district: string,
  txnCount: number,
  avgPrice: number | null,             // sale: dealAmount 평균, jeonse: deposit 평균
  avgMonthlyRent: number | null,       // wolse에만 채워짐 (monthlyRent 평균)
  slug: string,                        // /real-estate/[propertyType]/[buildingName] 빌더 결과
}
```

### 구현 노트

- **평균 계산**: `prisma.aptSaleTransaction.aggregate({ _avg: { dealAmount }, where: { contractDate: { gte: ... } } })`. `contractDate` 필드는 `dealYear/dealMonth/dealDay` 조합으로 산출 — 기존 코드에 `realEstateService`의 contractDate 헬퍼가 있으면 재사용, 없으면 `${dealYear}-${dealMonth}-${dealDay}` 문자열 비교 또는 raw SQL `STR_TO_DATE`.
- **TOP 단지**: `$queryRaw` GROUP BY (`buildingName`, `city`, `district`) ORDER BY COUNT DESC LIMIT 5. 빌라/오피스텔은 별도 카테고리로 빠질 수 있어 본 슬롯은 **아파트 데이터 한정**.
- **BigInt/Decimal 직렬화**: `realEstateService.serializeRow()` 패턴 재사용 — Number 변환.
- **City variant**: 응답의 `city`는 정식명(`서울특별시`)로 통일. 프론트 표시는 short name 변환은 프론트에서.
- **캐싱**: 응답을 in-memory 1시간 TTL. sync 직후 invalidate. `metaService` 내 `homeDashboardCache` 모듈 변수.
- **성능 목표**: SSR 블로킹 호출이므로 P95 200ms. 캐시 miss 시 1초 이내. 너무 무거우면 향후 daily snapshot 테이블(`HomeDashboardSnapshot`)을 cron으로 미리 채우는 방안 — 본 작업에서는 단순 캐시로 시작.

## 4. 프론트엔드 컴포넌트

```
frontend/pages/index.vue                ← 재편 (기존 인라인 카드 2섹션 제거)
frontend/components/home/
  ├─ HomeHero.vue                       ← (선택) hero 추출 + 라이브 뱃지 슬롯
  ├─ HomeMarketStats.vue                ← [신규] 오늘의 부동산 시장
  ├─ HomeTrendingBuildings.vue          ← [신규] 인기 단지 3컬럼
  ├─ HomeSubscriptionSection.vue        ← [강화] 요약 + 임박 + 카드 + 누락 메타
  └─ (기타 기존 섹션은 인라인 유지)

frontend/composables/
  └─ useHomeDashboard.ts                ← [신규] /api/meta/home-dashboard SSR fetch
```

**원칙:**
- 각 Home* 컴포넌트는 **props만 받는 표현 컴포넌트** — fetch는 `index.vue`에서 `useHomeDashboard()` 단일 호출 후 prop drilling
- 데이터 없으면 컴포넌트가 자체 `v-if` 가드로 섹션 자체를 미렌더 (빈 슬롯 X)
- 청약 카드 limit은 기존 `useHomeSubscriptions`의 `limit: 4`를 유지 — 별도 호출. (총계는 `subscriptionSummary.closingThisWeek` / `upcomingNextWeek`에서 가져와 누락 메타 라인 렌더)
- SSR/CSR hydration: 기존 `home-today-iso` `useState` 패턴 재활용 (D-day)

## 5. 디자인 디테일

- **변동률 색상**: `+`는 빨강(`text-red-500`), `-`는 파랑(`text-blue-500`), null/0은 `text-slate-400 "—"` (한국 부동산/주식 관례)
- **금액 포맷**: 1억 이상 `5.4억`, 미만 `8,500만`. `formatPrice(manwon: number): string` 유틸
- **월세 표기**: `보증금/월세(만원)` 형식 — 예: `2억/120`
- **TOP 단지 컬럼 강조색**: 매매=primary(blue), 전세=emerald-500, 월세=amber-500. 헤더 좌측 1.5px 세로 바
- **임박 박스**: bg-red-50 + border-red-200 + D-day는 red-600
- **TOP 단지 1~2위만 컬러 강조**, 3~5위는 slate-400 (시선 흐름 유도)
- **누락 메타 라인**: `text-[11px] text-slate-400 mt-3 text-right` — 청약 카드 그리드 직하

## 6. 엣지 케이스

| 케이스 | 처리 |
|--------|------|
| `realEstateTrends[i].avgPrice` null | 카드 평균 `—`, 변동률도 `—` |
| `prevAvgPrice = 0 또는 null` | `changePct = null` → UI `—` |
| `trendingBuildings.{sale\|jeonse\|wolse}` < 5건 | 그 컬럼만 짧게 렌더. 0건이면 빈 상태 메시지 ("이번 주 거래 없음") |
| `subscriptionSummary.imminent = []` | 임박 박스 미렌더 |
| `newlyListedToday = 0` | 라이브 뱃지 미렌더 (Hero 정상) |
| API 전체 실패 | useHomeDashboard data null → 신규 3섹션 미렌더. 기존 hero/시설/가이드는 영향 없음 |
| 청약 ongoing/upcoming 0건 | 기존 `hasAny` 가드로 섹션 자체 미렌더 |

## 7. 테스트

**Backend (vitest):**
- `metaService.getHomeDashboard()` 단위 테스트
  - 정상 평균/변동률 계산
  - prev=0 division-by-zero → null
  - BigInt → Number 직렬화
  - 캐시 hit/miss
- `/api/meta/home-dashboard` 라우트 통합 테스트 (기존 supertest 패턴)

**Frontend (vitest):**
- `HomeMarketStats.vue`: 정상/null/0건 props 변형
- `HomeTrendingBuildings.vue`: 3컬럼 각 < 5건 케이스, 0건 컬럼
- `HomeSubscriptionSection.vue`: imminent 0건 / 정상 / 누락 메타 라인 표시
- `useHomeDashboard` 컴포저블: MSW로 응답 모킹, 에러 처리

**E2E (playwright):**
- 메인 진입 → 5개 신규/강화 섹션 가시성
- TOP 단지 1건 클릭 → 단지 상세 페이지 이동
- 임박 청약 1건 클릭 → 청약 상세 페이지 이동

## 8. 범위 외 (Non-goals)

- 빌라/오피스텔 인기 단지 — 본 작업에서는 아파트만 (매매·전세·월세)
- 청약 캘린더 뷰
- 지역별 필터 (TOP 단지는 전국 통합)
- daily snapshot 테이블 도입 (단순 캐시로 시작)
- 다크모드 (사이트 전반 라이트 전용)

## 9. 마이그레이션 / 호환성

- 기존 `/api/meta/stats` 유지 — 다른 호출처가 있을 수 있음
- 기존 `useHomeSubscriptions` 유지 (limit 4) — 호출 그대로
- `HomeSubscriptionSection.vue`는 in-place 수정 (요약/임박/메타 추가)

## 10. 다음 단계

이 스펙 승인 후 `writing-plans` 스킬로 구현 계획서 작성. 단계별 PR:
1. 백엔드 endpoint + 테스트 (PR #1)
2. 프론트 컴포저블 + HomeMarketStats (PR #2)
3. HomeTrendingBuildings (PR #3)
4. HomeSubscriptionSection 강화 (PR #4)
5. index.vue 재편 + 기존 카드 제거 (PR #5)
