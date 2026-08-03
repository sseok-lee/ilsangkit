# 행정구역 개편 채택 — 전남광주통합특별시 정규화 설계

**작성일**: 2026-07-20 (개정: 방향 전환·범위 확대) · **재검증**: 2026-07-21 (전 대상 테이블 운영 DB 재실측 + UX=Flat 확정)
**상태**: 승인 대기 → 플랜
**선행 완료**: 2026 개편 6월 실거래 이중저장 정리 (`project_reform_june_duplicate_cleanup`)

## 방향 요약 (중요 — 기존 설계에서 반전됨)

당초 "광주/전남으로 분리 복원(부동산만)"으로 잡았으나, **정부 원천이 전남광주통합특별시로 완전 전환**됐음을 ground-truth로 확인하고 **"정부 개편 전면 채택"**으로 방향을 바꿈:

- **city** → `전남광주통합특별시`, **bjdCode** → `12xxx` (전 테이블 통일)
- **citySlug** → `jeonnamgwangju` (단일 slug), 27개 구·시군 flat (이름 충돌 없음)
- **주소 공식화** + **건물 이력 병합** + **코드12 특수처리 제거**
- **범위 = 시스템 전반** (부동산 + 시설 + 공매), 부동산만 아님

## Ground-truth (2026-07-20 실 API 검증)

| 원천 | 확인 결과 |
|---|---|
| **법정동코드 API**(StanReginCd, city명 원천) | `전남광주통합특별시`+`region_cd 12`, 시행일 `20260701`, 하위 3,204건. **옛명 `광주광역시`=데이터없음(INFO-3, 소멸)** |
| **부동산 실거래 API**(국토부 RTMSDataSvcAptTrade) | 신코드 `LAWD_CD=12240`=172건, **옛코드 `29140`=0건(폐기)**. city명 미포함 → 우리 Region에서 파생 |
| **시설 API/CSV** | **소스별 개편 반영 타임라인 상이.** 반영됨: Wifi·Sports·Childcare·School·WasteSchedule. 아직 옛명칭: Aed·EvCharger·Toilet·Park·Parking·Clothes·Library·Market·Subway (7/20 재sync에도 옛명) |

**결론**: 옛 코드·명칭은 원천에서 죽었고 갱신 안 됨. 전남광주통합특별시 채택이 유일하게 지속가능. 부수: 현재 Region에 옛코드(29/46) 잔존 → 부동산 sync가 매 실행 죽은 코드로 헛질의(0건).

## 데이터 실태 (운영 DB **2026-07-21 전면 재실측** — 시설 복구·재sync·toilet 역병합 이후)

정규화 목표값 = `전남광주통합특별시`(city) + `12xxx`(bjdCode, 있는 테이블). 유입/저장된 변종:

| 변종 | 출처 예 (현재 실측) | 처리 |
|---|---|---|
| `전남광주통합특별시` | 정상(신) — 부동산 code12·EvCharger 32,493·Wifi 9,546 등 | 목표값(유지) |
| `전남광주` | Hospital 4,947 (sync 잘림 버그, 잔존) | → 전남광주통합특별시 |
| `광주` / `전남` | 다수 시설·부동산 옛 단축명 (Wifi 광주2,921+전남8,814, OffitelRent 광주12,895+전남7,921 등) | → 전남광주통합특별시 |
| `광주광역시` / `전라남도` | Aed 2,174/4,123·Toilet 33/139·WasteSchedule 10/308·AuctionItem | → 전남광주통합특별시 |
| `광주시` | EvCharger 15 (오타, 잔존) | → 전남광주통합특별시 |
| `전남광주통합특별시영광군`·`전남광주통합특별시해남군` | **Toilet 3 (NEW — 우리 normalizeCityName prefix치환 + parseAddress 실패로 city에 district 혼입)** | → city=전남광주통합특별시 + district 분리 교정 |

**부동산 이관 물량(2026-07-21) ≈ 304k행**: bjdCode 29/46 = AptRent 171,201·AptSale 94,495·VillaRent 6,679·VillaSale 4,179·LandSale 3,876 (≈280k) + **Offitel은 bjdCode 없음** → city명으로만(Rent 광주12,895+전남7,921·Sale 광주1,417+전남1,437 ≈23.7k). 시설 광주/전남 ≈ 4만 행.

### ⚠️ 이번 재실측에서 확정된 범위 경계 (중요)

