<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/layouts

## Purpose
Nuxt 레이아웃. 페이지 래퍼로 `AppHeader`/`AppFooter`/공용 슬롯 구성.

## Key Files
| File | Description |
|------|-------------|
| `default.vue` | 기본 레이아웃 (대부분 페이지가 사용) |

## For AI Agents

### Working In This Directory
- 페이지에서 `definePageMeta({ layout: 'default' })`로 지정 (기본값이므로 생략 가능)
- 커스텀 레이아웃 추가 시 파일명이 `kebab-case`면 `layout: 'kebab-case'`로 참조
- `<slot />` 위치에 페이지 내용이 삽입됨

### Testing Requirements
- `tests/layouts/default.test.ts` — 레이아웃 렌더링 및 slot 검증

### Common Patterns
- Header/Footer는 `components/common/`에서 import
- SSR 안전 — 브라우저 API 사용 지양

## Dependencies

### Internal
- `../components/common/AppHeader.vue`, `AppFooter.vue`

### External
- Nuxt 3 레이아웃 시스템
