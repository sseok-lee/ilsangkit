# Screen Specifications

This directory contains YAML specification files for all frontend pages in the ilsangkit project.

## Generated Files (2026-02-12)

| File | Screen Name | Route | Vue File |
|------|-------------|-------|----------|
| `home.yaml` | 홈 (메인 페이지) | `/` | `pages/index.vue` |
| `search.yaml` | 검색 결과 페이지 | `/search` | `pages/search.vue` |
| `facility-detail.yaml` | 시설 상세 페이지 | `/[category]/[id]` | `pages/[category]/[id].vue` |
| `city.yaml` | 시/도 선택 페이지 | `/[city]` | `pages/[city]/index.vue` |
| `district.yaml` | 구/군 선택 페이지 | `/[city]/[district]` | `pages/[city]/[district]/index.vue` |
| `region-category.yaml` | 지역별 카테고리 시설 목록 | `/[city]/[district]/[category]` | `pages/[city]/[district]/[category].vue` |
| `trash-detail.yaml` | 쓰레기 배출 일정 상세 | `/trash/[id]` | `pages/trash/[id].vue` |
| `about.yaml` | 서비스 소개 | `/about` | `pages/about.vue` |
| `privacy.yaml` | 개인정보처리방침 | `/privacy` | `pages/privacy.vue` |
| `terms.yaml` | 이용약관 | `/terms` | `pages/terms.vue` |

## Specification Format

Each YAML file follows this structure:

```yaml
version: "2.0"
date: "2026-02-12"

screen:
  name: 화면 이름
  route: /route/path
  file: frontend/pages/xxx.vue

purpose:
  description: 화면 목적 설명
  userGoals:
    - 사용자 목표 1
    - 사용자 목표 2

layouts:
  mobile:
    breakpoint: "< 768px"
    sections: [...]
  desktop:
    breakpoint: ">= 768px"
    sections: [...]

sections:
  sectionName:
    name: 섹션 이름
    elements: [...]

state:
  composables:
    - name: useComposableName
      usage: description
  data: [...]
  computed: [...]

handlers:
  handlerName:
    trigger: event description
    action: what happens

seo:
  title: "페이지 타이틀"
  description: "메타 설명"
  structuredData: JSON-LD schema types

dataRequirements:
  - resource: resourceName
    endpoint: /api/endpoint (if applicable)
    params: [param1, param2]
    via: composableName or method
```

## Statistics

- **Total spec files**: 10
- **Total lines**: 1,030
- **Excluded files**: `msw-demo.vue` (dev-only page)

## Usage

These specifications serve as:

1. **Documentation** - Complete reference for each screen's structure and behavior
2. **Development guide** - Clear requirements for implementing or modifying screens
3. **Testing reference** - What needs to be tested on each screen
4. **Design handoff** - Bridge between design and implementation

## Key Features Documented

### Navigation Flow
- Home → Search → Facility Detail
- Home → City → District → Region Category → Facility Detail
- Search (trash category) → Trash Detail

### Responsive Design
- Mobile-first layouts with dedicated mobile sections
- Desktop layouts with split views and enhanced navigation
- Breakpoint specifications for each screen

### State Management
- Composables usage documented for each screen
- Reactive data dependencies
- Computed properties and their purposes

### SEO & Structured Data
- Dynamic meta tags for each screen
- JSON-LD structured data (WebSite, Place, ItemList, Breadcrumb, etc.)
- Pagination link tags for search results

### Category-Specific Features
- Trash category with region selection UI
- Facility detail pages with 8 different category layouts
- Category-specific data fields and display logic
