<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/scripts

## Purpose
프론트엔드 전용 빌드/설치 시 보조 스크립트.

## Key Files
| File | Description |
|------|-------------|
| `patch-pinia.mjs` | Pinia/Nuxt 3 호환성 패치 (postinstall에서 실행) |

## For AI Agents

### Working In This Directory
- `package.json`의 `postinstall` 훅에서 실행됨 — 설치마다 수행
- Node ESM 모듈 (`.mjs`) — `import`/`export` 사용
- 패치는 멱등해야 함 (여러 번 실행해도 안전)

### Testing Requirements
- 수동 검증 — `rm -rf node_modules && npm install` 후 Nuxt 부팅 확인
- Pinia/Nuxt 업그레이드 시 패치 필요 여부 재평가

### Common Patterns
- `fs.readFile` → 정규식 치환 → `fs.writeFile` 순서

## Dependencies

### Internal
- `../node_modules/pinia` (설치 후 패치 대상)

### External
- Node 20+ (ESM, `fs/promises`)
