# 공매(온비드) 부동산 페이지 설계 (전략 A: 낙찰 결과 누적형)

**작성일:** 2026-06-05
**상태:** 설계 확정 → 구현 계획 대기
**브랜치(예정):** `feature/auction-pages` (develop 기반, 신규)

---

## 1. 목표 (Goal)

온비드(KAMCO) 부동산 **공매** 데이터를 활용해, **색인 가능한 물건 상세·지역 통계 페이지**를 대량 생성하여 검색 유입 → 애드센스 수익을 확대한다. 토지 실거래가 기능과 동일한 SEO 자산 철학(지역 집계 + 품질게이트 + 영구 상세)을 따르되, 공매 데이터의 **휘발성**(진행중/예정만 제공) 제약을 "일일 스냅샷 + 마감 포착 archive"로 해소한다.

**전략 A (확정):** 낙찰 결과를 매일 누적해 영구 통계 자산화. 진행중 물건 리스트/상세로 즉시 콘텐츠를 확보하는 하이브리드.

**경매(법원)가 아닌 공매(온비드/캠코)** — 공공데이터포털에 공식 개방되어 합법·무료. 과거 보류했던 법원경매(무료/실시간 API 부재)와 구분.

---

## 2. 범위 (Scope)

### 포함 (v1)
- 차세대 온비드 부동산 API 2종만 사용: **물건목록(15157207)**, **물건상세 입찰정보(15157251)**
- 페이지: 허브 / 리스트(필터·카드) / 시도 집계 / 시군구 집계 / 물건 상세
- 일일 누적 sync + 마감 포착 archive + 지오코딩 + 집계 갱신
- 독립 "공매" 네비 드롭다운 (용도 1급 분류)
- 부가 기능 5종: ①낙찰가율 랭킹/통계 ②실거래가 시세 비교 ③주변 생활인프라 ④마감임박/신규 피드 ⑤감정가 대비 할인율 뱃지
- 공매 가이드 콘텐츠: **골격만**(라우트/메타/스텁, 본문은 후속)

### 제외 (Out of Scope / 후속)
- 과거 낙찰 backfill (API가 활성 물건만 제공 → 불가, 0부터 누적)
- 입찰가 시뮬레이터/낙찰가율 계산기 (부가 ⑦, 후속)
- 관심물건 저장·알림 (부가 ⑧, 로그인 인프라 필요 → 보류)
- 국유재산 매각현황/국유일반재산 입찰대상 API (부동산 공매만)
- 동산·권리 공매 (부동산만)

---

## 3. 외부 API

### 3.1 부동산 물건목록 — 15157207
- Endpoint: `RTMSDataSvc` 계열 아님. 온비드 차세대 서비스 (REST, JSON/XML)
- 인증: `OPENAPI_SERVICE_KEY` (기존 키와 동일 흐름, 무료·자동승인)
- 필수 파라미터: `prptDivCd`(재산유형코드), `pvctTrgtYn`(수의계약가능여부)
- 주요 응답: `cltrMngNo`(물건관리번호), `pbctCdtnNo`(공매조건번호), 소재지/물건명, 용도, 감정평가금액, 입찰금액(최저가), 입찰일자, 처분방식, 관리기관, 유찰/차수 등
- 갱신: 매시간(원천). 우리는 **하루 1회** 스냅샷.
- 제한: 개발 1,000건/일 → **운영계정 전환 + 활용사례 등록 필요**

### 3.2 물건상세 입찰정보 — 15157251
- 필수 파라미터: `cltrMngNo` + `pbctCdtnNo`
- 용도: ①목록에 없는 상세 필드 보강 ②**마감 물건의 개찰결과(낙찰가/유찰) 포착**
- 호출 최소화: 매일 "막 마감된 물건"에 대해서만 호출(전체 물건 매일 호출 금지)

### 3.3 핵심 제약
- **활성(진행중/예정) 물건만 반환** → 과거 데이터 backfill 불가. 낙찰 통계는 운영 시작 후 수개월 누적되어야 의미.
- 일부 물건은 좌표 정보 없음 → 지오코딩 필요, 실패 시 지도/로드뷰 생략.

---

## 4. 아키텍처 & URL 맵

공매는 실거래가의 하위 타입이 아니라 **평행한 거래 방식**(아파트·토지·상가·공장 모두 공매로 나옴)이므로 독립 네비 + 최상위 URL.

