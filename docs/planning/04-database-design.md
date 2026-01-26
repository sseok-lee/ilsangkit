# 04. 데이터베이스 설계

## ERD (Entity Relationship Diagram)

```
┌─────────────────────────────────────────────────────────────┐
│                         Facility                            │
├─────────────────────────────────────────────────────────────┤
│ id            VARCHAR(50)    PK                             │
│ category      ENUM           (toilet, trash, wifi, clothes, battery, kiosk)  │
│ name          VARCHAR(200)   시설명                          │
│ address       VARCHAR(500)   주소                            │
│ roadAddress   VARCHAR(500)   도로명주소                       │
│ lat           DECIMAL(10,7)  위도                            │
│ lng           DECIMAL(10,7)  경도                            │
│ city          VARCHAR(50)    시/도                           │
│ district      VARCHAR(50)    구/군                           │
│ details       JSON           카테고리별 상세정보              │
│ sourceId      VARCHAR(100)   원본 데이터 ID                   │
│ sourceUrl     VARCHAR(500)   원본 데이터 출처                 │
│ bjdCode       VARCHAR(5)     법정동코드 (주소 파싱으로 매핑)   │
│ viewCount     INT            조회수                          │
│ createdAt     DATETIME       생성일시                        │
│ updatedAt     DATETIME       수정일시                        │
│ syncedAt      DATETIME       마지막 동기화 일시               │
├─────────────────────────────────────────────────────────────┤
│ INDEX idx_category_location (category, city, district)      │
│ INDEX idx_location (lat, lng)                               │
│ INDEX idx_city_district (city, district)                    │
│ INDEX idx_bjd_code (bjdCode)                                │
│ UNIQUE idx_source (category, sourceId)                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         Category                            │
├─────────────────────────────────────────────────────────────┤
│ id            VARCHAR(20)    PK (toilet, trash, wifi)       │
│ name          VARCHAR(50)    카테고리명                      │
│ icon          VARCHAR(10)    이모지 아이콘                   │
│ description   VARCHAR(200)   설명                           │
│ sortOrder     INT            정렬 순서                       │
│ isActive      BOOLEAN        활성화 여부                     │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                         Region                              │
├─────────────────────────────────────────────────────────────┤
│ id            INT            PK AUTO_INCREMENT              │
│ bjdCode       VARCHAR(5)     법정동코드 (시군구 5자리)         │
│ city          VARCHAR(50)    시/도                           │
│ district      VARCHAR(50)    구/군                           │
│ slug          VARCHAR(50)    URL용 slug (gangnam)           │
│ lat           DECIMAL(10,7)  중심 위도                       │
│ lng           DECIMAL(10,7)  중심 경도                       │
├─────────────────────────────────────────────────────────────┤
│ UNIQUE idx_bjd_code (bjdCode)                               │
│ UNIQUE idx_city_district (city, district)                   │
│ UNIQUE idx_slug (city, slug)                                │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       SearchLog                             │
├─────────────────────────────────────────────────────────────┤
│ id            INT            PK AUTO_INCREMENT              │
│ sessionId     VARCHAR(32)    익명 세션 ID                    │
│ keyword       VARCHAR(200)   검색어                          │
│ category      VARCHAR(20)    카테고리                        │
│ city          VARCHAR(50)    검색 지역 (시/도)               │
│ district      VARCHAR(50)    검색 지역 (구/군)               │
│ lat           DECIMAL(10,7)  검색 위치 위도                  │
│ lng           DECIMAL(10,7)  검색 위치 경도                  │
│ resultCount   INT            검색 결과 수                    │
│ createdAt     DATETIME       검색 일시                       │
├─────────────────────────────────────────────────────────────┤
│ INDEX idx_created (createdAt)                               │
│ INDEX idx_keyword (keyword)                                 │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       SyncHistory                           │
├─────────────────────────────────────────────────────────────┤
│ id            INT            PK AUTO_INCREMENT              │
│ category      VARCHAR(20)    동기화 카테고리                 │
│ status        ENUM           (running, success, failed)     │
│ totalRecords  INT            총 레코드 수                    │
│ newRecords    INT            신규 레코드 수                  │
│ updatedRecords INT           업데이트 레코드 수              │
│ errorMessage  TEXT           에러 메시지                     │
│ startedAt     DATETIME       시작 일시                       │
│ completedAt   DATETIME       완료 일시                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "mysql"
  url      = env("DATABASE_URL")
}

enum FacilityCategory {
  toilet
  trash
  wifi
  clothes
  battery
  kiosk
}

enum SyncStatus {
  running
  success
  failed
}

model Facility {
  id          String           @id @db.VarChar(50)
  category    FacilityCategory
  name        String           @db.VarChar(200)
  address     String?          @db.VarChar(500)
  roadAddress String?          @db.VarChar(500)
  lat         Decimal          @db.Decimal(10, 7)
  lng         Decimal          @db.Decimal(10, 7)
  city        String           @db.VarChar(50)
  district    String           @db.VarChar(50)
  bjdCode     String?          @db.VarChar(5)  // 법정동코드 (주소 파싱으로 매핑)
  details     Json?
  sourceId    String           @db.VarChar(100)
  sourceUrl   String?          @db.VarChar(500)
  viewCount   Int              @default(0)
  createdAt   DateTime         @default(now())
  updatedAt   DateTime         @updatedAt
  syncedAt    DateTime         @default(now())

  @@unique([category, sourceId])
  @@index([category, city, district])
  @@index([lat, lng])
  @@index([city, district])
  @@index([bjdCode])
}

model Category {
  id          String  @id @db.VarChar(20)
  name        String  @db.VarChar(50)
  icon        String  @db.VarChar(10)
  description String? @db.VarChar(200)
  sortOrder   Int     @default(0)
  isActive    Boolean @default(true)
}

model Region {
  id       Int     @id @default(autoincrement())
  bjdCode  String  @db.VarChar(5)   // 법정동코드 (시군구 5자리)
  city     String  @db.VarChar(50)  // 시/도
  district String  @db.VarChar(50)  // 구/군
  slug     String  @db.VarChar(50)  // URL용
  lat      Decimal @db.Decimal(10, 7)
  lng      Decimal @db.Decimal(10, 7)

  @@unique([bjdCode])
  @@unique([city, district])
  @@unique([city, slug])
}

model SearchLog {
  id          Int      @id @default(autoincrement())
  sessionId   String   @db.VarChar(32)
  keyword     String?  @db.VarChar(200)
  category    String?  @db.VarChar(20)
  city        String?  @db.VarChar(50)
  district    String?  @db.VarChar(50)
  lat         Decimal? @db.Decimal(10, 7)
  lng         Decimal? @db.Decimal(10, 7)
  resultCount Int      @default(0)
  createdAt   DateTime @default(now())

  @@index([createdAt])
  @@index([keyword])
}

model SyncHistory {
  id             Int        @id @default(autoincrement())
  category       String     @db.VarChar(20)
  status         SyncStatus
  totalRecords   Int        @default(0)
  newRecords     Int        @default(0)
  updatedRecords Int        @default(0)
  errorMessage   String?    @db.Text
  startedAt      DateTime   @default(now())
  completedAt    DateTime?
}
```

