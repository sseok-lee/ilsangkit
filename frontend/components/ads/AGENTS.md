<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/ads

## Purpose
AdSense/디스플레이 광고 배너 래퍼. 뷰어빌리티/CLS 방지/RPM 최적화를 고려한 광고 배치 컴포넌트.

## Key Files
| File | Description |
|------|-------------|
| `AdBanner.vue` | 인라인 디스플레이 광고 슬롯 |
| `AnchorAdBanner.vue` | 하단 고정 앵커 광고 |

## For AI Agents

### Working In This Directory
- **CLS 방지**: 광고 컨테이너에 `min-height` 또는 `aspect-ratio` 지정 필수
- **광고 로더는 클라이언트 전용**: `if (!import.meta.client) return`
- `adsense-evaluation` 스킬의 배치 전략 준수 (`.claude/skills/adsense-evaluation`)
- AdSense 슬롯 ID는 환경변수 또는 props로 외부 주입

### Testing Requirements
- 컴포넌트 렌더링 테스트 (props 전달, 가드 동작)
- 실제 광고 로드는 E2E 수동 확인

### Common Patterns
- `<div class="ad-slot" style="min-height: 280px">` 고정 높이
- `defineProps<{ slot: string; format?: 'auto' | 'rectangle' }>()`

## Dependencies

### Internal
- 루트 `ads.txt`, `public/ads.txt`

### External
- Google AdSense (pagead2.googlesyndication.com)
