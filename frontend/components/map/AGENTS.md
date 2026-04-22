<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/map

## Purpose
Kakao Map 기반 지도 컴포넌트. 시설 위치 시각화, 모바일 바텀시트 UI 포함.

## Key Files
| File | Description |
|------|-------------|
| `FacilityMap.vue` | Kakao Map 래퍼 — 마커, 클러스터링, 반경 원 |
| `FacilityBottomSheet.vue` | 모바일 지도 하단 시설 리스트 바텀시트 |

## For AI Agents

### Working In This Directory
- **클라이언트 전용**: Kakao SDK는 `window` 의존 — SSR 가드 필수
- `useKakaoMap` composable로 SDK 로드/지도 인스턴스 생성
- `NUXT_PUBLIC_KAKAO_MAP_KEY` 환경변수 필요 (CDN 로더에 autoload 파라미터로 전달)
- 마커 대량 렌더링 시 클러스터링 활성화
- 바텀시트는 터치 제스처로 높이 조절 (모바일 UX)

### Testing Requirements
- `tests/components/map/FacilityMap.test.ts` — Kakao SDK mock 기반
- E2E 터치 제스처 테스트는 `tests/e2e/touch-interaction.spec.ts`

### Common Patterns
- `onMounted` 내부에서 지도 초기화 — `import.meta.client` 가드
- Unmount 시 지도 인스턴스 정리 (메모리 누수 방지)

## Dependencies

### Internal
- `../../composables/useKakaoMap.ts`, `useFacilitySearch.ts`
- `../facility/FacilityCard.vue`

### External
- Kakao Maps JavaScript SDK v3
