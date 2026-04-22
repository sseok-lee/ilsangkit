<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/facility/details

## Purpose
15개 카테고리 Detail 컴포넌트 테스트 중 9개 커버.

## Key Files
| File | Description |
|------|-------------|
| `ChildcareDetail.test.ts` | 어린이집 |
| `EvChargerDetail.test.ts` | 전기차 충전소 (충전기 목록) |
| `HospitalDetail.test.ts` | 병원 |
| `MarketDetail.test.ts` | 전통시장 |
| `ParkDetail.test.ts` | 공원 |
| `PharmacyDetail.test.ts` | 약국 |
| `SchoolDetail.test.ts` | 학교 (NEIS 필드) |
| `SportsDetail.test.ts` | 체육시설 |
| `ToiletDetail.test.ts` | 공공화장실 |

## For AI Agents

### Working In This Directory
- **누락 테스트**: `AedDetail`, `LibraryDetail`, `WifiDetail`, `ClothesDetail`, `ParkingDetail`, `TrashDetail` — 15개 중 6개 누락, 추가 권장
- 각 카테고리 고유 필드 렌더링 검증
- 운영 시간/상태는 시간 고정 필요

### Testing Requirements
- Prisma 생성 타입이 아닌 DTO 타입으로 props 구성

### Common Patterns
- 샘플 데이터는 테스트 파일 상단에 상수로
- `DetailRow` 렌더 개수로 필드 노출 개수 검증

## Dependencies

### Internal
- `../../../../components/facility/details/`, `../../../../types/facility.ts`

### External
- `vitest`, `@vue/test-utils`
