import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../../src/lib/prisma.js';
import { runIngest } from '../../../src/guideGen/ingest/ingestRunner.js';
import type { RawSourceItem } from '../../../src/guideGen/ingest/sources/koreaKr.js';

const sampleItem: RawSourceItem = {
  sourceUrl: 'https://test.example.com/policy-001',
  sourceProvider: 'korea.kr',
  sourceTitle: '전기차 충전소 보조금 발표',
  sourcePublishedAt: new Date('2026-05-12T10:00:00+09:00'),
  rssDescription: '서울특별시 전기차 충전 인프라 확충',
};

describe('runIngest', () => {
  beforeEach(async () => {
    await prisma.guideCandidate.deleteMany({
      where: { sourceUrl: { startsWith: 'https://test.example.com/' } },
    });
  });

  it('inserts new candidate with matched category', async () => {
    const result = await runIngest({ fetchers: [async () => [sampleItem]] });
    expect(result.new).toBe(1);
    expect(result.updated).toBe(0);
    const row = await prisma.guideCandidate.findUnique({
      where: { sourceUrl: sampleItem.sourceUrl },
    });
    expect(row).not.toBeNull();
    expect(row?.matchedCategory).toBe('ev-charger');
    expect(row?.status).toBe('pending');
  });

  it('updates title/excerpt on re-ingest but preserves status', async () => {
    await runIngest({ fetchers: [async () => [sampleItem]] });
    await prisma.guideCandidate.update({
      where: { sourceUrl: sampleItem.sourceUrl },
      data: { status: 'approved' },
    });
    const updated: RawSourceItem = {
      ...sampleItem,
      sourceTitle: '제목 갱신',
    };
    const result = await runIngest({ fetchers: [async () => [updated]] });
    expect(result.new).toBe(0);
    expect(result.updated).toBe(1);
    const row = await prisma.guideCandidate.findUnique({
      where: { sourceUrl: sampleItem.sourceUrl },
    });
    expect(row?.sourceTitle).toBe('제목 갱신');
    expect(row?.status).toBe('approved');
  });
});
