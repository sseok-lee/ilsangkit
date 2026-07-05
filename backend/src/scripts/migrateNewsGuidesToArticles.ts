// migrateNewsGuidesToArticles — news 가이드(articleType:'news') → published Article 멱등 마이그레이션
// Phase 4(오늘의 이슈 컷오버) Task 2. 프로덕션 데이터 이동 스크립트 — dry-run 필수 선행.
import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { copyFile, mkdir, stat } from 'fs/promises';
import prisma from '../lib/prisma.js';

export interface MigrateOptions {
  dryRun: boolean;
}

export function parseMigrateOptions(args: string[] = process.argv.slice(2)): MigrateOptions {
  return { dryRun: args.includes('--dry-run') };
}

interface GuideForMigration {
  id: string;
  slug: string;
  title: string;
  content: string;
  summary: string;
  category: string;
  keywords: string | null;
  viewCount: number;
  createdAt: Date;
}

export function mapGuideToArticleData(g: GuideForMigration) {
  return {
    slug: g.slug,
    title: g.title,
    content: g.content,
    summary: g.summary,
    category: g.category,
    articleType: 'news-brief',
    keywords: g.keywords,
    viewCount: g.viewCount,
    thumbnailUrl: `/api/images/articles/${g.slug}.webp`,
    sources: undefined, // Json? → 미지정 시 Prisma가 null로 저장
    status: 'published',
    publishedAt: g.createdAt,
    createdAt: g.createdAt,
  };
}

function imagesDir(sub: string): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  return path.join(uploadDir, sub);
}

export interface MigrateResult {
  migrated: number;
  skipped: number;
  thumbnailsCopied: number;
  failures: string[];
}

export async function migrateNewsGuides(opts: MigrateOptions): Promise<MigrateResult> {
  const guides = await prisma.guide.findMany({ where: { articleType: 'news' } });
  let migrated = 0;
  let skipped = 0;
  let thumbnailsCopied = 0;
  const failures: string[] = [];

  for (const g of guides) {
    const existing = await prisma.article.findUnique({ where: { slug: g.slug }, select: { id: true } });
    if (existing) {
      skipped++;
      continue; // 멱등: 이미 마이그레이션된 slug는 재생성/재삭제하지 않음
    }

    if (opts.dryRun) {
      migrated++;
      continue;
    }

    try {
      const data = mapGuideToArticleData(g);
      // create → updatedAt 리셋(가짜 freshness 방지) → delete를 하나의 트랜잭션으로 묶어 원자성 보장.
      // $executeRaw 단독 실패로 create+delete만 커밋되고 updatedAt 리셋이 누락되는 것을 방지(재실행 불가 상태 방지).
      await prisma.$transaction([
        prisma.article.create({ data }),
        prisma.$executeRaw`UPDATE Article SET updatedAt = ${g.createdAt} WHERE slug = ${g.slug}`,
        prisma.guide.delete({ where: { id: g.id } }),
      ]);
      migrated++;

      // 썸네일 복사(원본 없으면 경고만 하고 마이그레이션은 유지)
      try {
        const src = path.join(imagesDir('guides'), `${g.slug}.webp`);
        await stat(src);
        await mkdir(imagesDir('articles'), { recursive: true });
        await copyFile(src, path.join(imagesDir('articles'), `${g.slug}.webp`));
        thumbnailsCopied++;
      } catch {
        console.warn(`[migrate] 썸네일 원본 없음/복사 실패: ${g.slug}`);
      }
    } catch (err) {
      failures.push(`${g.slug}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { migrated, skipped, thumbnailsCopied, failures };
}

async function main() {
  const opts = parseMigrateOptions();
  console.log(`[migrate] news 가이드 → Article ${opts.dryRun ? '(DRY-RUN)' : '(실행)'}`);
  const r = await migrateNewsGuides(opts);
  console.log(
    `[migrate] 결과: migrated=${r.migrated} skipped=${r.skipped} thumbnails=${r.thumbnailsCopied} failures=${r.failures.length}`,
  );
  if (r.failures.length) console.error(r.failures.join('\n'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      process.exitCode = 0;
    })
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect().catch(() => {}));
}
