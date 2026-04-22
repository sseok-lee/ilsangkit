<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/layouts

## Purpose
Nuxt 레이아웃 테스트.

## Key Files
| File | Description |
|------|-------------|
| `default.test.ts` | `default.vue` 레이아웃 |

## For AI Agents

### Working In This Directory
- slot 렌더 + 헤더/푸터 포함 검증

### Testing Requirements
- 전역 stub으로 `NuxtLink`, `NuxtPage` 처리

### Common Patterns
- slot 콘텐츠 주입: `mount(Layout, { slots: { default: '...' } })`

## Dependencies

### Internal
- `../../layouts/default.vue`, `../../components/common/AppHeader.vue`, `AppFooter.vue`

### External
- `vitest`, `@vue/test-utils`
