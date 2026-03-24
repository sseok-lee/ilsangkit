export interface RssItem {
  title: string
  link: string
  description: string
  pubDate: string
}

export function generateRssXml(items: RssItem[], channelInfo: { title: string; link: string; description: string }): string {
  const itemsXml = items.map(item => `
    <item>
      <title><![CDATA[${item.title}]]></title>
      <link>${item.link}</link>
      <description><![CDATA[${item.description}]]></description>
      <pubDate>${new Date(item.pubDate).toUTCString()}</pubDate>
    </item>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>${channelInfo.title}</title>
    <link>${channelInfo.link}</link>
    <description>${channelInfo.description}</description>
    <language>ko</language>
    ${itemsXml}
  </channel>
</rss>`
}
