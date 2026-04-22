<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/utils

## Purpose
도메인별 순수 함수 유틸. 포매팅(금액/시간/주소), 카테고리 메타(설명/아이콘/색상/FAQ), SEO 상수/헬퍼, 부동산/청약 URL 생성, 상태 계산.

## Key Files
| File | Description |
|------|-------------|
| `analyticsConstants.ts` | GA4 이벤트 이름/파라미터 상수 |
| `categoryColors.ts` | 15개 카테고리별 테마 컬러 |
| `categoryDescriptions.ts` | 카테고리 허브 페이지 설명문 |
| `categoryFAQ.ts` | 카테고리별 FAQ 데이터 (구조화 데이터용) |
| `categoryIcons.ts` | 카테고리 → 아이콘 매핑 |
| `dataSource.ts` | 공공데이터 출처 메타 (URL/라이선스/갱신주기) |
| `dynamicFAQ.ts` | 지역·카테고리 조합 FAQ 동적 생성 |
| `dynamicTips.ts` | 시설별 동적 팁/안내 생성 |
| `facilityStatus.ts` | 운영 시간 → "운영 중/종료" 상태 계산 |
| `formatDeposit.ts` | 부동산 보증금/월세 포매팅 (억/만원) |
| `formatOperatingHours.ts` | 운영 시간 문자열 파싱/포매팅 |
| `formatters.ts` | 숫자/날짜/주소 공용 포매터 |
| `realEstateBuildingName.ts` | 건물명 정규화 (frontend 경유 — backend 동형 존재) |
| `realEstateMeta.ts` | 부동산 페이지 메타/FAQ/설명 |
| `realEstateNoindex.ts` | noindex 대상 부동산 URL 판별 |
| `realEstateUrl.ts` | 부동산 URL 생성/파싱 |
| `seoConstants.ts` | 사이트 전역 SEO 상수 (제목 템플릿, 기본 설명) |
| `seoHelpers.ts` | 메타/JSON-LD 생성 헬퍼 |
| `subscriptionMeta.ts` | 청약 페이지 메타/설명 |
| `wasteHowTo.ts` | 쓰레기 유형별 배출 방법 안내 |

## Subdirectories
| Directory | Purpose |
|-----------|---------|
| `api/` | API 클라이언트 래퍼 (see `api/AGENTS.md`) |

## For AI Agents

### Working In This Directory
- **순수 함수 유지** — 반응성(ref/reactive) 금지, composable이 이미 있음
- 카테고리 추가 시: `categoryColors`, `categoryDescriptions`, `categoryFAQ`, `categoryIcons`, `dataSource` 5종 업데이트 필수
- `realEstateBuildingName`/`realEstateUrl`는 backend 동형과 로직 일치 필요 (드리프트 주의)
- SEO 변경 시 `seoConstants` 상수만 수정 — `useSeoMeta` 호출부는 상수 참조

### Testing Requirements
- 테스트는 `tests/utils/`에 `categoryDescription`, `formatDeposit`, `realEstateBuildingName`, `realEstateUrl`, `seoConstants-related`, `seoConstants`, `seoHelpers` 존재
- 순수 함수이므로 단순 입출력 단위 테스트

### Common Patterns
- Default export 지양, named export 선호
- 상수는 `as const`로 리터럴 타입 고정

## Dependencies

### Internal
- `../types/` — 카테고리/부동산 타입
- `../shared/regionSlugs.ts` — 지역 slug 매핑

### External
- (없음 — 순수 유틸 목적)
