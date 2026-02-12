# 일상킷 (ilsangkit) - Reverse Extract Specs v2.0

> `reverse extract` 실행 결과
> 생성일: 2026-02-12
> 소스: 코드베이스에서 역추출 (Prisma schema, Express routes, Vue pages/components/composables)

## 디렉토리 구조

```
specs/
├── README.md                          # 이 파일
├── domain/
│   ├── resources.yaml       (899 LOC) # 도메인 리소스 (11개 모델)
│   └── sync-processes.yaml  (310 LOC) # 데이터 동기화 프로세스 (9개)
├── api/
│   ├── facilities.yaml      (299 LOC) # 시설 API (search, detail, region)
│   ├── waste-schedules.yaml (243 LOC) # 쓰레기 배출 일정 API
│   ├── meta.yaml            (146 LOC) # 메타 API (categories, stats, regions)
│   └── sitemap.yaml          (90 LOC) # 사이트맵 생성 API
├── screens/
│   ├── home.yaml            (138 LOC) # 홈 화면
│   ├── search.yaml          (147 LOC) # 통합 검색 (지도 + 목록)
│   ├── facility-detail.yaml (148 LOC) # 시설 상세
│   ├── city.yaml             (81 LOC) # 시/도 페이지
│   ├── district.yaml         (84 LOC) # 구/군 페이지
│   ├── region-category.yaml (112 LOC) # 지역별 카테고리 시설
│   ├── trash-detail.yaml    (101 LOC) # 쓰레기 배출 일정 상세
│   ├── about.yaml            (92 LOC) # 소개 페이지
│   ├── privacy.yaml          (63 LOC) # 개인정보 처리방침
│   └── terms.yaml            (64 LOC) # 이용약관
├── components/
│   └── catalog.yaml         (794 LOC) # 컴포넌트 카탈로그 (34개)
└── composables/
    └── contracts.yaml       (997 LOC) # 컴포저블 계약 (10개)
```

**총 18개 YAML 파일, ~4,808 LOC**

## v1.0 대비 변경사항 (2026-02-04 → 2026-02-12)

### 추가된 리소스
| 항목 | v1.0 | v2.0 | 변경 |
|------|------|------|------|
| 시설 모델 | 4 (toilet, wifi, clothes, kiosk) | 7 (+parking, aed, library) | +3 |
| API 명세 | 3 파일 | 4 파일 (+sitemap) | +1 |
| 화면 명세 | 4 화면 | 10 화면 (+6 신규) | +6 |
| 컴포넌트 카탈로그 | 없음 | 34개 컴포넌트 | 신규 |
| 컴포저블 계약 | 없음 | 10개 컴포저블 | 신규 |

### 카테고리 확장
```
v1.0: toilet, wifi, clothes, kiosk (4개)
v2.0: toilet, wifi, clothes, kiosk, parking, aed, library (7개)
```

## 명세 커버리지

### Domain (11 models)

| 모델 | 유형 | 데이터 소스 | 방식 |
|------|------|------------|------|
| Toilet | 시설 (지도) | 15012892 | CSV |
| Wifi | 시설 (지도) | 15013116 | CSV |
| Clothes | 시설 (지도) | 15139214 | API |
| Kiosk | 시설 (지도) | 15154774 | API |
| Parking | 시설 (지도) | 15050093 | CSV/API |
| Aed | 시설 (지도) | - | XML API |
| Library | 시설 (지도) | - | CSV |
| Category | 메타 | - | - |
| Region | 메타 | - | API |
| SearchLog | 시스템 | - | - |
| SyncHistory | 시스템 | - | - |
| WasteSchedule | 비지도 | 15155080 | API |

### API Endpoints (14)

| 경로 | 메서드 | 명세 파일 |
|------|--------|----------|
| `/api/facilities/search` | POST | facilities.yaml |
| `/api/facilities/:category/:id` | GET | facilities.yaml |
| `/api/facilities/region/:city/:district/:category` | GET | facilities.yaml |
| `/api/waste-schedules` | GET | waste-schedules.yaml |
| `/api/waste-schedules/:id` | GET | waste-schedules.yaml |
| `/api/waste-schedules/regions` | GET | waste-schedules.yaml |
| `/api/waste-schedules/cities` | GET | waste-schedules.yaml |
| `/api/waste-schedules/districts/:city` | GET | waste-schedules.yaml |
| `/api/meta/categories` | GET | meta.yaml |
| `/api/meta/stats` | GET | meta.yaml |
| `/api/meta/regions` | GET | meta.yaml |
| `/api/sitemap/facilities/:category` | GET | sitemap.yaml |
| `/api/sitemap/waste-schedules` | GET | sitemap.yaml |
| `/api/health` | GET | (미포함 - trivial) |

