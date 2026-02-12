# ADR-001: 카테고리별 개별 테이블 사용

## Status

승인됨 (Accepted)

## Context

일상킷 프로젝트는 다양한 공공시설 정보(화장실, 와이파이, 의류수거함, 무인민원발급기, 주차장, AED, 도서관)를 통합 검색하는 서비스입니다.

### 초기 설계

초기 계획(`docs_backup/planning/04-database-design.md`)에서는 단일 `Facility` 테이블을 사용하고 카테고리별 특수 필드를 JSON 컬럼(`details`)에 저장하는 방식을 고려했습니다:

```prisma
model Facility {
  id        String   @id
  category  ENUM     // toilet, wifi, clothes, kiosk, ...
  name      String
  address   String?
  lat       Decimal?
  lng       Decimal?
  city      String
  district  String
  details   Json?    // 카테고리별 특수 필드
  // ... 공통 필드
}
```

**단일 테이블 접근 방식의 장점:**
- 단순한 스키마 구조
- 전체 카테고리 통합 검색 용이
- 테이블 수 최소화

**단일 테이블 접근 방식의 단점:**
- 타입 안전성 부족 (JSON 필드는 런타임에만 검증 가능)
- 카테고리별 인덱스 최적화 불가
- 카테고리별 고유 필드 차이가 크면 NULL 컬럼 과다 발생
- 쿼리 성능 저하 (모든 카테고리가 하나의 테이블에 혼재)

### 실제 요구사항 분석

각 카테고리별 고유 필드를 분석한 결과, 필드 구조가 상당히 이질적임을 확인:

| 카테고리 | 고유 필드 수 | 주요 고유 필드 예시 |
|----------|-------------|-------------------|
| Toilet | 7개 | maleToilets, femaleToilets, hasDisabledToilet |
| Wifi | 6개 | ssid, serviceProvider, installDate |
| Clothes | 4개 | managementAgency, phoneNumber, detailLocation |
| Kiosk | 10개 | blindKeypad, voiceGuide, availableDocuments(JSON) |
| Parking | 14개 | capacity, baseFee, baseTime, dailyMaxFee |
| Aed | 21개 | monSttTme~sunEndTme (요일별 운영시간) |
| Library | 18개 | bookCount, seatCount, loanableBooks |

**문제점:**
- 단일 테이블로 구현 시 총 80+ 컬럼 필요 (대부분 NULL)
- 각 카테고리별 쿼리 패턴이 상이 (예: Parking은 요금 검색, Aed는 운영시간 검색)
- 타입스크립트 타입 정의가 복잡해짐 (조건부 타입 필요)

## Decision

**카테고리별 개별 테이블을 사용하기로 결정했습니다.**

실제 구현된 스키마 구조:

```prisma
// 7개 독립 테이블
model Toilet { /* 공통 필드 + 화장실 전용 필드 */ }
model Wifi { /* 공통 필드 + 와이파이 전용 필드 */ }
model Clothes { /* 공통 필드 + 의류수거함 전용 필드 */ }
model Kiosk { /* 공통 필드 + 키오스크 전용 필드 */ }
model Parking { /* 공통 필드 + 주차장 전용 필드 */ }
model Aed { /* 공통 필드 + AED 전용 필드 */ }
model Library { /* 공통 필드 + 도서관 전용 필드 */ }
```

**공통 필드 (모든 테이블에 반복):**
```prisma
id            String   @id @db.VarChar(50)
name          String   @db.VarChar(200)
address       String?  @db.VarChar(500)
roadAddress   String?  @db.VarChar(500)
lat           Decimal? @db.Decimal(10, 7)
lng           Decimal? @db.Decimal(10, 7)
city          String   @db.VarChar(50)
district      String   @db.VarChar(50)
bjdCode       String?  @db.VarChar(5)
sourceId      String   @unique @db.VarChar(100)
sourceUrl     String?  @db.VarChar(500)
viewCount     Int      @default(0)
createdAt     DateTime @default(now())
updatedAt     DateTime @updatedAt
syncedAt      DateTime @default(now())

@@index([city, district])
@@index([lat, lng])
```

