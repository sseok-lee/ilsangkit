# ADR-002: Nuxt SSR/ISR 하이브리드 렌더링 전략

## Status

승인됨 (Accepted)

## Context

일상킷 프로젝트는 공공시설 정보를 제공하는 위치 기반 검색 서비스입니다. SEO 최적화와 빠른 초기 로딩, 동적 데이터 업데이트가 모두 중요합니다.

### 요구사항 분석

| 요구사항 | 중요도 | 세부 설명 |
|---------|-------|----------|
| **SEO 최적화** | 높음 | 검색엔진이 시설 정보를 색인할 수 있어야 함 |
| **초기 로딩 속도** | 높음 | First Contentful Paint < 1.5초 목표 |
| **동적 데이터** | 중간 | 시설 데이터는 일 1회 동기화 (실시간 아님) |
| **지도 인터랙션** | 높음 | 사용자 위치 기반 실시간 검색 |
| **빌드 시간** | 중간 | 전체 페이지 정적 생성 시 수천 개 페이지 빌드 |

### 렌더링 옵션 비교

#### Option 1: Full CSR (Client-Side Rendering)
```javascript
// 모든 페이지 CSR
export default defineNuxtConfig({
  ssr: false
})
```

**장점:**
- 구현 간단
- 서버 부하 없음
- 동적 인터랙션 자유로움

**단점:**
- ❌ SEO 불가 (검색엔진 색인 안됨)
- ❌ 초기 로딩 느림 (JavaScript 실행 필요)
- ❌ 소셜 미디어 공유 시 메타태그 없음

#### Option 2: Full SSG (Static Site Generation)
```javascript
// 빌드 시 모든 페이지 정적 생성
export default defineNuxtConfig({
  nitro: {
    prerender: {
      routes: [/* 수천 개 URL */]
    }
  }
})
```

**장점:**
- ✅ SEO 완벽 지원
- ✅ 초기 로딩 매우 빠름
- ✅ CDN 캐싱 최적

**단점:**
- ❌ 빌드 시간 과다 (수천 개 페이지)
- ❌ 데이터 업데이트 시 전체 재빌드 필요
- ❌ 동적 검색 불가

#### Option 3: Full SSR (Server-Side Rendering)
```javascript
// 모든 페이지 요청마다 서버 렌더링
export default defineNuxtConfig({
  ssr: true,
  nitro: {
    routeRules: {
      '/**': { ssr: true }
    }
  }
})
```

**장점:**
- ✅ SEO 지원
- ✅ 항상 최신 데이터

**단점:**
- ❌ 서버 부하 높음
- ❌ 초기 로딩 느림 (서버 응답 대기)
- ❌ 호스팅 비용 증가

## Decision

**페이지 특성에 따른 하이브리드 렌더링 전략을 채택했습니다.**

### 구현된 전략 (`frontend/nuxt.config.ts`)

```typescript
export default defineNuxtConfig({
  ssr: true, // SSR 기본 활성화

  nitro: {
    routeRules: {
      // 1. 정적 페이지: Prerender (빌드 시 정적 생성)
      '/': { prerender: true },
      '/about': { prerender: true },
      '/privacy': { prerender: true },
      '/terms': { prerender: true },

      // 2. 정적 자산: 장기 캐싱
      '/_nuxt/**': {
        headers: { 'cache-control': 'public, max-age=31536000, immutable' }
      },
      '/icons/**': {
        headers: { 'cache-control': 'public, max-age=86400' }
      },
      '/images/**': {
        headers: { 'cache-control': 'public, max-age=86400' }
      },

      // 3. 사이트맵: SWR (Stale-While-Revalidate) 24시간
      '/sitemap.xml': { swr: 86400 },
      '/sitemap/**': { swr: 86400 },

      // 4. 동적 페이지: SSR (기본값, 명시 안함)
      // - /search (검색 페이지)
      // - /[category]/[id] (시설 상세)
      // - /[city]/[district]/[category] (지역별 목록)
    }
  }
})
```

### 렌더링 전략 분류