```
/auction/                       공매 허브 (용도별·지역별 진입, 마감임박/신규 하이라이트)
/auction/list                   물건 리스트 (필터: 지역/용도/상태, 카드형)
/auction/ranking                낙찰가율 랭킹/통계 (부가①)
/auction/[city]/                시·도 집계 (예: /auction/seoul)
/auction/[city]/[district]/     시군구 집계  ★전략 A SEO 자산
/auction/item/[물건관리번호]      물건 상세    ★양적 핵심 색인 자산
/guide/auction-*                공매 가이드 (골격만, 기존 /guide 인프라)
```

- slug `auction` (영문). Nuxt 정적 경로가 동적 `/[category]`·`/[city]`보다 우선 → 충돌 없음.
- 물건 상세는 단일 키 `[물건관리번호]`(cltrMngNo) — ayo의 2-세그먼트보다 단순·안정.

### 네비 (독립 "공매" 드롭다운)
```
공매 홈            /auction/
아파트·주거용 공매   /auction/list?usage=residential
토지 공매          /auction/list?usage=land
상가·업무 공매      /auction/list?usage=commercial
공장·창고 공매      /auction/list?usage=industrial
낙찰가율 랭킹       /auction/ranking
전체 물건          /auction/list
```

---

## 5. 데이터 모델 (`backend/prisma/schema.prisma`)

### 5.1 `AuctionItem` — 물건 1건 = 1 row
진행중엔 live 스냅샷, 마감 후엔 낙찰 archive로 전환.

| 필드 | 타입 | 비고 |
|---|---|---|
| id | Int PK | |
| cltrMngNo | VarChar(50) @unique | 물건관리번호 (자연키) |
| pbctCdtnNo | VarChar(50) | 공매조건번호 (상세 API용) |
| plnmNo | VarChar(50)? | 공고번호 |
| city / district | VarChar | 소재지 파싱 (서울/서울특별시 변형은 buildRegionFilter로 흡수) |
| bjdCode | VarChar(10) | 시군구 코드 |
| dongName | VarChar? | 법정동 |
| address | VarChar(500) | 소재지 전체 |
| usage | VarChar? | 용도 원문 |
| usageGroup | VarChar | residential/land/commercial/industrial/complex/etc |
| propertyType | VarChar? | 재산종류(압류재산/국유재산/수탁재산/기타) |
| dpslMtdNm | VarChar? | 처분방식(매각/임대) |
| landArea / bldArea | Decimal(12,2)? | 토지/건물 면적 ㎡ |
| apslAssAmt | BigInt? | 감정평가금액(원) |
| minBidPrc | BigInt? | 현 차수 최저입찰가(원) |
| failCnt | Int @default(0) | 유찰 횟수 |
| bidRound | Int? | 차수 |
| bidBeginDtm / bidCloseDtm | DateTime? | 입찰 시작/종료 |
| orgNm | VarChar? | 관리기관 |
| pvctTrgtYn | Boolean @default(false) | 수의계약 가능여부 |
| status | VarChar | scheduled/ongoing/closed/sold/failed/cancelled |
| isClosed | Boolean @default(false) | 입찰 종료 여부 |
| resultType | VarChar? | sold/failed/cancelled/noBid (archive) |
| winBidPrc | BigInt? | 낙찰가(원) (archive) |
| bidRate | Decimal(6,2)? | 낙찰가율 % = winBidPrc/apslAssAmt*100 (archive) |
| resultDate | DateTime? | 개찰/결과일 (archive) |
| lat / lng | Decimal? | 지오코딩 (지도·로드뷰) |
| sourceId | VarChar(200) @unique | dedupe 키 |
| firstSeenAt / lastSeenAt | DateTime | 스냅샷 추적(마감 판정) |
| syncedAt / createdAt / updatedAt | DateTime | |

인덱스: `@@index([bjdCode, usageGroup, status])`, `@@index([bidCloseDtm])`, `@@index([status, isClosed])`

**sourceId 규칙:** `['auction', cltrMngNo].join('-')` (물건관리번호가 고유 → 단순).
**금액 단위:** 온비드는 **원(₩)** 단위(실거래가 만원과 다름 — 주의). 표기 시 `억/만원` 변환은 표시 헬퍼에서.

