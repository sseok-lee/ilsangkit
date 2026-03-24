# PRD: SEO & CTR 최적화

> **작성일**: 2026-03-24
> **근거 문서**: `SEO_STRATEGY_REPORT.md` (Playwright 프로덕션 크롤링 + 코드베이스 정적 분석, 4개 전문 에이전트 병렬 분석)
> **현재 상태**: 기술적 SEO 기반 우수 (SSR, 구조화 데이터 11종, 사이트맵 27만 URL). 콘텐츠·CTR·내부링크에서 큰 개선 기회 존재.

---

## 1. 개요

### 1.1 목표

SEO 전략 보고서에서 도출된 문제점을 해결하여 검색 노출과 CTR을 극대화한다.

- **구조화 데이터 정상화**: 미사용/오류 스키마 수정 및 활성화
- **CTR 최적화**: Title/Description 공식 개선, 동적 OG 이미지 연결
- **콘텐츠 밀도 강화**: FAQ HTML 렌더링, 지역 텍스트, 내부 링크 확충
- **네이버 SEO 기반 구축**: 서치어드바이저 등록, RSS 피드 생성

### 1.2 핵심 발견 요약

| # | 발견 | 심각도 | 예상 효과 |
|---|------|--------|----------|
| 1 | FAQ — JSON-LD만 존재, HTML 미렌더링 (구글 가이드라인 위반 리스크) | 🔴 Critical | 리치 결과 자격 상실 방지 |
| 2 | AggregateRating 스키마 — 독립 @type (Google 미인식) + 미호출 | 🔴 Critical | 별점 리치 스니펫 획득 |
| 3 | HowTo 스키마 — composable 존재하나 미호출 | 🔴 Critical | HowTo 리치 스니펫 획득 |
| 4 | 동적 OG 이미지 — 생성 시스템 완성, meta 태그에 미연결 | 🔴 Critical | 소셜 공유 CTR 대폭 향상 |
| 5 | 부동산 OG/Twitter 태그 불완전 (og:image, twitter:card 누락) | 🔴 Critical | 소셜 미디어 공유 품질 |
| 6 | 홈페이지 H1 — "우리 동네, 얼마나 살기 좋을까?" (키워드 0개) | 🟡 High | 홈페이지 키워드 매칭 |
| 7 | Title/Description에 숫자/연도 미포함 | 🟡 High | SERP CTR +15-30% |
| 8 | 홈→지역 허브, 카테고리→지역 내부 링크 부재 | 🟡 High | 지역 페이지 PageRank |
| 9 | 페이지네이션 rel link가 CSR에서만 생성 (SSR 미포함) | 🟡 Medium | 네이버 Yeti 인식 |
| 10 | 지역 페이지 서술형 텍스트 콘텐츠 부족 | 🟡 Medium | 지역 키워드 랭킹 |

### 1.3 기대 효과

- **단기**: 리치 결과(별점/HowTo/FAQ) 활성화, 소셜 공유 품질 정상화
- **중기**: SERP CTR +15-30% (숫자/연도 Title), 지역 키워드 커버리지 확대
- **장기**: 네이버+구글 이중 노출 기반 확보, 월간 유기 트래픽 +200% 목표

---

## 2. Phase 1 — 구조화 데이터 정상화 + OG 수정 (즉시, 1~2주)

**이미 코드가 존재하지만 미사용/오류인 항목을 수정한다. 새 기능 개발 없이 기존 코드 연결·수정만으로 완료.**

### 2-1. 카테고리 목록 FAQ HTML 렌더링 추가

