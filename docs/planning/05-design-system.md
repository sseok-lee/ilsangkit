# 05. 디자인 시스템

## 디자인 원칙

### 1. 단순함 (Simplicity)
- 누구나 바로 사용할 수 있는 직관적인 UI
- 불필요한 요소 제거, 핵심 기능에 집중
- 한 화면에 하나의 주요 액션

### 2. 접근성 (Accessibility)
- WCAG 2.1 AA 준수
- 충분한 색상 대비 (최소 4.5:1)
- 키보드 네비게이션 지원

### 3. 반응형 (Responsive)
- Mobile First 접근
- 모든 디바이스에서 최적화된 경험
- 터치 친화적 인터페이스

---

## 반응형 웹 전략 (Mobile First)

### 브레이크포인트 정의

```
Mobile (기본)     Tablet (sm/md)      Desktop (lg/xl)
< 640px           640px ~ 1024px      > 1024px
     │                  │                  │
     │    sm: 640px     │    lg: 1024px    │
     │    md: 768px     │    xl: 1280px    │
     ▼                  ▼                  ▼
┌──────────┐      ┌──────────┐      ┌──────────┐
│ 단일 컬럼 │      │ 2컬럼    │      │ 멀티 컬럼│
│ 터치 최적화│      │ 적응형   │      │ 호버 효과│
│ 지도 토글 │      │ 지도 확대│      │ 목록+지도│
└──────────┘      └──────────┘      └──────────┘
```

| 브레이크포인트 | Tailwind | 크기 | 주요 용도 |
|--------------|----------|------|----------|
| **Default** | - | < 640px | 모바일 (기본 스타일) |
| **sm** | `sm:` | ≥ 640px | 큰 모바일, 작은 태블릿 |
| **md** | `md:` | ≥ 768px | 태블릿 |
| **lg** | `lg:` | ≥ 1024px | 작은 데스크톱 |
| **xl** | `xl:` | ≥ 1280px | 데스크톱 |
| **2xl** | `2xl:` | ≥ 1536px | 대형 모니터 |

### 페이지별 반응형 레이아웃

#### 메인 페이지 (/)

```css
/* Mobile (기본) */
.main-hero {
  padding: 24px 16px;
  text-align: center;
}

.search-input {
  width: 100%;
  height: 48px;  /* 터치 최적화 */
}

.category-chips {
  display: flex;
  overflow-x: auto;  /* 가로 스크롤 */
  gap: 8px;
  padding-bottom: 8px;
  -webkit-overflow-scrolling: touch;
}

/* Tablet (md) */
@media (min-width: 768px) {
  .category-chips {
    justify-content: center;
    overflow-x: visible;
    flex-wrap: wrap;
  }
}

/* Desktop (lg) */
@media (min-width: 1024px) {
  .main-hero {
    padding: 48px 32px;
  }

  .search-input {
    max-width: 600px;
    margin: 0 auto;
  }

  .category-chips {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    max-width: 720px;
    margin: 0 auto;
  }
}
```

#### 검색 결과 페이지 (/search)

```css
/* Mobile: 목록만 (지도는 토글) */
.search-results {
  display: flex;
  flex-direction: column;
}

.results-list {
  flex: 1;
  padding-bottom: 80px;  /* 하단 지도 버튼 공간 */
}

.results-map {
  display: none;  /* 기본 숨김 */
}

.map-toggle-button {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  height: 48px;
}

/* Desktop (lg): 목록 + 지도 분할 */
@media (min-width: 1024px) {
  .search-results {
    flex-direction: row;
  }

  .results-list {
    width: 400px;
    flex-shrink: 0;
    padding-bottom: 0;
    overflow-y: auto;
    max-height: calc(100vh - 64px);
  }

  .results-map {
    display: block;
    flex: 1;
    position: sticky;
    top: 64px;
    height: calc(100vh - 64px);
  }

  .map-toggle-button {
    display: none;  /* 데스크톱에서 숨김 */
  }
}
```

#### 상세 페이지 (/[category]/[id])

```css
/* Mobile: 지도 상단, 정보 스크롤 */
.detail-page {
  display: flex;
  flex-direction: column;
}

.detail-map {
  height: 180px;
  flex-shrink: 0;
}

.detail-info {
  padding: 16px;
}

.detail-cta {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 16px;
  background: white;
  border-top: 1px solid #e5e7eb;
}

/* Desktop (lg): 좌우 분할 */
@media (min-width: 1024px) {
  .detail-page {
    flex-direction: row;
    max-width: 1200px;
    margin: 0 auto;
    padding: 32px;
    gap: 32px;
  }

  .detail-info {
    flex: 1;
    padding: 0;
  }

  .detail-map {
    width: 400px;
    height: 360px;
    flex-shrink: 0;
    position: sticky;
    top: 96px;
  }

  .detail-cta {
    position: static;
    padding: 0;
    border: none;
    margin-top: 24px;
  }
}
```

