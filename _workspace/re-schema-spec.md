# Real Estate Schema Spec — StoreSaleTransaction & LandSaleTransaction

**생성일**: 2026-04-10
**입력**: `_workspace/re-expansion-plan.md`
**대상 모델**: `StoreSaleTransaction`, `LandSaleTransaction`
**레퍼런스**: `backend/prisma/schema.prisma:930-968` (`AptSaleTransaction`)

---

## 설계 원칙 요약

- 기존 6개 `*Transaction` 모델의 필드 네이밍·타입 규약을 **그대로 유지** (일관성)
- BigInt: 거래금액은 항상 `BigInt` (`serializeRow()`가 Number 변환 책임)
- Decimal: 면적류는 `@db.Decimal(10,2)` 또는 `(12,2)` (토지는 큰 면적 대비 12,2)
- 모든 필드는 **API 응답에 나타나는 모든 값을 수용** (`feedback_data_collection.md` 원칙)
- `sourceId @unique` 필수 — `syncRealEstateBase.generateSourceId()` 사용
- `syncedAt DateTime @default(now())` — IndexNow 트리거용 (`syncAptSale.ts:177` 패턴)
- 인덱스: 기존 공통 8종 + 모델 고유 1-2종

---

## 1. StoreSaleTransaction (상가·업무용 부동산 매매)

```prisma
model StoreSaleTransaction {
  id               Int      @id @default(autoincrement())
  city             String   @db.VarChar(50)
  district         String   @db.VarChar(50)
  bjdCode          String   @db.VarChar(10)
  dongName         String   @db.VarChar(50)
  buildingName     String   @db.VarChar(200)       // 건물명 (없으면 "{dongName} {jibun}" 합성)
  buildingDong     String?  @db.VarChar(50)        // 동 번호 — 집합건물 "A동" 등 (aptDong 상가판)
  unitNo           String?  @db.VarChar(30)        // 호수 — 집합건물 "101호" 등
  buildYear        Int?
  floor            Int?
  exclusiveArea    Decimal? @db.Decimal(12, 2)     // 전용/계약 면적 (API 명칭에 따라 매핑)
  buildingAr       Decimal? @db.Decimal(12, 2)     // 건물면적 (상가 고유)
  plottageAr       Decimal? @db.Decimal(12, 2)     // 대지면적 (상가 고유)
  buildingUse      String?  @db.VarChar(100)       // 주용도 (제1종근린생활시설, 업무시설 등)
  buildingCls      String?  @db.VarChar(20)        // 부동산 구분 (집합/일반)
  jibun            String?  @db.VarChar(20)
  roadName         String?  @db.VarChar(100)
  lat              Decimal? @db.Decimal(10, 7)
  lng              Decimal? @db.Decimal(10, 7)
  dealYear         Int
  dealMonth        Int
  dealDay          Int?
  dealAmount       BigInt                          // 만원 단위
  dealType         String?  @db.VarChar(20)
  cancelDealDay    String?  @db.VarChar(10)
  cancelDealType   String?  @db.VarChar(20)
  buyerType        String?  @db.VarChar(10)
  sellerType       String?  @db.VarChar(10)
  registrationDate String?  @db.VarChar(20)
  sourceId         String   @unique @db.VarChar(100)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  syncedAt         DateTime @default(now())

  @@index([bjdCode, dealYear, dealMonth])
  @@index([bjdCode, buildingName])
  @@index([bjdCode, exclusiveArea])
  @@index([buildingName, bjdCode, dealYear, dealMonth, dealDay])
  @@index([city, district])
  @@index([dealYear, dealMonth])
  @@index([city, district, dealYear, dealMonth])
  @@index([syncedAt])
  @@index([buildingUse])                           // 상가 고유 — 용도별 필터
}
```

### 상가 고유 필드 (vs AptSaleTransaction)

| 필드 | 타입 | 이유 |
|------|------|------|
| `buildingAr` | `Decimal?(12,2)` | API 응답 "건물면적" 보존 (`feedback_data_collection.md`) |
| `plottageAr` | `Decimal?(12,2)` | API 응답 "대지면적" 보존 |
| `buildingUse` | `String?(100)` | 주용도 — 사용자 필터링 핵심 축 |
| `buildingCls` | `String?(20)` | 집합/일반 구분 |
| `buildingDong` | `String?(50)` | 집합건물 동 번호 ("A동" 등) — aptDong의 상가판 |
| `unitNo` | `String?(30)` | 호수 ("101호") — 집합건물 개별 호실 검색·표시 |