현재 `CATEGORY_FAQ` 데이터(15개 카테고리 × 5~7개 = 약 90개 FAQ)가 JSON-LD에만 삽입되고 HTML에는 미노출. **구조화 데이터와 페이지 콘텐츠 불일치는 구글 가이드라인 위반 리스크.**

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/[category]/index.vue` | 시설 목록 하단에 FAQ `<details>` 아코디언 섹션 추가 |

#### 구현 방법

부동산 페이지(`[propertyType]/index.vue` line 111-126)의 FAQ 아코디언 패턴을 그대로 적용:

```vue
<section v-if="faqItems.length" class="mt-8">
  <h2 class="text-lg font-semibold mb-4">자주 묻는 질문</h2>
  <details v-for="(faq, i) in faqItems" :key="i" class="border-b py-3">
    <summary class="cursor-pointer font-medium">{{ faq.question }}</summary>
    <p class="mt-2 text-gray-600">{{ faq.answer }}</p>
  </details>
</section>
```

데이터 소스: `categoryFAQ.ts`의 `CATEGORY_FAQ[category]` (이미 존재)

#### 검증

- 카테고리 목록 페이지 렌더링 시 FAQ 섹션이 HTML에 존재하는지 확인
- Google Rich Results Test로 FAQPage 스키마 유효성 검증

### 2-2. AggregateRating 스키마 구조 수정 + 활성화

현재 `useStructuredData.ts`의 `setAggregateRatingSchema()`가 **독립 `@type: AggregateRating`**으로 생성 — Google에서 인식 불가. `LocalBusiness` 내부 프로퍼티로 병합해야 함.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/composables/useStructuredData.ts` | `setFacilitySchema()`에 optional `rating` 파라미터 추가, `aggregateRating` 프로퍼티로 병합 |
| `frontend/pages/[category]/[id].vue` | 리뷰 데이터가 있을 경우 `setFacilitySchema()`에 rating 전달 |

#### 구현 방법

```typescript
// useStructuredData.ts — setFacilitySchema 시그니처 변경
function setFacilitySchema(
  facility: FacilityDetail,
  rating?: { ratingValue: number; reviewCount: number }
) {
  const schema = { /* 기존 LocalBusiness 코드 */ }
  if (rating && rating.reviewCount > 0) {
    Object.assign(schema, {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: rating.ratingValue,
        reviewCount: rating.reviewCount,
        bestRating: 5,
        worstRating: 1,
      }
    })
  }
  // ... useHead 호출
}
```

기존 독립 `setAggregateRatingSchema()` 함수는 deprecated 처리 또는 제거.

#### 검증

- Google Rich Results Test에서 AggregateRating이 LocalBusiness 내부에 표시되는지 확인
- 리뷰 0건 시설에서 aggregateRating이 삽입되지 않는지 확인

### 2-3. HowTo 스키마 활성화 (trash 상세)

`useStructuredData.ts`에 `setHowToSchema()`가 line 455에 정의되어 있지만 호출하는 페이지 없음.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/trash/[id].vue` | `setHowToSchema()` 호출 추가 |

#### 구현 방법

```typescript
// pages/trash/[id].vue — 기존 구조화 데이터 호출 부분에 추가
const { setBreadcrumbSchema, setWasteScheduleSchema, setFAQSchema, setHowToSchema } = useStructuredData()

// 데이터 로드 후
setHowToSchema({
  name: `${data.value.city} ${data.value.district} 쓰레기 배출 방법`,
  description: `${data.value.city} ${data.value.district} 지역 쓰레기 올바른 배출 절차`,
  steps: [
    { name: '종량제 봉투 구매', text: '해당 지역 지정 종량제 봉투를 편의점 또는 마트에서 구매합니다.' },
    { name: '분리배출', text: '일반 쓰레기, 음식물, 재활용품을 분리합니다.' },
    { name: '배출 요일 확인', text: `배출 요일과 시간을 확인합니다.` },
    { name: '지정 장소 배출', text: '지정된 배출 장소에 올바르게 배출합니다.' },
  ],
  totalTime: 'PT10M',
})
```

#### 검증

- Google Rich Results Test에서 HowTo 리치 결과 자격 확인

### 2-4. 동적 OG 이미지 meta 태그 연결

`/og?category=...&title=...&city=...&district=...` 엔드포인트가 완성되어 있지만, 대부분 페이지에서 `DEFAULT_OG_IMAGE` (정적)을 사용 중.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/composables/useFacilityMeta.ts` | `setMeta()` 호출 시 `image` 옵션에 동적 OG URL 전달 |
| `frontend/pages/[category]/index.vue` | 카테고리 목록에서 동적 OG URL 생성 |
| `frontend/pages/[category]/[id].vue` | 시설 상세에서 동적 OG URL 생성 |
| `frontend/pages/[city]/index.vue` | 지역 허브에서 동적 OG URL 생성 |
| `frontend/pages/[city]/[district]/index.vue` | 지역 구에서 동적 OG URL 생성 |