#### 지역별 페이지 (/[city]/[district]/[category])

```css
/* Mobile: 단일 컬럼 */
.region-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Tablet (md): 2컬럼 그리드 */
@media (min-width: 768px) {
  .region-list {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }
}

/* Desktop (lg): 3컬럼 그리드 */
@media (min-width: 1024px) {
  .region-list {
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }
}
```

### 터치 타겟 가이드라인

```
┌──────────────────────────────────────────────────────┐
│              터치 타겟 최소 사이즈                      │
├──────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────────┐                               │
│  │                  │  최소 44x44px (Apple HIG)     │
│  │    탭 가능 영역   │  권장 48x48px                 │
│  │                  │                               │
│  │    44px x 44px   │                               │
│  │                  │                               │
│  └──────────────────┘                               │
│                                                      │
│  ← 8px 최소 간격 →                                   │
│  ┌────┐            ┌────┐                           │
│  │ A  │   8px gap  │ B  │                           │
│  └────┘            └────┘                           │
│                                                      │
└──────────────────────────────────────────────────────┘
```

| 요소 | 최소 크기 | 권장 크기 | 간격 |
|------|----------|----------|------|
| 버튼 (Primary) | 44x44px | 48x48px | 8px |
| 버튼 (Secondary) | 44x44px | 44x44px | 8px |
| 아이콘 버튼 | 44x44px | 44x44px | 4px |
| 카테고리 칩 | 44px 높이 | 48px 높이 | 8px |
| 카드 (전체 탭) | - | - | 12px |
| 지도 마커 | 40x40px | 44x44px | - |
| 체크박스/라디오 | 44x44px | 44x44px | 8px |
| 입력 필드 | 44px 높이 | 48px 높이 | - |

### 반응형 타이포그래피

```css
/* Mobile (기본) */
:root {
  --font-size-xs: 12px;
  --font-size-sm: 14px;
  --font-size-base: 16px;
  --font-size-lg: 18px;
  --font-size-xl: 20px;
  --font-size-2xl: 24px;
  --font-size-3xl: 28px;
  --font-size-4xl: 32px;
}

/* Desktop (lg) */
@media (min-width: 1024px) {
  :root {
    --font-size-xl: 22px;
    --font-size-2xl: 28px;
    --font-size-3xl: 34px;
    --font-size-4xl: 40px;
  }
}
```

### 반응형 컴포넌트 패턴

#### 1. 시설 카드 (반응형)

```html
<!-- 모바일: 가로 레이아웃, 데스크톱: 선택적 세로 -->
<div class="
  flex gap-3 p-4
  md:p-5
  lg:flex-col lg:items-start
">
  <span class="text-2xl flex-shrink-0">🚻</span>
  <div class="flex-1 min-w-0">
    <h3 class="font-semibold text-gray-900 truncate">강남역 공중화장실</h3>
    <p class="text-sm text-gray-500 mt-1 truncate">서울시 강남구 강남대로 396</p>
  </div>
  <span class="text-sm text-primary-500 font-medium flex-shrink-0">120m</span>
</div>
```

#### 2. 검색 입력 (반응형)

```html
<div class="
  w-full
  md:max-w-xl md:mx-auto
  lg:max-w-2xl
">
  <input
    type="text"
    class="
      w-full
      h-12 px-4 pl-12
      text-base
      rounded-lg border border-gray-200
      focus:ring-2 focus:ring-primary-500
      md:h-14 md:text-lg
    "
    placeholder="검색어 입력..."
  />
</div>
```

#### 3. 카테고리 그리드 (반응형)

```html
<div class="
  flex overflow-x-auto gap-2 pb-2
  -mx-4 px-4
  md:mx-0 md:px-0
  md:grid md:grid-cols-3 md:overflow-visible
  lg:grid-cols-6
">
  <button class="
    flex-shrink-0
    px-4 py-3
    min-w-max
    rounded-full
    text-sm font-medium
    bg-gray-100 text-gray-700
    md:px-3 md:py-2
    lg:justify-center
  ">
    🚻 화장실
  </button>
  <!-- ... -->
</div>
```

#### 4. 하단 시트 (모바일 전용)

