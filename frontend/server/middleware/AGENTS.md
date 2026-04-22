<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/server/middleware

## Purpose
Nitro 서버 미들웨어. 요청 수준에서 호스트 정규화, 영구 삭제(410 Gone), 레거시 URL 리다이렉트를 처리한다.

## Key Files
| File | Description |
|------|-------------|
| `canonical-host.ts` | `www.` 혹은 잘못된 호스트를 `ilsangkit.co.kr`로 301 리다이렉트 |
| `gone.ts` | 의도적으로 제거된 URL에 410 Gone 응답 (색인 제거용) |
| `real-estate-redirect.ts` | 구 부동산 URL → 신규 경로 매핑 |
| `redirects.ts` | 범용 URL 리다이렉트 테이블 |

## For AI Agents

### Working In This Directory
- **Nitro 미들웨어는 파일 알파벳 순서로 실행** — 우선순위를 예상할 수 없으면 번호 접두어 고려
- 301(영구) vs 302(임시) 의도 명확히
- 410 Gone은 색인 제거 목적 — 신중히 사용
- 정규식 리다이렉트는 `server/` 디렉터리 내 테스트 파일(`tests/server/real-estate-redirect-regex.test.ts`) 필수

### Testing Requirements
- `tests/server/real-estate-redirect.test.ts`, `real-estate-redirect-regex.test.ts`
- 케이스: 매칭/비매칭/파라미터 보존

### Common Patterns
- `defineEventHandler((event) => { ... sendRedirect(event, url, 301) })`
- 조건부 `return` — 매칭 안 되면 그냥 반환하여 다음 미들웨어로

## Dependencies

### Internal
- `../../utils/realEstateUrl.ts` — URL 해석

### External
- Nitro, `h3`