### 제거 필드 (vs AptSaleTransaction)

- `aptDong` 제거 → `buildingDong`으로 일반화

---

## 2. LandSaleTransaction (토지 매매)

```prisma
model LandSaleTransaction {
  id               Int      @id @default(autoincrement())
  city             String   @db.VarChar(50)
  district         String   @db.VarChar(50)
  bjdCode          String   @db.VarChar(10)
  dongName         String   @db.VarChar(50)
  buildingName     String   @db.VarChar(200)       // "{dongName} {jibun}" 합성값 — 기존 라우트 호환
  jibun            String?  @db.VarChar(20)
  roadName         String?  @db.VarChar(100)
  lat              Decimal? @db.Decimal(10, 7)
  lng              Decimal? @db.Decimal(10, 7)
  dealYear         Int
  dealMonth        Int
  dealDay          Int?
  dealAmount       BigInt                          // 만원 단위
  dealArea         Decimal? @db.Decimal(14, 2)     // 거래면적 (㎡) — 토지는 대형 가능, 14자리
  landCategory     String?  @db.VarChar(20)        // 지목 (대/전/답/임야/잡종지/도로 등)
  landUse          String?  @db.VarChar(50)        // 용도지역 (주거/상업/공업/녹지 등)
  shareRatio       String?  @db.VarChar(20)        // 지분 거래 비율 (문자열로 받아 파싱)
  shareType        String?  @db.VarChar(20)        // 지분 구분 (본인/공유)
  dealType         String?  @db.VarChar(20)
  cancelDealDay    String?  @db.VarChar(10)
  cancelDealType   String?  @db.VarChar(20)
  buyerType        String?  @db.VarChar(10)
  sellerType       String?  @db.VarChar(10)
  registrationDate String?  @db.VarChar(20)        // 등기일자
  sourceId         String   @unique @db.VarChar(100)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  syncedAt         DateTime @default(now())

  @@index([bjdCode, dealYear, dealMonth])
  @@index([bjdCode, buildingName])                 // buildingName = 합성값이지만 인덱스 유지 (라우트 조회)
  @@index([city, district])
  @@index([dealYear, dealMonth])
  @@index([city, district, dealYear, dealMonth])
  @@index([syncedAt])
  @@index([landCategory])                          // 토지 고유 — 지목별 필터
  @@index([landUse])                               // 토지 고유 — 용도지역별 필터
}
```

### 토지 고유 필드

| 필드 | 타입 | 이유 |
|------|------|------|
| `dealArea` | `Decimal?(14,2)` | 거래면적(㎡). 토지는 수만 ㎡도 흔해 정밀도 14,2 |
| `landCategory` | `String?(20)` | 지목 — 검색·필터 핵심 |
| `landUse` | `String?(50)` | 용도지역 — 투자자 관심 축 |
| `shareRatio` | `String?(20)` | 지분 거래 비율 (API가 문자열로 주는 경우 대비) |
| `shareType` | `String?(20)` | 지분 구분 (본인/공유) — `shareRatio`와 페어 |
| `registrationDate` | `String?(20)` | 등기일자 (AptSale 동일) |

### 제거 필드 (vs AptSaleTransaction)

- `buildYear`, `floor`, `exclusiveArea`, `aptDong` — **토지에 무관**
- `buildingName`: 의미상 불필요하지만 **기존 라우트 호환 위해 유지**. `syncLandSale.ts`에서 `{dongName} {jibun}` 합성값으로 채움

### buildingName 합성 규칙

```typescript
// syncLandSale.ts
const buildingName = `${dongName} ${jibunStr}`.trim() || '미상';
```

- 빈 `jibun` 대비 fallback: `'미상'`
- 최대 길이: 50 (dongName) + 1 + 20 (jibun) = 71자 → `@db.VarChar(200)` 여유

---

## 3. 마이그레이션 명령

### dev 환경 (권장)

```bash
cd backend
nvm use 20                                         # Node 20 고정 (메모리 주의사항)
npm run db:push                                    # 로컬 MySQL에 즉시 반영
npm run db:generate                                # Prisma Client 재생성
```

### prod 환경 (CI/CD 경유)

```bash
cd backend
npm run db:migrate --name add_store_and_land_sale_transaction
```