```html
<!-- 모바일에서 지도 토글 시 사용 -->
<div class="
  fixed inset-x-0 bottom-0
  bg-white rounded-t-2xl shadow-xl
  transform transition-transform
  translate-y-full
  data-[open=true]:translate-y-0
  lg:hidden
">
  <div class="w-12 h-1 bg-gray-300 rounded-full mx-auto mt-3"></div>
  <div class="p-4">
    <!-- 지도 컨텐츠 -->
  </div>
</div>
```

---

## 컬러 팔레트

### Primary Colors

```css
/* 메인 브랜드 컬러 - 신뢰와 편안함을 주는 블루 계열 */
--primary-50:  #eff6ff;
--primary-100: #dbeafe;
--primary-200: #bfdbfe;
--primary-300: #93c5fd;
--primary-400: #60a5fa;
--primary-500: #3b82f6;  /* 메인 */
--primary-600: #2563eb;
--primary-700: #1d4ed8;
--primary-800: #1e40af;
--primary-900: #1e3a8a;
```

### Neutral Colors

```css
/* 그레이스케일 */
--gray-50:  #f9fafb;
--gray-100: #f3f4f6;
--gray-200: #e5e7eb;
--gray-300: #d1d5db;
--gray-400: #9ca3af;
--gray-500: #6b7280;
--gray-600: #4b5563;
--gray-700: #374151;
--gray-800: #1f2937;
--gray-900: #111827;
```

### Semantic Colors

```css
/* 상태 표시 */
--success: #10b981;  /* 성공, 완료 */
--warning: #f59e0b;  /* 경고, 주의 */
--error:   #ef4444;  /* 에러, 실패 */
--info:    #3b82f6;  /* 정보 */
```

### Category Colors

```css
/* 카테고리별 색상 */
--toilet:  #8b5cf6;   /* 보라 - 화장실 */
--trash:   #10b981;   /* 초록 - 쓰레기 배출 */
--wifi:    #f59e0b;   /* 주황 - 와이파이 */
--clothes: #ec4899;   /* 핑크 - 의류수거함 */
--kiosk:   #6366f1;   /* 인디고 - 무인민원발급기 */
```

---

## 타이포그래피

### Font Family

```css
/* 시스템 폰트 스택 (빠른 로딩) */
font-family:
  'Pretendard Variable',
  Pretendard,
  -apple-system,
  BlinkMacSystemFont,
  system-ui,
  Roboto,
  'Helvetica Neue',
  'Segoe UI',
  'Apple SD Gothic Neo',
  'Noto Sans KR',
  'Malgun Gothic',
  sans-serif;
```

### Type Scale

| 이름 | 크기 | 줄간격 | 용도 |
|------|------|--------|------|
| xs | 12px | 16px | 보조 텍스트, 캡션 |
| sm | 14px | 20px | 본문 작은 크기 |
| base | 16px | 24px | 본문 기본 |
| lg | 18px | 28px | 본문 큰 크기 |
| xl | 20px | 28px | 소제목 |
| 2xl | 24px | 32px | 제목 |
| 3xl | 30px | 36px | 페이지 제목 |
| 4xl | 36px | 40px | 히어로 제목 |

### Font Weights

```css
--font-normal: 400;   /* 본문 */
--font-medium: 500;   /* 강조 본문 */
--font-semibold: 600; /* 제목 */
--font-bold: 700;     /* 강조 제목 */
```

---

## 간격 시스템 (Spacing)

### Base Unit: 4px

```css
--space-0:  0;
--space-1:  4px;
--space-2:  8px;
--space-3:  12px;
--space-4:  16px;
--space-5:  20px;
--space-6:  24px;
--space-8:  32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;
```

---

## 컴포넌트

### 1. 버튼

```html
<!-- Primary Button -->
<button class="
  px-4 py-2
  bg-primary-500 hover:bg-primary-600
  text-white font-medium
  rounded-lg
  transition-colors
">
  검색하기
</button>

<!-- Secondary Button -->
<button class="
  px-4 py-2
  bg-gray-100 hover:bg-gray-200
  text-gray-700 font-medium
  rounded-lg
  transition-colors
">
  취소
</button>

<!-- Icon Button -->
<button class="
  p-2
  bg-gray-100 hover:bg-gray-200
  rounded-full
  transition-colors
">
  <svg>...</svg>
</button>
```

### 2. 입력 필드

```html
<!-- 검색 입력 -->
<div class="relative">
  <input
    type="text"
    placeholder="검색어 입력..."
    class="
      w-full px-4 py-3 pl-10
      bg-white
      border border-gray-200
      rounded-lg
      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
      placeholder-gray-400
    "
  />
  <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
    <!-- search icon -->
  </svg>
</div>
```

### 3. 카드

