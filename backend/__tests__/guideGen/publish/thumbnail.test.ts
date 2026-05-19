import { describe, it, expect, beforeEach, vi } from 'vitest';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, existsSync } from 'node:fs';
import { generateThumbnail } from '../../../src/guideGen/publish/thumbnail.js';

interface MockClient {
  images: { generate: ReturnType<typeof vi.fn> };
}

function makeMockClient(): MockClient {
  return { images: { generate: vi.fn() } };
}

describe('generateThumbnail', () => {
  let uploadDir: string;

  beforeEach(() => {
    uploadDir = mkdtempSync(path.join(os.tmpdir(), 'thumb-test-'));
    process.env.UPLOAD_DIR = uploadDir;
  });

  it('writes thumbnail file and returns URL on success', async () => {
    const client = makeMockClient();
    client.images.generate.mockResolvedValue({
      data: [{ b64_json: Buffer.from('FAKE_IMAGE_DATA').toString('base64') }],
    });
    const result = await generateThumbnail({
      slug: 'test-slug',
      title: '테스트 제목',
      category: 'ev-charger',
    }, { client: client as never });
    expect(result.ok).toBe(true);
    expect(result.thumbnailUrl).toBe('/api/images/guides/test-slug.webp');
    expect(existsSync(path.join(uploadDir, 'guides', 'test-slug.webp'))).toBe(true);
  });

  it('returns ok=false when OpenAI returns no image data', async () => {
    const client = makeMockClient();
    client.images.generate.mockResolvedValue({ data: [] });
    const result = await generateThumbnail({
      slug: 'no-data',
      title: '...',
      category: 'pharmacy',
    }, { client: client as never });
    expect(result.ok).toBe(false);
    expect(result.thumbnailUrl).toBeNull();
  });

  it('returns ok=false when OpenAI throws', async () => {
    const client = makeMockClient();
    client.images.generate.mockRejectedValue(new Error('network'));
    const result = await generateThumbnail({
      slug: 'err',
      title: '...',
      category: 'hospital',
    }, { client: client as never });
    expect(result.ok).toBe(false);
  });
});
