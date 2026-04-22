<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/components/facility/details

## Purpose
15개 시설 카테고리별 상세 컴포넌트. 각 카테고리 고유 필드를 표시하는 전용 뷰.

## Key Files
| File | Description |
|------|-------------|
| `ToiletDetail.vue` | 공공화장실 (남/여 칸수, 장애인/유아용 설비) |
| `ParkingDetail.vue` | 주차장 (면수, 요금, 운영 시간) |
| `SchoolDetail.vue` | 학교 (NEIS 학과/학급 정보) |
| `ChildcareDetail.vue` | 어린이집 |
| `LibraryDetail.vue` | 도서관 |
| `MarketDetail.vue` | 전통시장 |
| `ParkDetail.vue` | 공원 (편의시설) |
| `SportsDetail.vue` | 체육시설 |
| `AedDetail.vue` | 자동제세동기 |
| `HospitalDetail.vue` | 병원 |
| `PharmacyDetail.vue` | 약국 |
| `ClothesDetail.vue` | 의류수거함 |
| `EvChargerDetail.vue` | 전기차 충전소 (충전기 목록) |
| `WifiDetail.vue` | 공공 와이파이 |
| `TrashDetail.vue` | 쓰레기 배출 (카테고리 시설 아닌 일정 데이터) |

## For AI Agents

### Working In This Directory
- **새 카테고리 추가 시**: `XxxDetail.vue` 생성 → `../FacilityDetail.vue` 매핑에 등록 → `tests/components/facility/details/XxxDetail.test.ts` 작성
- `ev-charger`는 충전소(`statId`) 단위 그룹핑 — 충전기 목록 렌더링 필요
- `trash`는 좌표 없는 일정 데이터 — `WasteSchedule` 별도 모델 사용 (`useWasteSchedule` composable)
- 필드 누락 시 조건부 렌더링 (`v-if="data.field"`)

### Testing Requirements
- `tests/components/facility/details/` — 9개 테스트 존재 (Childcare, EvCharger, Hospital, Market, Park, Pharmacy, School, Sports, Toilet)
- Aed/Library/Wifi/Clothes/Trash 테스트는 누락 — 추가 권장

### Common Patterns
- `defineProps<{ data: ToiletRecord }>()` — 카테고리별 타입 명시
- `<DetailRow label="..." :value="..." />` 반복

## Dependencies

### Internal
- `../DetailRow.vue`
- `../../../composables/useFacilityDetail.ts`
- `../../../types/facility.ts` — 카테고리별 레코드 타입
- `../../../utils/formatOperatingHours.ts`, `formatters.ts`

### External
- (없음)
