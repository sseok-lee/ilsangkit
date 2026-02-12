# 04. 데이터베이스 설계

## 실제 구현 DB 구조

> **Note**: 초기 설계는 통합 `Facility` 테이블을 제안했으나, 실제 구현은 카테고리별 독립 테이블로 정규화됨. 이는 각 카테고리별 고유 필드를 더 효율적으로 관리할 수 있는 더 나은 설계입니다.

### 구현된 테이블 구조

| 테이블 | 설명 | 좌표 | 건수 |
|--------|------|:----:|------|
| **Toilet** | 공공화장실 | ✅ 있음 | ~3만 |
| **Wifi** | 무료 와이파이 | ✅ 있음 | ~2만 |
| **Clothes** | 의류수거함 | ✅ 있음 | ~5천 |
| **Kiosk** | 무인민원발급기 | ✅ 있음 | ~300 |
| **Parking** | 공영주차장 | ✅ 있음 | ~1.5만 |
| **Aed** | 자동심장충격기 | ✅ 있음 | ~6만 |
| **Library** | 공공도서관 | ✅ 있음 | ~1.2천 |
| **WasteSchedule** | 쓰레기 배출 일정 | ❌ 없음 | 지역 기반 |

> **Trash 카테고리 특이사항**: 쓰레기 배출 정보는 좌표 기반이 아닌 지역(시/구) 기반 일정 정보입니다. 따라서 지도 표시가 불필요하며, 별도 WasteSchedule 테이블로 관리됩니다. 프론트엔드에서는 `/search?category=trash` 접근 시 지역 선택 UI + 배출 일정 목록을 표시합니다.

---

## Prisma Schema 주요 모델

### 공통 필드 (모든 위치 기반 모델)

```prisma
// 모든 위치 기반 모델(Toilet, Wifi, Clothes, Kiosk, Parking, Aed, Library)에 포함
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
```

### 카테고리별 모델 전용 필드

#### 1. Toilet (공공화장실)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| operatingHours | String? | VarChar(200) | 운영시간 |
| maleToilets | Int | - | 남성 화장실 수 |
| maleUrinals | Int | - | 남성 소변기 수 |
| femaleToilets | Int | - | 여성 화장실 수 |
| hasDisabledToilet | Boolean | - | 장애인 화장실 유무 |
| openTime | String? | VarChar(100) | 개방 시간대 |
| managingOrg | String? | VarChar(200) | 관리 기관 |

#### 2. Wifi (무료 와이파이)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| ssid | String? | VarChar(100) | 와이파이 SSID |
| installDate | String? | VarChar(50) | 설치일 |
| serviceProvider | String? | VarChar(100) | 서비스 제공자 |
| installLocation | String? | VarChar(200) | 설치 장소 |
| managementAgency | String? | VarChar(200) | 관리 기관 |
| phoneNumber | String? | VarChar(50) | 연락처 |

#### 3. Clothes (의류수거함)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| managementAgency | String? | VarChar(200) | 관리 기관 |
| phoneNumber | String? | VarChar(50) | 연락처 |
| dataDate | String? | VarChar(50) | 데이터 기준일 |
| detailLocation | String? | VarChar(500) | 상세 위치 |

#### 4. Kiosk (무인민원발급기)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| detailLocation | String? | VarChar(500) | 상세 위치 |
| operationAgency | String? | VarChar(200) | 운영 기관 |
| weekdayOperatingHours | String? | VarChar(100) | 평일 운영시간 |
| saturdayOperatingHours | String? | VarChar(100) | 토요일 운영시간 |
| holidayOperatingHours | String? | VarChar(100) | 공휴일 운영시간 |
| blindKeypad | Boolean | - | 시각장애인용 점자 키패드 |
| voiceGuide | Boolean | - | 음성 안내 |
| brailleOutput | Boolean | - | 점자 출력 |
| wheelchairAccessible | Boolean | - | 휠체어 접근 가능 |
| mngNo | String? | VarChar(50) | 관리번호 (API 연결키) |
| availableDocuments | Json? | - | 발급 가능 민원 목록 |