```html
<!-- 시설 카드 -->
<div class="
  p-4
  bg-white
  border border-gray-200
  rounded-lg
  hover:shadow-md
  transition-shadow
  cursor-pointer
">
  <div class="flex items-start gap-3">
    <span class="text-2xl">🚻</span>
    <div class="flex-1">
      <h3 class="font-semibold text-gray-900">강남역 공중화장실</h3>
      <p class="text-sm text-gray-500 mt-1">서울시 강남구 강남대로 396</p>
      <p class="text-xs text-gray-400 mt-1">24시간 운영</p>
    </div>
    <span class="text-sm text-primary-500 font-medium">120m</span>
  </div>
</div>
```

### 4. 카테고리 칩

```html
<!-- 카테고리 선택 칩 -->
<div class="flex gap-2">
  <button class="
    px-4 py-2
    bg-primary-500 text-white
    rounded-full
    font-medium text-sm
  ">
    🚻 화장실
  </button>
  <button class="
    px-4 py-2
    bg-gray-100 text-gray-700
    hover:bg-gray-200
    rounded-full
    font-medium text-sm
    transition-colors
  ">
    🗑️ 쓰레기
  </button>
  <button class="
    px-4 py-2
    bg-gray-100 text-gray-700
    hover:bg-gray-200
    rounded-full
    font-medium text-sm
    transition-colors
  ">
    📶 와이파이
  </button>
</div>
```

### 5. 지도 마커

```css
/* 카테고리별 마커 스타일 */
.marker {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  font-size: 16px;
}

.marker-toilet  { border: 2px solid #8b5cf6; }
.marker-trash   { border: 2px solid #10b981; }
.marker-wifi    { border: 2px solid #f59e0b; }
.marker-clothes { border: 2px solid #ec4899; }
.marker-kiosk   { border: 2px solid #6366f1; }

.marker-selected {
  width: 40px;
  height: 40px;
  font-size: 20px;
  z-index: 10;
}
```

---

## 레이아웃

### 반응형 브레이크포인트

```css
/* Tailwind 기본값 사용 */
sm: 640px   /* 작은 태블릿 */
md: 768px   /* 태블릿 */
lg: 1024px  /* 작은 데스크톱 */
xl: 1280px  /* 데스크톱 */
```

### 컨테이너

```css
.container {
  width: 100%;
  max-width: 1280px;
  margin: 0 auto;
  padding: 0 16px;
}

@media (min-width: 640px) {
  .container { padding: 0 24px; }
}

@media (min-width: 1024px) {
  .container { padding: 0 32px; }
}
```

### 페이지 레이아웃

```html
<!-- 기본 레이아웃 -->
<div class="min-h-screen flex flex-col">
  <header class="h-16 border-b border-gray-200">
    <!-- 헤더 -->
  </header>

  <main class="flex-1">
    <!-- 콘텐츠 -->
  </main>

  <footer class="py-8 bg-gray-50 border-t border-gray-200">
    <!-- 푸터 -->
  </footer>
</div>
```

---

## 아이콘

### 카테고리 아이콘 (Emoji)

| 카테고리 | 아이콘 | 대체 텍스트 | 색상 |
|----------|--------|-------------|------|
| 화장실 | 🚻 | 화장실 | #8b5cf6 (보라) |
| 쓰레기 배출 | 🗑️ | 쓰레기통 | #10b981 (초록) |
| 와이파이 | 📶 | 와이파이 | #f59e0b (주황) |
| 의류수거함 | 👕 | 의류 | #ec4899 (핑크) |
| 무인민원발급기 | 🏧 | 키오스크 | #6366f1 (인디고) |

### UI 아이콘 (Heroicons)

- 검색: `MagnifyingGlassIcon`
- 위치: `MapPinIcon`
- 현재 위치: `MapIcon`
- 뒤로가기: `ArrowLeftIcon`
- 필터: `FunnelIcon`
- 목록: `ListBulletIcon`
- 지도: `MapIcon`
- 길찾기: `ArrowTopRightOnSquareIcon`

---

## 애니메이션

### 기본 전환

```css
/* 기본 transition */
transition-colors: color, background-color, border-color 150ms ease;
transition-shadow: box-shadow 150ms ease;
transition-transform: transform 150ms ease;
transition-all: all 150ms ease;
```

### 로딩 스피너

```html
<svg class="animate-spin h-5 w-5 text-primary-500" viewBox="0 0 24 24">
  <circle
    class="opacity-25"
    cx="12" cy="12" r="10"
    stroke="currentColor"
    stroke-width="4"
    fill="none"
  />
  <path
    class="opacity-75"
    fill="currentColor"
    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
  />
</svg>
```