---

## 카테고리별 details 필드 스키마

> **전략**: API에서 제공하는 모든 필드를 details JSON에 저장, 프론트엔드에서 필요한 필드만 렌더링
> - null/undefined 필드는 그대로 저장 (선택적 필드)
> - 프론트엔드에서 null/undefined 필드는 UI에서 숨김 처리

### 1. 공공화장실 (toilet)

```json
{
  "operatingHours": "00:00~24:00",
  "femaleToilets": 5,
  "maleToilets": 3,
  "unisexToilets": 1,
  "disabledToilet": true,
  "childToilet": false,
  "diaperChangingTable": true,
  "emergencyBell": true,
  "installLocation": "지하1층",
  "description": "역사 내 1번 출구 옆",
  "openType": "24시간",
  "managementAgency": "강남구청",
  "phoneNumber": "02-1234-5678"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| operatingHours | string | 운영시간 |
| femaleToilets | number | 여성 화장실 수 |
| maleToilets | number | 남성 화장실 수 |
| unisexToilets | number | 남녀공용 화장실 수 |
| disabledToilet | boolean | 장애인 화장실 유무 |
| childToilet | boolean | 어린이 화장실 유무 |
| diaperChangingTable | boolean | 기저귀 교환대 유무 |
| emergencyBell | boolean | 비상벨 유무 |
| installLocation | string | 설치 위치 상세 |
| description | string | 추가 설명 |
| openType | string | 개방 유형 (24시간, 주간 등) |
| managementAgency | string | 관리 기관 |
| phoneNumber | string | 연락처 |

### 2. 쓰레기 배출 (trash)

```json
{
  "trashType": "일반쓰레기",
  "collectionDays": ["월", "수", "금"],
  "collectionStartTime": "20:00",
  "collectionEndTime": "06:00",
  "collectionArea": "강남대로 일대",
  "locationType": "도로가",
  "disposalMethod": "종량제봉투",
  "departmentName": "환경과",
  "phoneNumber": "02-1234-5678",
  "notes": "음식물쓰레기는 별도 배출"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| trashType | string | 쓰레기 종류 (일반/음식물/재활용 등) |
| collectionDays | string[] | 수거 요일 배열 |
| collectionStartTime | string | 배출 시작 시간 |
| collectionEndTime | string | 수거 종료 시간 |
| collectionArea | string | 수거 구역 |
| locationType | string | 위치 유형 (도로가, 아파트 등) |
| disposalMethod | string | 배출 방법 (종량제봉투 등) |
| departmentName | string | 담당 부서명 |
| phoneNumber | string | 연락처 |
| notes | string | 비고/특이사항 |

### 3. 무료 와이파이 (wifi)

```json
{
  "ssid": "Seoul_Free_WiFi",
  "installLocation": "지하철 역사 내",
  "detailLocation": "3번 출구 옆",
  "serviceProvider": "KT",
  "installDate": "2023-01-15",
  "securityType": "OPEN",
  "speedGrade": "고속",
  "managementAgency": "서울시",
  "operationStatus": "운영중"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| ssid | string | 와이파이 SSID |
| installLocation | string | 설치 장소 |
| detailLocation | string | 상세 위치 |
| serviceProvider | string | 서비스 제공자 (KT, SKT 등) |
| installDate | string | 설치일 (YYYY-MM-DD) |
| securityType | string | 보안 유형 (OPEN, WPA2 등) |
| speedGrade | string | 속도 등급 (고속, 일반 등) |
| managementAgency | string | 관리 기관 |
| operationStatus | string | 운영 상태 |

### 4. 의류수거함 (clothes)

```json
{
  "managementNo": "CLT-2024-001",
  "installLocation": "아파트 단지 내",
  "collectionItems": ["의류", "신발", "가방"],
  "collectionCycle": "주 1회",
  "clothesType": "일반의류, 속옷 제외",
  "installDate": "2023-06-01",
  "managementAgency": "강남구청",
  "phoneNumber": "02-1234-5678"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| managementNo | string | 관리 번호 |
| installLocation | string | 설치 위치 |
| collectionItems | string[] | 수거 가능 품목 배열 |
| collectionCycle | string | 수거 주기 |
| clothesType | string | 수거 가능 의류 종류 설명 |
| installDate | string | 설치일 (YYYY-MM-DD) |
| managementAgency | string | 관리 기관 |
| phoneNumber | string | 연락처 |

### 5. 폐형광등/폐건전지 수거함 (battery)

```json
{
  "detailLocation": "아파트 관리사무소 앞",
  "collectionItems": "폐형광등, 폐건전지",
  "boxCount": 2,
  "collectionCycle": "월 2회",
  "locationType": "옥외",
  "lastCollectionDate": "2024-01-15",
  "managementAgency": "강남구청",
  "phoneNumber": "02-1234-5678"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| detailLocation | string | 상세 위치 |
| collectionItems | string | 수거 품목 |
| boxCount | number | 수거함 개수 |
| collectionCycle | string | 수거 주기 |
| locationType | string | 위치 유형 (옥내/옥외) |
| lastCollectionDate | string | 최근 수거일 (YYYY-MM-DD) |
| managementAgency | string | 관리 기관 |
| phoneNumber | string | 연락처 |

### 6. 무인민원발급기 (kiosk)

```json
{
  "detailLocation": "1층 민원실 앞",
  "weekdayOperatingHours": "09:00~18:00",
  "saturdayOperatingHours": "09:00~13:00",
  "holidayOperatingHours": "휴무",
  "availableDocuments": ["주민등록등본", "가족관계증명서", "인감증명서"],
  "blindKeypad": true,
  "voiceGuide": true,
  "brailleGuide": true,
  "wheelchairAccess": true,
  "hasElevator": true,
  "hasParking": true,
  "hasDisabledRestroom": false,
  "managementAgency": "강남구청",
  "phoneNumber": "02-1234-5678"
}
```

| 필드 | 타입 | 설명 |
|------|------|------|
| detailLocation | string | 상세 위치 |
| weekdayOperatingHours | string | 평일 운영시간 |
| saturdayOperatingHours | string | 토요일 운영시간 |
| holidayOperatingHours | string | 공휴일 운영시간 |
| availableDocuments | string[] | 발급 가능 서류 목록 |
| blindKeypad | boolean | 시각장애인용 점자 키패드 |
| voiceGuide | boolean | 음성 안내 |
| brailleGuide | boolean | 점자 안내 |
| wheelchairAccess | boolean | 휠체어 접근 가능 |
| hasElevator | boolean | 엘리베이터 유무 |
| hasParking | boolean | 주차 가능 여부 |
| hasDisabledRestroom | boolean | 장애인 화장실 유무 |
| managementAgency | string | 관리 기관 |
| phoneNumber | string | 연락처 |

---

## 초기 데이터

### Category 초기 데이터

```sql
INSERT INTO Category (id, name, icon, description, sortOrder, isActive) VALUES
('toilet', '공공화장실', '🚻', '전국 공공화장실 위치 정보', 1, true),
('trash', '쓰레기 배출', '🗑️', '생활쓰레기/음식물쓰레기 배출 정보', 2, true),
('wifi', '무료 와이파이', '📶', '공공 무료 와이파이 위치', 3, true),
('clothes', '의류수거함', '👕', '전국 의류수거함 위치 정보', 4, true),
('battery', '폐형광등/폐건전지', '🔋', '전국 폐형광등/폐건전지 수거함 위치 정보', 5, true),
('kiosk', '무인민원발급기', '🏧', '전국 무인민원발급기 위치 및 운영시간 정보', 6, true);
```

### Region 초기 데이터 (서울 예시, 법정동코드 포함)

```sql
-- 서울특별시 (25개 구)
INSERT INTO Region (bjdCode, city, district, slug, lat, lng) VALUES
('11680', '서울', '강남구', 'gangnam', 37.5172, 127.0473),
('11740', '서울', '강동구', 'gangdong', 37.5301, 127.1238),
('11305', '서울', '강북구', 'gangbuk', 37.6396, 127.0257),
('11500', '서울', '강서구', 'gangseo', 37.5509, 126.8495),
('11620', '서울', '관악구', 'gwanak', 37.4784, 126.9516),
('11215', '서울', '광진구', 'gwangjin', 37.5385, 127.0823),
('11530', '서울', '구로구', 'guro', 37.4954, 126.8874),
('11545', '서울', '금천구', 'geumcheon', 37.4519, 126.9020),
('11350', '서울', '노원구', 'nowon', 37.6542, 127.0568),
('11320', '서울', '도봉구', 'dobong', 37.6688, 127.0471),
('11230', '서울', '동대문구', 'dongdaemun', 37.5744, 127.0400),
('11590', '서울', '동작구', 'dongjak', 37.5124, 126.9393),
('11440', '서울', '마포구', 'mapo', 37.5663, 126.9014),
('11410', '서울', '서대문구', 'seodaemun', 37.5791, 126.9368),
('11650', '서울', '서초구', 'seocho', 37.4837, 127.0324),
('11200', '서울', '성동구', 'seongdong', 37.5633, 127.0371),
('11290', '서울', '성북구', 'seongbuk', 37.5894, 127.0167),
('11710', '서울', '송파구', 'songpa', 37.5145, 127.1050),
('11470', '서울', '양천구', 'yangcheon', 37.5170, 126.8666),
('11560', '서울', '영등포구', 'yeongdeungpo', 37.5264, 126.8963),
('11170', '서울', '용산구', 'yongsan', 37.5324, 126.9906),
('11380', '서울', '은평구', 'eunpyeong', 37.6027, 126.9291),
('11110', '서울', '종로구', 'jongno', 37.5735, 126.9790),
('11140', '서울', '중구', 'jung', 37.5641, 126.9979),
('11260', '서울', '중랑구', 'jungnang', 37.6066, 127.0927);

-- 다른 시/도는 국토부 법정동코드 데이터에서 추출
-- 출처: https://www.data.go.kr/data/15123287/fileData.do
```

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

### 주소 파싱 규칙

```typescript
// 예시: "서울특별시 강남구 테헤란로 123"
function parseAddress(address: string): { city: string; district: string } | null {
  // 시/도명 정규화
  const cityMap: Record<string, string> = {
    '서울특별시': '서울', '서울시': '서울', '서울': '서울',
    '부산광역시': '부산', '부산시': '부산', '부산': '부산',
    '대구광역시': '대구', '대구시': '대구', '대구': '대구',
    '인천광역시': '인천', '인천시': '인천', '인천': '인천',
    '광주광역시': '광주', '광주시': '광주', '광주': '광주',
    '대전광역시': '대전', '대전시': '대전', '대전': '대전',
    '울산광역시': '울산', '울산시': '울산', '울산': '울산',
    '세종특별자치시': '세종', '세종시': '세종', '세종': '세종',
    '경기도': '경기', '경기': '경기',
    '강원특별자치도': '강원', '강원도': '강원', '강원': '강원',
    '충청북도': '충북', '충북': '충북',
    '충청남도': '충남', '충남': '충남',
    '전북특별자치도': '전북', '전라북도': '전북', '전북': '전북',
    '전라남도': '전남', '전남': '전남',
    '경상북도': '경북', '경북': '경북',
    '경상남도': '경남', '경남': '경남',
    '제주특별자치도': '제주', '제주도': '제주', '제주': '제주',
  };

  // 정규식으로 시/도, 구/군/시 추출
  const match = address.match(
    /^(서울특별시|서울시|서울|부산광역시|부산시|부산|대구광역시|대구시|대구|인천광역시|인천시|인천|광주광역시|광주시|광주|대전광역시|대전시|대전|울산광역시|울산시|울산|세종특별자치시|세종시|세종|경기도|경기|강원특별자치도|강원도|강원|충청북도|충북|충청남도|충남|전북특별자치도|전라북도|전북|전라남도|전남|경상북도|경북|경상남도|경남|제주특별자치도|제주도|제주)\s+(\S+[구군시])/
  );

  if (!match) return null;

  return {
    city: cityMap[match[1]] || match[1],
    district: match[2],
  };
}
```

### Region 테이블 조회하여 bjdCode 매핑

```typescript
async function mapBjdCode(address: string): Promise<string | null> {
  const parsed = parseAddress(address);
  if (!parsed) return null;

  const region = await prisma.region.findUnique({
    where: {
      city_district: {
        city: parsed.city,
        district: parsed.district,
      },
    },
  });

  return region?.bjdCode ?? null;
}
```

---

## 쿼리 예시

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
FROM Facility
WHERE category = :category
HAVING distance < :radius
ORDER BY distance
LIMIT :limit OFFSET :offset;
```

### 2. 지역별 시설 조회

```sql
SELECT * FROM Facility
WHERE category = :category
  AND city = :city
  AND district = :district
ORDER BY name
LIMIT :limit OFFSET :offset;
```

### 3. 법정동코드 기반 조회

```sql
SELECT * FROM Facility
WHERE category = :category
  AND bjdCode = :bjdCode
ORDER BY name
LIMIT :limit OFFSET :offset;
```

### 4. 키워드 검색

```sql
SELECT * FROM Facility
WHERE (name LIKE :keyword OR address LIKE :keyword)
  AND (:category IS NULL OR category = :category)
ORDER BY viewCount DESC
LIMIT :limit OFFSET :offset;
```

---

## 인덱스 전략

| 인덱스 | 컬럼 | 용도 |
|--------|------|------|
| PRIMARY | id | 기본키 |
| idx_category_location | category, city, district | 지역별 카테고리 검색 |
| idx_location | lat, lng | 위치 기반 검색 |
| idx_city_district | city, district | 지역 필터링 |
| idx_bjd_code | bjdCode | 법정동코드 기반 검색 |
| UNIQUE idx_source | category, sourceId | 중복 데이터 방지 |

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

```typescript
// src/scripts/syncFacilities.ts
async function syncCategory(category: string) {
  // 1. SyncHistory 생성 (running)
  const syncHistory = await createSyncHistory(category)

  try {
    // 2. API 호출
    const data = await fetchFromPublicAPI(category)

    // 3. 데이터 변환
    const facilities = transformData(data, category)

    // 4. Upsert
    const result = await upsertFacilities(facilities)

    // 5. SyncHistory 업데이트 (success)
    await updateSyncHistory(syncHistory.id, 'success', result)
  } catch (error) {
    // 6. SyncHistory 업데이트 (failed)
    await updateSyncHistory(syncHistory.id, 'failed', error)
    throw error
  }
}
```

---

## Region 시드 스크립트 가이드

### 파일 위치
`backend/prisma/seed/regions.ts`

### 구현 가이드

```typescript
// backend/prisma/seed/regions.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// 전국 시/군/구 데이터 (국토교통부 법정동코드 기반)
// 출처: https://www.data.go.kr/data/15123287/fileData.do
const regions = [
  // 서울특별시 (25개 구)
  { bjdCode: '11110', city: '서울', district: '종로구', slug: 'jongno', lat: 37.5735, lng: 126.9790 },
  { bjdCode: '11140', city: '서울', district: '중구', slug: 'jung', lat: 37.5641, lng: 126.9979 },
  { bjdCode: '11170', city: '서울', district: '용산구', slug: 'yongsan', lat: 37.5324, lng: 126.9906 },
  // ... 전국 약 250개 시/군/구
];

async function seedRegions() {
  console.log('Seeding regions...');

  for (const region of regions) {
    await prisma.region.upsert({
      where: { bjdCode: region.bjdCode },
      update: region,
      create: region,
    });
  }

  console.log(`Seeded ${regions.length} regions`);
}

export { seedRegions };

// 직접 실행 시
if (require.main === module) {
  seedRegions()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
```

### 실행 방법

```bash
# Prisma seed 설정 (package.json)
{
  "prisma": {
    "seed": "tsx prisma/seed/index.ts"
  }
}

# 시드 실행
npm run db:seed
# 또는
npx prisma db seed
```

### 전국 법정동코드 데이터 수집

1. 국토교통부 법정동코드 다운로드
2. 시/군/구 레벨 (5자리) 필터링
3. 중심 좌표 매핑 (지자체 청사 위치 등)
4. JSON/TypeScript 배열로 변환
