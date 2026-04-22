<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/pwa

## Purpose
PWA 관련 테스트 (manifest/Service Worker).

## Key Files
| File | Description |
|------|-------------|
| `manifest.test.ts` | `public/site.webmanifest` 유효성 검증 |

## For AI Agents

### Working In This Directory
- `public/site.webmanifest` 스키마(name/icons/start_url/display 등) 확인
- 아이콘 파일(`public/icons/icon-192x192.png`, `icon-512x512.png`) 존재 검증은 별도

### Testing Requirements
- JSON 파싱 + 필수 필드 존재 확인

### Common Patterns
- `const manifest = JSON.parse(readFileSync('public/site.webmanifest', 'utf8'))`

## Dependencies

### Internal
- `../../public/site.webmanifest`

### External
- `vitest`, Node `fs`
