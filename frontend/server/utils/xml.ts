/**
 * XML 직렬화 공용 유틸.
 *
 * sitemap.ts 와 ogImage.ts 가 각자 동일한 escapeXml 사본을 갖고 있었고 rss.ts 에만 빠져 있었다.
 * 세 번째 사본을 만들지 말고 여기를 쓸 것.
 */

/** 텍스트 노드·속성값 공용 이스케이프 (XML 1.0 사전정의 엔티티 5종). */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * XML 1.0 이 허용하지 않는 제어문자 제거.
 *
 * 이 문자들은 이스케이프로도 표현할 수 없어(`&#11;` 조차 무효) 반드시 제거해야 한다.
 * 탭(\x09)·개행(\x0A)·복귀(\x0D)는 유효하므로 남긴다.
 */
// eslint-disable-next-line no-control-regex
const INVALID_XML_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g

export function stripInvalidXmlChars(str: string): string {
  return str.replace(INVALID_XML_CHARS, '')
}

/** 외부 입력을 XML 텍스트/속성으로 안전하게 내보내기 위한 표준 경로. */
export function toXmlText(value: string): string {
  return escapeXml(stripInvalidXmlChars(value))
}