**서비스 계층 추상화:**

공통 로직은 Category Registry 패턴으로 추상화 (`backend/src/services/facilityService.ts`):

```typescript
const CATEGORY_REGISTRY: Record<FacilityCategory, CategoryConfig> = {
  toilet: {
    model: () => prisma.toilet,
    detailFields: ['operatingHours', 'maleToilets', ...],
  },
  wifi: {
    model: () => prisma.wifi,
    detailFields: ['ssid', 'installDate', ...],
  },
  // ... 다른 카테고리
};

// 통합 검색 시 카테고리별 병렬 쿼리
const fetchResults = await Promise.all(
  categories.map(async (cat) => {
    const records = await CATEGORY_REGISTRY[cat].model().findMany({ where });
    return records.map((r) => toFacilityItem(r, cat));
  })
);
```

## Consequences

### 긍정적 결과 (Positive)

1. **타입 안전성 강화**
   - Prisma가 각 테이블별 정확한 타입 생성
   - 컴파일 타임에 필드 존재 여부 검증
   - TypeScript 자동완성 지원

2. **쿼리 성능 최적화**
   - 카테고리별 인덱스 최적화 가능 (예: Kiosk의 `mngNo` 인덱스)
   - 불필요한 NULL 체크 제거
   - 테이블당 레코드 수 감소로 쿼리 속도 향상

3. **스키마 명확성**
   - 각 카테고리의 비즈니스 로직이 명확히 드러남
   - 새로운 개발자가 스키마 이해 용이
   - 데이터 무결성 검증 강화

4. **유지보수성 향상**
   - 특정 카테고리 스키마 변경 시 다른 카테고리 영향 없음
   - 카테고리별 마이그레이션 독립 수행 가능
   - 특정 카테고리만 롤백 가능

### 부정적 결과 (Negative)

1. **테이블 수 증가**
   - 7개 카테고리 = 7개 테이블
   - 새 카테고리 추가 시 테이블 + 마이그레이션 필요
   - 스키마 파일 크기 증가 (현재 345줄)

2. **공통 로직 중복 가능성**
   - 공통 필드가 각 테이블에 반복됨
   - 동기화 스크립트가 카테고리별로 필요 (`syncToilet.ts`, `syncWifi.ts`, ...)
   - 완화 방법: Category Registry 패턴으로 서비스 계층 추상화

3. **전체 카테고리 통합 검색 복잡도**
   - 7개 테이블을 병렬 쿼리 후 메모리 병합 필요
   - 완화 방법: Promise.all() + 카테고리별 카운트 기반 최적화 적용

4. **페이지네이션 복잡도**
   - 전체 검색 시 카테고리별 skip/take 계산 필요
   - 구현됨: `facilityService.search()`에서 카운트 기반 페이징 로직

### 채택한 완화 전략

1. **Category Registry 패턴**
   - 서비스 계층에서 단일 인터페이스 제공
   - 라우터에서는 카테고리 차이 인지 불필요

2. **공통 타입 정의**
   - `BASE_SELECT_FIELDS` 상수로 공통 필드 관리
   - `FacilityItem`, `FacilityDetail` 공통 응답 타입

3. **병렬 쿼리 최적화**
   - Promise.all()로 카테고리별 동시 조회
   - 카운트 기반 페이징으로 불필요한 fetch 제거

## Related Decisions

- ADR-002: SSR/ISR 하이브리드 전략 (페이지별 렌더링 전략)

## References

- 원본 계획: `docs_backup/planning/04-database-design.md`
- 구현된 스키마: `backend/prisma/schema.prisma`
- 서비스 계층 구현: `backend/src/services/facilityService.ts`
- Category Registry 패턴: Martin Fowler - Registry Pattern
