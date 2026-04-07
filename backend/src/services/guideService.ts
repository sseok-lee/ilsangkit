import prisma from '../lib/prisma.js';

export const guideViewBuffer = new Map<string, number>();

export async function flushGuideViewCounts(): Promise<void> {
  const entries = Array.from(guideViewBuffer.entries());
  guideViewBuffer.clear();
  await Promise.all(
    entries.map(([slug, count]) =>
      prisma.guide.update({
        where: { slug },
        data: { viewCount: { increment: count } },
      }).catch(() => {}) // ignore errors for deleted guides
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
  createdAt: true,
};

export interface GuideListParams {
  page: number;
  limit: number;
  category?: string;
  articleType?: 'news' | 'howto' | 'listicle' | 'guide';
}

export interface GuideListResult {
  items: typeof GUIDE_SELECT extends Record<string, true> ? unknown[] : unknown[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listGuides(params: GuideListParams) {
  const { page, limit, category, articleType } = params;
  const skip = (page - 1) * limit;

  const where = {
    published: true,
    ...(category ? { category } : {}),
    ...(articleType ? { articleType } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.guide.count({ where }),
    prisma.guide.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
      select: GUIDE_SELECT,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return { items, total, page, totalPages };
}

export async function listRecentGuides(limit: number) {
  return prisma.guide.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: GUIDE_SELECT,
  });
}

export async function getGuideBySlug(slug: string) {
  const guide = await prisma.guide.findUnique({ where: { slug } });
  if (!guide || !guide.published) return null;

  const currentCount = guideViewBuffer.get(slug) ?? 0;
  guideViewBuffer.set(slug, currentCount + 1);

  return { ...guide, viewCount: guide.viewCount + 1 };
}
