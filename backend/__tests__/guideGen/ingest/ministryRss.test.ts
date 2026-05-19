import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parseMinistryRss,
  MINISTRY_FEEDS,
} from '../../../src/guideGen/ingest/sources/ministryRss.js';

const fixturePath = path.join(
  __dirname,
  '../fixtures/molit-rss-sample.xml'
);

describe('parseMinistryRss', () => {
  it('parses sample molit feed', () => {
    const xml = readFileSync(fixturePath, 'utf-8');
    const items = parseMinistryRss(xml, 'molit');
    expect(items).toHaveLength(1);
    expect(items[0].sourceProvider).toBe('molit');
    expect(items[0].sourceTitle).toBe('행복주택 입주자격 개정 안내');
    expect(items[0].sourcePublishedAt.toISOString().slice(0, 10)).toBe('2026-05-10');
  });
});

describe('MINISTRY_FEEDS registry', () => {
  it('includes molit feed entry', () => {
    const molit = MINISTRY_FEEDS.find((f) => f.provider === 'molit');
    expect(molit).toBeDefined();
    expect(molit?.categories).toContain('public-rental');
  });

  it('every feed has provider, url, categories', () => {
    for (const feed of MINISTRY_FEEDS) {
      expect(feed.provider).toBeTruthy();
      expect(feed.url).toMatch(/^https?:\/\//);
      expect(Array.isArray(feed.categories)).toBe(true);
    }
  });
});