1. **city 정규화 ≠ dedup**: Wifi·Sports·Childcare·School·EvCharger·Toilet·AuctionItem 등이 **옛명 행 + 신명 행 공존**(개편으로 sourceId 해시가 바뀌어 물리적 동일 대상이 2행). city 이름만 통일하면 **지역 필터/URL은 정상화되나 중복 상세페이지는 남음**. → **facility/거래 dedup은 이 스펙 범위 밖**(별도 후속, toilet 역병합 패턴 재사용). 본 스펙은 **city/bjdCode 정규화 + slug/URL 이관**까지.
2. **bjdCode 없는 테이블**(OffitelSale/Rent·LandAreaSummary·SubwayStation·WasteSchedule): bjdCode 정규화 불가 → **city 이름 매핑만**. district는 기존 값 유지.
3. **파생 summary**(RealEstateBuildingSummary·AuctionAreaSummary·LandAreaSummary): 직접 UPDATE 아닌 **base 정규화 후 refreshSummary 재생성**으로 통일(옛코드 자연 소멸).
4. **AuctionItem**: bjdCode-null 스냅샷 행(광주광역시78·전남광주통합1,862·전라남도67)과 bjdCode 행(12/29/46) 공존 — city 정규화는 포함, **코드 이중(29/46/12) 중복 제거는 별개**(공매 스냅샷 특성).

### UX 결정 (2026-07-21 확정)

**Flat 단일** — 전남광주통합특별시 아래 27개 시군구를 평평하게. canonical·URL·UI 전부 통합, 정부 개편과 100% 일치. **(구)광주/(구)전남 UI 서브그룹핑 안 함** (non-goal에서 제거).

## Scope: 시스템 전반

**대상**: 부동산 7테이블 + Region + 시설 15테이블(Aed·Childcare·Clothes·EvCharger·Hospital·Library·Market·Park·Parking·Pharmacy·School·Sports·Subway·Toilet·Wifi) + WasteSchedule + AuctionItem.
**제외**: Subscription(청약 — 광주/전남 데이터 없음). SubwayStation은 20행뿐이나 포함.

## 방향의 기술적 근거

전남광주통합특별시 아래 27개 구·시군은 **이름 충돌 없음**(광주 5구 동/서/남/북/광산 vs 전남 22시군 목포/여수/…). → `전남광주통합특별시 → 27 district` flat 구조가 모호함 없이 성립 → citySlug=`jeonnamgwangju` 단일로 district 직결, 코드12 분리(GWANGJU_GU_BJD) **불필요**.

## 컴포넌트

### 1. 데이터 정규화 (프로덕션, 청크 UPDATE)

`backend/src/scripts/adoptRegionReform.ts` (dry-run 기본 + `--apply`).

- **변종 매핑 테이블**: `광주/광주광역시/광주시` + district∈광주5구 → `전남광주통합특별시`; `전남/전라남도` + district∈전남22시군 → `전남광주통합특별시`. `전남광주`(잘림)·`전라남도영광군`(혼입)은 정규식/명시 매핑으로 교정. district는 표준 27개로 정규화.
- **부동산 7테이블**: 옛코드(29/46) → `bjdCode 매핑 12xxx`(Region slug 조인, 27쌍) + `city=전남광주통합특별시`; code-12 행은 이미 정상.
- **시설 15 + waste + auction**: `city → 전남광주통합특별시` (bjdCode 있으면 12xxx 정규화; 없으면 city만).
- **Region**: 옛(29/46) 27행 삭제 → 신(12xxx) 27행 유지, `city=전남광주통합특별시`. @@unique 회피 위해 삭제 선행.
- **백업**: 대상 행(id·city·bjdCode·sourceId) `_reform_bak2_*` + 파일 덤프.
- **청크+statement timeout** 필수(좀비 트랜잭션/버퍼풀 차단 이력).

### 2. Sync-side 정규화 (재드리프트 방지 — 필수)

옛명칭을 계속 주는 소스(Aed·Toilet·Park·Parking·EvCharger·Clothes·Library·Market·Subway)가 다음 sync 때 옛명 재유입 → 정규화 무력화. 방지:

- **공통 정규화 유틸** `normalizeRegionName(city, district)` 신설 → 위 변종 매핑을 단일 소스로. ⚠️ **기존 `normalizeCityName`(toilet 복구 때 도입)이 이미 부분 동작하나 buggy** — `전라남도영광군` 같은 city+district 혼입 입력에 prefix만 치환해 `전남광주통합특별시영광군` 생성(NEW 변종 원인). 신 유틸은 이 case를 **city=전남광주통합특별시 + district 분리**로 교정하고 기존 normalizeCityName을 대체·흡수해야 함.
- 각 **시설 sync transform에 삽입**(city 저장 직전). 부동산은 Region에서 city 파생하므로 **Region만 정규화되면 자동 통일 — 부동산 sync 코드 무변**.
- Region sync: 옛코드(29/46) 재생성 안 하도록(법정동코드 API가 이미 12만 반환하므로 자연 소멸, 가드만 확인).

### 3. 코드 — slug/URL 이관 (jeonnamgwangju)

