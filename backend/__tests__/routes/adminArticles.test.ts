import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const {
  mockArticleFindMany,
  mockArticleCount,
  mockArticleFindUnique,
  mockArticleUpdate,
  mockArticleDelete,
  mockVerifySession,
  mockUnlink,
} = vi.hoisted(() => ({
  mockArticleFindMany: vi.fn(),
  mockArticleCount: vi.fn(),
  mockArticleFindUnique: vi.fn(),
  mockArticleUpdate: vi.fn(),
  mockArticleDelete: vi.fn(),
  mockVerifySession: vi.fn(async () => true),
  mockUnlink: vi.fn(async () => {}),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    article: {
      findMany: mockArticleFindMany,
      count: mockArticleCount,
      findUnique: mockArticleFindUnique,
      update: mockArticleUpdate,
      delete: mockArticleDelete,
    },
  },
}));

vi.mock('../../src/services/adminSessionService.js', () => ({
  verifySession: mockVerifySession,
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('fs/promises', () => ({ unlink: mockUnlink }));

process.env.ADMIN_PASSWORD_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfa';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import adminRouter from '../../src/routes/admin.js';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';
import { AppError, ValidationError } from '../../src/lib/errors.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use('/api/admin', adminRouter);
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const s = err instanceof AppError ? err.statusCode : 500;
    res.status(s).json({
      success: false,
      error: {
        code: err instanceof AppError ? err.code : 'INTERNAL',
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
      },
    });
  });
  return app;
}

const ORIGIN = 'http://localhost:3000';

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifySession.mockResolvedValue(true);
  mockUnlink.mockResolvedValue(undefined);
});

