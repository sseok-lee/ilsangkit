# Naming Conventions

**목적**: 프론트엔드와 백엔드 간 네이밍 차이를 명확히 정의하고, 일관된 용어 사용을 위한 매핑 규칙을 제공합니다.

## 핵심 원칙

1. **프론트엔드**: 사용자 친화적 네이밍 (URL, UI 라벨)
2. **백엔드**: 도메인 정확성 우선 (모델명, 서비스명)
3. **API**: RESTful 관례 준수 (kebab-case)

---

## 1. Trash vs WasteSchedule 매핑

### 1.1 컨텍스트별 네이밍

| 컨텍스트 | 프론트엔드 | 백엔드 | API | 비고 |
|----------|-----------|--------|-----|------|
| **URL 라우트** | `/trash/:id` | - | `/api/waste-schedules/:id` | 사용자 친화적 URL |
| **페이지 컴포넌트** | `pages/trash/[id].vue` | - | - | 파일 기반 라우팅 |
| **Prisma 모델** | - | `WasteSchedule` | - | PascalCase (도메인 정확성) |
| **DB 테이블명** | - | `WasteSchedule` | - | Prisma 스키마 규칙 |
| **서비스 레이어** | - | `wasteScheduleService` | - | camelCase |
| **Composable** | `useWasteSchedule` | - | - | camelCase, use 접두사 |
| **컴포넌트** | `WasteScheduleCard.vue` | - | - | PascalCase |
| **타입 정의** | `WasteScheduleItem` | `WasteScheduleItem` | - | PascalCase (공통) |
| **카테고리 값** | `'trash'` (CategoryId) | - | `category=trash` | 카테고리 enum 값 |
| **UI 라벨** | "쓰레기" / "쓰레기배출" | - | - | 사용자 표시용 |

### 1.2 이유 (Why)

#### 프론트엔드: `trash`
- **짧고 직관적**: URL이 간결하고 외우기 쉬움 (`/trash/123`)
- **사용자 친화적**: 일반 사용자가 이해하기 쉬운 용어
- **검색 최적화**: SEO에 유리한 짧은 키워드
- **기존 관례**: 다른 카테고리와 일관성 (`/toilet`, `/wifi` 등)

#### 백엔드: `wasteSchedule`
- **도메인 정확성**: "배출 일정"이라는 비즈니스 개념을 정확히 표현
- **확장성**: 향후 다른 waste 관련 모델 추가 시 혼동 방지
- **타입 안정성**: 명확한 의미로 인한 개발자 실수 감소
- **데이터 특성**: 지도 마커가 없는 "일정" 데이터임을 명시

---

## 2. 전체 네이밍 규칙

### 2.1 프론트엔드

#### 파일 및 디렉토리
```typescript
// ✅ 페이지 (kebab-case)
pages/trash/[id].vue
pages/[city]/[district]/index.vue

// ✅ 컴포넌트 (PascalCase)
components/facility/FacilityCard.vue
components/trash/WasteTypeSection.vue

// ✅ Composables (camelCase + use 접두사)
composables/useWasteSchedule.ts
composables/useFacilitySearch.ts

// ✅ Utils (camelCase)
utils/categoryIcons.ts
utils/api/facilities.ts

// ✅ Types (camelCase 파일명, PascalCase 타입명)
types/facility.ts → export interface Facility
```

#### 변수 및 함수
```typescript
// ✅ 변수: camelCase
const isLoading = ref(false)
const wasteSchedules = ref<WasteScheduleItem[]>([])

// ✅ 함수: camelCase (동사로 시작)
function getScheduleDetail(id: number) {}
function formatTimeRange(begin: string, end: string) {}

// ✅ 타입/인터페이스: PascalCase
interface WasteScheduleItem {}
type CategoryId = 'toilet' | 'trash' | ...
```

#### URL 및 라우트
```typescript
// ✅ URL: kebab-case, 짧고 명확
/trash/123
/search?category=trash
/seoul/gangnam/toilet

// ✅ Query 파라미터: camelCase
?category=trash&sortBy=distance
```

### 2.2 백엔드

#### 파일 및 디렉토리
```typescript
// ✅ 라우터 (camelCase, 복수형)
routes/wasteSchedules.ts
routes/facilities.ts

// ✅ 서비스 (camelCase + Service 접미사)
services/wasteScheduleService.ts
services/facilityService.ts

// ✅ 스키마 (camelCase)
schemas/wasteSchedule.ts
schemas/facility.ts

// ✅ 스크립트 (camelCase + sync/test 접두사)
scripts/syncTrash.ts
scripts/syncAll.ts
```

#### Prisma 스키마
```prisma
// ✅ 모델명: PascalCase (단수형)
model WasteSchedule {
  id            Int      @id @default(autoincrement())
  city          String
  district      String
  targetRegion  String?  // camelCase 필드명
}

// ✅ Enum: PascalCase
enum SyncStatus {
  running
  success
  failed
}
```

