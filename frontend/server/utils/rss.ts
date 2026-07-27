import { toXmlText } from './xml'

export interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}

/**
 * 파싱 불가능한 날짜는 `Invalid Date` 문자열을 뱉는 대신 null 을 돌려준다.
 * RSS 2.0 에서 item 의 pubDate 는 선택 요소이므로, 값이 없으면 요소 자체를 생략하는 편이
 * 깨진 날짜를 내보내는 것보다 안전하다.
 */
function formatPubDate(value: string): string | null {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toUTCString()
}

export function generateRssXml(
  items: RssItem[],
  channelInfo: { title: string; link: string; description: string; selfUrl: string },
): string {
  const lastBuildDate = new Date().toUTCString()
  const selfUrl = channelInfo.selfUrl

  // CDATA 를 쓰지 않고 엔티티 이스케이프로 통일한다. CDATA 는 본문에 `]]>` 가 섞이면
  // 섹션이 조기 종료되어 피드 전체가 깨지고(어드민 입력은 sanitize 를 우회한다),
  // 저장소의 sitemap.ts·ogImage.ts 도 이미 이스케이프 방식을 쓴다.
  const itemsXml = items.map((item) => {
    const pubDate = formatPubDate(item.pubDate)
    return `
    <item>
      <title>${toXmlText(item.title)}</title>
      <link>${toXmlText(item.link)}</link>
      <guid isPermaLink="true">${toXmlText(item.link)}</guid>
      <description>${toXmlText(item.description)}</description>${pubDate ? `
      <pubDate>${pubDate}</pubDate>` : ''}
    </item>`
  }).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${toXmlText(channelInfo.title)}</title>
    <link>${toXmlText(channelInfo.link)}</link>
    <description>${toXmlText(channelInfo.description)}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${toXmlText(selfUrl)}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`
}
