<!-- Parent: ../AGENTS.md -->
<!-- Generated: 2026-04-22 | Updated: 2026-04-22 -->

# frontend/tests/components/realEstate

## Purpose
`components/realEstate/` 테스트. 8개 컴포넌트 대부분 커버.

## Key Files
| File | Description |
|------|-------------|
| `AreaSelector.test.ts` | 면적 범위 선택 |
| `ComplexCard.test.ts` | 단지 카드 |
| `NearbyFacilities.test.ts` | 주변 시설 |
| `PriceTrendChart.test.ts` | 가격 차트 |
| `RealEstateSearchFilter.test.ts` | 검색 필터 |
| `RentTypeToggle.test.ts` | 전월세 전환 |
| `TransactionModeTab.test.ts` | 매매/임대 탭 |
| `TransactionTable.test.ts` | 거래 테이블 |

## For AI Agents

### Working In This Directory
- BigInt/Decimal → Number 변환 후 비교 (테스트 fixture는 Number 사용)
- 차트 라이브러리는 mock 또는 렌더만 확인 (계산은 별도 유닛)

### Testing Requirements
- URL 생성 왕복은 `tests/utils/realEstateUrl.test.ts`에서 검증

### Common Patterns
- 거래 fixture 배열은 테스트 파일에 상수
- 필터 변경 시 emit 이벤트 확인

## Dependencies

### Internal
- `../../../components/realEstate/`, `../../../utils/`

### External
- `vitest`, `@vue/test-utils`
