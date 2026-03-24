export interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}

export function generateRssXml(
  items: RssItem[],
  channelInfo: { title: string; link: string; description: string; selfUrl?: string },
): string {
  const lastBuildDate = new Date().toUTCString()
  const selfUrl = channelInfo.selfUrl || 'https://ilsangkit.co.kr/rss.xml'

  const itemsXml = items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <guid isPermaLink="true">${item.link}</guid>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    </item>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${channelInfo.title}</title>
    <link>${channelInfo.link}</link>
    <description>${channelInfo.description}</description>
    <language>ko</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${selfUrl}" rel="self" type="application/rss+xml" />
    ${itemsXml}
  </channel>
</rss>`
}
