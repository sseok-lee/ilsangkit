# Google Search Console 등록 및 SEO 검증 체크리스트

**프로젝트**: 일상킷 (ilsangkit.co.kr)
**작성일**: 2026-02-12
**Phase**: P14-T3

---

## 목차
1. [사전 확인 사항](#사전-확인-사항)
2. [도메인 소유권 확인](#도메인-소유권-확인)
3. [사이트맵 제출](#사이트맵-제출)
4. [인덱싱 상태 확인](#인덱싱-상태-확인)
5. [모바일 사용성 검증](#모바일-사용성-검증)
6. [구조화된 데이터 검증](#구조화된-데이터-검증)
7. [Core Web Vitals 확인](#core-web-vitals-확인)
8. [검색 성능 모니터링](#검색-성능-모니터링)

---

## 사전 확인 사항

### 1. 프로덕션 배포 확인
- [ ] 도메인 활성화: https://ilsangkit.co.kr
- [ ] HTTPS 인증서 설치 완료
- [ ] DNS 레코드 정상 작동
- [ ] Nginx 리버스 프록시 설정 완료

### 2. SEO 코드 레벨 검증 완료

#### robots.txt 확인
- [x] 파일 위치: `frontend/public/robots.txt`
- [x] 사이트맵 URL 포함: `https://ilsangkit.co.kr/sitemap.xml`
- [x] 주요 페이지 크롤링 허용 (`Allow: /`)
- [x] API 경로 차단 (`Disallow: /api/`, `/_nuxt/`)

**확인 URL**: https://ilsangkit.co.kr/robots.txt

#### sitemap.xml 확인
- [x] 백엔드 엔드포인트: `backend/src/routes/sitemap.ts`
- [x] 카테고리별 동적 생성 (toilet, wifi, clothes, kiosk, parking, aed, library, trash)
- [x] 정적 페이지 포함 (/, /about, /privacy, /terms)
- [x] lastmod 포함 (updatedAt 기반)
- [x] 우선순위 설정 (priority)
- [x] 캐싱 설정 (86400초 = 24시간)

**확인 URL**: https://ilsangkit.co.kr/sitemap.xml

#### 메타 태그 확인
- [x] `nuxt.config.ts`에 기본 메타 설정
  - [x] lang="ko"
  - [x] viewport 설정
  - [x] 기본 title 및 description
  - [x] theme-color

- [x] 페이지별 동적 메타 (`useFacilityMeta.ts`)
  - [x] 홈페이지: setHomeMeta()
  - [x] 시설 상세: setFacilityDetailMeta()
  - [x] Open Graph 태그
  - [x] Twitter Card 태그

#### 구조화된 데이터 (JSON-LD) 확인
- [x] `composables/useStructuredData.ts` 구현
  - [x] WebSite 스키마 (홈페이지)
  - [x] BreadcrumbList 스키마 (내비게이션)
  - [x] LocalBusiness/Place 스키마 (시설 상세)
  - [x] ItemList 스키마 (검색 결과)
  - [x] Organization 스키마 (사이트 정보)
  - [x] GovernmentService 스키마 (쓰레기 배출)

---

## 도메인 소유권 확인

### Google Search Console 등록

**URL**: https://search.google.com/search-console

### 방법 1: HTML 파일 업로드 (권장)
1. [x] Search Console에서 "속성 추가" 클릭
2. [x] "URL 접두어" 선택 → `https://ilsangkit.co.kr` 입력
3. [x] HTML 파일 다운로드 (예: `google1234abcd.html`)
4. [x] 파일을 `frontend/public/` 디렉토리에 복사
5. [x] 배포 후 확인: `https://ilsangkit.co.kr/google1234abcd.html`
6. [x] Search Console에서 "확인" 버튼 클릭

### 방법 2: DNS TXT 레코드 (대안)
1. [x] Search Console에서 TXT 레코드 값 복사
2. [ ] Cafe24 호스팅 관리자에서 DNS 설정
3. [ ] TXT 레코드 추가:
   - 호스트: `@` 또는 `ilsangkit.co.kr`
   - 값: `google-site-verification=XXXXX...`
4. [ ] DNS 전파 대기 (최대 24시간)
5. [ ] Search Console에서 "확인" 버튼 클릭

### 방법 3: Google Analytics 연동 (이미 GA 설정된 경우)
- [x] `nuxt.config.ts`에 GA ID 확인: `NUXT_PUBLIC_GA_ID`
- [ ] Search Console에서 "Google 애널리틱스" 방법 선택
- [ ] 자동 확인 완료

---

## 사이트맵 제출

### 1. 사이트맵 접근 확인
```bash
# 브라우저 또는 curl로 확인
curl -I https://ilsangkit.co.kr/sitemap.xml
# Expected: HTTP/1.1 200 OK
# Content-Type: application/xml
```

- [x] 사이트맵 XML 형식 유효성 확인
- [x] 모든 카테고리 URL 포함 확인
- [x] 정적 페이지 URL 포함 확인

### 2. Search Console에서 사이트맵 제출
1. [ ] Search Console → 좌측 메뉴 "Sitemaps" 클릭
2. [ ] "새 사이트맵 추가" 입력란에 `sitemap.xml` 입력
3. [ ] "제출" 버튼 클릭
4. [ ] 상태 확인: "성공" 표시 대기 (수 분~수 시간)

### 3. 사이트맵 인덱스 구조 확인
```xml
<!-- 예상 구조 -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- 정적 페이지 -->
  <url>
    <loc>https://ilsangkit.co.kr/</loc>
    <lastmod>2026-02-12</lastmod>
    <priority>1.0</priority>
  </url>

  <!-- 시설 상세 페이지 (각 카테고리) -->
  <url>
    <loc>https://ilsangkit.co.kr/toilet/123</loc>
    <lastmod>2026-01-15T10:30:00+09:00</lastmod>
    <priority>0.8</priority>
  </url>

  <!-- 쓰레기 배출 일정 -->
  <url>
    <loc>https://ilsangkit.co.kr/trash/456</loc>
    <lastmod>2026-01-20T14:20:00+09:00</lastmod>
    <priority>0.8</priority>
  </url>
</urlset>
```

### 4. 예상 URL 개수
- 정적 페이지: 4개 (/, /about, /privacy, /terms)
- 화장실: ~50,000개
- 와이파이: ~30,000개
- 의류수거함: ~10,000개
- 발급기: ~5,000개
- 주차장: ~10,000개
- AED: ~5,000개
- 도서관: ~1,000개
- 쓰레기 배출 일정: ~250개

**총 예상**: ~111,254개 URL

> **주의**: URL이 50,000개를 초과하면 사이트맵을 분할해야 합니다.
> 필요 시 `backend/src/routes/sitemap.ts` 수정하여 카테고리별 사이트맵 인덱스 생성

---

## 인덱싱 상태 확인

### 1. URL 검사 도구 사용
- [ ] Search Console → "URL 검사" (상단 검색창)
- [ ] 주요 페이지 검사:
  - [ ] 홈페이지: `https://ilsangkit.co.kr/`
  - [ ] 화장실 샘플: `https://ilsangkit.co.kr/toilet/[id]`
  - [ ] 검색 페이지: `https://ilsangkit.co.kr/search?keyword=강남`
  - [ ] 정적 페이지: `/about`, `/privacy`, `/terms`

### 2. 인덱싱 요청
- [ ] "URL이 Google에 등록되어 있지 않음" 표시 시 → "색인 생성 요청" 클릭
- [ ] 우선순위 높은 페이지부터 요청 (하루 10개 제한)

### 3. 커버리지 리포트 확인
- [ ] Search Console → "커버리지" 메뉴
- [ ] "오류" 탭: **0건 목표**
  - [ ] 404 에러 없음
  - [ ] 서버 오류(5xx) 없음
  - [ ] 리디렉션 오류 없음
- [ ] "제외됨" 탭 검토:
  - [ ] `robots.txt`에 의해 차단된 페이지 확인 (`/api/`, `/_nuxt/`)
  - [ ] "중복 페이지" 경고 확인 → canonical 태그 추가 검토

### 4. 색인 생성 문제 해결
| 문제 | 원인 | 해결 방법 |
|------|------|----------|
| 페이지가 발견되지 않음 | 사이트맵 미제출 | 사이트맵 제출 및 URL 검사 도구 사용 |
| 크롤링 차단됨 | robots.txt 설정 오류 | `frontend/public/robots.txt` 확인 |
| 서버 오류(5xx) | 백엔드 API 에러 | Nginx 로그 확인, PM2 재시작 |
| soft 404 | 빈 콘텐츠 페이지 | 시설 데이터 동기화 확인 |

---

## 모바일 사용성 검증

### 1. 모바일 사용성 리포트
- [ ] Search Console → "모바일 사용성" 메뉴
- [ ] **오류 0건 목표**:
  - [ ] "텍스트가 너무 작음" 경고 없음
  - [ ] "클릭 가능한 요소가 너무 가까이 있음" 경고 없음
  - [ ] "콘텐츠가 화면 너비보다 넓음" 경고 없음
  - [ ] "뷰포트가 설정되지 않음" 경고 없음

### 2. 뷰포트 설정 확인
```html
<!-- nuxt.config.ts app.head.meta에 이미 설정됨 -->
<meta name="viewport" content="width=device-width, initial-scale=1">
```
- [x] 설정 완료 (`nuxt.config.ts` 58번 줄)

### 3. 모바일 친화성 테스트
**URL**: https://search.google.com/test/mobile-friendly

- [ ] 홈페이지 테스트: `https://ilsangkit.co.kr/`
- [ ] 시설 상세 테스트: `https://ilsangkit.co.kr/toilet/[id]`
- [ ] 검색 결과 테스트: `https://ilsangkit.co.kr/search`

**통과 기준**:
- "페이지가 모바일 친화적입니다" 표시
- 스크린샷에서 레이아웃 정상 확인
- TailwindCSS 반응형 클래스 정상 작동 (`md:`, `lg:` 등)

### 4. Lighthouse 모바일 점수 확인
```bash
# Chrome DevTools → Lighthouse 탭
# - Device: Mobile
# - Categories: Performance, Accessibility, Best Practices, SEO
```

**목표 점수**:
- Performance: 90+ (모바일)
- Accessibility: 95+
- Best Practices: 95+
- SEO: 100

---

## 구조화된 데이터 검증

### 1. Rich Results Test (Google)
**URL**: https://search.google.com/test/rich-results

- [ ] 홈페이지 테스트 → WebSite 스키마 감지
- [ ] 시설 상세 테스트 → LocalBusiness/Place 스키마 감지
- [ ] 오류 0건, 경고 최소화

### 2. Schema Markup Validator
**URL**: https://validator.schema.org/

페이지별 JSON-LD 스키마 검증:

#### 홈페이지 (`pages/index.vue`)
```json
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "일상킷",
  "url": "https://ilsangkit.co.kr",
  "description": "내 주변 생활 편의 정보, 한 번에 찾기",
  "potentialAction": {
    "@type": "SearchAction",
    "target": {
      "@type": "EntryPoint",
      "urlTemplate": "https://ilsangkit.co.kr/search?keyword={search_term_string}"
    },
    "query-input": "required name=search_term_string"
  }
}
```
- [ ] 스키마 유효성 통과
- [ ] 검색 기능 정상 작동 (`potentialAction`)

#### 시설 상세 페이지 (`pages/[category]/[id].vue`)
```json
{
  "@context": "https://schema.org",
  "@type": "PublicToilet", // 또는 LocalBusiness, CivicStructure 등
  "name": "시설명",
  "description": "설명",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "도로명주소",
    "addressLocality": "구",
    "addressRegion": "시",
    "addressCountry": "KR"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 37.123,
    "longitude": 127.456
  },
  "url": "https://ilsangkit.co.kr/toilet/123"
}
```
- [ ] 스키마 유효성 통과
- [ ] 지리 정보 정확성 확인

#### BreadcrumbList 스키마
```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "홈",
      "item": "https://ilsangkit.co.kr/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "화장실",
      "item": "https://ilsangkit.co.kr/search?category=toilet"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "시설명",
      "item": "https://ilsangkit.co.kr/toilet/123"
    }
  ]
}
```
- [ ] 스키마 유효성 통과
- [ ] 브레드크럼 경로 정확성 확인

### 3. Search Console "개선 사항" 확인
- [ ] Search Console → "개선 사항" 메뉴
- [ ] "구조화된 데이터" 리포트 확인
- [ ] 오류 없음, 유효한 항목 증가 확인

---

## Core Web Vitals 확인

### 1. Search Console Core Web Vitals 리포트
- [ ] Search Console → "Core Web Vitals" 메뉴
- [ ] 모바일 및 데스크톱 점수 확인

**목표 지표** (75th percentile):
- **LCP** (Largest Contentful Paint): < 2.5s
- **FID** (First Input Delay): < 100ms
- **CLS** (Cumulative Layout Shift): < 0.1

### 2. 페이지 경험 신호
- [ ] HTTPS 사용: ✓
- [ ] 모바일 친화적: ✓
- [ ] 안전한 브라우징 (멀웨어 없음): ✓
- [ ] 침입적 인터스티셜 없음: ✓

### 3. 성능 최적화 확인
#### 이미지 최적화
- [x] WebP 포맷 사용 (`/icons/category/*.webp`)
- [ ] 이미지 lazy loading 설정 확인
- [x] 캐싱 헤더 설정 확인 (`nuxt.config.ts` routeRules)

#### 리소스 캐싱
```typescript
// nuxt.config.ts 이미 설정됨
routeRules: {
  '/_nuxt/**': { headers: { 'cache-control': 'public, max-age=31536000, immutable' } },
  '/icons/**': { headers: { 'cache-control': 'public, max-age=86400' } },
  '/images/**': { headers: { 'cache-control': 'public, max-age=86400' } },
}
```
- [x] 정적 리소스 캐싱 설정 완료

#### 폰트 최적화
- [x] Pretendard Variable 폰트 사용 (CDN)
- [x] `rel="preconnect"` 설정 완료 (`nuxt.config.ts` 64-66번 줄)

---

## 검색 성능 모니터링

### 1. 검색 성능 리포트
- [ ] Search Console → "검색 성능" 메뉴
- [ ] 지표 모니터링 (주간 확인):
  - [ ] **총 클릭수** 증가 추세
  - [ ] **총 노출수** 증가 추세
  - [ ] **평균 CTR** (목표: 2% 이상)
  - [ ] **평균 게재순위** (목표: 20위 이상)

### 2. 주요 검색어 분석
- [ ] 높은 노출 / 낮은 클릭 검색어 → 메타 description 개선
- [ ] 타겟 키워드 순위 추적:
  - "내 주변 화장실"
  - "공공 와이파이"
  - "의류수거함 위치"
  - "무인민원발급기"
  - 지역명 + 카테고리 조합 (예: "강남 화장실")

### 3. 페이지별 성능 분석
- [ ] 최다 노출 페이지 확인
- [ ] 클릭률 낮은 페이지 → 제목/설명 최적화
- [ ] 높은 이탈률 페이지 → UX 개선

---

## 문제 해결 가이드

### 인덱싱이 안 될 때
1. **사이트맵 재제출**: Search Console → Sitemaps → 사이트맵 삭제 후 재제출
2. **robots.txt 확인**: `Disallow` 규칙이 주요 페이지를 차단하지 않는지 확인
3. **서버 로그 확인**: Googlebot 크롤링 로그 확인
4. **URL 검사 도구**: "색인 생성 요청" 클릭 (우선순위 높은 페이지)

### 구조화된 데이터 오류
1. **콘솔 확인**: 브라우저 개발자 도구에서 JSON-LD 스크립트 확인
2. **스키마 타입 확인**: 각 카테고리에 맞는 @type 사용
3. **필수 필드 누락**: address, geo 필드 존재 확인
4. **타입 불일치**: 숫자/문자열 타입 정확히 맞추기

### 모바일 사용성 오류
1. **뷰포트 설정**: `<meta name="viewport">` 태그 확인
2. **터치 타겟 크기**: 버튼 최소 48x48px
3. **폰트 크기**: 본문 텍스트 최소 16px
4. **가로 스크롤**: `overflow-x: hidden` 또는 반응형 레이아웃 확인

---

## 주기적 점검 체크리스트 (월 1회)

### 기술적 SEO
- [ ] 사이트맵 업데이트 확인 (신규 시설 데이터 반영)
- [ ] robots.txt 정상 작동 확인
- [ ] HTTPS 인증서 만료일 확인 (최소 30일 전)
- [ ] 404 에러 페이지 모니터링

### 콘텐츠 SEO
- [ ] 메타 description 최적화 (낮은 CTR 페이지)
- [ ] 타이틀 태그 최적화 (검색어 반영)
- [ ] 구조화된 데이터 오류 0건 유지
- [ ] 신규 카테고리 추가 시 JSON-LD 스키마 업데이트

### 성능 모니터링
- [ ] Core Web Vitals 지표 확인
- [ ] Lighthouse 점수 추이 확인
- [ ] 페이지 로드 속도 측정
- [ ] 이미지 최적화 검토

### 사용자 경험
- [ ] 모바일 사용성 오류 0건 유지
- [ ] 검색 기능 정상 작동 확인
- [ ] 지도 API 할당량 확인 (Kakao Maps)
- [ ] 백엔드 API 응답 시간 모니터링

---

## 참고 자료

### Google 공식 문서
- [Search Console 고급 사용 가이드](https://support.google.com/webmasters/answer/9128668)
- [구조화된 데이터 가이드](https://developers.google.com/search/docs/advanced/structured-data/intro-structured-data)
- [모바일 친화적 웹사이트 만들기](https://developers.google.com/search/mobile-sites)
- [Core Web Vitals 최적화](https://web.dev/vitals/)

### 검증 도구
- Google Search Console: https://search.google.com/search-console
- Rich Results Test: https://search.google.com/test/rich-results
- Mobile-Friendly Test: https://search.google.com/test/mobile-friendly
- Schema Markup Validator: https://validator.schema.org/
- Lighthouse CI: https://github.com/GoogleChrome/lighthouse-ci

### 프로젝트 파일 참조
- SEO 설정: `frontend/nuxt.config.ts`
- 메타 태그: `frontend/composables/useFacilityMeta.ts`
- JSON-LD: `frontend/composables/useStructuredData.ts`
- robots.txt: `frontend/public/robots.txt`
- 사이트맵 API: `backend/src/routes/sitemap.ts`

---

## 완료 기준

✅ **P14-T3 완료 조건**:
1. Google Search Console 도메인 소유권 확인 완료
2. 사이트맵 제출 및 "성공" 상태 확인
3. 주요 페이지 10개 이상 인덱싱 확인
4. 모바일 사용성 오류 0건
5. 구조화된 데이터 오류 0건
6. Core Web Vitals 모든 지표 "양호" 범위

---

**작성자**: frontend-specialist
**최종 수정일**: 2026-02-12
