# 02. 기술 요구사항 정의서 (TRD)

## 기술 스택

| 영역 | 기술 | 버전 | 선택 이유 |
|------|------|------|----------|
| Frontend | Nuxt 3 | 3.x | SSR/SSG SEO 최적화, Vue 생태계 |
| Language | TypeScript | 5.x | 타입 안전성, 개발 생산성 |
| Styling | TailwindCSS | 3.x | 빠른 UI 개발, Nuxt 통합 |
| 상태관리 | Pinia | 2.x | Nuxt 공식 추천 |
| Backend | Express | 4.x | 경량 API 서버 |
| ORM | Prisma | 5.x | 타입 안전한 DB 접근 |
| Database | MySQL | 8.x | 카페24 호환, 위치 쿼리 |
| Hosting | 카페24 서버호스팅 | - | 사용자 지정 |
| Process | PM2 | 5.x | Node.js 프로세스 관리 |
| Web Server | Nginx | - | 리버스 프록시 |

---

## 시스템 아키텍처

```
                    ┌─────────────────┐
Internet ──────────▶│   Nginx :80     │
                    └─────────────────┘
                            │
              ┌─────────────┴─────────────┐
              ▼                           ▼
    ┌─────────────────┐         ┌─────────────────┐
    │  Nuxt SSR :3000 │         │  Express :8000  │
    │  (PM2)          │         │  (PM2)          │
    └─────────────────┘         └─────────────────┘
                                        │
                                        ▼
                                ┌─────────────────┐
                                │  MySQL :3306    │
                                └─────────────────┘

    ─────── 데이터 동기화 (Cron) ───────
              │
              ▼
    ┌─────────────────┐
    │ 공공데이터 API  │
    │ (data.go.kr)    │
    └─────────────────┘
```

---

## 공공데이터 API 연동

### API 목록

#### 1. 공공화장실 (data.go.kr/15075531)
- **API**: 전국공중화장실표준데이터
- **형식**: REST API (JSON)
- **주요 필드**: 화장실명, 주소, 위도, 경도, 운영시간
- **갱신 주기**: 월 1회

#### 2. 생활쓰레기 배출 (data.go.kr/15155080)
- **API**: 생활폐기물 배출정보
- **형식**: REST API (JSON)
- **주요 필드**: 지역, 배출요일, 배출시간, 배출장소
- **갱신 주기**: 수시

#### 3. 무료 와이파이 (data.go.kr/15013116)
- **API**: 전국무료와이파이표준데이터
- **형식**: REST API (JSON)
- **주요 필드**: 설치장소명, 주소, 위도, 경도, SSID
- **갱신 주기**: 월 1회

#### 4. 의류수거함 (data.go.kr/15139214)
- **API**: 전국의류수거함표준데이터
- **형식**: REST API (JSON, 자동승인)
- **주요 필드**: 관리번호, 설치장소명, 시도명, 시군구명, 주소, 위도, 경도, 관리기관명
- **갱신 주기**: 수시

#### 5. 폐형광등/폐건전지 수거함 (data.go.kr/15155673)
- **API**: 전국폐형광등폐건전지수거함표준데이터
- **엔드포인트**: `api.data.go.kr/openapi/tn_pubr_public_waste_lamp_battery_collection_box_api`
- **형식**: REST API (JSON, 자동승인)
- **주요 필드**: 설치장소명, 세부위치내용, 시도명, 시군구명, 주소, 위도, 경도, 수거품목명, 수거함수량, 관리기관명, 관리기관전화번호
- **갱신 주기**: 수시

#### 6. 무인민원발급기 (data.go.kr/15154774)
- **API**: 무인민원발급기정보 조회서비스
- **엔드포인트**: `apis.data.go.kr/1741000/kiosk_info/installation_info`
- **형식**: REST API (JSON/XML, 자동승인)
- **주요 필드**: 설치장소주소, 설치장소상세위치, 설치장소위치, 평일/공휴일 운영시간, 장애인 편의 기능 (시각장애인용 키패드, 음성안내), 관리기관 정보
- **갱신 주기**: 수시
- **⚠️ 특이사항**: 위도/경도 필드 없음 → 지오코딩 필요

