# 홈 대시보드 재구성 — "오늘의 부동산 시장" + "이번 주 인기 단지" 설계

- **작성일**: 2026-06-20
- **상태**: 설계 (구현 전)
- **관련**: 진단 spec `2026-06-20-ssr-fail-closed-noindex-fix-design.md` §7(Approach B). 본 작업이 B Phase 1의 **home-dashboard 성능 부분을 precompute로 흡수**한다.

---

## 1. 배경 / 목표

홈의 두 섹션 **① 오늘의 부동산 시장**(`HomeMarketStats`/`HomeHotspotSignals`)과 **② 이번 주 인기 단지**(`HomeTrendingBuildings`)를 **콘텐츠·구성째로 재설계**한다. 동시에 이 섹션을 떠받치는 `getHomeDashboard()`는 매 SSR 요청마다 무거운 `$queryRaw` 집계를 돌려 **백엔드 Prisma 풀 고갈(P2024)의 주요 출처**(프론트 SSR fetch timeout 1위 엔드포인트 `/api/meta/home-dashboard`)였다. 재설계 데이터를 **야간 sync 때 미리 계산(precompute)**해 요청 경로에서 무거운 쿼리를 제거한다.

**목표:** (1) 두 섹션을 데이터로 정확히 표현 가능한 콘텐츠로 재구성(부동산 데이터만, 평균가 금지, 신고 지연 정직 처리). (2) 야간 precompute → 요청은 스냅샷 1행만 읽음 → P2024 출처 1개 제거. (3) 데스크톱(1200px)+모바일 반응형.

## 2. 범위 / 비목표

**범위:** ①② 콘텐츠·컴포넌트 재설계 + 백엔드 precompute(스냅샷 테이블 + 야간 스크립트) + `/api/meta/home-dashboard`를 스냅샷 읽기로 전환 + 테스트.

**비목표(제외):** 저평가/전세가율/갭(부정확·커버리지), 생활 인프라 결합(J), 청약(기존 섹션 유지), 공식 가격지수 차트(보유 데이터에 없음), B Phase 1 나머지(pool_timeout↓·slow_query_log ON·다른 엔드포인트 캐시 — 별도).

## 3. 섹션 설계 (확정)

### ① 오늘의 부동산 시장 = "이번 주 실거래 요약" (전부 카운트 기반)
- **상단 통계 타일 3개**: (a) 이번 주 거래량 + 전주 대비 %(잠정), (b) 신고가 경신 건수, (c) 거래 1위 지역.
- **하단 2열**(데스크톱) / **세그먼트 토글**(모바일): **거래 활발 지역 TOP**(7일 거래건수) + **거래 급증 지역**(전주 대비 %).
- **신고 지연 처리(§4.5)**: "전주 대비"는 신고가 거의 찬 **성숙 윈도우끼리** 비교 + 화면에 "잠정" 표기.

### ② 이번 주 인기 단지 = 거래유형 토글 + (매매)렌즈
2단 탭 구조:
- **1차 — 거래유형 토글** `[매매 · 전세 · 월세]` (세그먼트 컨트롤).
- **2차 — 렌즈 탭** `[거래량 많은 · 신고가 · 가격 급등]` — **매매에서만**. 전세·월세는 렌즈 없이 **거래량 순**.
- **가격 = 단지 "대표 평형(거래 최다)"의 실거래** — 여러 평형의 평균 금지(캡션 명시). 우측 표기:
  - 매매·거래량 → `거래 N건` + 매매가
  - 매매·신고가 → `신고가 금액`+배지 + `직전 최고가`
  - 매매·급등 → `▲ %` + `현재가 ← 직전가`
  - **전세** → `전세 N건` + `보증금`(대표평형 중앙값)
  - **월세** → `월세 N건` + `보증금`(상단) + `월 ○○만원`(하단) — 보증금·월세 둘 다
- 데스크톱 2열, 모바일 1열(탭 가로 스크롤). 전세/월세 정렬은 거래량 순(가격 정렬은 보증금·월세 중 모호 → 거래량이 명확).

### 대상 부동산 타입
**아파트.** 매매 = `AptSaleTransaction`, 전세/월세 = `AptRentTransaction`(`rentType`). (빌라·오피스텔은 후속 확장 여지)