#### 5. WasteSchedule (쓰레기 배출 일정)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| city | String | VarChar(50) | 시도명 |
| district | String | VarChar(50) | 시군구명 |
| targetRegion | String? | Text | 관리구역 대상지역명 |
| emissionPlace | String? | VarChar(100) | 배출장소 |
| details | Json? | - | 기타 상세 정보 |
| sourceId | String | VarChar(100) | 원본 데이터 ID |
| sourceUrl | String? | VarChar(500) | 데이터 출처 |

#### 6. Parking (공영주차장)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| parkingType | String? | VarChar(50) | 주차구분 (공영/민영) |
| lotType | String? | VarChar(50) | 주차장유형 (노외/노상/부설) |
| capacity | Int | - | 주차면수 |
| baseFee | Int? | - | 기본요금 (원) |
| baseTime | Int? | - | 기본시간 (분) |
| additionalFee | Int? | - | 추가요금 (원) |
| additionalTime | Int? | - | 추가시간 (분) |
| dailyMaxFee | Int? | - | 일최대요금 (원) |
| monthlyFee | Int? | - | 월정기권요금 (원) |
| operatingHours | String? | VarChar(200) | 운영시간 |
| phone | String? | VarChar(50) | 전화번호 |
| paymentMethod | String? | VarChar(200) | 결제방법 |
| remarks | String? | Text | 특기사항 |
| hasDisabledParking | Boolean | - | 장애인전용주차구역보유여부 |

#### 7. Aed (자동심장충격기)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| buildPlace | String? | VarChar(500) | 설치 상세위치 |
| org | String? | VarChar(200) | 설치기관 |
| clerkTel | String? | VarChar(50) | 담당자 전화 |
| mfg | String? | VarChar(100) | 제조사 |
| model | String? | VarChar(100) | 모델명 |
| monSttTme, monEndTme | String? | VarChar(4) | 월요일 시작/종료 |
| tueSttTme, tueEndTme | String? | VarChar(4) | 화요일 시작/종료 |
| wedSttTme, wedEndTme | String? | VarChar(4) | 수요일 시작/종료 |
| thuSttTme, thuEndTme | String? | VarChar(4) | 목요일 시작/종료 |
| friSttTme, friEndTme | String? | VarChar(4) | 금요일 시작/종료 |
| satSttTme, satEndTme | String? | VarChar(4) | 토요일 시작/종료 |
| sunSttTme, sunEndTme | String? | VarChar(4) | 일요일 시작/종료 |
| holSttTme, holEndTme | String? | VarChar(4) | 공휴일 시작/종료 |

#### 8. Library (공공도서관)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| libraryType | String? | VarChar(50) | 도서관유형 |
| closedDays | String? | VarChar(200) | 휴관일 |
| weekdayOpenTime | String? | VarChar(10) | 평일 개장시간 |
| weekdayCloseTime | String? | VarChar(10) | 평일 폐장시간 |
| saturdayOpenTime | String? | VarChar(10) | 토요일 개장시간 |
| saturdayCloseTime | String? | VarChar(10) | 토요일 폐장시간 |
| holidayOpenTime | String? | VarChar(10) | 공휴일 개장시간 |
| holidayCloseTime | String? | VarChar(10) | 공휴일 폐장시간 |
| seatCount | Int | - | 열람좌석수 |
| bookCount | Int | - | 도서수 |
| serialCount | Int | - | 자료수(연속간행물) |
| nonBookCount | Int | - | 자료수(비도서) |
| loanableBooks | Int | - | 대출가능권수 |
| loanableDays | Int | - | 대출가능일수 |
| phoneNumber | String? | VarChar(50) | 전화번호 |
| homepageUrl | String? | VarChar(500) | 홈페이지 URL |
| operatingOrg | String? | VarChar(200) | 운영기관 |

### 마스터 테이블

#### Category (카테고리)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| id | String | VarChar(20) | PK (toilet, wifi, clothes, kiosk, trash, parking, aed, library) |
| name | String | VarChar(50) | 카테고리명 |
| icon | String | VarChar(10) | 이모지 아이콘 |
| description | String? | VarChar(200) | 설명 |
| sortOrder | Int | - | 정렬 순서 |
| isActive | Boolean | - | 활성화 여부 |

