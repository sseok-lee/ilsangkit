import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdir, stat, unlink, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import OpenAI from 'openai';

export interface ThumbnailInput {
  slug: string;
  title: string;
  category: string;
}

export interface ThumbnailDeps {
  client?: OpenAI;
}

export interface ThumbnailResult {
  ok: boolean;
  thumbnailUrl: string | null;
}

const REAL_ESTATE_CATEGORIES = new Set<string>([
  'apt-sale', 'apt-rent', 'villa-sale', 'villa-rent',
  'offitel-sale', 'offitel-rent', 'subscription', 'public-rental',
]);

function uploadRoot(): string {
  if (process.env.UPLOAD_DIR) return process.env.UPLOAD_DIR;
  const here = fileURLToPath(import.meta.url);
  return path.resolve(path.dirname(here), '../../../../assets/images');
}

let _defaultClient: OpenAI | null = null;
function defaultClient(): OpenAI {
  if (!_defaultClient) {
    _defaultClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return _defaultClient;
}

export async function generateThumbnail(
  input: ThumbnailInput,
  deps: ThumbnailDeps = {}
): Promise<ThumbnailResult> {
  const client = deps.client ?? defaultClient();
  try {
    const style = REAL_ESTATE_CATEGORIES.has(input.category)
      ? 'Minimal clean illustration. No text, image only. Professional tone. Korean housing theme.'
      : 'Minimal clean illustration. No text, image only. Bright, friendly tone. Korean urban life theme.';

    const response = await client.images.generate({
      model: 'gpt-image-1',
      prompt: `Blog thumbnail. Title: "${input.title}". ${style}`,
      n: 1,
      size: '1024x1024',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return { ok: false, thumbnailUrl: null };

    const buffer = Buffer.from(b64, 'base64');
    const outputPath = path.join(uploadRoot(), 'guides', `${input.slug}.webp`);
    await mkdir(path.dirname(outputPath), { recursive: true });
    const tmpPath = `${outputPath}.tmp.png`;
    await writeFile(tmpPath, buffer);

    try {
      try {
        execFileSync(
          'convert',
          [tmpPath, '-resize', '800x', '-quality', '80', outputPath],
          { stdio: 'pipe' }
        );
        const optimized = await stat(outputPath);
        console.info(
          `[thumbnail] ${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.size / 1024).toFixed(0)}KB`
        );
      } catch {
        await writeFile(outputPath, buffer);
        console.info(
          `[thumbnail] (resize skipped) ${(buffer.length / 1024).toFixed(0)}KB`
        );
      }
    } finally {
      await unlink(tmpPath).catch(() => {});
    }
    return { ok: true, thumbnailUrl: `/api/images/guides/${input.slug}.webp` };
  } catch (err) {
    console.warn('[thumbnail] failed:', err instanceof Error ? err.message : err);
    return { ok: false, thumbnailUrl: null };
  }
}
