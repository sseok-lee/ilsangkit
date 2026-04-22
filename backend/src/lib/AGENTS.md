<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# backend/src/lib

## Purpose
프로젝트 최하위 공용 유틸. Prisma 싱글톤, 에러 클래스, asyncHandler, 외부 API 클라이언트, 파서 및 URL/주소/지역 슬러그 헬퍼.

## Key Files
| File | Description |
|------|-------------|
| `prisma.ts` | Prisma Client 싱글톤 (hot-reload 시 인스턴스 중복 방지) |
| `asyncHandler.ts` | Express 5 async 라우트 래퍼 — Promise reject를 next(err)로 전파 |
| `errors.ts` | `NotFoundError`/`ValidationError`/`ConflictError` 클래스 + 전역 핸들러 |
| `publicApiClient.ts` | 공공데이터 HTTP 클라이언트 (재시도/타임아웃) |
| `csvParser.ts` | CSV → 객체 배열 변환 (BOM 처리, 한글 인코딩) |
| `addressParser.ts` | 주소 문자열 → 시/구/동 파싱 |
| `realEstateBuildingName.ts` | 부동산 건물명 정규화 (지번 → 건물명 매핑) |
| `realEstateUrl.ts` | 부동산 상세 URL 생성/파싱 (slug → 객체) |
| `regionSlugs.ts` | 한글 지역명 ↔ 영문 slug 변환 |

## For AI Agents

### Working In This Directory
- **Prisma 싱글톤**: `globalThis.prisma` 패턴 — dev hot-reload 시 인스턴스 폭증 방지
- **에러 클래스 확장 시**: `code`, `statusCode`, `message`, `details` 필드 준수
- `asyncHandler` 시그니처: `(req, res, next) => Promise<void>` 래퍼
- `realEstateBuildingName`/`realEstateUrl`는 frontend 동형과 로직 일치 필수 — 드리프트 발생 시 사용자 URL 깨짐
- ESM `.js` 확장자 import

### Testing Requirements
- `backend/__tests__/lib/` — 6개 파일 커버 (asyncHandler, errors, prisma, publicApiClient, realEstateBuildingName, realEstateUrl)

### Common Patterns
- Default export는 singleton에 한해 사용 (prisma)
- 그 외 named export 선호
- 에러 클래스는 `extends Error` + `this.name` 설정

## Dependencies

### Internal
- `../constants/` (geo/pagination)

### External
- `@prisma/client`, `axios`, `csv-parse`