**초기 데이터**:
```sql
INSERT INTO Category (id, name, icon, description, sortOrder, isActive) VALUES
('toilet', '공공화장실', '🚻', '전국 공공화장실 위치 정보', 1, true),
('trash', '쓰레기 배출', '🗑️', '생활쓰레기/음식물쓰레기 배출 정보', 2, true),
('wifi', '무료 와이파이', '📶', '공공 무료 와이파이 위치', 3, true),
('clothes', '의류수거함', '👕', '전국 의류수거함 위치 정보', 4, true),
('kiosk', '무인민원발급기', '🏧', '전국 무인민원발급기 위치 및 운영시간 정보', 5, true),
('parking', '공영주차장', '🅿️', '공영주차장 위치 및 요금 정보', 6, true),
('aed', '자동심장충격기', '💓', '응급의료 장비 위치 정보', 7, true),
('library', '공공도서관', '📚', '공공도서관 위치 및 운영 정보', 8, true);
```

#### Region (지역)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| id | Int | - | PK AUTO_INCREMENT |
| bjdCode | String | VarChar(5) | 법정동코드 (시군구 5자리) |
| city | String | VarChar(50) | 시/도 |
| district | String | VarChar(50) | 구/군 |
| slug | String | VarChar(50) | URL용 slug (gangnam) |
| lat | Decimal | Decimal(10,7) | 중심 위도 |
| lng | Decimal | Decimal(10,7) | 중심 경도 |

**유니크 제약**: bjdCode, (city, district), (city, slug)

### 운영 테이블

#### SearchLog (검색 로그)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| id | Int | - | PK AUTO_INCREMENT |
| sessionId | String | VarChar(32) | 익명 세션 ID |
| keyword | String? | VarChar(200) | 검색어 |
| category | String? | VarChar(20) | 카테고리 |
| city | String? | VarChar(50) | 검색 지역 (시/도) |
| district | String? | VarChar(50) | 검색 지역 (구/군) |
| lat | Decimal? | Decimal(10,7) | 검색 위치 위도 |
| lng | Decimal? | Decimal(10,7) | 검색 위치 경도 |
| resultCount | Int | - | 검색 결과 수 |
| createdAt | DateTime | - | 검색 일시 |

**인덱스**: createdAt, keyword

#### SyncHistory (동기화 히스토리)

| 필드 | Prisma 타입 | DB 타입 | 설명 |
|------|------------|---------|------|
| id | Int | - | PK AUTO_INCREMENT |
| category | String | VarChar(20) | 동기화 카테고리 |
| status | Enum | - | (running, success, failed) |
| totalRecords | Int | - | 총 레코드 수 |
| newRecords | Int | - | 신규 레코드 수 |
| updatedRecords | Int | - | 업데이트 레코드 수 |
| errorMessage | String? | Text | 에러 메시지 |
| startedAt | DateTime | - | 시작 일시 |
| completedAt | DateTime? | - | 완료 일시 |

---

## 인덱스 전략

### 위치 기반 모델 (Toilet, Wifi, Clothes, Parking, Aed, Library)

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| PRIMARY | id | 기본키 |
| UNIQUE | sourceId | 원본 데이터 중복 방지 |
| @@index | city, district | 지역 필터링 |
| @@index | lat, lng | 위치 기반 검색 (Haversine) |

### Kiosk 모델

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| PRIMARY | id | 기본키 |
| UNIQUE | sourceId | 원본 데이터 중복 방지 |
| @@index | city, district | 지역 필터링 |
| @@index | lat, lng | 위치 기반 검색 |
| @@index | mngNo | 관리번호 기반 API 연결 |

### WasteSchedule 모델

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| PRIMARY | id | 기본키 (auto increment) |
| @@unique | city, district, sourceId | 지역별 원본 데이터 중복 방지 |
| @@index | city, district | 지역 필터링 |

---

## 데이터 마이그레이션 전략

### 초기 동기화
1. 공공데이터 API 전체 데이터 조회
2. 데이터 정규화 (주소 파싱, 좌표 변환)
3. Bulk Insert로 DB 저장

