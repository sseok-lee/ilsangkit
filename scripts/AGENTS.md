<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# scripts

## Purpose
루트 레벨에서 실행되는 쉘 스크립트 모음. 주로 Lighthouse 성능 측정과 SEO 검증용 CI/로컬 도구.

## Key Files
| File | Description |
|------|-------------|
| `lighthouse-test.sh` | Lighthouse 실행 스크립트 (성능/접근성/SEO 점수 수집) |
| `validate-seo.sh` | SEO 메타/사이트맵/robots.txt 검증 |

## For AI Agents

### Working In This Directory
- Bash 스크립트 — `#!/usr/bin/env bash`와 `set -euo pipefail` 관례 유지
- 실행 권한(`chmod +x`) 확인
- 스크립트가 생성하는 리포트는 루트 `lighthouse-results/`, `lighthouse-results-prod/`, `lighthouse-reports/`로 저장됨

### Testing Requirements
- 쉘 스크립트 자체 테스트 없음 — 수동 실행으로 검증
- CI에서 사용되는 경우 `.github/workflows/`의 작업과 동기화 필요

### Common Patterns
- 환경 변수 기반 타깃 URL 스위칭 (로컬 vs 프로덕션)

## Dependencies

### Internal
- `lighthouserc.js` — Lighthouse CI 설정

### External
- `lighthouse` CLI, `curl`, `jq`