### 지오코딩 전략 (무인민원발급기)

```
┌──────────────────────────────────────────────────┐
│              지오코딩 전략 (kiosk)                │
├──────────────────────────────────────────────────┤
│                                                  │
│  무인민원발급기 API ──▶ 주소 추출 ──▶ Kakao API  │
│                                 │                │
│                                 ▼                │
│                        좌표 변환 (lat, lng)      │
│                                 │                │
│                                 ▼                │
│                        MySQL 저장               │
│                                                  │
│  - Kakao 지오코딩 API 활용 (기존 KAKAO_MAP_KEY)  │
│  - Rate Limit 고려 (배치 처리, 딜레이)           │
│  - 지오코딩 실패 시 null 저장 (지도 미표시)      │
│                                                  │
└──────────────────────────────────────────────────┘
```

### 연동 전략

```
┌──────────────────────────────────────────────┐
│              데이터 동기화 전략                │
├──────────────────────────────────────────────┤
│                                              │
│  공공데이터 API  ──(Cron 일 1회)──▶  MySQL   │
│                                              │
│  - 전체 데이터 주기적 동기화                   │
│  - 증분 업데이트 (변경분만)                    │
│  - 실패 시 재시도 로직                        │
│                                              │
└──────────────────────────────────────────────┘
```

---

## 디렉토리 구조

```
ilsangkit/
├── docs/
│   └── planning/              # 기획 문서
│       ├── 01-prd.md
│       ├── 02-trd.md
│       ├── 03-user-flow.md
│       ├── 04-database-design.md
│       ├── 05-design-system.md
│       ├── 06-tasks.md
│       └── 07-coding-convention.md
├── frontend/                  # Nuxt 3 프로젝트
│   ├── app/
│   │   ├── pages/            # 페이지 컴포넌트
│   │   ├── components/       # 공통 컴포넌트
│   │   ├── composables/      # Composition API 훅
│   │   └── layouts/          # 레이아웃
│   ├── server/               # Nuxt 서버 미들웨어
│   ├── public/               # 정적 파일
│   ├── nuxt.config.ts
│   └── package.json
├── backend/                   # Express API 서버
│   ├── src/
│   │   ├── routes/           # API 라우트
│   │   ├── services/         # 비즈니스 로직
│   │   ├── schemas/          # Zod 스키마
│   │   └── scripts/          # 데이터 동기화 스크립트
│   ├── prisma/
│   │   └── schema.prisma     # DB 스키마
│   └── package.json
├── docker-compose.yml         # 로컬 MySQL
└── .github/
    └── workflows/
        └── deploy.yml         # CI/CD
```

---

## API 엔드포인트 설계

### 검색 API

```
POST /api/facilities/search
{
  "keyword": "화장실",
  "category": "toilet",
  "lat": 37.5665,
  "lng": 126.9780,
  "radius": 1000,  // meters
  "page": 1,
  "limit": 20
}

Response:
{
  "items": [...],
  "total": 150,
  "page": 1,
  "totalPages": 8
}
```

### 상세 조회 API

```
GET /api/facilities/:category/:id

Response (toilet 예시):
{
  "id": "toilet-12345",
  "category": "toilet",
  "name": "강남역 공중화장실",
  "address": "서울시 강남구 강남대로 396",
  "lat": 37.4979,
  "lng": 127.0276,
  "details": {
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
}

Response (kiosk 예시):
{
  "id": "kiosk-67890",
  "category": "kiosk",
  "name": "강남구청 무인민원발급기",
  "address": "서울시 강남구 학동로 426",
  "lat": 37.5172,
  "lng": 127.0473,
  "details": {
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
}
```

> **전략**: API에서 제공하는 모든 필드를 details JSON에 저장하고, 프론트엔드에서 카테고리별로 필요한 필드만 렌더링. null/undefined 필드는 UI에서 숨김 처리.

### 지역별 조회 API

```
# 기존 방식 (유지)
GET /api/facilities/region/:city/:district/:category

Response:
{
  "region": {
    "city": "서울",
    "district": "강남구",
    "bjdCode": "11680"
  },
  "category": "toilet",
  "items": [...],
  "total": 45
}

# 법정동코드 방식 (추가)
GET /api/facilities/region/code/:bjdCode/:category

Response:
{
  "region": {
    "city": "서울",
    "district": "강남구",
    "bjdCode": "11680"
  },
  "category": "toilet",
  "items": [...],
  "total": 45
}
```