## 4. 데이터 정의 (정확성)

단지 키 = `(bjdCode, buildingName)`. 거래일 = `dealYear/Month/Day` → `dealDate`.

- **4.1 대표 평형**: 단지별 최근 90일(폴백 전체) 거래에서 `exclusiveArea`별 건수 최다값. 동률 시 더 최근·더 많은 거래.
- **4.2 매매가/보증금/월세(대표가)**: 대표 평형의 최근 90일 **중앙값**(평균 아님). 매매=`dealAmount`, 전세=`deposit`, 월세=`deposit`+`monthlyRent`(각각 중앙값).
- **4.3 거래량(단지)**: 최근 7일 그 단지·해당 유형 거래 건수. (전세/월세는 `rentType` 필터)
- **4.4 신고가(매매)**: 대표 평형의 저장 이력 내 최대 `dealAmount`. "이번 주 경신" = 7일 거래가 (단지,대표평형) 직전 최고가 초과. 정렬=신고가 금액 desc. ⚠️ "역대"=저장 이력 한도(sync가 현재+직전월 누적).
- **4.5 급등(매매)**: 대표평형 이번 주 중앙값 vs 직전 대표가 상승률. 표본<N 단지 제외.
- **4.6 지역 집계**: `(city, district)` 윈도우 거래 건수 → 활발 TOP. 전주 대비 % → 급증 TOP(이번 주 최소 거래 ≥ 임계치).
- **4.7 신고 지연 보정(①)**: 실거래 신고는 계약 후 ~30일 가능 → "최근 7일"(계약일)은 과소집계. **"전주 대비"·"거래 급증"은 신고가 거의 찬 성숙 윈도우끼리 비교**(예: lag를 둔 직전 완료 주 vs 그 전 주). 화면 "잠정" 라벨. 랭킹(활발/급증)은 동일 윈도우. 절대 거래량은 "이번 주(잠정)"로 표기.

## 5. Precompute 아키텍처 (핵심)

```
야간 sync → refreshRealEstateSummary(기존) → refreshHomeDashboard(신규)
   → HomeDashboardSnapshot(1행, JSON payload) upsert
요청: GET /api/meta/home-dashboard → 스냅샷 payload 읽기(가벼움) → 응답
```

- **신규 테이블** `HomeDashboardSnapshot { id, key @unique, payload Json, computedAt }` (key='apt'). 현재 1행 upsert.
- **신규 스크립트** `backend/src/scripts/refreshHomeDashboard.ts`: §4 로직으로 ①② payload 계산·upsert. 윈도우·인덱스 활용 bound. 야간 sync의 `refreshRealEstateSummary` 직후 단계로 추가(`.github/workflows/sync-real-estate.yml`).
- **엔드포인트 전환**: `metaService.getHomeDashboard()`가 라이브 `$queryRaw` 다발 대신 **스냅샷 payload 반환**. 스냅샷 없음(최초/실패) → 라이브 1회 폴백(또는 빈 응답). 기존 `lastCache` 인메모리 유지.
- **효과**: 무거운 집계가 요청당 → 야간 1회. `/api/meta/home-dashboard`발 P2024/SSR timeout 제거(= B Phase 1 home-dashboard 부분 해결).

## 6. API 계약

`GET /api/meta/home-dashboard` 응답 `data`(스냅샷 payload):
```ts
{
  computedAt: string,
  market: {                                  // ①
    weeklyDeals: number, weeklyDealsProvisional: boolean,
    weeklyDealsChangePct: number,            // 성숙 윈도우 기준(§4.7)
    newHighCount: number,
    topRegionsByVolume: { city; district; count: number }[],
    risingRegions:      { city; district; changePct: number }[],
  },
  popular: {                                 // ② 거래유형별
    sale:   { byVolume: SaleItem[]; byNewHigh: SaleItem[]; byRise: SaleItem[] },
    jeonse: { byVolume: RentItem[] },
    wolse:  { byVolume: RentItem[] },
  }
}
// SaleItem = { buildingName, city, district, repArea, price,
//              dealCount?, prevHigh?, risePct?, prevPrice? }
// RentItem = { buildingName, city, district, repArea, dealCount,
//              deposit, monthlyRent? }   // 월세만 monthlyRent
```
BigInt → Number 직렬화는 기존 `serializeRow` 패턴.