### 5.2 `AuctionAreaSummary` — `(bjdCode, usageGroup)` @@unique
전략 A SEO 자산. 시군구 전체·시도는 용도별 row를 서비스에서 합산.

| 필드 | 타입 | 비고 |
|---|---|---|
| id | Int PK | |
| bjdCode | VarChar(10) | |
| usageGroup | VarChar | residential/land/commercial/industrial/complex |
| city / district | VarChar | |
| activeCount | Int | 진행중+예정 물건 수 |
| closedCount | Int | 마감 누적 |
| soldCount | Int | 낙찰 건수 |
| avgBidRate | Decimal(6,2)? | 평균 낙찰가율 ★헤드라인 (soldCount≥3일 때만 노출) |
| avgApslAmt | BigInt? | 평균 감정가 |
| avgWinBidPrc | BigInt? | 평균 낙찰가 |
| failRate | Decimal(5,2)? | 유찰률 % |
| latestResultDate | DateTime? | |
| isIndexable | Boolean @default(false) | 품질게이트 |
| createdAt / updatedAt | DateTime | |

`@@unique([bjdCode, usageGroup])`

---

## 6. Sync 파이프라인 (`backend/src/scripts/syncAuction.ts`)

`baseSyncService`(runSync/batchUpsert) + 기존 `syncRealEstateBase`/`geocodeRealEstate` 패턴 재사용.

```
1. 목록 수집: prptDivCd(재산유형) × pvctTrgtYn 루프로 15157207 전체 페이징
   - transformAuctionItem(): 소재지→city/district/bjdCode/dong 파싱, usageGroup 매핑
   - upsert(active): status=ongoing/scheduled, lastSeenAt=now
2. 마감 포착: !isClosed && lastSeenAt < (이번 런 시작시각)인 물건 추출
   - 15157251(cltrMngNo+pbctCdtnNo) 호출 → 개찰결과 freeze
   - resultType/winBidPrc/bidRate/resultDate 채우고 isClosed=true, status=sold|failed|cancelled
   - 호출량 = 당일 신규 마감분만 (소량)
3. 지오코딩: lat/lng 없는 신규 물건 (기존 geocodeRealEstate 유틸/카카오, rate limit 준수)
4. refreshAuctionSummary(): 시군구×용도 재집계
   - avgBidRate(soldCount 기준), failRate, count들, isIndexable 갱신
```

- 운영 가드: `SYNC_GUARD_MINUTES`(기본 20), `installRuntimeGuard` (토지와 동일).
- CLI: `--prpt`(재산유형 한정), `--ym`/범위는 불필요(활성만 제공). 기본은 전체 활성 스냅샷.
- 멱등성: cltrMngNo 기준 upsert, 마감된 물건은 다시 active로 덮어쓰지 않음(isClosed 가드).

### usageGroup 매핑 (온비드 용도코드 → 1급 분류)
| usageGroup | 포함 용도(예시) |
|---|---|
| residential | 아파트, 단독·다가구, 연립·다세대, 오피스텔(주거) |
| land | 대지, 전, 답, 임야, 잡종지 등 토지 |
| commercial | 근린상가, 사무실, 업무용 |
| industrial | 공장, 창고, 산업용 |
| complex | 토지+건물 복합, 기타 복합용 |
| etc | 위 미분류 |

(정확한 코드값은 온비드 코드조회(15000920) 결과로 매핑 테이블 확정 — 구현 시)

---

## 7. 품질게이트 & 색인 정책

| 페이지 | 색인 조건 |
|---|---|
| 물건 상세 | 진행중·예정·마감(낙찰/유찰) = 색인 / 취소·무효 = noindex,follow |
| 시군구×용도 집계 | `isIndexable = soldCount≥3 OR closedCount≥5 OR activeCount≥3` |
| 낙찰가율 노출 | `soldCount≥3`일 때만 (미달 시 진행중/감정가 통계만 표시) |
| 리스트 | 기본·용도 고정진입(`?usage=`)만 색인 / 임의 필터 조합 = noindex |
| 랭킹/통계 | 데이터 충분(전국 soldCount 임계) 시 색인 |

noindex 페이지: `robots: noindex,follow` + canonical 생략 + 사이트맵 제외 (토지와 동일 규칙).

---

## 8. 페이지별 콘텐츠 & SEO

