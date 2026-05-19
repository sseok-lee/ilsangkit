import { XMLParser } from 'fast-xml-parser';

export interface RawSourceItem {
  sourceUrl: string;
  sourceProvider: string;
  sourceTitle: string;
  sourcePublishedAt: Date;
  rawHtml?: string;
  rssDescription?: string;
}

const KOREA_KR_FEED_URL = 'https://www.korea.kr/rss/policy.xml';

const parser = new XMLParser({
  ignoreAttributes: false,
  cdataPropName: '__cdata',
  textNodeName: '_text',
});

interface ParsedItem {
  title?: string | { __cdata?: string; _text?: string };
  link?: string;
  pubDate?: string;
  description?: string | { __cdata?: string; _text?: string };
}

function pickText(v: ParsedItem['title']): string {
  if (typeof v === 'string') return v;
  if (v && typeof v === 'object') return v.__cdata ?? v._text ?? '';
  return '';
}

export function parseKoreaKrRss(xml: string): RawSourceItem[] {
  const parsed = parser.parse(xml) as {
    rss?: { channel?: { item?: ParsedItem | ParsedItem[] } };
  };
  const rawItems = parsed.rss?.channel?.item;
  if (!rawItems) return [];
  const items: ParsedItem[] = Array.isArray(rawItems) ? rawItems : [rawItems];

  return items.flatMap((item) => {
    const title = pickText(item.title);
    const link = item.link ?? '';
    const pubDate = item.pubDate ?? '';
    if (!title || !link || !pubDate) return [];
    const description = pickText(item.description);
    const date = new Date(pubDate);
    if (Number.isNaN(date.getTime())) return [];
    return [{
      sourceUrl: link,
      sourceProvider: 'korea.kr',
      sourceTitle: title,
      sourcePublishedAt: date,
      rssDescription: description || undefined,
    }];
  });
}

export async function fetchKoreaKrRss(
  feedUrl: string = KOREA_KR_FEED_URL
): Promise<RawSourceItem[]> {
  const res = await fetch(feedUrl, {
    headers: { 'user-agent': 'ilsangkit-guide-bot/1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new Error(`korea.kr fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  return parseKoreaKrRss(xml);
}
