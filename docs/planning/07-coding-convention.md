# 07. 코딩 컨벤션

## 일반 규칙

### 언어
- 코드: 영어
- 주석: 한국어 허용 (복잡한 비즈니스 로직 설명)
- 커밋 메시지: 한국어

### 포매팅
- Prettier 사용
- 들여쓰기: 2 spaces
- 줄 길이: 100자 제한
- 세미콜론: 사용 안 함 (TypeScript/JavaScript)
- 따옴표: 작은따옴표

```json
// .prettierrc
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "printWidth": 100,
  "trailingComma": "es5"
}
```

---

## TypeScript 규칙

### 타입 정의

```typescript
// ✅ Good: interface 사용 (확장 가능)
interface Facility {
  id: string
  name: string
  category: FacilityCategory
}

// ✅ Good: type alias (유니온, 유틸리티 타입)
type FacilityCategory = 'toilet' | 'trash' | 'wifi'

// ❌ Bad: any 사용
const data: any = fetchData()

// ✅ Good: unknown 후 타입 가드
const data: unknown = fetchData()
if (isFacility(data)) {
  console.log(data.name)
}
```

### 명명 규칙

| 대상 | 규칙 | 예시 |
|------|------|------|
| 변수 | camelCase | `facilityList`, `searchQuery` |
| 상수 | UPPER_SNAKE_CASE | `MAX_RESULTS`, `API_BASE_URL` |
| 함수 | camelCase | `fetchFacilities`, `handleSearch` |
| 클래스 | PascalCase | `FacilityService`, `ApiClient` |
| 인터페이스 | PascalCase | `Facility`, `SearchParams` |
| 타입 | PascalCase | `FacilityCategory`, `ApiResponse` |
| 파일 (컴포넌트) | PascalCase | `FacilityCard.vue` |
| 파일 (기타) | camelCase | `facilityService.ts` |
| 디렉토리 | kebab-case | `api-client`, `search-results` |

### 함수 스타일

```typescript
// ✅ Good: 화살표 함수 (단순한 경우)
const add = (a: number, b: number) => a + b

// ✅ Good: function 선언 (복잡한 경우, hoisting 필요)
function searchFacilities(params: SearchParams): Promise<Facility[]> {
  // ...
}

// ✅ Good: async/await 사용
async function fetchData() {
  try {
    const response = await api.get('/facilities')
    return response.data
  } catch (error) {
    handleError(error)
    throw error
  }
}
```

---

## Vue/Nuxt 규칙

### 컴포넌트 구조

```vue
<script setup lang="ts">
// 1. imports
import { ref, computed } from 'vue'
import type { Facility } from '~/types'

// 2. props & emits
const props = defineProps<{
  facility: Facility
  selected?: boolean
}>()

const emit = defineEmits<{
  click: [facility: Facility]
}>()

// 3. composables
const { $api } = useNuxtApp()

// 4. reactive state
const isLoading = ref(false)

// 5. computed
const displayName = computed(() => props.facility.name || '이름 없음')

// 6. methods
function handleClick() {
  emit('click', props.facility)
}

// 7. lifecycle
onMounted(() => {
  // ...
})
</script>

<template>
  <div
    class="facility-card"
    :class="{ 'facility-card--selected': selected }"
    @click="handleClick"
  >
    <span class="facility-card__icon">{{ facility.category }}</span>
    <div class="facility-card__content">
      <h3 class="facility-card__name">{{ displayName }}</h3>
      <p class="facility-card__address">{{ facility.address }}</p>
    </div>
  </div>
</template>

<style scoped>
.facility-card {
  @apply p-4 bg-white border rounded-lg cursor-pointer;
}
</style>
```

### 컴포넌트 명명

```
components/
├── facility/
│   ├── FacilityCard.vue      # 시설 카드
│   ├── FacilityList.vue      # 시설 목록
│   └── FacilityDetail.vue    # 시설 상세
├── search/
│   ├── SearchInput.vue       # 검색 입력
│   └── SearchFilters.vue     # 검색 필터
└── common/
    ├── BaseButton.vue        # 기본 버튼
    ├── BaseCard.vue          # 기본 카드
    └── BaseModal.vue         # 기본 모달
```