### 8.1 물건 상세 `/auction/item/[cltrMngNo]`
- **H1/타이틀**: `"{소재지} {용도} 공매 - 최저입찰가 {금액}"` / 마감: `"… 낙찰가 {금액}(낙찰가율 %)"`
- 상태 뱃지(예정/진행중/마감/낙찰/유찰)
- 핵심 카드: 감정가 · 최저입찰가 · **감정가 대비 할인율(부가⑤)** · (낙찰가율 if 마감) · 입찰기간 · 차수/유찰 · 처분방식 · 수의계약
- 물건정보: 소재지·용도·토지/건물면적·재산종류·관리기관
- 입찰이력(회차별)
- **🗺️ 카카오 지도(마커) + 로드뷰** (좌표 기반, 없으면 지도만/생략)
- **실거래가 시세 비교(부가②)**: 같은 동 아파트/토지 실거래가 평균 → "감정가 시세 대비 ±%"
- **주변 생활인프라(부가③)**: 반경 내 지하철/병원/학교 (facility 데이터)
- 내부링크: 같은 시군구 다른 물건 / 지역 실거래가·토지 / 데이터 출처(온비드·캠코)
- 구조화 데이터: Product/Offer (price=최저입찰가, 마감 시 낙찰가)

### 8.2 리스트 `/auction/list` (ayo식 카드)
- 필터: 지역(시도→시군구)·용도·상태 / 정렬: 입찰임박·감정가·낙찰가율
- 카드: `[상태] 재산종류·유찰N회·N차 / 소재지 / 용도 / 📍시군구 / 감정가(·최저가) / 할인율 / 입찰기간 / 용도아이콘`
- 페이지네이션(`Pagination.vue` 재사용)

### 8.3 시군구 집계 `/auction/[city]/[district]` ★전략A
- H1: `"{시군구} 공매 물건·낙찰가율"`
- 헤드라인: 평균 낙찰가율(soldCount≥3) · 진행중 N · 누적 낙찰 N
- 용도별 섹션(아파트/토지/상가/공장): 낙찰가율·건수
- 진행중 물건 리스트(상위 N) → 상세 링크
- 최근 낙찰 사례(archive)
- 분기 낙찰가율 추이
- FAQ / 출처 / 품질게이트 색인

### 8.4 시도 `/auction/[city]` · 허브 `/auction`
- 시도: 시군구 카드 그리드 + 통계
- 허브: 전국 개요 · 용도별 진입 카드 · 인기 지역 · **마감임박/신규 물건 하이라이트(부가④)**

### 8.5 랭킹/통계 `/auction/ranking` (부가①)
- "낙찰가율 높은/낮은 지역 TOP", "용도별 평균 낙찰가율", "전국 공매 통계"
- AuctionAreaSummary 집계로 자동 생성·영구

### 8.6 가이드 (골격만)
- `/guide/auction-vs-court`, `/guide/auction-how-to-bid`, `/guide/auction-bid-rate` 등 라우트/메타/스텁만. 본문 후속.

---

## 9. 백엔드 구성

- **`schemas/auction.ts`**: AuctionListSchema(필터), AuctionRegionSchema, AuctionItemSchema, AuctionRankingSchema (Zod)
- **`services/auctionService.ts`**: getItems(필터·페이징), getItemDetail(시세비교·인프라 join 포함), getRegionDetail(시군구 집계), getCityDetail, getHubSummary, getRanking, getSitemapEntries. `serializeRow`(BigInt→Number).
- **`routes/auction.ts`**: `/api/auction/items`, `/item/:cltrMngNo`, `/regions`, `/region`, `/city`, `/hub-summary`, `/ranking`, `/sitemap`. `asyncHandler` + `validate`. `app.ts`에 `/api/auction` 마운트.
- 모든 지역 필터: `buildRegionFilter()` (서울/서울특별시 변형 흡수).

---

## 10. 프론트엔드 구성

