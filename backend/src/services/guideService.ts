import { prisma } from '../lib/prisma.js';

export const guideViewBuffer = new Map<string, number>();

export async function flushGuideViewCounts(): Promise<void> {
  const entries = Array.from(guideViewBuffer.entries());
  guideViewBuffer.clear();
  await Promise.all(
    entries.map(([slug, count]) =>
      // articleService 와 동일한 이유 — model.update() 는 @updatedAt 을 함께 갱신해
      // 조회수 반영이 dateModified 오염으로 이어진다. raw UPDATE 는 viewCount 만 건드린다.
      prisma.$executeRaw`UPDATE \`Guide\` SET \`viewCount\` = \`viewCount\` + ${count} WHERE \`slug\` = ${slug}`
        .catch(() => {}) // ignore errors for deleted guides
    )
  );
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(flushGuideViewCounts, 60_000);
}

const GUIDE_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  articleType: true,
  thumbnailUrl: true,
  keywords: true,
  viewCount: true,
  publishedAt: true, // NEW
  createdAt: true,
};

export function serializeGuide<T extends { publishedAt: Date | null; createdAt: Date }>(g: T) {
  return { ...g, publishedAt: g.publishedAt ?? g.createdAt };
}

export interface GuideListParams {
  page: number;
  limit: number;
  category?: string;
  categories?: string[];
  articleType?: 'news' | 'howto' | 'listicle' | 'guide';
}

export interface GuideListResult {
  items: typeof GUIDE_SELECT extends Record<string, true> ? unknown[] : unknown[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listGuides(params: GuideListParams) {
  const { page, limit, category, categories, articleType } = params;
  const skip = (page - 1) * limit;

  const categoryFilter =
    categories && categories.length > 0
      ? { category: { in: categories } }
      : category
      ? { category }
      : {};

  const where = {
    published: true,
    ...categoryFilter,
    ...(articleType ? { articleType } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.guide.count({ where }),
    prisma.guide.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: GUIDE_SELECT,
    }),
  ]);

  const items = rows.map(serializeGuide);
  const totalPages = Math.ceil(total / limit);
  return { items, total, page, totalPages };
}

export async function listRecentGuides(limit: number) {
  const rows = await prisma.guide.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: GUIDE_SELECT,
  });
  return rows.map(serializeGuide);
}

export async function getGuideBySlug(slug: string) {
  const guide = await prisma.guide.findUnique({ where: { slug } });
  if (!guide || !guide.published) return null;

  const currentCount = guideViewBuffer.get(slug) ?? 0;
  guideViewBuffer.set(slug, currentCount + 1);

  return {
    ...guide,
    viewCount: guide.viewCount + 1,
    publishedAt: guide.publishedAt ?? guide.createdAt, // NEW
  };
}