#### 구현 패턴

```typescript
// 카테고리 목록
setMeta({
  title: ...,
  description: ...,
  path: `/${category}`,
  image: `${SITE_URL}/og?category=${category}&title=${encodeURIComponent(catLabel)}`,
})

// 시설 상세
setMeta({
  ...
  image: `${SITE_URL}/og?category=${facility.category}&title=${encodeURIComponent(facility.name)}&city=${encodeURIComponent(facility.city || '')}&district=${encodeURIComponent(facility.district || '')}`,
})
```

#### 주의사항

- OG 이미지가 SVG 형식 — 카카오톡/네이버에서 미렌더링 가능성 있음. Phase 3에서 PNG 변환 대응.
- 캐시: `og.get.ts`에서 `Cache-Control: public, max-age=86400` 설정 확인

#### 검증

- 카카오 디버거, Facebook Sharing Debugger에서 OG 이미지 노출 확인
- 5개 이상 대표 페이지에서 `og:image` 메타 태그 값이 동적 URL인지 확인

### 2-5. 부동산 메타 OG/Twitter 태그 보완

`useRealEstateMeta.ts`에서 `og:image`, `og:url`, `og:type`, `twitter:card` 누락.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/composables/useRealEstateMeta.ts` | `setRealEstateListMeta()`, `setRealEstateDetailMeta()` 에서 누락 OG/Twitter 태그 추가 |

#### 구현 방법

`useFacilityMeta.ts`의 `setMeta()` 패턴을 따라 아래 태그 추가:

```typescript
// setRealEstateListMeta 내부
useSeoMeta({
  ogImage: `${SITE_URL}/og?category=${propertyType}&title=${encodeURIComponent(title)}`,
  ogUrl: `${SITE_URL}/real-estate/${propertyType}`,
  ogType: 'website',
  twitterCard: 'summary_large_image',
  twitterImage: `${SITE_URL}/og?category=${propertyType}&title=${encodeURIComponent(title)}`,
})
```

#### 검증

- `/real-estate/apt` 페이지에서 `og:image`, `twitter:card` 메타 태그 존재 확인

### 2-6. robots 메타 태그 추가

전역 robots 메타 태그에 `max-image-preview:large` 설정으로 검색 결과 이미지 프리뷰 크기 증대.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/nuxt.config.ts` | `app.head.meta`에 robots 메타 추가 |

#### 구현

```typescript
// nuxt.config.ts — app.head.meta 배열에 추가
{ name: 'robots', content: 'index, follow, max-image-preview:large, max-snippet:-1' }
```

#### 검증

- 홈페이지 HTML `<head>`에서 `<meta name="robots" ...>` 태그 존재 확인

### 2-7. 정적 페이지 사이트맵 lastmod 고정

현재 `static.xml.ts`에서 모든 정적 페이지의 lastmod가 `new Date()` (매일 변경). Google이 lastmod 신호를 불신하게 됨.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/server/routes/sitemap/static.xml.ts` | 정적 페이지(about, faq, privacy, terms)는 실제 변경일 고정. 홈/카테고리 랜딩은 주간 단위 갱신 |

#### 구현

```typescript
// 변경이 드문 페이지
{ loc: '/about', lastmod: '2026-01-15', priority: 0.3 },
{ loc: '/privacy', lastmod: '2026-01-15', priority: 0.2 },
{ loc: '/terms', lastmod: '2026-01-15', priority: 0.2 },

