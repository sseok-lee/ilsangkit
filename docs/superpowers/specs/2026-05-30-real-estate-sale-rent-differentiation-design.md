# 부동산 매매/전월세 상세 페이지 차별화 (Phase 2) — 설계

- 날짜: 2026-05-30
- 목적: GSC "중복 페이지, Google이 사용자와 다른 표준 선택" 4,303건 해소
- 상위 계획: `docs/seo-real-estate-indexing-plan.md` (Phase 2)
- 선행: PR #366 (getBuildingInfo bjdCode 힌트화, merged)

## 1. 문제

같은 건물의 매매(`/real-estate/{prop}-sale/...`)·전월세(`/real-estate/{prop}-rent/...`) 상세 페이지가
**보이는 텍스트 골격이 100% 동일**하다(eyebrow "{아파트} 실거래가", H1=건물명만, 상단 카드 라벨,
섹션 제목 "시세 추이"/"거래 내역"). 값만 다르고 골격이 같아 Google이 near-duplicate로 보고
표준을 임의 선택 → "중복-다른 표준" 4,303건.

데이터·차트 로직은 이미 모드별로 동작한다(`PriceTrendChart` priceLabel = 매매가/보증금/환산보증금,
`TransactionModeTab`, `RentTypeToggle`, `AreaSelector` 모두 존재). 즉 문제는 **콘텐츠가 아니라
"보이는 구분 텍스트"의 부재**다.

## 2. 목표 / 비목표

**목표**
- 매매 vs 전월세 페이지의 H1·eyebrow·상단 카드·섹션 제목을 모드별로 구분.
- 전월세 페이지에 고유 지표 **"전·월세 거래 비중"** 1개 추가.
- 두 페이지 모두 색인 유지(self-canonical 그대로). 검색 의도(매매가 vs 전세/월세)가 다른 별개 수요.

**비목표 (이번 범위 제외)**
- 전세가율(매매 대비 전세) — 매매↔전세 데이터 조인 필요, 범위 초과.
- 건물 고유 요약 문단(thin content) — Phase 3.
- 사이트맵 priority 티어링 — Phase 1.
- canonical 통합(rent→sale) — 전세/월세 트래픽 손실로 비채택.

## 3. 변경 종류 (3분류)

- 🟩 **신규**: "전·월세 거래 비중" (전월세 전용). 백엔드 카운트 1개 + 프론트 표시 1개.
- 🟨 **라벨/제목 모드화**: eyebrow, H1 배지, 상단 카드 라벨, 섹션 제목. (기존 요소 텍스트만 분기)
- ⬜ **변경 없음**: 차트(`PriceTrendChart`)·평형(`AreaSelector`)·거래내역 표·지도·로드뷰·인근단지·생활시설·가이드·쿠팡.

## 4. 상세 설계

### 4.1 모드 구분 텍스트 (🟨)

`mode = 'sale' | 'rent'` (URL의 `{prop}-{mode}`에서 파생, 이미 `currentTab`으로 존재)

| 위치 | sale | rent |
|------|------|------|
| PageHero eyebrow | `{label} 매매 실거래` | `{label} 전세·월세 시세` |
| H1 배지 | `매매` | `전세·월세` |
| 시세 추이 섹션 제목 | `매매가 추이` | `환산보증금 추이` |
| 평형 섹션 제목 | `평형별 매매 시세` | `평형별 전월세 시세` |

- `{label}` = `PROPERTY_TYPE_META[propertyType].label` (아파트/빌라/오피스텔).
- 라벨 매핑은 순수 함수로 분리해 단위 테스트 가능하게 한다 (아래 4.4).
- `useRealEstateDetailMeta`는 이미 `transactionMode`로 title/description을 분기하므로, eyebrow/H1/섹션 제목만 페이지에서 동일 규칙으로 맞춘다(메타와 화면 문구 일관).

### 4.2 상단 요약 카드 (🟨 + 🟩 1칸)

현재 `heroStats` 4칸: 최근 거래 / 최근 거래일 / 건축년도 / 전용면적 (라벨 양쪽 동일).

| 칸 | sale | rent |
|----|------|------|
| 1 | 최근 매매가 | 최근 거래(전세/월세) |
| 2 | 최근 거래일 | 최근 거래일 |
| 3 | 건축년도 | **전·월세 비중** 🟩 (예: "전세 68%") |
| 4 | 전용면적 | 전용면적 |

- 값은 기존 `buildingInfo`/`summary`에서 가져온다. rent의 3번 칸만 신규 데이터(4.3) 사용.
- sale은 라벨만 "최근 거래"→"최근 매매가"로 명확화(값 동일).

