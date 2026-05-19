import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, writeFileSync } from 'node:fs';

vi.mock('../../../src/lib/prisma.js', () => ({
  default: {
    guideCandidate: { findUnique: vi.fn(), update: vi.fn() },
    guide: { create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock('../../../src/guideGen/publish/thumbnail.js', () => ({
  generateThumbnail: vi.fn(),
}));

import prisma from '../../../src/lib/prisma.js';
import { generateThumbnail } from '../../../src/guideGen/publish/thumbnail.js';
import {
  publishCandidate,
  unpublishCandidate,
} from '../../../src/guideGen/publish/publishCli.js';

function seedDisk() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'pub-test-'));
  const draftPath = path.join(root, 'draft.md');
  const planPath = path.join(root, 'plan.json');
  writeFileSync(draftPath, '## 본문\nhello\n', 'utf-8');
  writeFileSync(planPath, JSON.stringify({
    articleType: 'policy-explainer',
    title: '제목',
    summary: '요약',
    slug: 'test-slug',
    keywords: ['k1', 'k2'],
    sections: [],
    internalLinks: [],
    angle: '',
  }), 'utf-8');
  return { draftPath, planPath };
}

const baseCandidate = {
  id: 'cand_pub_001',
  sourceUrl: 'https://x.example/1',
  sourceProvider: 'korea.kr',
  sourceTitle: '원본',
  sourcePublishedAt: new Date('2026-05-12'),
  matchedCategory: 'ev-charger',
  status: 'drafted',
  draftPath: '',
  planPath: '',
  checkReport: JSON.stringify({ passed: true }),
  publishedGuideId: null,
};

describe('publishCandidate', () => {
  beforeEach(() => {
    vi.mocked(prisma.guideCandidate.findUnique).mockReset();
    vi.mocked(prisma.guideCandidate.update).mockReset();
    vi.mocked(prisma.guide.create).mockReset();
    vi.mocked(generateThumbnail).mockReset();
  });

  it('creates Guide row and updates candidate to status=published on success', async () => {
    const { draftPath, planPath } = seedDisk();
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate, draftPath, planPath,
    } as never);
    vi.mocked(generateThumbnail).mockResolvedValue({
      ok: true,
      thumbnailUrl: '/api/images/guides/test-slug.webp',
    });
    vi.mocked(prisma.guide.create).mockResolvedValue({ id: 'guide_001' } as never);
    vi.mocked(prisma.guideCandidate.update).mockImplementation(async ({ data }) =>
      ({ ...baseCandidate, ...data }) as never
    );

    const result = await publishCandidate({ id: baseCandidate.id, force: false, yes: false });
    expect(result.id).toBe('guide_001');
    expect(vi.mocked(prisma.guide.create)).toHaveBeenCalledOnce();
    const createArgs = vi.mocked(prisma.guide.create).mock.calls[0][0];
    expect(createArgs.data.slug).toBe('test-slug');
    expect(createArgs.data.published).toBe(true);
    expect(createArgs.data.candidateId).toBe(baseCandidate.id);
    const updateArgs = vi.mocked(prisma.guideCandidate.update).mock.calls.at(-1)?.[0];
    expect((updateArgs?.data as { status: string }).status).toBe('published');
  });

  it('refuses to publish when checkReport.passed is false and force=false', async () => {
    const { draftPath, planPath } = seedDisk();
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate,
      draftPath, planPath,
      checkReport: JSON.stringify({ passed: false }),
    } as never);
    await expect(publishCandidate({ id: baseCandidate.id, force: false, yes: false })).rejects.toThrow(
      /check did not pass/i
    );
  });

  it('refuses force without yes (destructive confirmation)', async () => {
    const { draftPath, planPath } = seedDisk();
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate,
      draftPath, planPath,
      checkReport: JSON.stringify({ passed: false }),
    } as never);
    await expect(publishCandidate({ id: baseCandidate.id, force: true, yes: false })).rejects.toThrow(
      /confirm|--yes/i
    );
  });

  it('proceeds when force=true and yes=true even if check did not pass', async () => {
    const { draftPath, planPath } = seedDisk();
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate,
      draftPath, planPath,
      checkReport: JSON.stringify({ passed: false }),
    } as never);
    vi.mocked(generateThumbnail).mockResolvedValue({ ok: true, thumbnailUrl: '/x' });
    vi.mocked(prisma.guide.create).mockResolvedValue({ id: 'g2' } as never);
    vi.mocked(prisma.guideCandidate.update).mockImplementation(async ({ data }) =>
      ({ ...baseCandidate, ...data }) as never
    );

    const result = await publishCandidate({ id: baseCandidate.id, force: true, yes: true });
    expect(result.id).toBe('g2');
  });

  it('still publishes when thumbnail generation fails (thumbnailUrl=null)', async () => {
    const { draftPath, planPath } = seedDisk();
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate, draftPath, planPath,
    } as never);
    vi.mocked(generateThumbnail).mockResolvedValue({ ok: false, thumbnailUrl: null });
    vi.mocked(prisma.guide.create).mockResolvedValue({ id: 'g3' } as never);
    vi.mocked(prisma.guideCandidate.update).mockImplementation(async ({ data }) =>
      ({ ...baseCandidate, ...data }) as never
    );
    const result = await publishCandidate({ id: baseCandidate.id, force: false, yes: false });
    expect(result.id).toBe('g3');
    const createArgs = vi.mocked(prisma.guide.create).mock.calls[0][0];
    expect(createArgs.data.thumbnailUrl).toBeNull();
  });
});

describe('unpublishCandidate', () => {
  beforeEach(() => {
    vi.mocked(prisma.guideCandidate.findUnique).mockReset();
    vi.mocked(prisma.guide.update).mockReset();
  });

  it('sets Guide.published=false when yes=true', async () => {
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate,
      status: 'published',
      publishedGuideId: 'guide_001',
    } as never);
    vi.mocked(prisma.guide.update).mockResolvedValue({ id: 'guide_001', published: false } as never);
    const result = await unpublishCandidate({ id: baseCandidate.id, yes: true });
    expect(result.published).toBe(false);
  });

  it('refuses without yes', async () => {
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate,
      status: 'published',
      publishedGuideId: 'guide_001',
    } as never);
    await expect(unpublishCandidate({ id: baseCandidate.id, yes: false })).rejects.toThrow(
      /confirm|--yes/i
    );
  });

  it('rejects if candidate has no publishedGuideId', async () => {
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...baseCandidate, status: 'drafted', publishedGuideId: null,
    } as never);
    await expect(unpublishCandidate({ id: baseCandidate.id, yes: true })).rejects.toThrow(
      /not published/i
    );
  });
});