// 동적 콘텐츠 페이지 — 주간 단위 (일요일 기준)
const weekStart = getWeekStartDate() // 유틸 함수
{ loc: '/', lastmod: weekStart, priority: 1.0 },
```

### 2-8. 페이지네이션 rel link SSR 이동

`[category]/index.vue`의 `watch()`에서 `rel="prev"`/`rel="next"`를 설정 — CSR에서만 실행. SSR 시점에서 네이버 Yeti 등 JS 미실행 봇이 인식하지 못함.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/[category]/index.vue` | rel link 설정을 `useHead()` + `computed`로 이동하여 SSR에서도 생성되도록 변경 |

#### 구현 방법

```typescript
// 기존 watch → useHead의 link computed로 이동
useHead({
  link: computed(() => {
    const links = []
    if (currentPage.value > 1) {
      links.push({ rel: 'prev', href: `${SITE_URL}/${category}?page=${currentPage.value - 1}` })
    }
    if (currentPage.value < totalPages.value) {
      links.push({ rel: 'next', href: `${SITE_URL}/${category}?page=${currentPage.value + 1}` })
    }
    return links
  })
})
```

#### 검증

- `curl -s https://ilsangkit.co.kr/toilet?page=2 | grep 'rel="prev"'` — SSR HTML에서 rel link 존재 확인

---

## 3. Phase 2 — Title/Description CTR 최적화 + 내부 링크 (2~4주)

### 3-1. Title에 숫자/연도 동적 삽입

SERP에서 숫자가 포함된 Title은 CTR이 +15-25% 높다.

#### 수정 대상

| 페이지 유형 | 파일 | Before → After |
|-----------|------|---------------|
| 카테고리 목록 | `pages/[category]/index.vue` | `근처 공공화장실 찾기 · 위치/개방시간 확인` → `공공화장실 찾기 - 전국 28,583곳 위치·개방시간 (2026.03)` |
| 부동산 유형 | `pages/real-estate/[propertyType]/index.vue` | `아파트 매매 실거래가·시세 조회` → `아파트 매매 실거래가 조회 2026년` |
| 부동산 건물 | `pages/real-estate/[propertyType]/[buildingName].vue` | `래미안 아파트 실거래가 - 서울 강남구` → `래미안 아파트 실거래가 - 서울 강남구 (2026.03)` |
| 지역 허브 | `pages/[city]/[district]/index.vue` | `강남구 생활 정보` → `강남구 생활 정보 - 시설 1,234곳·아파트 시세 확인` |
| 가이드 | `pages/guide/[slug].vue` | `{제목} - 일상킷` → `{제목} [2026년] - 일상킷` |

#### 구현 방법 (카테고리 목록 예시)

`/api/meta/stats` 응답에 카테고리별 count가 이미 포함. SSR에서 `useAsyncData`로 가져와 title에 삽입:

```typescript
const yearMonth = `${new Date().getFullYear()}.${String(new Date().getMonth() + 1).padStart(2, '0')}`
const title = `${catLabel} 찾기 - 전국 ${total.value?.toLocaleString()}곳 (${yearMonth}) - 일상킷`
```

#### 주의사항

- Title 길이 제한: 한글 기준 최대 35자 (Google 표시 기준). 초과 시 잘림 발생.
- count가 0인 경우 숫자 미삽입 가드레일 필요.

