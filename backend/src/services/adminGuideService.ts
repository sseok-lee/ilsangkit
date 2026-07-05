import path from 'path';
import { fileURLToPath } from 'url';
import { unlink } from 'fs/promises';
import prisma from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// UPLOAD_DIR가 상대경로(.env 예: '../assets/images')일 수 있으므로 항상 절대경로로 정규화
// — 그래야 아래 startsWith 기반 디렉터리 탈출 가드가 올바르게 동작한다.
// 이 파일은 backend/src/services/에 위치 — app.ts(backend/src/)의 정적 서빙 기본값과 동일한
// 실제 서빙 디렉터리(ilsangkit/assets/images)로 귀결되려면 3단계 상위(../../../)가 필요하다.
// (adminArticleService.ts는 2단계(../../)를 사용해 폴백 시 backend/assets/images로 어긋나지만,
// UPLOAD_DIR 환경변수가 항상 설정돼 있어 실제로는 도달하지 않는 경로다.)
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images'));
const GUIDES_IMAGE_DIR = path.join(UPLOAD_DIR, 'guides');

const GUIDE_LIST_SELECT = {
  id: true,
  title: true,
  slug: true,
  summary: true,
  category: true,
  articleType: true,
  thumbnailUrl: true,
  keywords: true,
  published: true,
  viewCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
};

export interface AdminGuideListParams {
  page: number;
  limit: number;
  published?: boolean;
  category?: string;
}

export interface AdminGuidePatch {
  title?: string;
  summary?: string;
  keywords?: string | null;
  content?: string;
}

// 어드민 목록 — 공개 API와 달리 published 강제 없이 전체(published/draft) 반환
export async function listAdminGuides(params: AdminGuideListParams) {
  const { page, limit, published, category } = params;
  const skip = (page - 1) * limit;

  const where = {
    ...(published !== undefined ? { published } : {}),
    ...(category ? { category } : {}),
  };

  const [total, items] = await Promise.all([
    prisma.guide.count({ where }),
    prisma.guide.findMany({
      where,
      orderBy: [{ published: 'asc' }, { createdAt: 'desc' }],
      skip,
      take: limit,
      select: GUIDE_LIST_SELECT,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, total, page, totalPages };
}

export async function getAdminGuide(id: string) {
  const g = await prisma.guide.findUnique({ where: { id } });
  if (!g) throw new NotFoundError('가이드를 찾을 수 없습니다');
  return g;
}

export async function updateAdminGuide(id: string, patch: AdminGuidePatch) {
  const existing = await prisma.guide.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  return prisma.guide.update({ where: { id }, data: patch });
}

export async function publishGuide(id: string) {
  const existing = await prisma.guide.findUnique({
    where: { id },
    select: { id: true, publishedAt: true, title: true, summary: true, content: true, thumbnailUrl: true },
  });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  if (!existing.title || !existing.summary || !existing.content || !existing.thumbnailUrl) {
    throw new ValidationError('발행에 필요한 필드(제목·요약·본문·썸네일)가 비어 있습니다');
  }
  return prisma.guide.update({
    where: { id },
    data: { published: true, publishedAt: existing.publishedAt ?? new Date() }, // 최초 1회만
  });
}

// 발행취소 — published:false + publishedAt:null (재발행 시 새 발행일 부여)
export async function unpublishGuide(id: string) {
  const existing = await prisma.guide.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  return prisma.guide.update({ where: { id }, data: { published: false, publishedAt: null } });
}

// 반려 — 초안 삭제. 썸네일 경로는 반드시 저장된 thumbnailUrl에서만 유도(path traversal 방어).
// 클라이언트 입력이 아닌 DB에 저장된 값 기준이라도, basename 이후 고정 디렉터리를 벗어나면 unlink를 스킵한다.
export async function rejectGuide(id: string): Promise<void> {
  const existing = await prisma.guide.findUnique({ where: { id }, select: { id: true, thumbnailUrl: true } });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');

  if (existing.thumbnailUrl) {
    const filename = path.basename(existing.thumbnailUrl);
    const resolved = path.resolve(GUIDES_IMAGE_DIR, filename);
    const isInsideGuidesDir = resolved.startsWith(GUIDES_IMAGE_DIR + path.sep);
    if (isInsideGuidesDir) {
      // ENOENT(이미 없는 파일)는 무시하고 삭제 흐름을 계속하되, 그 외 오류(EACCES 등)는 관측 가능하도록 로깅한다.
      await unlink(resolved).catch((err: unknown) => {
        const code = (err as { code?: string } | undefined)?.code;
        if (code !== 'ENOENT') console.warn('썸네일 삭제 실패:', err instanceof Error ? err.message : err);
      });
    }
  }

  await prisma.guide.delete({ where: { id } });
}