### 4.3 "전·월세 거래 비중" 신규 지표 (🟩)

**정의**: 해당 건물(bjdCode+buildingName)의 rent 거래 중 전세 건수 / 월세 건수 비율.

**백엔드 (최소 변경)** — `getBuildingInfo`에 rent 타입일 때만 **건물 전체 기준** 카운트 추가:
- `jeonseCount: number`, `wolseCount: number` (해당 건물의 rentType='전세' / '월세' 전체 건수).
- **기간/면적 필터와 무관한 건물-레벨 집계** → 상단 hero 카드에 둬도 기간 선택에 반응하지 않고 안정적.
  (period-filtered `getTransactionStats`가 아니라 building-level `getBuildingInfo`에 두는 이유.)
- where = `{ bjdCode, buildingName }` (기존 getBuildingInfo와 동일 scope). sale 타입은 두 필드 생략.
- 응답 타입(`BuildingInfo`)에 옵셔널 필드 추가. 기존 호출부 영향 없음(옵셔널).

**프론트**:
- 상단 카드 3번 칸: 다수 쪽 라벨(`전세 N%` 또는 `월세 N%`).
- "전·월세 거래 비중" 블록: 가로 막대(전세:월세). 데이터 없으면 블록 숨김.
- 위치: 광고 다음, "환산보증금 추이" 위. rent 페이지에서만 렌더(`v-if mode==='rent' && (jeonseCount+wolseCount)>0`).

### 4.4 코드 단위 (격리)

- `frontend/utils/realEstateDetailLabels.ts` (신규, 순수 함수):
  - `getDetailEyebrow(label, mode)`, `getDetailH1Badge(mode)`, `getTrendSectionTitle(mode)`, `getAreaSectionTitle(mode)`.
  - 단위 테스트로 sale/rent 출력 검증.
- `frontend/components/realEstate/RentRatioBar.vue` (신규): props `jeonseCount, wolseCount` → 막대 + 라벨. 합계 0이면 아무것도 렌더 안 함.
- `[buildingName].vue`: 위 유틸/컴포넌트 사용해 eyebrow·H1·heroStats·섹션 제목 분기. (파일이 이미 크므로 로직은 유틸로 빼서 페이지는 호출만)
- 백엔드 `realEstateService.ts` getBuildingInfo: rent일 때 건물-레벨 jeonse/wolse 카운트.
- 타입: `frontend/types/realEstate.ts` `BuildingInfo`에 `jeonseCount?`, `wolseCount?`.

## 5. canonical / 색인

- 변경 없음. 각 type-mode 페이지는 자기 자신 canonical 유지(`useHead`의 기존 로직).
- noindex 정책(`realEstateNoindex`) 변경 없음.
- 사이트맵 변경 없음(URL 그대로).

## 6. 테스트

- `realEstateDetailLabels.test.ts`: 4개 라벨 함수 sale/rent 출력.
- `RentRatioBar.test.ts`: 카운트 → 비율/라벨, 합계 0 → 미렌더.
- 백엔드 `realEstateServiceGetBuildingInfo` 테스트 확장: rent BuildingInfo에 jeonseCount/wolseCount 포함(건물-레벨), sale은 미포함.
- 기존 `realEstateBuildingDetail.test.ts` 등 회귀 통과(heroStats 라벨 변경 반영).
- 백엔드/프론트 vitest run + lint (Node 20).

## 7. 측정

- GSC 페이지 색인 → "중복 페이지, Google이 다른 표준 선택" 버킷 추이(4주 간격). 목표 < 1,000.
- 부수: 매매/전세/월세 검색어 노출 분리 추이(GSC 실적).

## 8. 영향 / 리스크

- 모드별 텍스트 분기만이라 회귀 위험 낮음. 백엔드는 옵셔널 필드 추가라 기존 응답 호환.
- heroStats 라벨 변경으로 기존 detail 테스트 기대값 갱신 필요(스냅샷/문자열).
- 데이터 없는 신축/저거래 건물: 비중 블록 자동 숨김으로 빈 UI 방지.

## 부록: 파일 목록
- 신규: `frontend/utils/realEstateDetailLabels.ts`, `frontend/components/realEstate/RentRatioBar.vue`, 각 테스트.
- 수정: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`, `frontend/composables/useRealEstateDetailMeta.ts`(필요 시 일관화), `frontend/types/realEstate.ts`(BuildingInfo), `backend/src/services/realEstateService.ts`(getBuildingInfo), `backend/__tests__/services/realEstateServiceGetBuildingInfo.test.ts`.