### 3-2. Description에 데이터 건수 + CTA 삽입

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/[category]/index.vue` | `SEO_DESCRIPTIONS` 상수를 동적 함수로 전환 |
| `frontend/composables/useFacilityMeta.ts` | `setRegionMeta()` description에 시설 수 + 카테고리별 핵심 정보 추가 |

#### Description CTR 공식

`[숫자+단위] + [핵심 정보] + [행동 유도] + [차별점]`

```
Before: 지금 이용 가능한 주변 공공화장실과 개방화장실 위치를 확인하세요. 24시간 운영 여부와 장애인화장실 정보를 제공합니다.
After:  전국 28,583곳 공공화장실 위치·개방시간을 지도에서 확인하세요. 24시간 운영, 장애인화장실, CCTV 설치 여부까지 공공데이터 기반으로 제공합니다.
```

### 3-3. 홈페이지 H1 키워드 최적화

현재 H1 "우리 동네, 얼마나 살기 좋을까?" — 감성 문구, 핵심 키워드 0개.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/index.vue` | H1을 키워드 포함 문구로 변경, 감성 문구는 서브카피(`<p>`)로 분리 |

#### Before → After

```html
<!-- Before -->
<h1>우리 동네, 얼마나 살기 좋을까?</h1>

<!-- After -->
<h1>부동산 실거래가·생활시설 통합 검색</h1>
<p>우리 동네, 얼마나 살기 좋을까?</p>
```

### 3-4. 홈페이지에 "지역별 생활 정보" 섹션 추가

현재 홈→지역 허브 직접 링크 없음. 지역 페이지의 PageRank가 약함.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/index.vue` | 카테고리 그리드 하단에 "지역별 생활 정보" 섹션 추가 |

#### 구현

```vue
<section>
  <h2>지역별 생활 정보</h2>
  <div class="grid grid-cols-3 md:grid-cols-6 gap-2">
    <NuxtLink v-for="city in cities" :to="`/${city.slug}/`">
      {{ city.label }}
    </NuxtLink>
  </div>
</section>
```

17개 시/도 링크: 서울, 경기, 인천, 부산, 대구, 광주, 대전, 울산, 세종, 강원, 충북, 충남, 전북, 전남, 경북, 경남, 제주

### 3-5. 카테고리 목록 하단 "인기 지역" 내부 링크

카테고리 → 지역+카테고리 페이지로의 내부 링크 추가.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/[category]/index.vue` | 페이지네이션 하단에 "인기 지역" 링크 섹션 |

#### 구현

```vue
<section class="mt-8">
  <h2 class="text-lg font-semibold mb-4">인기 지역</h2>
  <div class="flex flex-wrap gap-2">
    <NuxtLink
      v-for="region in popularRegions"
      :to="`/${region.citySlug}/${region.districtSlug}/${category}`"
      class="px-3 py-1.5 bg-gray-100 rounded-full text-sm"
    >
      {{ region.label }} {{ catLabel }}
    </NuxtLink>
  </div>
</section>
```

인기 지역은 시설 수 기준 상위 12개 시군구. 백엔드 `/api/meta/stats` 또는 프론트엔드 상수로 제공.

### 3-6. 지역 페이지 서술형 텍스트 자동 생성

현재 지역 페이지는 데이터 카드(부동산 시세, 시설 수)만 표시. 서술형 텍스트가 거의 없어 콘텐츠 밀도 부족.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/[city]/[district]/index.vue` | `areaData` 기반 서술형 요약 텍스트 자동 생성 |

#### 구현

```vue
<p class="text-gray-600 mt-4">
  {{ city }} {{ district }}에는 병원 {{ areaData.hospitalCount }}곳,
  약국 {{ areaData.pharmacyCount }}곳, 학교 {{ areaData.schoolCount }}곳 등
  총 {{ areaData.totalFacilities }}곳의 생활시설이 등록되어 있습니다.
  아파트 매매 평균가는 {{ formatPrice(areaData.avgAptPrice) }}이며,
  전세 평균 보증금은 {{ formatPrice(areaData.avgRentDeposit) }}입니다.
</p>
```

---

## 4. Phase 3 — 리치 결과 확장 + 네이버 SEO (1~2개월)

### 4-1. 시설 상세에 "주변 시설" + "이 지역 다른 시설" 링크

내부 링크 강화 + 이탈률 감소.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/[category]/[id].vue` | 상세 하단에 "이 지역 다른 시설" 추천 섹션 |

#### 구현

