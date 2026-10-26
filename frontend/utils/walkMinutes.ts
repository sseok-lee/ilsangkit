/** 성인 평균 보행 속도(분속 67m ≈ 시속 4km). */
const WALK_METERS_PER_MINUTE = 67

/**
 * 직선거리(m) → 도보 시간(분) 추정. 실제 길은 직선보다 기니 "약 n분"으로만 쓴다.
 * 아주 가까워도 0분이 아니라 1분으로 올린다.
 */
export function walkMinutes(distanceMeters: number): number {
  return Math.max(1, Math.round(distanceMeters / WALK_METERS_PER_MINUTE))
}
