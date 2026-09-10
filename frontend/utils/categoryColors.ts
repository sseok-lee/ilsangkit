/**
 * Canonical category color map.
 *
 * tailwind.config.js 의 category colors 를 손으로 미러링한 값이다. 자동 참조가
 * 아니므로 토큰을 바꾸면 여기도 같이 바꿔야 한다. 실제로 15중 9가 어긋난 채
 * 방치돼 있었고(주석은 일치한다고 주장했다) 지도 마커와 카테고리 UI 가 같은
 * 카테고리를 다른 색으로 그렸다. 값과 대소문자를 토큰과 완전히 일치시켜
 * 문자열 비교만으로 드리프트를 잡을 수 있게 한다.
 *
 * 근본 해결은 Tailwind 를 CSS 변수에 배선해 중복 자체를 없애는 것이고 별건이다.
 */
export const CATEGORY_MARKER_COLORS: Record<string, string> = {
  toilet: '#7C4DEC',
  trash: '#0FA968',
  wifi: '#E8920C',
  clothes: '#E2548E',
  parking: '#0EA5E9',
  aed: '#E0443B',
  library: '#D9820B',
  park: '#22A95B',
  school: '#6366F1',
  market: '#F2730C',
  hospital: '#3B82F6',
  pharmacy: '#14B8A6',
  childcare: '#EC6AA5',
  'ev-charger': '#06B6D4',
  sports: '#8B5CF6',
}

export function getMarkerColor(category: string): string {
  return CATEGORY_MARKER_COLORS[category] || '#3B82F6'
}