```vue
<section class="mt-8">
  <h2 class="text-lg font-semibold mb-4">{{ district }} 다른 시설</h2>
  <div class="flex flex-wrap gap-2">
    <NuxtLink :to="`/${citySlug}/${districtSlug}/hospital`">병원</NuxtLink>
    <NuxtLink :to="`/${citySlug}/${districtSlug}/pharmacy`">약국</NuxtLink>
    <NuxtLink :to="`/${citySlug}/${districtSlug}/school`">학교</NuxtLink>
    <!-- 현재 카테고리 제외, 주요 5개 카테고리 -->
  </div>
</section>
```

### 4-2. OG 이미지 SVG → PNG 변환

카카오톡/네이버에서 SVG OG 이미지 미지원 가능성 대응.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/server/routes/og.get.ts` | SVG → PNG 변환 후 반환 |
| `backend/package.json` 또는 `frontend/package.json` | `@resvg/resvg-js` 또는 `sharp` 의존성 추가 |

#### 구현 방법

```typescript
// og.get.ts
import { Resvg } from '@resvg/resvg-js'

const svg = generateOgImageSvg(params)
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } })
const pngBuffer = resvg.render().asPng()

return new Response(pngBuffer, {
  headers: {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400',
  },
})
```

#### 주의사항

- Cafe24 서버에서 `@resvg/resvg-js` native binding 호환성 확인 필요
- 대안: `sharp` 라이브러리 (더 넓은 호환성)

### 4-3. 부동산 허브 페이지 콘텐츠 강화

현재 `/real-estate/` 페이지는 카드 3개 + 텍스트 2문단으로 매우 빈약.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/real-estate/index.vue` | 지역별 시세 요약, 인기 지역 순위, FAQ 섹션 추가 |

#### 추가 콘텐츠 구조

```
H1: 부동산 실거래가
H2: 유형별 실거래가 조회 (기존 카드 3개)
H2: 지역별 아파트 시세 현황 (NEW — 상위 10개 시군구 테이블)
H2: 부동산 실거래가란? (기존 텍스트)
H2: 자주 묻는 질문 (NEW — FAQ 아코디언)
```

### 4-4. 네이버 서치어드바이저 등록 + RSS 피드

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/nuxt.config.ts` | `<meta name="naver-site-verification">` 메타 추가 |
| `frontend/server/routes/rss.xml.ts` | 가이드 기사 RSS 피드 엔드포인트 신설 |

#### RSS 피드 구현

```typescript
// server/routes/rss.xml.ts
export default defineEventHandler(async (event) => {
  const guides = await $fetch(`${apiBase}/api/guides?limit=50`)
  const rss = generateRssXml(guides) // title, link, description, pubDate
  setResponseHeader(event, 'Content-Type', 'application/xml')
  return rss
})
```

네이버 서치어드바이저에서 사이트맵 + RSS 제출.

### 4-5. 가이드 본문 내 카테고리/지역 내부 링크

가이드 → 관련 카테고리/지역 페이지 링크 삽입으로 내부 링크 강화.

#### 수정 대상

| 파일 | 수정 내용 |
|------|---------|
| `frontend/pages/guide/[slug].vue` | 가이드 하단에 "관련 카테고리" 링크 섹션 추가 |
| `backend/src/scripts/generateGuide.ts` | AI 가이드 생성 시 본문에 내부 링크 포함 프롬프트 추가 |

#### 가이드 하단 구현

```vue
<section v-if="relatedCategories.length" class="mt-8 border-t pt-6">
  <h2 class="text-lg font-semibold mb-4">관련 정보</h2>
  <div class="flex flex-wrap gap-2">
    <NuxtLink
      v-for="cat in relatedCategories"
      :to="`/${cat.slug}`"
      class="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg"
    >
      {{ cat.label }} 찾기
    </NuxtLink>
  </div>
