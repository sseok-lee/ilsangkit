<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-05-07 -->

# backend/src/utils

## Purpose
도메인 특화 헬퍼. 현재는 청약 관련 유틸만 분리되어 있다. 더 공용인 것은 `lib/`에, 서비스 내부 전용은 각 `service.ts`에 직접 둔다.

## Key Files
| File | Description |
|------|-------------|
| `subscriptionUtils.ts` | 청약 공급 유형 분류/필터 헬퍼 |

## For AI Agents

### Working In This Directory
- 새 유틸 추가 기준: 2+ 서비스/라우트에서 공용 + 도메인 특화 — 둘 중 하나라도 아니면 `lib/`(공용) 또는 서비스 내부로
- 순수 함수 유지 — DB 접근 금지
- `backend/src/services/` 내부 전용이면 그 서비스 파일에 함께 두는 편이 낫다

### Testing Requirements
- 순수 함수 단위 테스트 — `backend/__tests__/` 하위에 대응 위치

### Common Patterns
- named export, 타입과 함수를 같은 파일에 그룹화

## Dependencies

### Internal
- `../types/` — 청약 타입

### External
- (없음)
