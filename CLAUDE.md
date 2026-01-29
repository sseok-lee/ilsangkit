# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

일상킷 (ilsangkit) - 내 주변 생활 편의 정보, 한 번에 찾기. 위치 기반으로 공공화장실, 쓰레기 배출, 무료 와이파이 정보를 통합 검색합니다.

## Tech Stack

- **Backend**: Express + TypeScript + Prisma + Zod + MySQL
- **Frontend**: Vue 3 + Nuxt 3 + TypeScript + TailwindCSS + Pinia
- **Testing**: Vitest + Supertest (BE), Vitest (FE), Playwright (E2E)
- **Infrastructure**: Cafe24 서버 + Nginx + PM2
- **CI/CD**: GitHub Actions (자동 배포)
- **Map**: Kakao Maps API

## Common Commands

### Backend (from `backend/`)
```bash
npm run dev              # 개발 서버 (tsx watch)
npm run build            # TypeScript 빌드
npm run start            # 프로덕션 서버
npm run test             # 테스트 실행
npm run test:watch       # 테스트 watch 모드
npm run test:coverage    # 커버리지 포함 테스트
npm run lint             # ESLint
npm run lint:fix         # ESLint 자동 수정
npm run format           # Prettier 포맷팅
npm run db:generate      # Prisma 클라이언트 생성
npm run db:migrate       # Prisma 마이그레이션 (development)
npm run db:push          # Prisma 스키마 동기화 (dev only)
npm run db:studio        # Prisma Studio GUI
npm run sync:clothes     # 의류수거함 데이터 동기화
```

### Frontend (from `frontend/`)
```bash
npm run dev              # 개발 서버 (localhost:3000)
npm run build            # 프로덕션 빌드
npm run generate         # 정적 사이트 생성 (SSG)
npm run preview          # 프로덕션 미리보기
npm run test             # 테스트 실행
npm run test:watch       # 테스트 watch 모드
npm run test:coverage    # 커버리지 포함 테스트
npm run lint             # ESLint
npm run lint:fix         # ESLint 자동 수정
npm run format           # Prettier 포맷팅
```

### Docker
```bash
docker compose up -d     # MySQL 컨테이너 시작
docker compose down      # 컨테이너 중지
```

## Architecture

```
Client (Nuxt SSR/SSG) → Backend (Express API) → MySQL (Prisma ORM)
                                ↓
                        공공데이터 API (data.go.kr)
```

### Backend Structure
- `src/routes/` - Express 라우터 (API 엔드포인트)
- `src/services/` - 비즈니스 로직
- `src/schemas/` - Zod 검증 스키마
- `src/middlewares/` - Express 미들웨어
- `src/scripts/` - 데이터 동기화 스크립트
- `prisma/schema.prisma` - DB 스키마

### Frontend Structure
- `app/pages/` - Nuxt 페이지 (SSR/SSG)
- `app/components/` - Vue 컴포넌트
- `app/composables/` - Composition API 훅
- `stores/` - Pinia 상태 관리

## Key Patterns

### Backend API Flow
```typescript
// 1. Route validation with Zod (src/routes/facilities.ts)
const result = SearchSchema.safeParse(req.body)
if (!result.success) {
  return res.status(422).json({ error: 'Validation Error', details: result.error.flatten() })
}

// 2. Service layer business logic (src/services/facilityService.ts)
const facilities = await facilityService.search(result.data)

// 3. Response with metadata
res.json({ items: facilities, total, page, totalPages })
```

### Prisma Client Usage
```typescript
// Singleton pattern (src/lib/prisma.ts)
import prisma from '../lib/prisma'

// Use in routes/services
await prisma.facility.findMany({
  where: { /* filters */ }
})
```

### Frontend Composables Pattern
```typescript
// Composables return readonly state (composables/useFacilitySearch.ts)
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

## Agent Team

이 프로젝트는 `.claude/agents/`에 정의된 전문가 에이전트를 사용합니다:
- `backend-specialist` - Express API, Prisma
- `frontend-specialist` - Vue/Nuxt UI
- `database-specialist` - Prisma 스키마, 마이그레이션
- `test-specialist` - Vitest, Supertest

오케스트레이터 커맨드: `/orchestrate`

## Planning Documents

`docs/planning/`에 기획 문서가 있습니다:
- `01-prd.md` - 제품 요구사항 정의서
- `02-trd.md` - 기술 요구사항 정의서
- `03-user-flow.md` - 사용자 흐름도
- `04-database-design.md` - 데이터베이스 설계
- `05-design-system.md` - 디자인 시스템
- `06-tasks.md` - 개발 태스크 목록
- `07-coding-convention.md` - 코딩 컨벤션

## Environment Variables

### Backend (`backend/.env`)
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

## Development Workflow

### TDD Workflow (Contract-First)
이 프로젝트는 Contract-First TDD를 따릅니다:

1. **RED**: 테스트 먼저 작성 (실패 확인)
2. **GREEN**: 최소 구현 (테스트 통과)
3. **REFACTOR**: 코드 정리 (테스트 유지)

### Testing Strategy
- **Backend**: Vitest + Supertest (API 통합 테스트)
- **Frontend**: Vitest + Vue Test Utils (컴포넌트 테스트)
- **E2E**: Playwright (사용자 플로우 테스트)
- **Coverage Target**: 80% 이상

## Public Data Integration

### 데이터 소스 (6개 카테고리)

| 카테고리 | 데이터 번호 | 제공 방식 |
|----------|------------|----------|
| 공공화장실 | 15012892 | **CSV 파일** |
| 생활쓰레기 | 15155080 | Open API |
| 무료와이파이 | 15013116 | **CSV 파일** |
| 의류수거함 | 15139214 | Open API |
| 무인민원발급기 | 15154774 | Open API |

### 데이터 동기화 전략
- **CSV 기반** (toilet, wifi): `csv-parse` + `iconv-lite`로 파싱
- **API 기반** (trash, clothes, kiosk): REST API 호출
- 주기적 DB 동기화 (크론잡, 일 1회)
- 증분 업데이트 지원

## Deployment

### Production Environment
- **Server**: Cafe24 가상서버 호스팅
- **Web Server**: Nginx (리버스 프록시)
- **Process Manager**: PM2
- **Database**: MySQL (서버 내 설치)

### Deployment Commands
```bash
# 로컬에서 배포 (자동)
git add .
git commit -m "feat: 새 기능 추가"
git push origin main  # GitHub Actions 자동 실행
```
