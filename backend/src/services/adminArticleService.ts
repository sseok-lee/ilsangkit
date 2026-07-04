import path from 'path';
import { fileURLToPath } from 'url';
import { unlink } from 'fs/promises';
import prisma from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOAD_DIR가 상대경로(.env 예: '../assets/images')일 수 있으므로 항상 절대경로로 정규화
// — 그래야 아래 startsWith 기반 디렉터리 탈출 가드가 올바르게 동작한다.
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.resolve(__dirname, '../../assets/images'));
const ARTICLES_IMAGE_DIR = path.join(UPLOAD_DIR, 'articles');

const ARTICLE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  articleType: true,
  thumbnailUrl: true,
  keywords: true,
  status: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
};

export interface AdminArticleListParams {
  page: number;
  limit: number;
  status?: 'draft' | 'published' | 'rejected';
  category?: string;
}

export interface AdminArticlePatch {
  title?: string;
  summary?: string;
  keywords?: string | null;
  content?: string;
}

// 어드민 목록 — 공개 API와 달리 published 강제 없이 전체 상태(draft/published/rejected) 반환
export async function listAdminArticles(params: AdminArticleListParams) {
  const { page, limit, status, category } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(status ? { status } : {}),
    ...(category ? { category } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: ARTICLE_LIST_SELECT,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, total, page, totalPages };
}

export async function getAdminArticle(id: string) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw new NotFoundError('기사를 찾을 수 없습니다');
  return article;
}

export async function updateAdminArticle(id: string, patch: AdminArticlePatch) {
  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('기사를 찾을 수 없습니다');
  return prisma.article.update({ where: { id }, data: patch });
}

export async function publishArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true, publishedAt: true, title: true, summary: true, content: true, thumbnailUrl: true } });
  if (!existing) throw new NotFoundError('기사를 찾을 수 없습니다');
  if (!existing.title || !existing.summary || !existing.content || !existing.thumbnailUrl) {
    throw new ValidationError('발행에 필요한 필드(제목·요약·본문·썸네일)가 비어 있습니다');
  }
  return prisma.article.update({
    where: { id },
    data: { status: 'published', publishedAt: existing.publishedAt ?? new Date() }, // 최초 1회만
  });
}

// 발행취소 — draft로 되돌리되 publishedAt=null (재발행 시 새 발행일 부여)
export async function unpublishArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('기사를 찾을 수 없습니다');
  return prisma.article.update({ where: { id }, data: { status: 'draft', publishedAt: null } });
}

export async function rejectArticle(id: string) {
  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('기사를 찾을 수 없습니다');
  return prisma.article.update({ where: { id }, data: { status: 'rejected' } });
}

// 삭제 — 썸네일 경로는 반드시 저장된 thumbnailUrl에서만 유도(path traversal 방어).
// 클라이언트 입력이 아닌 DB에 저장된 값 기준이라도, basename 이후 고정 디렉터리를 벗어나면 unlink를 스킵한다.
export async function deleteAdminArticle(id: string): Promise<void> {
  const existing = await prisma.article.findUnique({ where: { id }, select: { id: true, thumbnailUrl: true } });
  if (!existing) throw new NotFoundError('기사를 찾을 수 없습니다');

  if (existing.thumbnailUrl) {
    const filename = path.basename(existing.thumbnailUrl);
    const resolved = path.resolve(ARTICLES_IMAGE_DIR, filename);
    const isInsideArticlesDir = resolved.startsWith(ARTICLES_IMAGE_DIR + path.sep);
    if (isInsideArticlesDir) {
      await unlink(resolved).catch(() => {}); // 파일 없어도 삭제 흐름은 계속
    }
  }

  await prisma.article.delete({ where: { id } });
}