### Screens (10 pages)

| 라우트 | 명세 파일 | 소스 |
|--------|----------|------|
| `/` | home.yaml | `pages/index.vue` |
| `/search` | search.yaml | `pages/search.vue` |
| `/:category/:id` | facility-detail.yaml | `pages/[category]/[id].vue` |
| `/:city` | city.yaml | `pages/[city]/index.vue` |
| `/:city/:district` | district.yaml | `pages/[city]/[district]/index.vue` |
| `/:city/:district/:category` | region-category.yaml | `pages/[city]/[district]/[category].vue` |
| `/trash/:id` | trash-detail.yaml | `pages/trash/[id].vue` |
| `/about` | about.yaml | `pages/about.vue` |
| `/privacy` | privacy.yaml | `pages/privacy.vue` |
| `/terms` | terms.yaml | `pages/terms.vue` |

### Components (34)

| 디렉토리 | 수량 | 주요 컴포넌트 |
|----------|------|-------------|
| common/ | 8 | AppHeader, AppFooter, BaseButton, BaseCard, CategoryIcon, CategoryTabs, SearchBar, ErrorBoundary |
| facility/ | 7 | FacilityCard, FacilityList, FacilityDetail, FacilityFeatureCard, DetailRow, OperatingStatusBadge, WasteScheduleCard |
| facility/details/ | 8 | ToiletDetail, WifiDetail, ClothesDetail, KioskDetail, ParkingDetail, AedDetail, LibraryDetail, TrashDetail |
| category/ | 2 | CategoryCards, CategoryChips |
| map/ | 2 | FacilityMap, FacilityBottomSheet |
| search/ | 2 | SearchFilters, SearchInput |
| location/ | 1 | CurrentLocationButton |
| navigation/ | 1 | Breadcrumb |
| trash/ | 3 | RegionSelector, ScheduleList, WasteTypeSection |

### Composables (10)

| 이름 | 역할 | API 의존 |
|------|------|---------|
| useErrorHandler | 중앙 에러 핸들링 | - |
| useFacilityDetail | 시설 상세 조회 | GET /:category/:id |
| useFacilityMeta | SEO 메타데이터 생성 | - |
| useFacilitySearch | 위치 기반 검색 | POST /search |
| useGeolocation | 브라우저 위치 API | - |
| useKakaoMap | 카카오 맵 통합 | - |
| useRegionFacilities | 지역별 시설 조회 | GET /region/:city/:district/:category |
| useRegions | 지역 데이터 관리 | GET /meta/regions |
| useStructuredData | JSON-LD 구조화 데이터 | - |
| useWasteSchedule | 쓰레기 배출 일정 | GET /waste-schedules |

## 신뢰도 평가

| 항목 | 신뢰도 | 근거 |
|------|--------|------|
| DB 스키마 | 95% | Prisma 명시적 정의 직접 파싱 |
| API 계약 | 90% | Zod 스키마 + Express 라우트 코드 |
| 화면 구조 | 85% | Vue SFC template + script setup 분석 |
| 컴포넌트 인터페이스 | 85% | defineProps/defineEmits 직접 추출 |
| 컴포저블 계약 | 90% | TypeScript 타입 + 반환값 분석 |
| 동기화 프로세스 | 80% | 스크립트 로직 추론 |

## 활용 방법

### 새 기능 개발 시
```bash
# 새 카테고리 추가 시 기존 패턴 참조
cat specs/domain/resources.yaml     # 모델 필드 구조
cat specs/api/facilities.yaml       # API 엔드포인트 패턴
cat specs/screens/facility-detail.yaml  # 화면 레이아웃
cat specs/components/catalog.yaml   # 컴포넌트 재사용
cat specs/composables/contracts.yaml    # 컴포저블 인터페이스
```

### 명세-코드 동기화 검증
```bash
/sync check  # 드리프트 감지
```

### AI 에이전트 컨텍스트로 활용
```bash
# CLAUDE.md에서 참조하여 구현 가이드로 활용
# 에이전트가 기존 패턴을 정확히 따를 수 있도록 명세 제공
```