#### 변수 및 함수
```typescript
// ✅ 변수: camelCase
const wasteSchedule = await prisma.wasteSchedule.findUnique()
const totalCount = await prisma.wasteSchedule.count()

// ✅ 함수: camelCase (동사로 시작)
export async function getByRegion() {}
export async function getCities() {}

// ✅ 타입/인터페이스: PascalCase
interface WasteScheduleItem {}
interface WasteScheduleResult {}
```

### 2.3 API 엔드포인트

#### RESTful 규칙
```typescript
// ✅ 리소스명: kebab-case, 복수형
GET  /api/waste-schedules
GET  /api/waste-schedules/:id
GET  /api/waste-schedules/regions
GET  /api/waste-schedules/cities

// ✅ 다른 카테고리 (참고)
GET  /api/facilities?category=toilet
GET  /api/facilities/:id
```

#### 응답 필드
```json
// ✅ JSON 필드: camelCase
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "totalPages": 10
  }
}
```

---

## 3. 카테고리별 네이밍 매핑

### 3.1 전체 카테고리 매핑표

| 카테고리 | URL 라우트 | Prisma 모델 | API 경로 | UI 라벨 | 아이콘 파일 |
|----------|-----------|------------|----------|---------|-----------|
| 화장실 | `/toilet` | `Toilet` | `/api/facilities?category=toilet` | "화장실" | `toilet.webp` |
| 쓰레기 | `/trash` | `WasteSchedule` | `/api/waste-schedules` | "쓰레기" | `trash.webp` |
| 와이파이 | `/wifi` | `Wifi` | `/api/facilities?category=wifi` | "와이파이" | `wifi.webp` |
| 의류수거함 | `/clothes` | `Clothes` | `/api/facilities?category=clothes` | "의류수거함" | `clothes.webp` |
| 발급기 | `/kiosk` | `Kiosk` | `/api/facilities?category=kiosk` | "발급기" | `kiosk.webp` |
| 주차장 | `/parking` | `Parking` | `/api/facilities?category=parking` | "주차장" | `parking.webp` |
| AED | `/aed` | `Aed` | `/api/facilities?category=aed` | "AED" | `aed.webp` |
| 도서관 | `/library` | `Library` | `/api/facilities?category=library` | "도서관" | `library.webp` |

### 3.2 특이 사항

#### WasteSchedule의 특수성
- **다른 카테고리**: 지도 마커 있음 (`lat`, `lng` 필드 필수)
- **WasteSchedule**: 지도 마커 없음 (지역별 일정 정보만 제공)
- **API 분리 이유**: 다른 시설과 검색 방식이 다름 (좌표 vs 지역명)

```typescript
// ❌ WasteSchedule은 facilities API에 포함되지 않음
GET /api/facilities?category=trash  // 404 (존재하지 않음)

// ✅ 별도 API 사용
GET /api/waste-schedules?city=서울특별시&district=강남구
```

---

## 4. 타입 정의 공통화

### 4.1 공유 타입

프론트엔드와 백엔드에서 동일한 구조를 사용하는 타입:

```typescript
// frontend/types/facility.ts + backend/services/wasteScheduleService.ts

interface WasteTypeInfo {
  dayOfWeek?: string
  beginTime?: string
  endTime?: string
  method?: string
}

interface BulkWasteInfo {
  beginTime?: string
  endTime?: string
  method?: string
  place?: string
}

interface WasteScheduleItem {
  id: number
  city: string
  district: string
  targetRegion: string | null
  emissionPlace: string | null
  details: {
    emissionPlaceType?: string
    livingWaste?: WasteTypeInfo
    foodWaste?: WasteTypeInfo
    recyclable?: WasteTypeInfo
    bulkWaste?: BulkWasteInfo
    uncollectedDay?: string
    manageDepartment?: string
    managePhone?: string
  } | null
}
```

### 4.2 네이밍 규칙 통일

| 항목 | 규칙 | 예시 |
|------|------|------|
| Interface | PascalCase | `WasteScheduleItem`, `WasteTypeInfo` |
| Type Alias | PascalCase | `CategoryId`, `WasteType` |
| Enum | PascalCase | `SyncStatus` (백엔드 Prisma) |
| 필드명 | camelCase | `targetRegion`, `emissionPlace` |
| 배열/복수 | 복수형 | `items`, `schedules`, `cities` |

---

## 5. 변환 레이어

### 5.1 프론트엔드에서의 변환

```typescript
// composables/useWasteSchedule.ts

// URL 라우트: /trash/:id
// 내부 Composable: useWasteSchedule
// API 호출: /api/waste-schedules/:id

export function useWasteSchedule() {
  const config = useRuntimeConfig()

  async function getScheduleDetail(id: number) {
    // ✅ API는 waste-schedules 사용
    const response = await $fetch(
      `${config.public.apiBase}/api/waste-schedules/${id}`
    )
    return response.data
  }

  return { getScheduleDetail }
}
```

### 5.2 라우팅 매핑

```typescript
// frontend/pages/trash/[id].vue
// URL: /trash/123
// → API: /api/waste-schedules/123

// frontend/pages/search.vue
// URL: /search?category=trash
// → API: /api/waste-schedules?city=...&district=...
```

---

## 6. 코드 예시

### 6.1 프론트엔드 (사용자 친화적)