| 페이지 타입 | 렌더링 방식 | 캐싱 전략 | 근거 |
|------------|-----------|----------|------|
| **홈페이지 (/)** | Prerender (SSG) | CDN 캐싱 | 콘텐츠 거의 변경 없음, SEO 중요 |
| **정적 페이지 (/about, /privacy)** | Prerender (SSG) | CDN 캐싱 | 콘텐츠 변경 없음 |
| **검색 페이지 (/search)** | SSR | 캐싱 없음 | 사용자별 위치 기반 동적 검색 |
| **시설 상세 (/[category]/[id])** | SSR | 캐싱 없음 | 조회수 증가, 최신 데이터 표시 |
| **지역별 목록 (/[city]/[district])** | SSR | 고려 가능 (ISR 24시간) | 데이터 변경 빈도 낮음, SEO 중요 |
| **사이트맵 (/sitemap.xml)** | SSR + SWR | 24시간 캐싱 | 일 1회 동기화에 맞춤 |
| **정적 자산 (/_nuxt/**, /icons/**)** | Static | 장기 캐싱 | 변경 없음, 버전 관리 |

### 클라이언트 사이드 동적 기능

SSR로 초기 HTML 전달 후, 클라이언트에서 하이드레이션하여 동적 기능 제공:

1. **Kakao Map 인터랙션**
   - 초기 HTML: 정적 지도 이미지 또는 스켈레톤
   - 하이드레이션 후: 실시간 지도 조작, 마커 클러스터링

2. **위치 기반 검색**
   - 브라우저 Geolocation API로 현재 위치 획득
   - AJAX로 `/api/facilities/search` 호출
   - 결과를 클라이언트에서 렌더링

3. **무한 스크롤/페이지네이션**
   - 초기 페이지: SSR (SEO)
   - 추가 페이지: CSR (AJAX)

## Consequences

### 긍정적 결과 (Positive)

1. **SEO 최적화 달성**
   - 모든 시설 상세 페이지가 검색엔진에 색인됨
   - 구조화된 데이터 지원 (JSON-LD) via `useStructuredData` composable
   - Open Graph 메타태그로 소셜 공유 최적화

2. **초기 로딩 속도 개선**
   - 정적 페이지: First Contentful Paint < 1초
   - 동적 페이지: SSR HTML 즉시 표시, JavaScript 하이드레이션 점진적

3. **서버 부하 균형**
   - 정적 페이지: CDN에서 제공 (서버 부하 없음)
   - 동적 페이지: 필요한 경우만 SSR
   - 사이트맵: 24시간 캐싱으로 부하 분산

4. **개발 생산성 향상**
   - 페이지별 렌더링 전략을 라우팅 설정으로 선언적 관리
   - Nuxt의 Auto-import로 SSR/CSR 코드 작성 단순화
   - 동일한 컴포넌트 코드로 SSR/CSR 자동 처리

5. **유연한 배포**
   - Vercel/Netlify: SSR + Edge Function 지원
   - Cafe24 (현재): Nginx + PM2로 Node.js SSR 실행
   - 필요 시 Static Export로 전환 가능

### 부정적 결과 (Negative)

1. **SSR 서버 필요**
   - Node.js 런타임 호스팅 필요 (Static Hosting만으로 불가)
   - PM2로 프로세스 관리 필요
   - 완화: Cafe24 가상서버 사용 중, 서버 부하 낮음

2. **하이드레이션 복잡도**
   - SSR HTML과 CSR 상태 불일치 시 오류 발생 가능
   - 완화: Nuxt의 `useState`, `useFetch` 사용으로 상태 자동 동기화
   - 주의: Kakao Map, Geolocation 등 브라우저 API는 `onMounted` 훅에서 호출

3. **개발 환경 복잡도**
   - 로컬 개발 시 SSR 서버 실행 필요 (`npm run dev`)
   - 브라우저 전용 코드 실행 시 주의 필요 (`window`, `document` 체크)
   - 완화: Nuxt DevTools로 SSR/CSR 상태 디버깅

4. **캐싱 전략 관리**
   - 페이지별 적절한 캐싱 전략 설정 필요
   - 데이터 변경 시 캐시 무효화 고려
   - 현재 상태: 데이터 일 1회 동기화로 캐시 이슈 적음

### 채택한 완화 전략

1. **Composables로 SSR/CSR 추상화**
   ```typescript
   // composables/useStructuredData.ts
   export function useStructuredData(data: any) {
     useHead({
       script: [{ type: 'application/ld+json', innerHTML: JSON.stringify(data) }]
     })
   }
   ```

2. **브라우저 API 안전 호출**
   ```typescript
   // composables/useGeolocation.ts
   export function useGeolocation() {
     const location = ref(null)

     onMounted(() => {
       if (navigator.geolocation) {
         navigator.geolocation.getCurrentPosition(...)
       }
     })

     return { location }
   }
   ```

3. **API 호출 최적화**
   ```typescript
   // pages/[category]/[id].vue
   const { data } = await useFetch(`/api/facilities/${category}/${id}`, {
     key: `facility-${category}-${id}`, // SSR 캐시 키
     server: true, // SSR에서 실행
     lazy: false, // 하이드레이션 전에 완료
   })
   ```

## Alternatives Considered

### 대안 1: Next.js ISR (Incremental Static Regeneration)
- **내용:** 정적 생성 + 백그라운드 재검증
- **거부 이유:** Nuxt 3에서 ISR은 실험적 기능 (Nitro SWR로 유사 구현 가능)

### 대안 2: Full SSG + Client-side Hydration
- **내용:** 모든 페이지 빌드 시 정적 생성, 클라이언트에서 최신 데이터 fetch
- **거부 이유:** 수천 개 페이지 빌드 시간 과다, SEO 인덱싱 시점 데이터 오래됨

### 대안 3: Astro Islands Architecture
- **내용:** 정적 HTML + 필요한 부분만 인터랙티브
- **거부 이유:** Vue 3 생태계 활용 제한, Nuxt보다 생산성 낮음

## Related Decisions

- ADR-001: 카테고리별 개별 테이블 사용 (데이터베이스 설계)

## References

- 구현 파일: `frontend/nuxt.config.ts`
- Nuxt 3 Rendering Modes: https://nuxt.com/docs/guide/concepts/rendering
- Nitro Route Rules: https://nitro.unjs.io/guide/routing
- 구조화된 데이터 구현: `frontend/composables/useStructuredData.ts`
- 페이지 예시:
  - SSG: `frontend/pages/index.vue`
  - SSR: `frontend/pages/search.vue`, `frontend/pages/[category]/[id].vue`
