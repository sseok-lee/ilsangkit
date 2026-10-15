<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/ads

## Purpose
AdSense/디스플레이 광고 배너 래퍼. 앱의 초기 높이 예약 없이 SDK가 만든 실제 크기를 수용하는 광고 배치 컴포넌트.

## Key Files
| File | Description |
|------|-------------|
| `AdBanner.vue` | 인라인 디스플레이 광고 슬롯 |
| `useDeferredAdSenseRequest.ts` | SDK ready·연결된 DOM·양수 폭·근접·문서 가시성 확인 및 요소당 1회 요청 composable |

> AnchorAdBanner(모바일 하단 고정 앵커)는 AdSense 자동광고 overlay와 중복돼 제거됨. 재도입 금지.

## For AI Agents

### Working In This Directory
- **초기 무예약**: 광고 높이·최소 높이·고정 높이·aspect-ratio를 예약하지 않는다.
- 기본 포맷은 데스크톱(≥768px) `horizontal`, 모바일(<768px) `auto`이며 명시적 `adFormat`이 우선한다.
- `ins`의 실제 렌더 높이가 0이면 wrapper의 margin/padding/border만 제거한다. SDK ready·filled 이전에도 양수 높이를 허용하고 pending 광고를 숨기거나 자르지 않는다.
- 요청한 요소의 slot/format/full-width 속성은 최초 push 전에 고정하며, SDK의 inline 높이를 덮어쓰지 않는다.
- 정상 fill에 따른 하향 이동은 허용한다. 초기 실패 무이동을 전체 CLS 0 또는 실제 충전 보장으로 표현하지 않는다.
- 요청은 정책 허용·연결된 DOM·SDK ready·외부 display:none 아님·유한 양수 폭·근접·visible 문서가 모두 필요하다. 높이와 양수 intersectionRatio는 조건이 아니다.
- 근접 IO는 `root: null`, `rootMargin: '0px 0px 300px 0px'`, `threshold: 0`으로 SDK 대기 전에 등록한다. 획득한 자격은 같은 `ins`에 보존하고 새 요소는 재판정한다.
- 같은 `ins`에는 push 예외까지 최대 1회 시도한다. 요청 완료·정책 해제·unmount는 request IO/폭 RO/visibility listener를 정리하며, AdBanner status/크기 관측은 요소 수명 동안 유지한다.
- 1500ms 미만 route 변경은 같은 요소와 waiter를 보존한다. visibility/resize는 SDK 재시도를 만들지 않는다.
- **광고 로더는 클라이언트 전용**: `if (!import.meta.client) return`
- `adsense-evaluation` 스킬의 배치 전략 준수 (`.claude/skills/adsense-evaluation`)
- AdSense 슬롯 ID는 환경변수 또는 props로 외부 주입

### Testing Requirements
- 컴포넌트 렌더링 테스트 (props 전달, 가드 동작)
- 실제 광고 로드는 E2E 수동 확인

### Common Patterns
- `<AdBanner />`는 본문 폭 100%와 viewport 기본 포맷을 사용한다.
- 상세 첫 슬롯은 `<AdBanner full-width-responsive="false" />`로 확장을 끈다.
- `variant="compact-mobile"`은 모바일 max-width 336px·full-width=false를 적용하며 높이는 예약하지 않는다.
- `ad-banner--empty`는 간격만 지우고, `ad-banner--collapsed`는 명시적 unfilled/loader-error/외부 display:none에만 적용한다.

## Dependencies

### Internal
- 루트 `ads.txt`, `public/ads.txt`

### External
- Google AdSense (pagead2.googlesyndication.com)