</section>
```

관련 카테고리 매핑: 가이드의 `category` 필드 + 관련 카테고리 상수 테이블.

---

## 5. Phase 4 — 콘텐츠 확장 + 신규 페이지 (2~3개월)

### 5-1. 지역+부동산 교차 페이지

"강남구 아파트 실거래가" 같은 고가치 키워드를 위한 전용 페이지.

#### 신규 파일

| 파일 | 역할 |
|------|------|
| `frontend/pages/[city]/[district]/real-estate.vue` | 지역별 부동산 시세 요약 페이지 |

#### 핵심 콘텐츠

```
H1: {시} {구} 부동산 실거래가
H2: 아파트 매매 시세 (상위 건물 테이블 + 평균가)
H2: 아파트 전월세 시세
H2: 빌라·오피스텔 시세
H2: 주변 생활시설 현황 (cross-link)
H2: 자주 묻는 질문
```

#### 사이트맵 추가

`static.xml.ts`에 268개 시군구 × 부동산 교차 URL 추가 (268건).

### 5-2. SEO 최적화 가이드 20편 작성

`SEO_STRATEGY_REPORT.md` Part 5의 가이드 주제 20선을 기반으로 작성.

#### 작성 기준

| 항목 | 기준 |
|------|------|
| 제목 | 30~60자, 타겟 키워드를 앞부분에 배치 |
| H2 | 최소 3개, 각 H2에 관련 키워드 포함 |
| 내부 링크 | 관련 카테고리/지역 페이지 링크 최소 2개 |
| 분량 | 최소 1,500자 |
| Article 스키마 | `dateModified` 실제 갱신일 반영 |

#### 우선 작성 (HIGH 검색량 10편)

1. 아파트 취득세·중개수수료 총정리
2. 전세 사기 예방 체크리스트
3. 신혼부부 전세자금 대출 조건
4. 야간·주말 진료 병원 찾는 방법
5. 어린이집 종류와 국공립 신청 방법
6. 서울 자치구별 아파트 시세 비교
7. 아파트 vs 빌라 vs 오피스텔 비교
8. 이사할 동네 고르는 법
9. 전기차 충전 요금 비교
10. 분리수거 완벽 가이드

### 5-3. 동(읍면동) 단위 지역 페이지 (선별)

"서초동 아파트", "역삼동 병원" 같은 동 단위 검색 캡처.

#### 신규 파일

| 파일 | 역할 |
|------|------|
| `frontend/pages/[city]/[district]/[dong].vue` | 동 단위 지역 페이지 |

#### 생성 기준

- 시설 수 50개 이상인 동만 생성 (thin content 방지)
- 사이트맵 규모 관리: 동 페이지는 상위 1,000개 동만 사이트맵 포함

### 5-4. 카테고리 간 교차 링크

관련 카테고리 추천으로 내부 링크 밀도 강화.

#### 관련 카테고리 매핑

```typescript
const RELATED_CATEGORIES: Record<string, string[]> = {
  hospital: ['pharmacy', 'aed'],
  pharmacy: ['hospital'],
  school: ['childcare', 'library'],
  childcare: ['school', 'park'],
  park: ['sports', 'childcare'],
  parking: ['ev-charger'],
  'ev-charger': ['parking'],
  toilet: ['parking'],
  clothes: ['trash'],
  trash: ['clothes'],
  market: ['parking'],
  library: ['school'],
  aed: ['hospital'],
  sports: ['park'],
}
```

카테고리 목록 페이지 상단 또는 사이드바에 "관련 카테고리" 칩 링크로 표시.

---

## 6. 구현 순서 및 의존성

```
Phase 1 (즉시, 1~2주 — 기존 코드 수정만)
├── 2-1. FAQ HTML 렌더링 추가 ─────────────── 독립 작업
├── 2-2. AggregateRating 구조 수정 ────────── 독립 작업
├── 2-3. HowTo 스키마 활성화 ──────────────── 독립 작업
├── 2-4. 동적 OG 이미지 meta 연결 ─────────── 독립 작업
├── 2-5. 부동산 OG/Twitter 보완 ───────────── 독립 작업
├── 2-6. robots 메타 추가 ─────────────────── 독립 작업
├── 2-7. 사이트맵 lastmod 고정 ────────────── 독립 작업
└── 2-8. 페이지네이션 rel link SSR ────────── 독립 작업