### Composables 패턴

```typescript
// composables/useFacilitySearch.ts
export function useFacilitySearch() {
  const results = ref<Facility[]>([])
  const loading = ref(false)
  const error = ref<Error | null>(null)

  async function search(params: SearchParams) {
    loading.value = true
    error.value = null

    try {
      const { data } = await $fetch('/api/facilities/search', {
        method: 'POST',
        body: params,
      })
      results.value = data.items
    } catch (e) {
      error.value = e as Error
    } finally {
      loading.value = false
    }
  }

  return {
    results: readonly(results),
    loading: readonly(loading),
    error: readonly(error),
    search,
  }
}
```

---

## Express/Backend 규칙

### 라우트 구조

```typescript
// src/routes/facilities.ts
import { Router } from 'express'
import { z } from 'zod'
import { facilityService } from '../services/facilityService'

const router = Router()

// 검색 스키마
const SearchSchema = z.object({
  keyword: z.string().optional(),
  category: z.enum(['toilet', 'trash', 'wifi']).optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  radius: z.number().min(100).max(10000).default(1000),
  page: z.number().min(1).default(1),
  limit: z.number().min(1).max(100).default(20),
})

// POST /api/facilities/search
router.post('/search', async (req, res, next) => {
  try {
    const result = SearchSchema.safeParse(req.body)
    if (!result.success) {
      return res.status(422).json({
        error: 'Validation Error',
        details: result.error.flatten(),
      })
    }

    const facilities = await facilityService.search(result.data)
    res.json(facilities)
  } catch (error) {
    next(error)
  }
})

export default router
```

### 서비스 레이어

```typescript
// src/services/facilityService.ts
import prisma from '../lib/prisma'
import type { SearchParams, SearchResult } from '../types'

class FacilityService {
  async search(params: SearchParams): Promise<SearchResult> {
    const { keyword, category, lat, lng, radius, page, limit } = params
    const skip = (page - 1) * limit

    const where = this.buildWhereClause(params)

    const [items, total] = await Promise.all([
      prisma.facility.findMany({
        where,
        take: limit,
        skip,
        orderBy: { viewCount: 'desc' },
      }),
      prisma.facility.count({ where }),
    ])

    return {
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    }
  }

  private buildWhereClause(params: SearchParams) {
    // ...
  }
}

export const facilityService = new FacilityService()
```

### 에러 처리

```typescript
// src/middlewares/errorHandler.ts
import { Request, Response, NextFunction } from 'express'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('[Error]', err)

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.message,
    })
  }

  res.status(500).json({
    error: 'Internal Server Error',
  })
}
```

---

## 테스트 규칙

### 파일 구조

```
__tests__/
├── unit/
│   ├── services/
│   │   └── facilityService.test.ts
│   └── utils/
│       └── helpers.test.ts
├── integration/
│   └── routes/
│       └── facilities.test.ts
└── fixtures/
    └── facilities.ts
```

### 테스트 작성 패턴

```typescript
// __tests__/unit/services/facilityService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { facilityService } from '../../../src/services/facilityService'

describe('FacilityService', () => {
  describe('search', () => {
    it('키워드로 시설을 검색한다', async () => {
      // Arrange
      const params = { keyword: '화장실', page: 1, limit: 10 }

      // Act
      const result = await facilityService.search(params)

      // Assert
      expect(result.items).toBeDefined()
      expect(result.items.length).toBeLessThanOrEqual(10)
    })

    it('카테고리 필터가 적용된다', async () => {
      // Arrange
      const params = { category: 'toilet' as const, page: 1, limit: 10 }

      // Act
      const result = await facilityService.search(params)

      // Assert
      result.items.forEach(item => {
        expect(item.category).toBe('toilet')
      })
    })
  })
})
```

### 테스트 명명

