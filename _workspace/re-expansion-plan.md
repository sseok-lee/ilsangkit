# Real Estate Expansion Plan — 상가(Commercial) & 토지(Land)

**생성일**: 2026-04-10
**요청**: 상가, 토지 거래 카테고리 추가

---

## 1. 제안 slug

| 제안 slug | 한글명 | 거래 유형 | 비고 |
|-----------|--------|----------|------|
| `store-sale` | 상가(상업·업무용) 매매 | 매매 | ✅ 권장 |
| `land-sale`  | 토지 매매 | 매매 | ✅ 권장 |
| ~~`store-rent`~~ | 상가 전월세 | 전월세 | ⚠️ **보류** — 공공 API 미확인 |

### 규약 체크
| 항목 | store-sale | land-sale |
|------|-----------|-----------|
| 하이픈 케이스 | ✓ | ✓ |
| 기존 slug 충돌 | ✗ (없음) | ✗ (없음) |
| `offitel` 규약 적용 | N/A | N/A |
| `-sale` 접미사 | ✓ | ✓ |

### 기존 slug (충돌 검사 완료)
`backend/src/schemas/realEstate.ts:6-13` + `frontend/types/realEstate.ts:5`:
```
apt-sale, apt-rent, villa-sale, villa-rent, offitel-sale, offitel-rent
```
→ `store-sale`, `land-sale` 신규 추가 가능.

### 명명 선택 이유
- `store-sale`: 사용자 요청("상가")을 그대로 반영. 실제 API는 **상업·업무용 부동산** 전체(상가·오피스·창고 등)를 포함하므로 내부 `use` 필드로 세분화 가능.
  - 대안: `commercial-sale` — 더 정확하지만 사용자 표현과 거리감
  - **권장: `store-sale`**. 사용자 친화성 우선
- `land-sale`: 자연스러움, 기존 규약 준수

### 상가 임대 보류 사유
국토교통부 실거래가 공공 API(`RTMSDataSvc*` 시리즈)에서 **상업·업무용 부동산의 임대차 데이터가 공식 제공되지 않는 것으로 추정**됩니다(주거용만 전월세 신고 의무화 초기 단계). 필요 시 사용자가 API 존재 여부 확인 후 2차 확장으로 진행 권장.

---

## 2. 데이터 소스 후보

> ⚠️ **중요**: 아래 엔드포인트명은 공공데이터포털의 일반적 `getRTMSDataSvc*` 시리즈 네이밍 컨벤션과 문서 기반 추정입니다. **실 API 호출 전 반드시 사용자가 공공데이터포털에서 서비스명·엔드포인트를 확인**해야 합니다.

### 2-1. store-sale (상업·업무용 부동산 매매)

- **추정 서비스**: 국토교통부 상업업무용부동산 매매 신고 자료
- **엔드포인트 후보**:
  - `RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade` (Non-residential General, 가장 유력)
  - 또는 `RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade` (일부 문서에서 상가 표기 — Shop/House 혼동 주의)
- **필수 파라미터**: `serviceKey`, `LAWD_CD` (법정동코드 5자리), `DEAL_YMD` (YYYYMM)
- **예상 XML 응답 필드** (기존 aptSale 패턴 + 상업용 고유 필드):

| XML 필드 (추정) | 설명 | 타입 |
|----------------|------|------|
| `sggCd` | 시군구 코드 | String |
| `umdNm` | 법정동명 | String |
| `jibun` | 지번 | String |
| `dealYear` | 거래년도 | Int |
| `dealMonth` | 거래월 | Int |
| `dealDay` | 거래일 | Int |
| `dealAmount` | 거래금액(만원) | BigInt |
| `buildYear` | 건축연도 | Int |
| `buildingAr` | **건물면적(㎡)** | Decimal |
| `plottageAr` | **대지면적(㎡)** | Decimal |
| `buildingUse` | **주용도** (제1종근린생활, 업무시설 등) | String |
| `buildingCls` | **부동산구분** (집합/일반) | String |
| `floor` | 층 | Int |
| `cdealDay` | 취소거래일 | String |
| `cdealType` | 취소거래구분 | String |

### 2-2. land-sale (토지 매매)

- **추정 서비스**: 국토교통부 토지 매매 신고 자료
- **엔드포인트 후보**: `RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade`
- **필수 파라미터**: 동일 (`serviceKey`, `LAWD_CD`, `DEAL_YMD`)
- **예상 XML 응답 필드**:

| XML 필드 (추정) | 설명 | 타입 |
|----------------|------|------|
| `sggCd` | 시군구 코드 | String |
| `umdNm` | 법정동명 | String |
| `jibun` | 지번 | String |
| `dealYear` | 거래년도 | Int |
| `dealMonth` | 거래월 | Int |
| `dealDay` | 거래일 | Int |
| `dealAmount` | 거래금액(만원) | BigInt |
| `landCategory` | **지목** (대,전,답,임야 등) | String |
| `landUse` | **용도지역** (주거/상업/공업 등) | String |
| `dealArea` | **거래면적(㎡)** | Decimal |
| `shareRatio` | **지분거래 비율** | Decimal/String |
| `cdealDay` | 취소거래일 | String |
| `cdealType` | 취소거래구분 | String |

> 🔍 **액션 아이템**: 사용자 또는 verifier가 `OPENAPI_SERVICE_KEY`로 소량 실 호출(예: `LAWD_CD=11680`, `DEAL_YMD=202503`)해서 실제 필드명·케이스(camelCase vs PascalCase) 확정 필요.

---

## 3. 레퍼런스 sync 스크립트

| 신규 slug | 레퍼런스 | 이유 |
|-----------|---------|------|
| `store-sale` | `backend/src/scripts/syncAptSale.ts` | 매매 구조 동일(거래금액 BigInt, dealYear/Month/Day, cancelDeal 처리), building 중심 조회 패턴 재사용 가능. `buildingUse`·`buildingAr` 등 신규 필드만 추가 |
| `land-sale` | `backend/src/scripts/syncAptSale.ts` | 동일 매매 패턴. 단, **buildingName 개념이 없음** → `buildingName` 컬럼을 `{umdNm}-{jibun}` 형태로 합성하거나 nullable로 변경 검토 필요 |

공통 유틸은 `backend/src/services/syncRealEstateBase.ts`의 `fetchRealEstateData`, `generateSourceId`, `getAllLawdCodes`를 동일하게 사용.

---

## 4. 영향 파일 체크리스트

`CLAUDE.md`의 "부동산 카테고리 추가 시 수정 필요 파일" 6개 항목:

### store-sale
- [ ] `backend/prisma/schema.prisma` — **새 모델 `StoreSaleTransaction`** (AptSale 패턴 + `buildingUse`, `buildingAr`, `plottageAr`, `buildingCls` 추가)
- [ ] `backend/src/scripts/syncStoreSale.ts` — 신규 sync (syncAptSale 복제·수정)
- [ ] `backend/src/services/realEstateService.ts` — `getModel('store-sale') → prisma.storeSaleTransaction` 등록, `serializeRow()` 경로 확인
- [ ] `backend/src/schemas/realEstate.ts` — `RealEstateTypeSchema` enum에 `'store-sale'` 추가
- [ ] `frontend/types/realEstate.ts` — `RealEstateType` 유니온 + `RealEstateCategory('storeSale')` + `CATEGORY_TO_SLUG_MAP`/`SLUG_TO_CATEGORY_MAP`/`REAL_ESTATE_CATEGORIES`/`REAL_ESTATE_TYPES` 배열 + **`RealEstatePropertyType` 확장(`'store'`)** 필요
- [ ] `frontend/utils/realEstateMeta.ts` — store-sale 엔트리(title/description/longDescription/faqs)

### land-sale
- [ ] `backend/prisma/schema.prisma` — **새 모델 `LandSaleTransaction`** (AptSale 패턴에서 `buildYear`, `floor`, `aptDong`, `exclusiveArea`, `buildingName` 제거/nullable화, `landCategory`, `landUse`, `dealArea`, `shareRatio` 추가)
- [ ] `backend/src/scripts/syncLandSale.ts` — 신규 sync
- [ ] `backend/src/services/realEstateService.ts` — `getModel('land-sale')` 등록
- [ ] `backend/src/schemas/realEstate.ts` — enum `'land-sale'` 추가
- [ ] `frontend/types/realEstate.ts` — 유니온·매핑·`'land'` property type 추가. **주의: land는 `SaleTransaction` 인터페이스가 부적합** → `LandSaleTransaction` 별도 인터페이스 필요(면적·지목 등)
- [ ] `frontend/utils/realEstateMeta.ts` — land-sale 엔트리

---

## 5. 스키마 설계 주의사항 (schema-architect에게 인계)

### store-sale 모델 초안 필드
```
기존 aptSale 필드 유지: city, district, bjdCode, dongName, buildingName, buildYear, floor, jibun, roadName, lat, lng, dealYear, dealMonth, dealDay, dealAmount(BigInt), dealType, cancelDealDay, cancelDealType, sourceId, createdAt, updatedAt, syncedAt
- aptDong → 제거 (상가 무관)
- buyerType, sellerType → 상업용 API에서 제공 여부 불확실 → 일단 nullable로 유지
+ buildingUse String? @db.VarChar(50)    -- 주용도
+ buildingCls String? @db.VarChar(20)    -- 집합/일반
+ buildingAr Decimal? @db.Decimal(12,2)  -- 건물면적
+ plottageAr Decimal? @db.Decimal(12,2)  -- 대지면적
+ exclusiveArea Decimal? @db.Decimal(10,2) -- 유지 (호환성)
```