Phase 2 (2~4주 — CTR + 내부 링크)
├── 3-1. Title 숫자/연도 삽입 ─────────────── /api/meta/stats 의존
├── 3-2. Description 건수/CTA 삽입 ────────── 3-1과 동시 가능
├── 3-3. 홈 H1 키워드 최적화 ──────────────── 독립 작업
├── 3-4. 홈 "지역별 생활 정보" 섹션 ────────── 독립 작업
├── 3-5. 카테고리 "인기 지역" 링크 ────────── 독립 작업
└── 3-6. 지역 서술형 텍스트 ───────────────── areaData API 의존

Phase 3 (1~2개월 — 리치 결과 + 네이버)
├── 4-1. 시설 상세 "다른 시설" 링크 ────────── 독립 작업
├── 4-2. OG SVG→PNG 변환 ─────────────────── native binding 환경 확인 의존
├── 4-3. 부동산 허브 콘텐츠 강화 ──────────── 독립 작업
├── 4-4. 네이버 서치어드바이저 + RSS ────────── 독립 작업
└── 4-5. 가이드 내부 링크 ─────────────────── 독립 작업

Phase 4 (2~3개월 — 신규 페이지 + 콘텐츠)
├── 5-1. 지역+부동산 교차 페이지 ──────────── Phase 3 완료 후
├── 5-2. 가이드 20편 작성 ─────────────────── Phase 2 가이드라인 확정 후
├── 5-3. 동 단위 지역 페이지 ──────────────── Phase 3 완료 후
└── 5-4. 카테고리 간 교차 링크 ────────────── 독립 작업
```

---

## 7. 검증 기준

### Phase 완료 시 필수 검증

| Phase | 검증 항목 | 도구 |
|-------|----------|------|
| 1 | 구조화 데이터 에러 0건 | Google Rich Results Test |
| 1 | OG 이미지 정상 표시 | 카카오 디버거, Facebook Sharing Debugger |
| 1 | Lighthouse SEO 100점 유지 | Lighthouse |
| 2 | Title 잘림 없음 (35자 이내) | Google SERP 확인 |
| 2 | 내부 링크 추가 확인 | Screaming Frog 크롤링 |
| 3 | 네이버 인덱싱 확인 | 네이버 서치어드바이저 |
| 4 | 신규 페이지 인덱싱 | GSC Coverage |

### KPI 목표 (6개월)

| 지표 | 현재 (추정) | 목표 |
|------|-----------|------|
| 인덱싱률 | 미확인 | 27만 URL 중 80%+ |
| 월간 노출수 | 기준 수집 필요 | 기준 대비 +200% |
| 평균 CTR | 기준 수집 필요 | 3% → 5%+ |
| 리치 결과 | FAQ만 | FAQ + HowTo + 별점 활성 |
| 네이버 인덱싱 | 미등록 | 주요 페이지 100% |

---

## 8. 전제 조건

PRD 실행 전 반드시 확인/완료해야 할 항목:

- [ ] **Google Search Console 기준 데이터 수집** (최소 2주) — 현재 트래픽/CTR 기준점
- [ ] **네이버 서치어드바이저 등록** — 네이버 최적화의 전제 조건
- [ ] **리뷰 데이터 평점 체계 확인** — `ReviewWithFacility` 타입에 `rating` (1~5점) 필드 존재 여부 → AggregateRating 적용 가능 여부
- [ ] **Cafe24 서버 native module 지원 확인** — `@resvg/resvg-js` 또는 `sharp` 설치 가능 여부 → OG PNG 변환 방식 결정
- [ ] **소셜 미디어 계정 여부** — Organization `sameAs` 배열 채우기 위해 필요