### 증분 동기화 (일 1회)
1. 마지막 동기화 이후 변경분 확인
2. 신규/수정 데이터 Upsert
3. 삭제된 데이터 처리 (soft delete 또는 플래그)

### 동기화 스크립트 구조

실제 구현된 동기화 스크립트 목록 (`backend/src/scripts/`):

| 스크립트 | 파일명 | 대상 모델 | 상태 |
|---------|--------|----------|------|
| syncToilet | `syncToilet.ts` | Toilet | ✅ 완료 |
| syncWifi | `syncWifi.ts` | Wifi | ✅ 완료 |
| syncClothes | `syncClothes.ts` | Clothes | ✅ 완료 |
| syncKiosk | `syncKiosk.ts` | Kiosk | ✅ 완료 |
| syncTrash | `syncTrash.ts` | WasteSchedule | ✅ 완료 |
| syncParking | `syncParking.ts` | Parking | ✅ 완료 |
| syncAed | `syncAed.ts` | Aed | ✅ 완료 |
| syncLibrary | `syncLibrary.ts` | Library | ✅ 완료 |
| syncAll | `syncAll.ts` | 전체 카테고리 일괄 실행 | ✅ 완료 |

---

## 법정동코드 매핑 전략

### 데이터 소스
- **국토교통부_법정동코드**: https://www.data.go.kr/data/15123287/fileData.do
- 시/군/구 레벨 5자리만 사용 (예: 서울 강남구 = 11680)

### 매핑 프로세스

#### 1. Region 테이블 초기화
- 법정동코드 데이터에서 시/군/구 레벨 추출
- 전국 시/군/구 약 250개 등록

#### 2. Facility 동기화 시 매핑
- API 응답의 주소에서 시/군/구 파싱
- Region 테이블과 매칭하여 bjdCode 설정
- 매칭 실패 시 null (위치 기반 검색은 가능)

---

## 쿼리 예시

> 각 카테고리별 독립 테이블 구조이므로, 쿼리는 모델별로 실행됩니다. 아래 예시는 Toilet을 기준으로 하며, 다른 모델(Wifi, Clothes, Kiosk, Parking, Aed, Library)도 동일한 패턴입니다.

### 1. 위치 기반 주변 검색 (Haversine 공식)

```sql
SELECT
  id,
  name,
  address,
  lat,
  lng,
  (
    6371 * acos(
      cos(radians(:lat)) * cos(radians(lat)) *
      cos(radians(lng) - radians(:lng)) +
      sin(radians(:lat)) * sin(radians(lat))
    )
  ) AS distance
FROM Toilet
HAVING distance < :radius
ORDER BY distance
LIMIT :limit OFFSET :offset;
```

### 2. 지역별 시설 조회

```sql
SELECT * FROM Toilet
WHERE city = :city
  AND district = :district
ORDER BY name
LIMIT :limit OFFSET :offset;
```

### 3. 법정동코드 기반 조회

```sql
SELECT * FROM Toilet
WHERE bjdCode = :bjdCode
ORDER BY name
LIMIT :limit OFFSET :offset;
```

### 4. 키워드 검색

```sql
-- 모델별로 각각 실행 (예: Toilet)
SELECT * FROM Toilet
WHERE (name LIKE :keyword OR address LIKE :keyword)
ORDER BY viewCount DESC
LIMIT :limit OFFSET :offset;
```

---

## 참고: 초기 설계 vs 최종 구현

### 초기 설계 (참고용)
- 단일 통합 `Facility` 테이블 + `details` JSON 컬럼
- ENUM category 필드로 카테고리 구분

### 최종 구현 (현재)
- 카테고리별 독립 테이블 (Toilet, Wifi, Clothes, 등)
- 각 테이블의 typed column으로 전용 필드 관리
- **장점**:
  - 타입 안전성 강화 (TypeScript 자동 완성)
  - 쿼리 성능 최적화 (JSON 파싱 불필요)
  - 인덱스 효율성 증대
  - 스키마 진화에 용이

이 설계 변경은 **더 나은 구현 방식**으로 검증되었으며, PRD의 "상세 페이지 정보 전략"과 일치합니다.