## 7. 프론트엔드 컴포넌트

- `components/home/HomeMarketSummary.vue`(신규, ① 대체): 통계 타일 3 + 거래활발/급증 지역(데스크톱 2열, 모바일 세그먼트 토글), "잠정" 표기.
- `components/home/HomePopularBuildings.vue`(신규, ② 대체): **거래유형 토글 + (매매)렌즈 탭** + 랭킹(데스크톱 2열/모바일 1열, 탭 가로 스크롤), 대표 평형 캡션, 전세=보증금·월세=보증금+월세.
- `pages/index.vue`: 구 3 컴포넌트 제거, 신규 2 배치.
- `composables/useHomeDashboard.ts`: 타입 갱신(`HomeMarket`, `SaleItem`, `RentItem`).
- 가격 포맷(`formatPriceManwon`)·`HardLink`·SSR 가드 기존 유틸 재사용.

## 8. 테스트

**백엔드(vitest, 시드 픽스처):** 대표 평형 선택·중앙값(매매/전세/월세), 신고가 경신 판정·정렬, 급등 계산(표본 과소 제외), 지역 활발/급증(성숙 윈도우·최소 거래), 전국 주간 카운트·전주 대비(성숙 윈도우), 엔드포인트 스냅샷 읽기·폴백.
**프론트(vitest):** 두 컴포넌트 — 거래유형 토글 전환(매매↔전세↔월세), 매매 렌즈 탭 전환, 모바일 토글, 월세 보증금+월세 표기, 빈 상태, "대표 평형"·"잠정" 캡션.

## 9. 롤아웃 / B와의 관계

PR 기반(develop). 백엔드(스냅샷·스크립트·엔드포인트) → 프론트(컴포넌트). 야간 sync에 `refreshHomeDashboard` 추가 → 다음 sync부터 스냅샷, 배포 직후 폴백이 받침. **B Phase 1 잔여**(pool_timeout↓·slow_query_log ON·다른 엔드포인트 캐시)는 후속 — 본 작업이 가장 무거운 home-dashboard를 제거해 B 부담을 줄인다.

## 10. 확정된 결정

1. **② = 거래유형 토글**: 매매(렌즈 거래량/신고가/급등) + 전세(거래량+보증금) + 월세(거래량+보증금/월세). 빌라·오피스텔 제외(아파트만).
2. 대표가 = 대표평형 **중앙값**(매매가/전세 보증금/월세 보증금·월세).
3. 신고가 정렬 = 금액 desc.
4. 급등 = 대표평형 이번주 중앙값 vs 직전, 표본<N 제외.
5. **"이번 주" = 데이터 최신일 기준 7일**, "전주 대비"·"급증"은 **신고 지연 성숙 윈도우 + 잠정 라벨**(§4.7).
6. 전세/월세 정렬 = 거래량 순. 월세 표기 = 보증금 + 월세 둘 다.

> 구현 시 확정할 기본값(스펙 리뷰 후 plan에서): 90일 윈도우 길이, 급등 표본 N, 급증 지역 최소 거래 임계, 성숙 윈도우 lag 일수.

## 11. 변경 파일 요약

**백엔드 신규**: `prisma/schema.prisma`(HomeDashboardSnapshot), `src/scripts/refreshHomeDashboard.ts`, `src/services/homeDashboardService.ts`(신규) + 테스트.
**백엔드 수정**: `src/services/metaService.ts`(getHomeDashboard→스냅샷), `.github/workflows/sync-real-estate.yml`(단계 추가).
**프론트 신규**: `components/home/HomeMarketSummary.vue`, `components/home/HomePopularBuildings.vue` + 테스트.
**프론트 수정**: `pages/index.vue`, `composables/useHomeDashboard.ts`.
**프론트 제거**: `HomeMarketStats.vue`, `HomeHotspotSignals.vue`, `HomeTrendingBuildings.vue`(+테스트).
**불변**: 청약 섹션, 부동산 상세/목록 섹션.
