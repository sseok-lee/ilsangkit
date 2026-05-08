<!-- Parent: ../../../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# ads

## Purpose
광고 컴포넌트 테스트 모음. Coupang Partners 배너 등 타사 광고 위젯 컴포넌트의 단위 테스트를 포함한다.

## Key Files
| File | Description |
|------|-------------|
| `CoupangBanner.test.ts` | Coupang 파트너스 배너 컴포넌트 테스트 — iframe 렌더, tracking code, 고지문, layout shift 방지 |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- **테스트 프레임워크**: Vitest + @vue/test-utils
- **마운팅**: `mount(CoupangBanner)` — happy-dom 환경
- **검증 대상**:
  1. 고지문 텍스트 존재 여부 (`wrapper.text().toContain(...)`)
  2. iframe 존재 + src 속성 (광고 ID, tracking code 포함)
  3. iframe height 지정 (layout shift 방지)
- **메서드**: `wrapper.find()` (DOM 선택), `wrapper.text()` (내용), `attributes()` (속성)

### Common Patterns
- 컴포넌트별 여러 it() 블록으로 단일 책임 테스트
- 브라우저 API (iframe) 관련 테스트도 happy-dom에서 가능
- Mock 프레임워크: MSW (API mocking, frontend/mocks/handlers/)

## Dependencies

### Internal
- 테스트 대상: `frontend/components/ads/CoupangBanner.vue`
- 테스트 setup: `frontend/tests/setup.ts` (Nuxt auto-import 함수 mock, 컴포넌트 stub)

### External
- Vitest
- @vue/test-utils
- Vue 3

<!-- MANUAL: -->
