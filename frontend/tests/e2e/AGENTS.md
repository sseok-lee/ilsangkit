<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/e2e

## Purpose
Playwright 기반 E2E 테스트. 실제 브라우저에서 레이아웃/인터랙션/반응형을 검증.

## Key Files
| File | Description |
|------|-------------|
| `responsive-layout.spec.ts` | 데스크톱/모바일 레이아웃 전환 |
| `touch-interaction.spec.ts` | 터치 제스처 (바텀시트, 지도) |

## For AI Agents

### Working In This Directory
- `npm run test:e2e` 또는 `npm run test:e2e:ui`
- `playwright.config.ts`에서 baseURL/프로젝트(브라우저) 설정
- 로컬에서는 `npm run dev`를 별도로 띄워야 할 수 있음 (설정에 따라 webServer 자동 기동)
- 스냅샷/스크린샷은 `tests/e2e/__snapshots__/` 또는 CI 아티팩트

### Testing Requirements
- Playwright 브라우저 설치 필요 (`npx playwright install`)
- CI에서 별도 워크플로우로 실행 가능

### Common Patterns
- `test.use({ viewport: { width: 375, height: 812 } })` 모바일 시뮬
- `page.tap()` 터치 이벤트

## Dependencies

### Internal
- `../../` 앱 전체 (개발 서버 기동 전제)

### External
- `@playwright/test`
