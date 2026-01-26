# MSW (Mock Service Worker) 설정

## 개요

프론트엔드 독립 개발을 위한 Mock Service Worker 설정입니다. 백엔드 API 없이도 개발 가능하도록 API 응답을 시뮬레이션합니다.

## 디렉토리 구조

```
mocks/
├── README.md           # 이 파일
├── browser.ts          # MSW 브라우저 워커 설정
├── data/
│   └── facilities.ts   # Mock 데이터 정의
└── handlers/
    └── facilities.ts   # API 핸들러 정의
```

## 자동 활성화

개발 환경에서 MSW는 **자동으로 활성화**됩니다.

```bash
npm run dev
# [MSW] Mock Service Worker started
# [MSW] API Base: http://localhost:8000
```

## 비활성화 방법

### 방법 1: 환경 변수 설정

```bash
NUXT_PUBLIC_DISABLE_MSW=true npm run dev
```

### 방법 2: `.env` 파일 추가

```bash
# frontend/.env
NUXT_PUBLIC_DISABLE_MSW=true
```

## 지원하는 API 엔드포인트

### 메타데이터

- `GET /api/health` - 헬스체크
- `GET /api/meta/categories` - 카테고리 목록
- `GET /api/meta/regions` - 지역 목록

### 시설 검색

- `POST /api/facilities/search` - 시설 검색
  - 필터: `category`, `lat`, `lng`, `radius`
  - 페이지네이션: `page`, `limit`
- `GET /api/facilities/:category/:id` - 시설 상세
- `GET /api/facilities/region/:city/:district/:category` - 지역별 조회
- `GET /api/facilities/popular` - 인기 시설
- `GET /api/facilities/stats` - 통계

## Mock 데이터 커스터마이징

### 새 시설 추가

`mocks/data/facilities.ts` 파일의 `mockFacilities` 배열에 추가:

```typescript
export const mockFacilities = [
  // 기존 데이터...
  {
    id: 'new-facility-1',
    category: 'toilet',
    name: '새로운 화장실',
    address: '서울시 강남구 테헤란로 123',
    roadAddress: '서울시 강남구 테헤란로 123',
    lat: 37.5000,
    lng: 127.0300,
    city: '서울',
    district: '강남구',
    distance: 500,
  },
];
```

### 새 카테고리 추가

`mocks/data/facilities.ts` 파일의 `mockCategories` 배열에 추가:

```typescript
export const mockCategories = [
  // 기존 카테고리...
  {
    id: 'new-category',
    name: '새 카테고리',
    icon: '🆕',
    description: '새로운 카테고리 설명',
    sortOrder: 7,
    isActive: true,
  },
];
```

### 시설 상세 정보 추가

`mocks/data/facilities.ts` 파일의 `mockFacilityDetails`에 추가:

```typescript
export const mockFacilityDetails = {
  // 기존 상세 정보...
  'new-facility-1': {
    operatingHours: '09:00~18:00',
    // 추가 정보...
  },
};
```

## 새 핸들러 추가

### 1. 핸들러 정의

`mocks/handlers/` 디렉토리에 새 파일 생성:

```typescript
// mocks/handlers/myHandlers.ts
import { http, HttpResponse } from 'msw';

export const myHandlers = [
  http.get('/api/my-endpoint', () => {
    return HttpResponse.json({
      success: true,
      data: { message: 'Hello!' },
    });
  }),
];
```

### 2. 브라우저 워커에 등록

`mocks/browser.ts` 파일 수정:

```typescript
import { setupWorker } from 'msw/browser';
import { facilityHandlers } from './handlers/facilities';
import { myHandlers } from './handlers/myHandlers';

export const worker = setupWorker(
  ...facilityHandlers,
  ...myHandlers
);
```

## 테스트

MSW 핸들러는 Vitest로 테스트됩니다:

```bash
# 전체 테스트 실행
npm test

# MSW 핸들러 테스트만 실행
npm test -- tests/mocks/handlers.test.ts

# Watch 모드
npm run test:watch
```

## 디버깅

### 네트워크 요청 확인

브라우저 개발자 도구 → Network 탭에서 MSW가 가로챈 요청 확인:

- 요청 옆에 `[MSW]` 표시가 있으면 Mock 응답
- `onUnhandledRequest: 'bypass'` 설정으로 처리되지 않은 요청은 실제 서버로 전달

### 콘솔 로그

MSW가 활성화되면 콘솔에 다음 메시지 출력:

```
[MSW] Mock Service Worker started
[MSW] API Base: http://localhost:8000
```

### 핸들러가 작동하지 않을 때

1. **서비스 워커 재등록**
   - 브라우저 개발자 도구 → Application → Service Workers
   - `mockServiceWorker.js` 제거 후 페이지 새로고침

2. **환경 변수 확인**
   ```bash
   echo $NUXT_PUBLIC_DISABLE_MSW  # 비어있어야 함
   ```

3. **브라우저 캐시 삭제**
   - 하드 리로드: `Cmd + Shift + R` (Mac) / `Ctrl + Shift + R` (Windows)

## 프로덕션 빌드

프로덕션 빌드에서는 MSW가 **자동으로 제외**됩니다:

```bash
npm run build  # MSW 코드 포함 안 됨
npm run generate  # SSG에도 포함 안 됨
```

## 참고 자료

- [MSW 공식 문서](https://mswjs.io/)
- [MSW with Nuxt](https://mswjs.io/docs/integrations/nuxt)
- [MSW Browser](https://mswjs.io/docs/integrations/browser)
