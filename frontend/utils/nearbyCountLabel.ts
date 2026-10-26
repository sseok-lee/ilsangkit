/**
 * "주변 시설" 섹션 머리의 개수 문구. 예: `2km 안 1,942곳`, 하한값이면 `… 이상`.
 * 부동산 상세(2km)·시설 상세(1km) 공용.
 */
export function nearbyCountLabel(radiusMeters: number, count: number, exact = true): string {
  const radius = radiusMeters >= 1000 ? `${radiusMeters / 1000}km` : `${radiusMeters}m`
  return `${radius} 안 ${count.toLocaleString('ko-KR')}곳${exact ? '' : ' 이상'}`
}
