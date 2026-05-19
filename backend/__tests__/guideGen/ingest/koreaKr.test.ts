import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { parseKoreaKrRss } from '../../../src/guideGen/ingest/sources/koreaKr.js';

const fixturePath = path.join(
  __dirname,
  '../fixtures/korea-rss-sample.xml'
);

describe('parseKoreaKrRss', () => {
  it('parses 2 items from sample feed', () => {
    const xml = readFileSync(fixturePath, 'utf-8');
    const items = parseKoreaKrRss(xml);
    expect(items).toHaveLength(2);
  });

  it('extracts title, link, pubDate, description', () => {
    const xml = readFileSync(fixturePath, 'utf-8');
    const [first] = parseKoreaKrRss(xml);
    expect(first.sourceTitle).toBe('서울시 2026년 전기차 충전소 보조금 발표');
    expect(first.sourceUrl).toBe('https://www.korea.kr/news/policy-001.do');
    expect(first.sourcePublishedAt).toBeInstanceOf(Date);
    expect(first.sourcePublishedAt.toISOString().slice(0, 10)).toBe('2026-05-12');
    expect(first.rssDescription).toContain('서울특별시');
    expect(first.sourceProvider).toBe('korea.kr');
  });

  it('returns empty array when channel has no items', () => {
    const empty = `<?xml version="1.0"?><rss><channel><title>x</title></channel></rss>`;
    expect(parseKoreaKrRss(empty)).toEqual([]);
  });
});