describe('admin articles CRUD', () => {
  describe('GET /api/admin/articles', () => {
    it('status 필터 없으면 draft 포함 전체 상태 반환', async () => {
      mockArticleCount.mockResolvedValue(2);
      mockArticleFindMany.mockResolvedValue([
        { id: 'a1', status: 'draft', title: '초안' },
        { id: 'a2', status: 'published', title: '발행됨' },
      ]);

      const res = await request(makeApp()).get('/api/admin/articles');

      expect(res.status).toBe(200);
      expect(res.body.data.items).toHaveLength(2);
      expect(res.body.data.items.some((it: { status: string }) => it.status === 'draft')).toBe(true);

      const callArgs = mockArticleFindMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('status');
      expect(callArgs.orderBy).toEqual([{ status: 'asc' }, { createdAt: 'desc' }]);
    });

    it('status/category 쿼리로 필터링', async () => {
      mockArticleCount.mockResolvedValue(0);
      mockArticleFindMany.mockResolvedValue([]);

      await request(makeApp()).get('/api/admin/articles?status=draft&category=toilet');

      const callArgs = mockArticleFindMany.mock.calls[0][0];
      expect(callArgs.where).toMatchObject({ status: 'draft', category: 'toilet' });
    });

    it('인증 없으면 401', async () => {
      mockVerifySession.mockResolvedValue(false);
      const res = await request(makeApp()).get('/api/admin/articles');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/admin/articles/:id/publish', () => {
    it('발행 시 status=published + publishedAt 설정', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({
        id: 'a1', publishedAt: null, title: '제목', summary: '요약', content: '본문', thumbnailUrl: '/api/images/articles/a1.webp',
      });
      mockArticleUpdate.mockResolvedValueOnce({ id: 'a1', status: 'published', publishedAt: new Date() });

      const res = await request(makeApp()).post('/api/admin/articles/a1/publish').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      const updateArgs = mockArticleUpdate.mock.calls[0][0];
      expect(updateArgs.where).toEqual({ id: 'a1' });
      expect(updateArgs.data.status).toBe('published');
      expect(updateArgs.data.publishedAt).toBeInstanceOf(Date);
    });

    it('재발행 시 publishedAt은 최초 값 유지', async () => {
      const originalDate = new Date('2026-01-01T00:00:00Z');
      mockArticleFindUnique.mockResolvedValueOnce({
        id: 'a1', publishedAt: originalDate, title: '제목', summary: '요약', content: '본문', thumbnailUrl: '/api/images/articles/a1.webp',
      });
      mockArticleUpdate.mockResolvedValueOnce({ id: 'a1', status: 'published', publishedAt: originalDate });

      const res = await request(makeApp()).post('/api/admin/articles/a1/publish').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      const updateArgs = mockArticleUpdate.mock.calls[0][0];
      expect(updateArgs.data.publishedAt).toBe(originalDate);
    });

    it('존재하지 않는 id는 404', async () => {
      mockArticleFindUnique.mockResolvedValueOnce(null);

      const res = await request(makeApp()).post('/api/admin/articles/missing/publish').set('Origin', ORIGIN);

      expect(res.status).toBe(404);
      expect(mockArticleUpdate).not.toHaveBeenCalled();
    });

    it('필수 필드가 비어 있으면 422', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({
        id: 'a2', publishedAt: null, title: '', summary: '요약', content: '본문', thumbnailUrl: '/api/images/articles/a2.webp',
      });

      const res = await request(makeApp()).post('/api/admin/articles/a2/publish').set('Origin', ORIGIN);

      expect(res.status).toBe(422);
      expect(mockArticleUpdate).not.toHaveBeenCalled();
    });

    it('Origin 없으면 403 (CSRF)', async () => {
      const res = await request(makeApp()).post('/api/admin/articles/a1/publish');
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/admin/articles/:id/unpublish', () => {
    it('status=draft, publishedAt=null로 변경', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a3' });
      mockArticleUpdate.mockResolvedValueOnce({ id: 'a3', status: 'draft', publishedAt: null });

      const res = await request(makeApp()).post('/api/admin/articles/a3/unpublish').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(mockArticleUpdate).toHaveBeenCalledWith({ where: { id: 'a3' }, data: { status: 'draft', publishedAt: null } });
    });

    it('존재하지 않는 id는 404', async () => {
      mockArticleFindUnique.mockResolvedValueOnce(null);
      const res = await request(makeApp()).post('/api/admin/articles/missing/unpublish').set('Origin', ORIGIN);
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/admin/articles/:id/reject', () => {
    it('status=rejected로 변경', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a4' });
      mockArticleUpdate.mockResolvedValueOnce({ id: 'a4', status: 'rejected' });

      const res = await request(makeApp()).post('/api/admin/articles/a4/reject').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(mockArticleUpdate).toHaveBeenCalledWith({ where: { id: 'a4' }, data: { status: 'rejected' } });
    });

    it('존재하지 않는 id는 404', async () => {
      mockArticleFindUnique.mockResolvedValueOnce(null);
      const res = await request(makeApp()).post('/api/admin/articles/missing/reject').set('Origin', ORIGIN);
      expect(res.status).toBe(404);
      expect(mockArticleUpdate).not.toHaveBeenCalled();
    });
  });

  describe('PATCH /api/admin/articles/:id', () => {
    it('빈 본문은 422', async () => {
      const res = await request(makeApp()).patch('/api/admin/articles/a5').set('Origin', ORIGIN).send({});
      expect(res.status).toBe(422);
      expect(mockArticleUpdate).not.toHaveBeenCalled();
    });

    it('허용 필드만 업데이트', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a5' });
      mockArticleUpdate.mockResolvedValueOnce({ id: 'a5', title: '새 제목' });

      const res = await request(makeApp()).patch('/api/admin/articles/a5').set('Origin', ORIGIN).send({ title: '새 제목' });

      expect(res.status).toBe(200);
      expect(mockArticleUpdate).toHaveBeenCalledWith({ where: { id: 'a5' }, data: { title: '새 제목' } });
    });

    it('존재하지 않는 id는 404', async () => {
      mockArticleFindUnique.mockResolvedValueOnce(null);
      const res = await request(makeApp()).patch('/api/admin/articles/missing').set('Origin', ORIGIN).send({ title: 'x' });
      expect(res.status).toBe(404);
    });

    // mass-assignment 가드: AdminArticlePatchSchema가 status/slug/publishedAt을 스키마에서 제외(omit)하고
    // validate 미들웨어가 Zod의 stripped output으로 req.body를 교체하므로, 보호 필드만 보낸 요청은
    // strip 후 빈 객체가 되어 refine(비어있으면 거부)에 걸려 422가 되어야 한다.
    it('status만 보내면 422 (Zod가 스키마 밖 필드를 strip → 빈 객체 → refine 거부), update 호출 안 됨', async () => {
      const res = await request(makeApp()).patch('/api/admin/articles/a5').set('Origin', ORIGIN).send({ status: 'published' });

      expect(res.status).toBe(422);
      expect(mockArticleUpdate).not.toHaveBeenCalled();
    });

    it('title과 함께 status/slug를 보내도 허용 필드(title)만 update data에 반영되고 status/slug/publishedAt은 유입되지 않음', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a5' });
      mockArticleUpdate.mockResolvedValueOnce({ id: 'a5', title: '새 제목' });

      const res = await request(makeApp()).patch('/api/admin/articles/a5').set('Origin', ORIGIN)
        .send({ title: '새 제목', status: 'published', slug: 'evil' });

      expect(res.status).toBe(200);
      const updateArgs = mockArticleUpdate.mock.calls[0][0];
      expect(updateArgs).toEqual({ where: { id: 'a5' }, data: { title: '새 제목' } });
      expect(updateArgs.data).not.toHaveProperty('status');
      expect(updateArgs.data).not.toHaveProperty('slug');
      expect(updateArgs.data).not.toHaveProperty('publishedAt');
    });
  });

  describe('DELETE /api/admin/articles/:id', () => {
    it('레코드 삭제 + articles 디렉터리 내부 썸네일 unlink', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a6', thumbnailUrl: '/api/images/articles/a6.webp' });
      mockArticleDelete.mockResolvedValueOnce({ id: 'a6' });

      const res = await request(makeApp()).delete('/api/admin/articles/a6').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(mockArticleDelete).toHaveBeenCalledWith({ where: { id: 'a6' } });
      expect(mockUnlink).toHaveBeenCalledTimes(1);
      const unlinkPath = mockUnlink.mock.calls[0][0] as string;
      expect(unlinkPath.endsWith(path.join('assets', 'images', 'articles', 'a6.webp'))).toBe(true);
    });

    it('디렉터리 탈출 시도(thumbnailUrl이 ..로 끝남)는 unlink 스킵하되 레코드는 삭제', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a7', thumbnailUrl: '/api/images/articles/..' });
      mockArticleDelete.mockResolvedValueOnce({ id: 'a7' });

      const res = await request(makeApp()).delete('/api/admin/articles/a7').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(mockArticleDelete).toHaveBeenCalledWith({ where: { id: 'a7' } });
    });

    it('thumbnailUrl이 없으면 unlink 호출 없이 삭제만', async () => {
      mockArticleFindUnique.mockResolvedValueOnce({ id: 'a8', thumbnailUrl: null });
      mockArticleDelete.mockResolvedValueOnce({ id: 'a8' });

      const res = await request(makeApp()).delete('/api/admin/articles/a8').set('Origin', ORIGIN);

      expect(res.status).toBe(200);
      expect(mockUnlink).not.toHaveBeenCalled();
      expect(mockArticleDelete).toHaveBeenCalledWith({ where: { id: 'a8' } });
    });

    it('존재하지 않는 id는 404', async () => {
      mockArticleFindUnique.mockResolvedValueOnce(null);
      const res = await request(makeApp()).delete('/api/admin/articles/missing').set('Origin', ORIGIN);
      expect(res.status).toBe(404);
      expect(mockArticleDelete).not.toHaveBeenCalled();
    });
  });
});