- `cityMapping.ts`: `CITY_SLUG_TO_FULL/SHORT`에 `jeonnamgwangju: 전남광주통합특별시` 추가, `gwangju`/`jeonnam` 제거. `resolveCitySlug` → 순수 name-based(전남광주통합특별시→jeonnamgwangju), **GWANGJU_GU_BJD·코드12 분기 삭제**. `buildRegionFilter` variant 특수처리 삭제(더는 불필요).
- `realEstateUrl.ts`(백+프론트) `toCitySlugByDistrict`: 코드12 특수처리 삭제 → name-based.
- **프론트 slug 3중맵**: gwangju/jeonnam → jeonnamgwangju.
- `localMarketService`·`hotspotService`: resolveCitySlug 단순화 반영, 주석 정정("10자"→5자).

### 4. 301 리다이렉트 + 사이트맵 재색인

- 서버 미들웨어: `/gwangju/**`·`/jeonnam/**` → `/jeonnamgwangju/**` (시설 지역 + 부동산 URL 전부). 301.
- 사이트맵 재생성(jeonnamgwangju slug) → GSC/네이버 재제출 → 재색인 모니터링.

### 5. 집계 재생성

`refreshRealEstateSummary` 1회(건물이력 12xxx 병합 반영).

## 실행 순서 (expand-migrate-contract, 안전)

1. **Expand**: 코드가 신·구 형태 **둘 다** 처리하도록 배포(전남광주통합특별시→jeonnamgwangju 신규 처리 + 기존 광주/전남 레거시 병행). 301은 이후.
2. **Migrate**: 프로덕션 데이터 정규화 실행 + 검증 + refreshSummary.
3. **Contract**: 레거시 gwangju/jeonnam 처리 제거 + 301 활성 + 사이트맵 재제출.
4. sync-side 정규화는 1단계에 포함(이후 유입 즉시 정규화).

*플랜에서 이 순서를 PR 단위로 분해. URL 전환(3단계)이 SEO 민감 지점 — 별도 검증 게이트.*

## 검증

- **데이터**: 전 대상 테이블에 옛 변종(광주/전남/광주광역시/전라남도/전남광주/광주시/전라남도영광군) **0**, 부동산 29/46 bjdCode **0**, Region 27행 정규화.
- **건물 이력**: 개편 걸친 광주 아파트 상세가 ≤5월+6월↑ 전체 표시.
- **URL/301**: `/gwangju/**`·`/jeonnam/**` → `/jeonnamgwangju/**` 301, 신 URL 200+데이터.
- **재드리프트**: 정규화 후 시설 1회 재sync → 옛명 재유입 0(sync-side 정규화 동작).
- **CI**: cityMapping/realEstateUrl 테스트 갱신 green.
- **재색인**: 사이트맵 jeonnamgwangju 반영, GSC/네이버 제출 후 색인 추적.

## 롤백

- 데이터: `_reform_bak2_*`에서 city·bjdCode 복원.
- 코드: PR revert. 301은 미들웨어 토글.

## 리스크

- **SEO/URL 이관**: 광주/전남 전 URL(시설+부동산) 변경 → 301 누락 시 색인 손실. #576~#579(광주/전남 별개 유지) 결정 반전이므로 재색인 수 주 + 일시 순위 변동. **최대 리스크 — expand-migrate-contract + 301 전수 + 사이트맵 재제출로 관리.**
- **UPDATE 물량 ~318k(부동산)+시설 수만** → 청크+timeout 필수.
- **sync-side 정규화 누락 시 재드리프트** → 공통 유틸 + 전 시설 sync 적용 + 재sync 검증.
- **변종 교정 정확도**(전남광주/전라남도영광군 등 malformed) → 매핑 dry-run으로 잔여 0 확인 후 apply.

## 비목표

- Subscription(청약) — 광주/전남 데이터 없음.
- 공매 코드12/29/46 이중 별도 진단(스냅샷) — city 정규화는 포함하되 중복 제거는 별개.
- 홈 개편(feat/home-realestate-market-redesign) — 별개 브랜치, 이후 재개.
- **UX 서브그룹핑 = 채택 안 함(2026-07-21 결정): Flat 단일**. (구)광주5구/(구)전남22시군 시각 구분 없이 27개 시군구 평평하게.
- **facility/거래 dedup**(개편으로 옛명 행+신명 행 공존하는 중복 상세페이지 제거) — 본 스펙은 city/bjdCode 정규화까지, dedup은 별도 후속(toilet 역병합 패턴 재사용).

## 규모 참고 (분해 가능성)

시스템 전반이라 큼. 플랜에서 (A) 데이터 정규화+sync-side, (B) slug/URL 코드, (C) 301+재색인 3묶음으로 PR 분해 권장. 단 expand-migrate-contract 순서 준수.
