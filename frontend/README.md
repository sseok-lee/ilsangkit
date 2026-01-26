# 일상킷 Frontend

Vue 3 + Nuxt 3 + TypeScript + TailwindCSS로 구축된 프론트엔드 애플리케이션

## 기술 스택

- **Framework**: Nuxt 3.21.0
- **UI Framework**: Vue 3.5.27
- **Styling**: TailwindCSS 3.4.0
- **State Management**: Pinia
- **Testing**: Vitest + Vue Test Utils
- **Build Tool**: Vite 6.4.1

## 프로젝트 구조

```
frontend/
├── app/
│   ├── pages/          # Nuxt 페이지 (SSR/SSG)
│   ├── components/     # Vue 컴포넌트
│   ├── composables/    # Composition API 훅
│   ├── layouts/        # 레이아웃 컴포넌트
│   └── app.vue         # 루트 컴포넌트
├── stores/             # Pinia 상태 관리
├── tests/              # 테스트 파일
├── mocks/              # 테스트 목 데이터
├── types/              # TypeScript 타입 정의
├── utils/
│   └── api/            # API 클라이언트 함수
├── assets/
│   └── css/
│       └── main.css    # Global CSS + Tailwind
├── nuxt.config.ts      # Nuxt 설정
├── tailwind.config.js  # Tailwind 설정
└── vitest.config.ts    # Vitest 설정
```

## 설치

```bash
npm install
```

## 개발 서버

```bash
npm run dev
```

개발 서버: http://localhost:3000

## 빌드

```bash
# 프로덕션 빌드
npm run build

# 정적 사이트 생성 (SSG)
npm run generate

# 프로덕션 미리보기
npm run preview
```

## 테스트

```bash
# 테스트 실행
npm run test

# Watch 모드
npm run test:watch

# 커버리지 포함
npm run test:coverage
```

## 코드 품질

```bash
# 코드 포맷팅
npm run format

# ESLint (현재 비활성화 - 추후 설정 필요)
npm run lint
npm run lint:fix
```

## 환경 변수

`.env` 파일을 생성하고 다음 변수를 설정하세요:

```bash
NUXT_PUBLIC_API_BASE=http://localhost:8000
NUXT_PUBLIC_KAKAO_MAP_KEY=your-kakao-map-api-key
NUXT_PUBLIC_GA_ID=G-XXXXXXXXXX
```

## 디자인 시스템

이 프로젝트는 `docs/planning/05-design-system.md`에 정의된 디자인 시스템을 따릅니다:

- **Primary Color**: Blue (#3b82f6)
- **Typography**: Pretendard Variable
- **Spacing**: 4px 기반 시스템
- **Breakpoints**: Mobile First (sm: 640px, md: 768px, lg: 1024px)

## 주요 기능

- Server-Side Rendering (SSR)
- Static Site Generation (SSG)
- 반응형 디자인 (Mobile First)
- Composition API 기반 컴포넌트
- Type-safe API 통신
- Vitest 기반 단위 테스트

## 개발 가이드

### 컴포넌트 작성

```vue
<template>
  <div class="card-base">
    <h2 class="text-xl font-semibold">{{ title }}</h2>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
}>()
</script>
```

### Composable 작성

```typescript
// composables/useFacilitySearch.ts
export function useFacilitySearch() {
  const loading = ref(false)
  const results = ref<Facility[]>([])

  async function search(params: SearchParams) {
    loading.value = true
    // ... fetch logic
  }

  return { loading: readonly(loading), results: readonly(results), search }
}
```

## 배포

GitHub Actions를 통해 자동 배포됩니다. `main` 브랜치에 푸시하면 자동으로 빌드 및 배포가 실행됩니다.

## 라이선스

Private