### 스켈레톤 로딩

```html
<div class="animate-pulse">
  <div class="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
  <div class="h-4 bg-gray-200 rounded w-1/2"></div>
</div>
```

---

## 카테고리별 상세 페이지 컴포넌트

### 공통 레이아웃

```html
<!-- 상세 페이지 공통 구조 -->
<div class="max-w-2xl mx-auto">
  <!-- 지도 영역 -->
  <div class="h-48 bg-gray-100 rounded-lg overflow-hidden mb-4">
    <FacilityMap :lat="facility.lat" :lng="facility.lng" />
  </div>

  <!-- 기본 정보 -->
  <div class="space-y-2 mb-6">
    <div class="flex items-center gap-2 text-gray-600">
      <MapPinIcon class="w-5 h-5" />
      <span>{{ facility.address }}</span>
    </div>
    <div v-if="phoneNumber" class="flex items-center gap-2 text-gray-600">
      <PhoneIcon class="w-5 h-5" />
      <a :href="`tel:${phoneNumber}`" class="text-primary-500">{{ phoneNumber }}</a>
    </div>
  </div>

  <!-- 카테고리별 상세 정보 (동적 컴포넌트) -->
  <component :is="detailComponent" :details="facility.details" />

  <!-- 길찾기 버튼 -->
  <div class="mt-6">
    <a
      :href="directionsUrl"
      target="_blank"
      class="flex items-center justify-center gap-2 w-full py-3 bg-primary-500 text-white rounded-lg font-medium"
    >
      <MapPinIcon class="w-5 h-5" />
      길찾기
    </a>
  </div>
</div>
```

### 정보 섹션 컴포넌트

```html
<!-- 정보 섹션 (재사용) -->
<div class="border-t border-gray-200 pt-4 mt-4">
  <h3 class="text-sm font-semibold text-gray-500 mb-3">{{ title }}</h3>
  <div class="space-y-2">
    <slot />
  </div>
</div>
```

### 정보 항목 컴포넌트

```html
<!-- 단일 정보 항목 -->
<div class="flex justify-between items-center py-1">
  <span class="text-gray-600">{{ label }}</span>
  <span class="font-medium text-gray-900">{{ value }}</span>
</div>

<!-- Boolean 정보 항목 (있음/없음) -->
<div class="flex justify-between items-center py-1">
  <span class="text-gray-600">{{ label }}</span>
  <span :class="value ? 'text-green-600' : 'text-gray-400'">
    {{ value ? '있음 ✅' : '없음' }}
  </span>
</div>

<!-- 배열 정보 항목 (태그 형태) -->
<div class="py-1">
  <span class="text-gray-600 block mb-2">{{ label }}</span>
  <div class="flex flex-wrap gap-2">
    <span
      v-for="item in items"
      :key="item"
      class="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
    >
      {{ item }}
    </span>
  </div>
</div>
```

### null/undefined 필드 처리

```typescript
// composables/useDetailFields.ts
export function useDetailFields(details: Record<string, unknown>) {
  // null/undefined가 아닌 필드만 필터링
  const hasValue = (key: string) => {
    const value = details[key]
    return value !== null && value !== undefined && value !== ''
  }

  // Boolean 필드 표시 (false도 표시해야 하는 경우)
  const hasBooleanValue = (key: string) => {
    return typeof details[key] === 'boolean'
  }

  return { hasValue, hasBooleanValue }
}
```

### 카테고리별 색상 테두리

```css
/* 상세 페이지 카테고리 강조 */
.detail-header-toilet  { border-left: 4px solid #8b5cf6; }
.detail-header-trash   { border-left: 4px solid #10b981; }
.detail-header-wifi    { border-left: 4px solid #f59e0b; }
.detail-header-clothes { border-left: 4px solid #ec4899; }
.detail-header-kiosk   { border-left: 4px solid #6366f1; }
```

---

## 다크 모드 (향후)

MVP에서는 라이트 모드만 지원. 향후 다크 모드 추가 시:

```css
/* 다크 모드 색상 */
@media (prefers-color-scheme: dark) {
  :root {
    --bg-primary: #111827;
    --bg-secondary: #1f2937;
    --text-primary: #f9fafb;
    --text-secondary: #9ca3af;
    --border: #374151;
  }
}
```

---

## Tailwind 설정

```javascript
// tailwind.config.js
module.exports = {
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        toilet: '#8b5cf6',
        trash: '#10b981',
        wifi: '#f59e0b',
        clothes: '#ec4899',
        kiosk: '#6366f1',
      },
      fontFamily: {
        sans: ['Pretendard Variable', 'Pretendard', '-apple-system', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
```