```typescript
// ✅ Good: 한국어로 명확하게
it('키워드로 시설을 검색한다', async () => {})
it('검색 결과가 없으면 빈 배열을 반환한다', async () => {})
it('잘못된 카테고리는 422 에러를 반환한다', async () => {})

// ❌ Bad: 모호한 설명
it('should work', async () => {})
it('test search', async () => {})
```

---

## Git 규칙

### 브랜치 전략

```
main                    # 프로덕션
├── feature/검색-기능    # 기능 개발
├── feature/지도-연동    # 기능 개발
├── fix/검색-버그       # 버그 수정
└── chore/의존성-업데이트 # 기타 작업
```

### 커밋 메시지

```
<type>: <subject>

<body> (선택)

<footer> (선택)
```

**Type:**
- `feat`: 새 기능
- `fix`: 버그 수정
- `docs`: 문서 수정
- `style`: 코드 스타일 (포매팅)
- `refactor`: 리팩토링
- `test`: 테스트
- `chore`: 기타 (빌드, 설정)

**예시:**
```
feat: 시설 검색 API 구현

- POST /api/facilities/search 엔드포인트 추가
- Zod 스키마 검증 적용
- 페이지네이션 지원
```

---

## 디렉토리 구조

### Frontend (Nuxt 3)

```
frontend/
├── app/
│   ├── pages/              # 페이지 컴포넌트
│   │   ├── index.vue       # 메인 페이지
│   │   ├── search.vue      # 검색 결과
│   │   ├── [category]/
│   │   │   └── [id].vue    # 상세 페이지
│   │   └── [city]/
│   │       └── [district]/
│   │           └── [category].vue  # 지역별 페이지
│   ├── components/         # 컴포넌트
│   │   ├── facility/
│   │   ├── search/
│   │   ├── map/
│   │   └── common/
│   ├── composables/        # Composition API 훅
│   │   ├── useFacilitySearch.ts
│   │   └── useGeolocation.ts
│   ├── layouts/            # 레이아웃
│   │   └── default.vue
│   └── assets/             # 정적 자원
│       └── css/
│           └── main.css
├── server/                 # Nuxt 서버
│   └── api/                # 서버 API (필요시)
├── public/                 # 정적 파일
├── types/                  # 타입 정의
│   └── index.ts
├── nuxt.config.ts
├── tailwind.config.js
└── package.json
```

### Backend (Express)

```
backend/
├── src/
│   ├── routes/             # API 라우트
│   │   ├── facilities.ts
│   │   ├── meta.ts
│   │   └── health.ts
│   ├── services/           # 비즈니스 로직
│   │   ├── facilityService.ts
│   │   └── syncService.ts
│   ├── schemas/            # Zod 스키마
│   │   └── facility.ts
│   ├── middlewares/        # 미들웨어
│   │   ├── errorHandler.ts
│   │   └── rateLimiter.ts
│   ├── scripts/            # 스크립트
│   │   └── syncFacilities.ts
│   ├── lib/                # 유틸리티
│   │   └── prisma.ts
│   ├── types/              # 타입 정의
│   │   └── index.ts
│   └── app.ts              # Express 앱
├── prisma/
│   ├── schema.prisma       # DB 스키마
│   └── seed.ts             # 초기 데이터
├── __tests__/              # 테스트
└── package.json
```

---

## 보안 규칙

### 환경 변수

```typescript
// ✅ Good: 환경 변수에서 로드
const apiKey = process.env.OPENAPI_SERVICE_KEY

// ❌ Bad: 하드코딩
const apiKey = 'abc123xyz'
```

### SQL Injection 방지

```typescript
// ✅ Good: Prisma 사용 (파라미터화 쿼리)
const facilities = await prisma.facility.findMany({
  where: { name: { contains: keyword } }
})

// ❌ Bad: raw query에 직접 삽입
const facilities = await prisma.$queryRaw`
  SELECT * FROM Facility WHERE name LIKE '%${keyword}%'
`
```

### XSS 방지

```vue
<!-- ✅ Good: Vue 자동 이스케이프 -->
<p>{{ userInput }}</p>

<!-- ❌ Bad: v-html 사용 -->
<p v-html="userInput"></p>
```
