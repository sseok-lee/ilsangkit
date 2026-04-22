<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/map

## Purpose
`components/map/` 테스트.

## Key Files
| File | Description |
|------|-------------|
| `FacilityMap.test.ts` | Kakao Map 래퍼 (SDK mock) |

## For AI Agents

### Working In This Directory
- `window.kakao` 전역을 mock 또는 `useKakaoMap` composable 전체를 mock
- SSR 가드 동작 확인 (서버에서 지도 초기화 스킵)
- `FacilityBottomSheet.test.ts` 누락 — 모바일 바텀시트 제스처 테스트 권장

### Testing Requirements
- happy-dom 환경 — 실제 Kakao SDK 로드 불가

### Common Patterns
- `vi.stubGlobal('kakao', mockKakao)`
- `import.meta.client = true` 가정

## Dependencies

### Internal
- `../../../components/map/`, `../../../composables/useKakaoMap.ts`

### External
- `vitest`, `@vue/test-utils`