- **주의**: `package-lock.json` 절대 삭제 금지. Node 20에서 `npm install` 또는 `npm ci`만 사용

---

## 4. 기존 모델과의 일관성 체크

| 항목 | StoreSale | LandSale | 비고 |
|------|-----------|----------|------|
| `id` PK | ✓ | ✓ | autoincrement |
| `sourceId @unique` | ✓ | ✓ | upsert 키 |
| `dealAmount BigInt` | ✓ | ✓ | serializeRow() 필수 |
| 거래일 분해 (Year/Month/Day) | ✓ | ✓ | |
| 지역 3종 (city/district/bjdCode) | ✓ | ✓ | buildRegionFilter 호환 |
| 좌표 (lat/lng Decimal(10,7)) | ✓ | ✓ | Kakao Map 호환 |
| 취소거래 (cancelDealDay/Type) | ✓ | ✓ | P0 패턴 |
| 매수/매도자 타입 (buyerType/sellerType) | ✓ | ✓ | P2 패턴 |
| `syncedAt` | ✓ | ✓ | IndexNow 트리거 |
| 공통 인덱스 8종 | 7/8 | 5/8 | Land는 `exclusiveArea` 인덱스 제외 |

### Rent 모델 비교는 N/A (둘 다 매매만)

---

## 5. serializeRow() 영향

`backend/src/services/realEstateService.ts`의 `serializeRow()`가 BigInt·Decimal 모든 필드를 자동 Number 변환하는지 확인 필요. 현재 구현이 모델별 분기 없이 **모든 BigInt/Decimal 필드를 일반화 처리**하는지 `re-backend-expander`가 Phase 4에서 검증:

- ✅ 일반화 처리면: 모델 추가만으로 동작
- ❌ 모델별 화이트리스트면: `serializeRow()` 수정 필요

레퍼런스 코드 확인 포인트: `realEstateService.ts`의 `serializeRow` 함수 본문.

---

## 6. 위험 & 주의사항

| # | 항목 | 대응 |
|---|------|------|
| 1 | API 필드명 추정 — 실제 케이스가 다를 수 있음 (`buildingAr` vs `bldgAr`) | 승인 후 `re-backend-expander`가 실 호출 샘플로 transform 함수에서만 매핑 조정. **스키마는 그대로 유지** |
| 2 | `buildingAr` 필드가 응답에 없을 가능성 | nullable로 선언했으므로 무해 |
| 3 | Land의 `buildingName` 중복도 매우 높음 | `bjdCode, buildingName` 인덱스가 과도히 커질 수 있으나 지역별로 분산되므로 허용 |
| 4 | `dealArea`의 최대값 | `Decimal(14,2)` = 최대 999,999,999,999.99 ㎡ — 안전 |
| 5 | `shareRatio`를 String으로 받는 이유 | API가 `"1/2"`, `"0.5"`, `"50%"` 등 변형 가능 — 파싱 이슈 회피 |
| 6 | realEstateSummaryService 확장 | `syncAptSale.ts:192` 의 `refreshSummary('apt-sale')` 패턴을 `'store-sale'`, `'land-sale'`에도 적용 가능한지 `re-backend-expander`가 확인 |

---

## 7. 체크리스트 (schema 단계 완료 조건)

- [x] StoreSaleTransaction 모델 설계
- [x] LandSaleTransaction 모델 설계
- [x] 기존 모델과 필드·인덱스 일관성 확인
- [x] BigInt/Decimal 직렬화 전제 명시
- [x] 마이그레이션 명령 문서화
- [ ] **다음 단계**: schema.prisma 실제 반영 + `db:push` 실행 (backend-expander 책임)
- [ ] **다음 단계**: `serializeRow()` 동작 검증 (backend-expander)

---

## 8. 다음 단계 인수

`re-backend-expander`, `re-frontend-expander` 두 에이전트에게 이 문서를 입력으로 전달. 둘 다 **승인 대기 상태를 전제**로 골격 작업 수행:

- 백엔드: schema.prisma 반영 → `db:push` → service 레지스트리 등록 → enum 추가 → sync 스크립트 골격 (`API_ENDPOINT`만 TODO) → transform 함수는 추정 필드명으로 작성
- 프론트: 타입 확장 → 메타 엔트리 → `RealEstatePropertyType` guard → rent 탭 조건부 숨김
