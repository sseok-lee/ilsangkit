import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { detectRasterImage } from '../../src/utils/rasterImage.js';

describe('detectRasterImage', () => {
  it.each(['png', 'jpg', 'webp', 'gif'] as const)('accepts a real %s fixture', (ext) => {
    const bytes = readFileSync(new URL(`../fixtures/affiliate-banner.${ext}`, import.meta.url));

    expect(detectRasterImage(bytes).extension).toBe(ext);
  });

  it.each(['<svg></svg>', '<html>banner</html>', 'GIF89a'])('rejects invalid raster bytes: %s', (body) => {
    expect(() => detectRasterImage(Buffer.from(body))).toThrow();
  });
});
