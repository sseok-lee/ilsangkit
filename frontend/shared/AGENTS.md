<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-05-07 | Updated: 2026-05-07 -->

# shared

## Purpose
프론트엔드 전역에서 공유하는 상수 및 데이터 모듈. 지역(시/도/구/군) slug 매핑, 동적 라우트 생성, 정규화 로직 등을 Single Source of Truth로 제공한다.

## Key Files
| File | Description |
|------|-------------|
| `regionSlugs.ts` | 지역 slug 매핑 (한글 ↔ slug) + 시/도별 구/군 목록 + 헬퍼 함수 `getDistrictSlug()` |

## Subdirectories
None

## For AI Agents

### Working In This Directory
- **지역 매핑**: 4가지 변환 맵 제공
  - `CITY_SLUGS`: 시/도 한글 → slug (예: "서울" → "seoul")
  - `CITY_SLUG_MAP`: slug → 시/도 한글 (역매핑)
  - `CITY_FULL_NAME_TO_SLUG`: DB 풀네임 → slug (예: "서울특별시" → "seoul")
  - `DISTRICT_SLUG_MAP`: 구/군/시 한글 → slug (300+ 항목)
- **지역 목록**: `REGIONS` Record로 시/도별 구/군 배열 제공
- **헬퍼 함수**: `getDistrictSlug(koreanName)` — DISTRICT_SLUG_MAP 조회 후 fallback
- **용도**: 라우트 slug 생성, 지역 필터, UI 드롭다운 등

### Common Patterns
- 한글 지역명 → URL slug 변환 (예: `/seoul/gangnam/` 라우트)
- 역방향 변환 (slug → 한글 표시명)
- DB에 "서울특별시"와 "서울" 혼재 시 양쪽 매핑으로 대응
- 새 지역 추가 시 이 파일만 수정하면 static.xml.ts, useRegions.ts 등에 자동 반영

## Dependencies

### Internal
- 사용처: `frontend/pages/` (지역 라우트), `frontend/composables/useRegions.ts`, `frontend/server/routes/static.xml.ts`, `frontend/utils/` 등 여러 곳
- 명명 규칙 공유: 다른 파일에서 동일한 slug 사용 (단일 소스 원칙)

### External
- JavaScript (TypeScript Record, Object.entries())

<!-- MANUAL: -->
