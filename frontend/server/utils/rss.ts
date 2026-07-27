import { toXmlText } from './xml'

export interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}

/** 파싱 불가능한 날짜는 null. 호출부가 '없음'과 '깨짐'을 구분하지 않아도 되게 한다. */
function pubTime(value: string): number | null {
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? null : time
}

/**
 * 파싱 불가능한 날짜는 `Invalid Date` 문자열을 뱉는 대신 null 을 돌려준다.
 * RSS 2.0 에서 item 의 pubDate 는 선택 요소이므로, 값이 없으면 요소 자체를 생략하는 편이
 * 깨진 날짜를 내보내는 것보다 안전하다.
 */
function formatPubDate(value: string): string | null {
  const time = pubTime(value)
  return time === null ? null : new Date(time).toUTCString()
}

/**
 * 최신 발행순 정렬. 날짜 없는 항목은 뒤로 밀되 서로의 상대 순서는 유지한다
 * (Array.prototype.sort 는 ES2019 부터 안정 정렬).
 * 호출부가 잊어버릴 수 있으므로 API 응답 순서에 기대지 않고 여기서 보장한다.
 */
function sortByPubDateDesc(items: RssItem[]): RssItem[] {
  return [...items].sort((a, b) => {
    const ta = pubTime(a.pubDate)
    const tb = pubTime(b.pubDate)
    if (ta === null && tb === null) return 0
    if (ta === null) return 1
    if (tb === null) return -1
    return tb - ta
  })
}

export function generateRssXml(
  items: RssItem[],
  channelInfo: { title: string; link: string; description: string; selfUrl: string },
): string {
  const selfUrl = channelInfo.selfUrl
  const sorted = sortByPubDateDesc(items)

  // 신선도 신호는 콘텐츠에서만 도출한다. 서빙 시각을 쓰면 내용이 3주째 그대로인 피드가
  // 매 요청 "방금 갱신"을 주장하고, 캐시 만료마다 바이트가 달라져 조건부 요청도 무력해진다.
  // 도출할 날짜가 없으면 지어내지 말고 생략한다 (lastBuildDate 는 선택 요소).
  const latest = sorted.reduce<number | null>((max, item) => {
    const time = pubTime(item.pubDate)
    if (time === null) return max
    return max === null || time > max ? time : max
  }, null)
  const lastBuildDate = latest === null ? null : new Date(latest).toUTCString()

  // CDATA 를 쓰지 않고 엔티티 이스케이프로 통일한다. CDATA 는 본문에 `]]>` 가 섞이면
  // 섹션이 조기 종료되어 피드 전체가 깨지고(어드민 입력은 sanitize 를 우회한다),
  // 저장소의 sitemap.ts·ogImage.ts 도 이미 이스케이프 방식을 쓴다.
  const itemsXml = sorted.map((item) => {
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
    <language>ko</language>${lastBuildDate ? `
    <lastBuildDate>${lastBuildDate}</lastBuildDate>` : ''}
    <atom:link href="${toXmlText(selfUrl)}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`
}