### 메타 API

```
GET /api/meta/categories    # 카테고리 목록
GET /api/meta/regions       # 지역 목록
GET /api/health             # 헬스체크
```

---

## SEO 전략

### 1. SSR/SSG 활용
- 검색 결과 페이지: SSR (실시간 데이터)
- 상세 페이지: SSG (빌드 시 생성) + ISR
- 지역별 페이지: SSG (대량 생성)

### 2. URL 구조
```
/                           # 메인 페이지
/search?q=화장실&region=강남  # 검색 결과
/toilet/12345               # 상세 페이지
/seoul/gangnam/toilet       # 지역별 페이지
/seoul/gangnam/wifi         # 지역별 페이지
/seoul/gangnam/trash        # 지역별 페이지
/seoul/gangnam/clothes      # 지역별 페이지
/seoul/gangnam/battery      # 지역별 페이지
/seoul/gangnam/kiosk        # 지역별 페이지
```

### 3. 메타태그
```html
<title>강남구 공공화장실 위치 | 일상킷</title>
<meta name="description" content="강남구 공공화장실 45곳 위치 정보. 주소, 운영시간, 지도 확인.">
<meta property="og:title" content="강남구 공공화장실 위치">
```

### 4. 사이트맵
- 동적 사이트맵 생성 (`/sitemap.xml`)
- 지역별 페이지 자동 포함
- 상세 페이지 자동 포함

---

## 비기능 요구사항

### 성능
- First Contentful Paint (FCP): < 1.5s
- Time to Interactive (TTI): < 3s
- Lighthouse Performance Score: > 90

### 반응형 웹 (Mobile First)

#### 뷰포트별 성능 지표
| 뷰포트 | FCP 목표 | LCP 목표 | CLS 목표 |
|--------|---------|---------|---------|
| Mobile (< 640px) | < 1.8s | < 2.5s | < 0.1 |
| Tablet (640px~1024px) | < 1.5s | < 2.0s | < 0.1 |
| Desktop (> 1024px) | < 1.2s | < 1.8s | < 0.1 |

#### 뷰포트별 렌더링 전략
```
┌──────────────────────────────────────────────────────┐
│              Mobile First 렌더링 전략                  │
├──────────────────────────────────────────────────────┤
│                                                      │
│  1. 기본 CSS: 모바일 스타일 (< 640px)                 │
│     - 단일 컬럼 레이아웃                              │
│     - 터치 최적화 버튼 (min 44px)                     │
│     - 지도 토글 (목록 우선)                           │
│                                                      │
│  2. @media (min-width: 640px): 태블릿                 │
│     - 2컬럼 그리드 시작                               │
│     - 패딩/마진 확대                                  │
│                                                      │
│  3. @media (min-width: 1024px): 데스크톱             │
│     - 목록+지도 분할 뷰                               │
│     - 사이드바 네비게이션                             │
│     - hover 효과 활성화                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

#### 이미지/에셋 최적화
- Nuxt Image 모듈 활용 (자동 리사이징)
- 뷰포트별 srcset 제공
- Lazy loading (뷰포트 외 컨텐츠)
- WebP 포맷 우선 사용

### 확장성
- 데이터 100만 건 이상 처리 가능
- 동시 접속 1000명 이상 처리

### 보안
- HTTPS 필수
- API Rate Limiting
- SQL Injection 방지 (Prisma 사용)

### 모니터링
- PM2 모니터링
- Google Analytics
- Google Search Console

---

## 환경 변수

### Backend (.env)
```bash
DATABASE_URL=mysql://ilsangkit:password@localhost:3306/ilsangkit
PORT=8000
CORS_ORIGIN=http://localhost:3000
NODE_ENV=development
OPENAPI_SERVICE_KEY=your-api-key
```

### Frontend
```bash
NUXT_PUBLIC_API_BASE=http://localhost:8000
NUXT_PUBLIC_KAKAO_MAP_KEY=your-kakao-key
NUXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```