```vue
<!-- pages/trash/[id].vue -->
<template>
  <div>
    <h1>{{ data.city }} {{ data.district }} 쓰레기 배출 정보</h1>
    <!-- ... -->
  </div>
</template>

<script setup lang="ts">
import { useWasteSchedule } from '~/composables/useWasteSchedule'

const route = useRoute()
const { getScheduleDetail } = useWasteSchedule()

const id = parseInt(route.params.id as string, 10)
const data = await getScheduleDetail(id)  // API: /api/waste-schedules/123
</script>
```

### 6.2 백엔드 (도메인 정확성)

```typescript
// routes/wasteSchedules.ts
router.get('/:id', asyncHandler(async (req, res) => {
  const id = parseInt(req.params.id, 10)
  const item = await wasteScheduleService.getById(id)  // wasteSchedule 서비스
  res.json({ success: true, data: item })
}))

// services/wasteScheduleService.ts
export async function getById(id: number): Promise<WasteScheduleItem | null> {
  return prisma.wasteSchedule.findUnique({ where: { id } })  // Prisma 모델
}
```

---

## 7. 네이밍 체크리스트

### 새 기능 추가 시 확인사항

- [ ] **URL**: 사용자 친화적이고 짧은가? (예: `/trash` ✅, `/waste-schedule` ❌)
- [ ] **Prisma 모델**: 도메인을 정확히 표현하는가? (예: `WasteSchedule` ✅)
- [ ] **API 경로**: RESTful 관례를 따르는가? (예: `/api/waste-schedules` ✅)
- [ ] **Composable**: `use` 접두사 + camelCase? (예: `useWasteSchedule` ✅)
- [ ] **컴포넌트**: PascalCase? (예: `WasteScheduleCard.vue` ✅)
- [ ] **타입**: PascalCase? (예: `WasteScheduleItem` ✅)
- [ ] **변수**: camelCase? (예: `wasteSchedules` ✅)
- [ ] **일관성**: 기존 카테고리와 패턴이 일치하는가?

---

## 8. 향후 확장 가이드

### 새 카테고리 추가 시

1. **URL 라우트**: 짧고 직관적인 단어 선택 (예: `/pharmacy` 약국)
2. **Prisma 모델**: 도메인 개념 표현 (예: `Pharmacy`)
3. **API 경로**:
   - 지도 마커 있음 → `/api/facilities?category=pharmacy`
   - 지도 마커 없음 → `/api/[새-리소스명]` (waste-schedules 참고)
4. **타입 정의**: `CategoryId` 타입에 추가
5. **아이콘**: `public/icons/category/pharmacy.webp`

### 일관성 유지

```typescript
// ✅ 일관된 패턴
type CategoryId =
  | 'toilet'      // 짧은 영단어
  | 'trash'       // 짧은 영단어
  | 'wifi'        // 약어
  | 'clothes'     // 짧은 영단어
  | 'kiosk'       // 짧은 영단어
  | 'parking'     // 짧은 영단어
  | 'aed'         // 약어
  | 'library'     // 짧은 영단어

// ❌ 피해야 할 패턴
type BadCategoryId =
  | 'public-toilet'           // 너무 길고 복잡
  | 'waste-schedule'          // 백엔드 모델명 노출
  | 'free-wifi'               // 불필요한 형용사
  | 'automated-kiosk-machine' // 과도하게 상세함
```

---

## 9. 자주 하는 실수

### ❌ 안티패턴

```typescript
// ❌ 프론트엔드에서 백엔드 모델명 노출
<NuxtLink to="/waste-schedule/123">  // URL이 너무 길고 복잡

// ❌ 백엔드에서 프론트엔드 용어 사용
model Trash {  // 도메인 개념 부정확 (일정인데 "쓰레기"?)
  id   Int
  city String
}

// ❌ API 경로 불일치
GET /api/trash  // waste-schedules와 다른 패턴
```

### ✅ 올바른 패턴

```typescript
// ✅ 프론트엔드: 사용자 친화적
<NuxtLink to="/trash/123">  // 짧고 직관적

// ✅ 백엔드: 도메인 정확성
model WasteSchedule {  // "배출 일정"이라는 개념 명확
  id   Int
  city String
}

// ✅ API: RESTful 관례
GET /api/waste-schedules  // kebab-case, 복수형
```

---

## 10. 요약

### 핵심 매핑

```
프론트엔드 (사용자)    API (인터페이스)           백엔드 (도메인)
──────────────────    ──────────────────        ─────────────────
/trash/:id         →  /api/waste-schedules/:id  → WasteSchedule 모델
useWasteSchedule   →  /api/waste-schedules      → wasteScheduleService
category=trash     →  ?city=...&district=...    → prisma.wasteSchedule
"쓰레기배출"        →  waste-schedules           → WasteSchedule
```

### 설계 철학

1. **프론트엔드**: 사용자가 이해하기 쉬운 용어
2. **백엔드**: 개발자가 유지보수하기 쉬운 정확한 용어
3. **API**: 두 세계를 연결하는 명확한 계약

이 문서를 통해 개발자는 언제 어떤 네이밍을 사용해야 하는지 명확히 알 수 있습니다.
