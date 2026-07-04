import { prisma } from '../lib/prisma.js';

export const articleViewBuffer = new Map<string, number>();

export async function flushArticleViewCounts(): Promise<void> {
  const entries = Array.from(articleViewBuffer.entries());
  articleViewBuffer.clear();
  await Promise.all(
    entries.map(([slug, count]) =>
      prisma.article.update({
        where: { slug },
        data: { viewCount: { increment: count } },
      }).catch(() => {}) // ignore errors for deleted articles
    )
  );
}

if (process.env.NODE_ENV !== 'test') {
  setInterval(flushArticleViewCounts, 60_000);
}

const ARTICLE_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  articleType: true,
  thumbnailUrl: true,
  keywords: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
};

export interface ArticleListParams {
  page: number;
  limit: number;
  category?: string;
  categories?: string[];
  articleType?: string;
}

export async function listArticles(params: ArticleListParams) {
  const { page, limit, category, categories, articleType } = params;
  const skip = (page - 1) * limit;

  const categoryFilter =
    categories && categories.length > 0
      ? { category: { in: categories } }
      : category
      ? { category }
      : {};

  const where = {
    status: 'published',
    ...categoryFilter,
    ...(articleType ? { articleType } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { publishedAt: 'desc' },
      skip,
      take: limit,
      select: ARTICLE_SELECT,
    }),
  ]);

  const totalPages = Math.ceil(total / limit);
  return { items, total, page, totalPages };
}

export async function listRecentArticles(limit: number) {
  return prisma.article.findMany({
    where: { status: 'published' },
    orderBy: { publishedAt: 'desc' },
    take: limit,
    select: ARTICLE_SELECT,
  });
}

export async function getArticleBySlug(slug: string) {
  const article = await prisma.article.findUnique({ where: { slug } });
  if (!article || article.status !== 'published') return null;

  const currentCount = articleViewBuffer.get(slug) ?? 0;
  articleViewBuffer.set(slug, currentCount + 1);

  return { ...article, viewCount: article.viewCount + 1 };
}
