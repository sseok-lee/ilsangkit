/** 쉼표 구분 운영시간 문자열을 줄바꿈으로 변환 */
export function formatOperatingHours(raw: string): string {
  return raw.replace(/,\s*/g, '\n')
}