### land-sale 모델 초안 필드
```
공통: id, city, district, bjdCode, dongName, jibun, lat, lng, dealYear, dealMonth, dealDay, dealAmount(BigInt), dealType, cancelDealDay, cancelDealType, sourceId, createdAt, updatedAt, syncedAt
- buildYear, floor, exclusiveArea, aptDong, buildingName → **제거 또는 nullable**
  ※ buildingName은 프론트 공통 composable 호환 위해 `{umdNm} {jibun}` 합성값 저장 권장
+ landCategory String? @db.VarChar(20)   -- 지목 (대/전/답/임야/잡종지…)
+ landUse      String? @db.VarChar(50)   -- 용도지역
+ dealArea     Decimal? @db.Decimal(14,2)-- 거래면적
+ shareRatio   String?  @db.VarChar(20)  -- 지분거래 비율 문자열
```

### 인덱스 (기존 동일 패턴)
- `@@index([bjdCode, dealYear, dealMonth])`
- `@@index([city, district])`
- `@@index([dealYear, dealMonth])`
- `@@index([city, district, dealYear, dealMonth])`
- `@@index([syncedAt])`
- land는 `@@index([landCategory])`, store는 `@@index([buildingUse])` 추가 고려

---

## 6. 위험 요소 & 미결 사항

| # | 항목 | 심각도 | 대응 |
|---|------|--------|------|
| 1 | API 엔드포인트명·필드명 미확정 | **높음** | 사용자 또는 planner가 공공데이터포털에서 서비스 ID·레퍼런스 확정 필요 |
| 2 | `store-rent` 보류 | 중 | 공공 API 제공 여부 미확인 — 사용자 확인 필요 |
| 3 | `buildingName` 개념이 없는 land | 중 | 기존 `useRealEstate` composable·페이지 `/real-estate/[propertyType]/[buildingName]` 구조가 building 전제 → land에 적합한지 검토. 필요 시 `[id]`/`[jibun]` 라우트 분기 |
| 4 | `RealEstatePropertyType` 유니온 확장 | 중 | 현재 `'apt' \| 'villa' \| 'offitel'` — `'store'`, `'land'` 추가로 기존 코드 분기점 증가 |
| 5 | 상가의 `exclusiveArea` 해석 | 중 | 기존 주거용과 달리 `buildingAr`/`plottageAr`로 분리. 프론트 표시 일관성 조정 필요 |
| 6 | 토지의 `dealAmount` 단위 확인 | 낮음 | 기존 모든 모델 만원 단위. API 동일 가정 |
| 7 | IndexNow·사이트맵 통합 | 낮음 | `syncAptSale.ts`의 `buildRealEstateUrls('apt', ...)` 패턴이 `'store'`/`'land'` 를 지원하는지 확인 필요 |

---

## 7. 확정된 결정 사항 (2026-04-10)

1. ✅ **slug**: `store-sale`, `land-sale`
2. ✅ **상가 임대**: 공공 API 미제공으로 제외 (`store-rent` 없음)
3. ⏳ **API 엔드포인트**: 사용자가 공공데이터포털에 두 데이터셋 **신청 완료**. 추정 엔드포인트(`RTMSDataSvcNrgTrade`, `RTMSDataSvcLandTrade`)로 선행 작업, 승인 후 실 필드로 마이너 패치
4. ✅ **API 키**: 기존 `OPENAPI_SERVICE_KEY` 재사용 — 환경변수 변경 없음
5. ✅ **land의 `buildingName`**: `{법정동} {지번}` 합성값으로 저장 → 기존 `/real-estate/[propertyType]/[buildingName]` 라우트 호환
6. ✅ **`RealEstatePropertyType` 확장**: `'store'`, `'land'` 추가 + 헬퍼(`propertyTypeToRentSlug` 등)에 sale-only guard 추가. 프론트에서 rent 탭은 조건부 숨김
7. ✅ **진행 모드**: 승인 대기 동안 스키마/백엔드 골격 선행 작업. 승인 후 실 필드명·케이스로 마이너 패치

---

## 8. 다음 단계 (승인 시)

1. `re-schema-architect` → `_workspace/re-schema-spec.md` 작성 (`StoreSaleTransaction`, `LandSaleTransaction` 확정)
2. `re-backend-expander` ‖ `re-frontend-expander` 병렬 실행 (TDD)
3. `re-expansion-verifier` → lint/test/build + 실 API 스모크 sync + SEO/사이트맵 검증

중간 산출물은 모두 `_workspace/` 디렉토리에 누적됩니다.
