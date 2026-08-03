# 시설·부동산 상세 페이지 — 네이버 블로그 후기 섹션 설계

- **작성일**: 2026-05-15
- **범위**: 시설 상세 페이지 (`/[category]/[id]`, 15개 카테고리) + 부동산 단지 상세 페이지 (6개 realEstateType)
- **목표**: Naver Search API로 시설명·단지명 기반 블로그 후기를 가져와 (1) 사용자 체험·정보 가치 추가, (2) 네이버 알고리즘 친화 신호 증가, (3) thin content 페이지 색인률 추가 보강

## 0. 사전 컨텍스트

- 동일 패턴의 YouTube 섹션이 직전 PR(#257)에서 머지됨. 아키텍처·캐시·quota·lazy CSR·SSR cache-only 패턴을 그대로 재사용
- YouTube 섹션 구현 중 발견된 핵심 교훈: **lazy CSR sentinel은 layout box를 가져야 함** (display:none이면 IntersectionObserver가 발화하지 않음). 본 설계는 처음부터 `min-h-[1px]` sentinel 패턴 적용
- Naver Search API 자격증명 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 이미 운영 환경변수에 등록되어 있음 — 추가 설정 불필요
- 본 섹션은 YouTube 섹션 **아래**에 별도 섹션으로 배치 (시각적 구분)

## 1. 적용 범위 & UX

### 대상 페이지
- **시설 상세** `/[category]/[id]` 15종: toilet, wifi, clothes, parking, aed, library, hospital, pharmacy, park, school, market, childcare, ev-charger, sports
- **부동산 단지 상세** 6종 realEstateType: apt-sale, apt-rent, villa-sale, villa-rent, offitel-sale, offitel-rent

### 배치
- 시설 상세: `FacilityYoutubeSection` 바로 아래
- 부동산 단지 상세: 본문 하단 (거래 내역 카드 다음, 주변 시설/지도 이전 적절 위치 — 실제 위치는 페이지 구조 확인 후 결정)

### 표시
- 카드 **5개**, 세로 스택 (썸네일 없어서 그리드 안 함)
- 카드 = 제목(굵게, 1줄 클램프) + 80자 스니펫(`description` strip-HTML, 2줄 클램프) + 블로거명 · 게시 날짜
- 모바일·데스크톱 동일 레이아웃

### 클릭 동작
- 카드 자체가 `<a target="_blank" rel="nofollow noopener noreferrer">`
- 네이버 블로그 원문으로 새 탭 이동 (iframe 임베드 불가 — Naver는 X-Frame-Options 차단)

### 결과 없음 / 저품질
- 필터링 후 3건 미만이면 콘텐츠 미렌더 (sentinel section만 DOM에 남음, layout 보존)
- 빈 결과도 `itemCount=0`으로 캐싱 (negative caching, 14일 재호출 차단)

### 헤더 / 신뢰 시그널
- "방문자 후기" + 작은 캡션 "네이버 블로그 검색 · 자동 수집"
- "신고" 버튼 / 협찬 표시 UI는 MVP 외 (운영하며 필요 시 추가)

## 2. 검색 쿼리 & 결과 필터링

### Naver Search API
- 엔드포인트: `GET https://openapi.naver.com/v1/search/blog.json`
- 헤더: `X-Naver-Client-Id`, `X-Naver-Client-Secret` (서버사이드 호출 — 클라이언트에 키 노출 금지)
- 파라미터: `query`, `display=15`, `start=1`, `sort=sim`

### 쿼리 빌더 — 시설

`backend/src/services/naverBlogService.ts::buildNaverBlogQuery(facility, category)` 한 함수.

| 카테고리 | 쿼리 패턴 |
|---|---|
| parking | `{name} {district} 주차장` |
| toilet | `{name} 공중화장실 {district}` |
| park | `{name} {cityShort}` |
| pharmacy | `{name} {district} 약국` |
| ev-charger | `{name} 전기차 충전소` |
| childcare | `{name} {district} 어린이집` |
| aed | `{name} AED {district}` |
| library / hospital / school / market / sports / wifi / clothes / subway | `{name} {district}` |

`region` = `district.trim()` 비어있으면 `cityShort(city)`. 메트로폴리탄 city → 단축형 매핑 (`서울특별시 → 서울` 등 9종). YouTube 빌더와 동일 로직.

### 쿼리 빌더 — 부동산

`backend/src/services/naverBlogService.ts::buildNaverBlogQueryForRealEstate(building, realEstateType)` 별도 함수.

| realEstateType | 라벨 토큰 |
|---|---|
| apt-sale | `아파트 매매` |
| apt-rent | `아파트 전세` |
| villa-sale | `빌라 매매` |
| villa-rent | `빌라 전세` |
| offitel-sale | `오피스텔 매매` |
| offitel-rent | `오피스텔 전세` |

쿼리 형식: `{buildingName} {district} {realEstateTypeLabel}`
예: `롯데캐슬 골드 종로구 아파트 매매`

부동산 `building` 입력 타입: `{ buildingName, city, district }`.

### 결과 필터링 (적극적)

`filterNaverBlogPosts(posts, opts)`에서 다음 순서로 적용:

1. **광고 키워드 블랙리스트** (제목 또는 description 어느 쪽에라도 포함 시 제외):
   - `체험단`, `협찬`, `광고`, `#광고`, `#협찬`, `[광고]`, `[Ad]`, `[AD]`, `원고료`, `무료초대`, `소정의 대가`, `제공받아`
2. **블로거명/도메인 차단 리스트**: 초기 빈 배열, 발견 시 코드 상수에 누적 (배포 필요)
3. **너무 오래된 글 제외**: `postdate` 파싱(YYYYMMDD), 현재 시점 기준 3년 초과면 제외
4. **너무 짧은 description 제외**: 30자 미만이면 정보성 부족 → 제외
5. 필터링 통과 글 중 상위 **5개** 선별

### API 응답 매핑 — `RawNaverBlogPost`

```ts
interface RawNaverBlogPost {
  url: string         // <link> from API
  title: string       // strip <b>...</b> HTML tags
  description: string // strip HTML tags, then slice to 80자
  bloggerName: string // bloggername
  bloggerLink: string // bloggerlink
  postDate: string    // postdate (YYYYMMDD)
}
```

`stripHtml(input)` 헬퍼: `<b>`, `<i>`, `&quot;`, `&amp;`, `&lt;`, `&gt;`, `&#x27;`, `&#39;`, `&nbsp;` 등 엔티티/태그 안전하게 제거. RegExp 단순 치환 (DOM 파서 X — Node 서버사이드).

### 최소 결과 임계값

```ts
export const NAVER_BLOG_MIN_RESULTS = 3
```

필터링 결과가 이 미만이면 빈 배열로 캐싱 → 섹션 자동 숨김.

## 3. 백엔드 캐싱 & API 한도 관리

### 환경 변수 (기존)
- `NAVER_CLIENT_ID`
- `NAVER_CLIENT_SECRET`

별도 신규 변수 없음. 키 회전 정책은 별도 운영 이슈.

### 캐시 테이블 (Prisma)

**시설용:**

```prisma
model FacilityNaverBlogCache {
  id         Int      @id @default(autoincrement())
  category   String   @db.VarChar(20)
  facilityId String   @db.VarChar(100)
  query      String   @db.VarChar(300)
  posts      Json
  itemCount  Int      @default(0)
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime

  @@unique([category, facilityId])
  @@index([expiresAt])
}
```

**부동산용:**

```prisma
model RealEstateNaverBlogCache {
  id           Int      @id @default(autoincrement())
  realEstateType String   @db.VarChar(20)
  buildingKey  String   @db.VarChar(200)
  query        String   @db.VarChar(300)
  posts        Json
  itemCount    Int      @default(0)
  fetchedAt    DateTime @default(now())
  expiresAt    DateTime

  @@unique([realEstateType, buildingKey])
  @@index([expiresAt])
}
```

- `buildingKey`: 부동산 단지 식별자. **결정**: `{city}|{district}|{buildingName}` 컴포지트 문자열을 정규화(공백 trim + 소문자 변환 없음 — 한글이므로) 후 사용. 부동산 detail URL 4-segment 패턴(`/real-estate/{realEstateType}/{city}/{district}/{buildingName}`)과 1:1 매핑. internal DB row id를 쓰지 않는 이유: 같은 단지가 realEstateType별로 별도 row를 가질 수 있어 단지명 단위 결합이 더 안정적.
- `posts` JSON 컬럼: `RawNaverBlogPost[]` 직렬화
- `itemCount=0` negative caching 정상 동작

### TTL
- **14일** (`expiresAt = fetchedAt + 14d`)
- YouTube(30일)보다 짧음 — 블로그는 갱신 빈도 높음

### API 엔드포인트

```
GET /api/facilities/:category/:id/naver-blog?ssr=1
GET /api/real-estate/:realEstateType/:buildingKey/naver-blog?ssr=1
```

- 양쪽 모두 `?ssr=1` 시 cache-only 모드 (캐시 미스면 빈 배열, API 호출 없음)
- `validate(Schema, 'params')` Zod 검증 + `asyncHandler()` 래핑 (프로젝트 컨벤션)
- 응답: `{ success: true, data: { posts: RawNaverBlogPost[] } }`
- 422: 잘못된 카테고리/realEstateType
- 404: 시설/단지 미존재
- 200 + 빈 배열: 결과 없음 (정상)

### Quota guard

`backend/src/services/naverBlogQuotaService.ts`:
- 인메모리 카운터, KST 자정 리셋 (YouTube과 동일 패턴, factory function 재사용 가능 검토 — 단 별도 인스턴스)
- 일일 한도 **5,000건** (Naver 무료 25K의 20%, 다른 잠재 사용처 보호)
- `createNaverBlogQuotaCounter({ dailyLimit: 5000 })` + 모듈 싱글톤 `naverBlogQuotaCounter`

### 처리 흐름

1. 캐시 조회 (`category+facilityId` 또는 `realEstateType+buildingKey`)
2. 히트 + `expiresAt > now` → posts 반환
3. 미스 + `options.cacheOnly` → 빈 배열 (SSR 모드)
4. 미스 + quota 통과 → buildQuery → fetchFromNaver → filter → 5건 이상이면 그대로, 아니면 빈 배열 → upsert → 반환
5. quota 소진 → 빈 배열, no upsert
6. API 4xx/5xx 또는 네트워크 에러 → 빈 배열, no upsert (재시도 가능 유지)

### 동시성
- `inFlight: Map<string, Promise<RawNaverBlogPost[]>>` (YouTube 캐시 서비스와 동일 패턴) — 시설/부동산 각각 별도 키 스페이스

### 서비스 구조

```
backend/src/services/
├── naverBlogService.ts        # buildQuery × 2, filterPosts, stripHtml, fetchFromNaver, MIN_RESULTS, types
├── naverBlogCacheService.ts   # getOrFetchNaverBlogForFacility, getOrFetchNaverBlogForRealEstate
├── naverBlogQuotaService.ts   # daily counter
```

`naverBlogCacheService`는 단일 파일에서 시설/부동산 둘 다 export.

### 워밍업
없음 (lazy fill — YouTube과 동일)

## 4. 프론트엔드 컴포넌트 & 성능

### 컴포넌트 구조

```
frontend/components/blog/
├── BlogReviewSection.vue   # 섹션 컨테이너 (IntersectionObserver lazy fetch, sentinel)
└── BlogReviewCard.vue       # 카드 (제목+스니펫+블로거+날짜, 클릭 시 새 탭)
```

`facility/` 폴더에 두지 않은 이유: 부동산도 사용하므로 카테고리 중립적 위치.

### Composable

`frontend/composables/useBlogReviews.ts`

```ts
interface UseBlogReviewsResult {
  posts: Readonly<Ref<RawNaverBlogPost[]>>
  loading: Readonly<Ref<boolean>>
  fetchPosts(kind: 'facility' | 'real-estate', primary: string, secondary: string): Promise<void>
}

export function useBlogReviews(): UseBlogReviewsResult
```

- `kind='facility'` → `/api/facilities/{primary}/{secondary}/naver-blog`
- `kind='real-estate'` → `/api/real-estate/{primary}/{secondary}/naver-blog`
- `readonly()` refs, `lastKey + inFlight` dedup (YouTube composable 패턴)
- 에러 시 빈 배열, throw 없음

### Section 컴포넌트 props

```ts
defineProps<{
  kind: 'facility' | 'real-estate'
  primaryKey: string
  secondaryKey: string
}>()
```

**사용 예시:**
- 시설: `<BlogReviewSection kind="facility" :primary-key="facility.category" :secondary-key="facility.id" />`
- 부동산: `<BlogReviewSection kind="real-estate" :primary-key="realEstateType" :secondary-key="buildingKey" />`

### Lazy CSR + Sentinel

YouTube 섹션 fix에서 배운 패턴:
- 항상 `<section ref="rootEl" data-testid="blog-section" class="min-h-[1px] ...">` 렌더 (1px sentinel)
- 콘텐츠(헤더/카드)는 내부 `<template v-if="hasResults || loading">` 가드
- `IntersectionObserver`(rootMargin: '200px')가 sentinel에 발화 → fetchPosts → 응답 도착 → hasResults 갱신

### 카드 디자인 (`BlogReviewCard.vue`)

레이아웃:
- 상단: 제목 (text-base font-semibold, line-clamp-1)
- 중간: 80자 스니펫 (text-sm text-slate-600, line-clamp-2, leading-relaxed)
- 하단: 블로거명 · 게시 날짜 (text-xs text-slate-500), 오른쪽에 `open_in_new` material symbol

- 카드 전체가 `<a>` 태그
- 속성: `target="_blank"`, `rel="nofollow noopener noreferrer"`
- 호버 시 그림자만 강조 (그라데이션 X)

### Schema markup
- 출력하지 않음. 우리가 publisher가 아니며 외부 콘텐츠 Review schema는 Google Helpful Content 리스크
- `useStructuredData`에 새 helper 추가 없음

### Material Symbols
- `open_in_new` 아이콘 — `nuxt.config.ts`의 Material Symbols 서브셋에 누락이면 추가 필요 (YouTube fix에서 했던 것과 동일 처리)

### CSP
- 카드의 `<a>` 링크는 외부 도메인이지만 frame이 아니므로 CSP 변경 불필요
- SSR 시 외부 이미지 로드 X (썸네일 없음) — img-src 변경 불필요

## 5. 테스트 전략

프로젝트 메모리 룰: TDD 워크플로우, 테스트 먼저.

### 백엔드 (vitest)

`backend/__tests__/services/naverBlogService.test.ts`
- `buildNaverBlogQuery(facility, category)` — 시설 11 카테고리 케이스
- `buildNaverBlogQueryForRealEstate(building, realEstateType)` — 부동산 6 타입 케이스
- `stripHtml(input)` — `<b>`, `<i>`, 엔티티 `&amp;`/`&quot;`/`&#39;`/`&nbsp;` 처리
- `filterNaverBlogPosts(posts, opts)` — 광고 키워드 차단, 도메인 블랙리스트, 3년 초과 제외, description 30자 미만 제외, 상위 5건
- `fetchFromNaver(query, clientId, secret)` — fetch mock:
  - 정상 응답 → RawNaverBlogPost 배열 매핑 + HTML strip 적용
  - 4xx/5xx/네트워크 에러 → 빈 배열
  - 키(clientId 또는 secret) 미설정 → 호출 스킵, 빈 배열

`backend/__tests__/services/naverBlogCacheService.test.ts`
- `getOrFetchNaverBlogForFacility` — 6건: 캐시 히트, 캐시 미스+quota 여유, quota 소진, 만료 캐시 미스 처리, negative caching, in-flight dedup
- `getOrFetchNaverBlogForRealEstate` — 3건: 핵심 시나리오 (히트, 미스+성공, 미스+quota 소진)
- `cacheOnly` 옵션 — `cacheOnly=true`에서 캐시 미스 시 fetch 호출 없이 빈 배열

`backend/__tests__/services/naverBlogQuotaService.test.ts`
- 3건: 첫 호출 허용, 한도 도달, KST 자정 리셋

`backend/__tests__/routes/facilityNaverBlog.test.ts`
- 5건: 정상 200, 시설 미존재 404, 잘못된 category 422, 빈 배열 200, `?ssr=1` cache-only 전달 검증

`backend/__tests__/routes/realEstateNaverBlog.test.ts`
- 5건: 정상 200, 단지 미존재 404, 잘못된 realEstateType 422, 빈 배열 200, `?ssr=1` cache-only 전달 검증

### 프론트엔드 (vitest + happy-dom)

`frontend/tests/composables/useBlogReviews.test.ts`
- 5건: 초기 상태, kind='facility' URL 생성, kind='real-estate' URL 생성, 에러 시 빈 배열, 동일 인자 dedup

`frontend/tests/components/blog/BlogReviewCard.test.ts`
- 3건: 제목/스니펫/블로거/날짜 렌더, `<a>` target/rel 속성, HTML 태그가 strip되어 노출

`frontend/tests/components/blog/BlogReviewSection.test.ts`
- 4건:
  - 결과 0~2건 → 콘텐츠 미렌더 (sentinel만 남음)
  - 3건 이상 → 카드 N개 (최대 5)
  - IntersectionObserver 스텁이 sentinel 발화 → fetch 트리거
  - kind 분기에 따라 다른 URL 호출 확인

### MSW

`frontend/mocks/handlers/naverBlog.ts`:
- `*/api/facilities/:category/:id/naver-blog` → 시설용 fixture 5건
- `*/api/real-estate/:realEstateType/:buildingKey/naver-blog` → 부동산용 fixture 5건
- 기존 핸들러 aggregator (`mocks/browser.ts`)에 등록

### 수동 검증 (로컬 dev)

YouTube 섹션 fix에서 얻은 교훈: **단위 테스트만 믿지 말고 브라우저에서 실제 동작 확인**.

체크리스트:
- 시설 페이지 진입 → 스크롤 → 섹션 노출 (또는 결과 부족 시 sentinel만)
- 부동산 단지 페이지 진입 → 동일 확인
- Network 탭에 `/naver-blog` 요청 발생 확인
- 카드 클릭 시 새 탭으로 네이버 블로그 정확히 이동
- 응답 description의 `<b>` 태그가 카드에 노출 안 되는지 (XSS 안전)
- 결과 < 3건 케이스 (예: 잘 알려지지 않은 작은 시설) → 섹션 안 보임

### 커밋 전 체크
- backend `npm run test` + `npm run lint`
- frontend `npm run test` + `npm run lint`
- 두 빌드(`npm run build`) 모두 통과

## 6. 배포 & 운영

### 환경 변수
- 운영 서버: 이미 `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 설정됨 — 추가 작업 없음

### 데이터베이스 마이그레이션
- 새 모델 2개 (`FacilityNaverBlogCache`, `RealEstateNaverBlogCache`) — `npm run db:push` 적용 (기존 캐시 마이그레이션 패턴 답습)

### Quota 모니터링
- 일일 5,000건 한도. 운영 모니터링은 별도 작업 (이번 범위 외) — 카운터 노출 admin endpoint 또는 로그 집계는 추후

### 페일오버
- 모든 에러 경로가 빈 배열 + 캐시 저장 X. UI는 섹션 자동 숨김 → 사용자가 인지 못 함 (silent degradation)

## 7. 카테고리·타입 추가 시 영향

- 시설 새 카테고리 추가 시: `naverBlogService.ts`의 쿼리 패턴 맵에 카테고리 추가 (별도 마이그레이션 불필요, `category: String` 그대로 수용)
- 부동산 새 realEstateType 추가 시: 같은 파일의 부동산 쿼리 빌더에 라벨 추가

## 8. 비범위 (Out of scope)

- 청약·지하철역·가이드 상세 페이지 적용 (다음 이터레이션)
- Review/Article JSON-LD schema 출력
- "신고" 버튼 / 블로그 평판 시스템
- 본문 전체 크롤링 / 더 긴 스니펫
- 일일 quota 알림 / admin dashboard
- 사전 워밍업 배치
- E2E (Playwright) — 단위·통합 테스트로 충분, 추후 별도 추가 가능
- Tistory / Daum Cafe 등 다른 블로그 플랫폼 — 별도 API 통합 필요
