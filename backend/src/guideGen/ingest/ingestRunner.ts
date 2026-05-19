import prisma from '../../lib/prisma.js';
import type { RawSourceItem } from './sources/koreaKr.js';
import { matchCategory } from './categoryMatcher.js';

export interface IngestResult {
  fetched: number;
  new: number;
  updated: number;
  matched: number;
  unmatched: number;
  perProvider: Record<string, { fetched: number; new: number; updated: number }>;
}

export interface IngestOptions {
  fetchers: Array<() => Promise<RawSourceItem[]>>;
  category?: string;
  since?: Date;
}

export async function runIngest(opts: IngestOptions): Promise<IngestResult> {
  const result: IngestResult = {
    fetched: 0,
    new: 0,
    updated: 0,
    matched: 0,
    unmatched: 0,
    perProvider: {},
  };

  for (const fetcher of opts.fetchers) {
    let items: RawSourceItem[];
    try {
      items = await fetcher();
    } catch (err) {
      console.error('[ingest] fetcher failed:', err);
      continue;
    }

    for (const item of items) {
      if (opts.since && item.sourcePublishedAt < opts.since) continue;

      const match = matchCategory(item.sourceTitle, item.rssDescription ?? '');
      if (opts.category && match.category !== opts.category) continue;

      result.fetched += 1;
      const provider = item.sourceProvider;
      result.perProvider[provider] ??= { fetched: 0, new: 0, updated: 0 };
      result.perProvider[provider].fetched += 1;

      if (match.category) result.matched += 1;
      else result.unmatched += 1;

      const existing = await prisma.guideCandidate.findUnique({
        where: { sourceUrl: item.sourceUrl },
        select: { id: true },
      });

      await prisma.guideCandidate.upsert({
        where: { sourceUrl: item.sourceUrl },
        create: {
          sourceUrl: item.sourceUrl,
          sourceProvider: item.sourceProvider,
          sourceTitle: item.sourceTitle,
          sourcePublishedAt: item.sourcePublishedAt,
          sourceExcerpt: item.rssDescription ?? null,
          matchedCategory: match.category,
          matchKeywords: match.keywords.join(',') || null,
        },
        update: {
          sourceTitle: item.sourceTitle,
          sourceExcerpt: item.rssDescription ?? null,
        },
      });

      if (existing) {
        result.updated += 1;
        result.perProvider[provider].updated += 1;
      } else {
        result.new += 1;
        result.perProvider[provider].new += 1;
      }
    }
  }

  return result;
}