- **`types/auction.ts`**: AuctionItem, AuctionItemDetail, AuctionRegionSummary, AuctionListResult, AuctionRanking, USAGE_GROUPS, 표시 헬퍼(formatWon→억/만원, formatBidRate, formatDiscountRate, formatAuctionDate, statusLabel)
- **`composables/useAuction.ts`**: getItems, getItemDetail, getRegionDetail, getCityDetail, getHubSummary, getRanking
- **`utils/auctionMeta.ts`**: AUCTION_META, buildItemTitle/Description, buildRegionTitle/Description, AUCTION_FAQ (landMeta 패턴)
- **컴포넌트**: `components/auction/AuctionCard.vue`, `AuctionFilters.vue`, `AuctionMap.vue`(지도+로드뷰), `AuctionPriceCompare.vue`(시세비교), `AuctionNearbyFacilities.vue`, `AuctionStatusBadge.vue`, `AuctionBidHistory.vue`, `AuctionRankingTable.vue`
- **페이지**: `pages/auction/{index, list, ranking, [city]/index, [city]/[district]/index, item/[cltrMngNo]}.vue`
- **`composables/useKakaoMap`**: 로드뷰(Roadview/RoadviewClient) 지원 확장 (좌표→panoId, 없으면 fallback)

---

## 11. 사이트 통합

1. **네비**: `frontend/types/facility.ts` `NAV_LINK_GROUPS`에 독립 "공매" 드롭다운 추가 + 전용 아이콘(`/icons/category/auction-*.webp`, 신규 제작 — SVG→sharp→webp, 기존 세트와 톤 일치)
2. **허브/카피**: 부동산 허브·about·terms·seoConstants 등에 공매 언급 추가(사용자 결정형 — 토지처럼)
3. **사이트맵**: `getSitemapEntries`(색인 물건/집계만) → 기존 sitemap 라우트 연결
4. **CI cron**: `.github/workflows/sync-real-estate.yml` 루프에 `syncAuction` 추가 + kill_sync_zombies allowlist에 `*dist/scripts/syncAuction*`
5. **광고**: 신규 페이지 AdBanner 배치(개수/위치는 사용자 정책)

---

## 12. 테스트

- 백엔드: computeAuctionSummary(낙찰가율/품질게이트), transformAuctionItem(파싱/usageGroup/단위), 마감포착 전이 로직, serializeRow, 라우트 통합테스트 (vitest, prisma mock)
- 프론트: useAuction, auctionMeta, AuctionCard/StatusBadge/Map, item 상세 페이지(noindex 게이트, 시세비교 join), 리스트 필터
- 모두 통과 + lint 0 errors (커밋 전 vitest run 필수)

---

## 13. 제약 & 리스크

- **데이터 0부터 누적**: 런칭 직후 낙찰 통계 부실 → 진행중 콘텐츠로 커버, 집계는 품질게이트로 noindex. 수개월 후 본격화.
- **API 1,000건/일**: 운영계정 전환·활용사례 등록 선행. 미전환 시 전국 1회 스냅샷도 초과 위험.
- **소재지 파싱 정확도**: 비정형 주소 → bjdCode 매핑 실패 가능. 실패분은 집계 제외 + 로깅.
- **로드뷰 부재**: 좌표 없거나 로드뷰 미지원 위치 → 지도만/생략 fallback.
- **금액 단위(원)**: 실거래가(만원)와 혼동 금지. 전용 헬퍼로 격리.
- **마감 포착 누락**: API에서 갑자기 사라진 물건은 상세 호출로 결과 확인. 상세도 실패하면 status=closed(결과미상)로 보존, 재시도.

---

## 14. 파일 체크리스트 (구현 시 생성/수정)

**백엔드**
- 생성: `prisma/schema.prisma`(모델2), `scripts/syncAuction.ts`, `services/auctionService.ts`, `routes/auction.ts`, `schemas/auction.ts`
- 수정: `app.ts`(라우트 마운트)

**프론트엔드**
- 생성: `types/auction.ts`, `composables/useAuction.ts`, `utils/auctionMeta.ts`, `components/auction/*`, `pages/auction/*`, `public/icons/category/auction-*.webp`
- 수정: `types/facility.ts`(네비), `composables/useKakaoMap`(로드뷰), 허브/카피 파일들, 사이트맵 서버 라우트

**운영**
- 수정: `.github/workflows/sync-real-estate.yml`

---

## 15. 후속 (Future)

- 입찰가 시뮬레이터/낙찰가율 계산기 (부가⑦)
- 관심물건 저장·알림 (부가⑧, 로그인 인프라)
- 공매 가이드 본문 작성 (골격→완성)
- 국유재산 매각현황 등 추가 API
