import { XMLParser } from 'fast-xml-parser';
import type { RawSourceItem } from './koreaKr.js';

export interface MinistryFeed {
  provider: string;
  url: string;
  categories: string[];
}

export const MINISTRY_FEEDS: MinistryFeed[] = [
  {
    provider: 'molit',
    url: 'https://www.molit.go.kr/USR/NEWS/m_71/lst.jsp?rss=1',
    categories: [
      'apt-sale', 'apt-rent', 'public-rental', 'subscription',
      'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent',
    ],
  },
  {
    provider: 'mohw',
    url: 'https://www.mohw.go.kr/board.es?rss=1&bid=0027',
    categories: ['hospital', 'pharmacy'],
  },
  {
    provider: 'seoul',
    url: 'https://news.seoul.go.kr/news/list/rss',
    categories: ['parking', 'ev-charger', 'park', 'market', 'toilet', 'aed'],
  },
];

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

export function parseMinistryRss(xml: string, provider: string): RawSourceItem[] {
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
      sourceProvider: provider,
      sourceTitle: title,
      sourcePublishedAt: date,
      rssDescription: description || undefined,
    }];
  });
}

export async function fetchMinistryRss(
  feed: MinistryFeed
): Promise<RawSourceItem[]> {
  const res = await fetch(feed.url, {
    headers: { 'user-agent': 'ilsangkit-guide-bot/1.0' },
  });
  if (!res.ok) {
    throw new Error(`${feed.provider} fetch failed: ${res.status}`);
  }
  const xml = await res.text();
  return parseMinistryRss(xml, feed.provider);
}
