import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { AppError } from '../lib/errors.js';
import { AdminLoginSchema, AdminArticleListSchema, AdminArticleIdSchema, AdminArticlePatchSchema } from '../schemas/admin.js';
import { SESSION_COOKIE_NAME, getAdminPasswordHash, getSessionTtlMs } from '../config/adminConfig.js';
import { createSession, revokeSession } from '../services/adminSessionService.js';
import { isLockedOut, recordLoginFailure, clearLoginFailures } from '../services/adminThrottleService.js';
import { requireAdmin, requireSameOrigin, adminLoginRateLimiter } from '../middlewares/adminAuth.js';
import {
  listAdminArticles,
  getAdminArticle,
  updateAdminArticle,
  publishArticle,
  unpublishArticle,
  rejectArticle,
  deleteAdminArticle,
} from '../services/adminArticleService.js';

const router = Router();

function cookieOptions(): { httpOnly: boolean; secure: boolean; sameSite: 'strict'; path: string; maxAge: number } {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict' as const, path: '/', maxAge: getSessionTtlMs() };
}

// POST /api/admin/login
router.post('/login', requireSameOrigin, adminLoginRateLimiter, validate(AdminLoginSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const hash = getAdminPasswordHash();
    if (!hash) throw new AppError(503, '어드민이 설정되지 않았습니다', 'ADMIN_NOT_CONFIGURED'); // fail-closed
    if (await isLockedOut()) {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: '로그인이 일시 잠겼습니다. 잠시 후 다시 시도하세요.', requestId: req.requestId } });
      return;
    }
    const { password } = req.body as { password: string };
    const ok = await bcrypt.compare(password, hash);
    if (!ok) {
      await recordLoginFailure();
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: '비밀번호가 올바르지 않습니다', requestId: req.requestId } });
      return;
    }
    await clearLoginFailures();
    const { token } = await createSession();
    res.cookie(SESSION_COOKIE_NAME, token, cookieOptions());
    res.json({ success: true, data: { authenticated: true } });
  })
);

// POST /api/admin/logout
router.post('/logout', requireSameOrigin, asyncHandler(async (req: Request, res: Response) => {
  const token = (req.cookies?.[SESSION_COOKIE_NAME] as string | undefined) ?? '';
  await revokeSession(token);
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
  res.json({ success: true, data: { authenticated: false } });
}));

// GET /api/admin/session — 프론트 가드
router.get('/session', requireAdmin, (_req: Request, res: Response) => {
  res.json({ success: true, data: { authenticated: true } });
});

// GET /api/admin/articles — 목록(전체 상태, 공개 API와 달리 published 강제 없음)
router.get('/articles', requireAdmin, validate(AdminArticleListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listAdminArticles(req.query as unknown as { page: number; limit: number; status?: 'draft' | 'published' | 'rejected'; category?: string });
    res.json({ success: true, data: result });
  })
);

// GET /api/admin/articles/:id — 상세
router.get('/articles/:id', requireAdmin, validate(AdminArticleIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const article = await getAdminArticle(id);
    res.json({ success: true, data: article });
  })
);

// PATCH /api/admin/articles/:id — 편집(허용 필드만)
router.patch('/articles/:id', requireAdmin, requireSameOrigin,
  validate(AdminArticleIdSchema, 'params'), validate(AdminArticlePatchSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const article = await updateAdminArticle(id, req.body);
    res.json({ success: true, data: article });
  })
);

// POST /api/admin/articles/:id/publish
router.post('/articles/:id/publish', requireAdmin, requireSameOrigin, validate(AdminArticleIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const article = await publishArticle(id);
    res.json({ success: true, data: article });
  })
);

// POST /api/admin/articles/:id/unpublish
router.post('/articles/:id/unpublish', requireAdmin, requireSameOrigin, validate(AdminArticleIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const article = await unpublishArticle(id);
    res.json({ success: true, data: article });
  })
);

// POST /api/admin/articles/:id/reject
router.post('/articles/:id/reject', requireAdmin, requireSameOrigin, validate(AdminArticleIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const article = await rejectArticle(id);
    res.json({ success: true, data: article });
  })
);

// DELETE /api/admin/articles/:id
router.delete('/articles/:id', requireAdmin, requireSameOrigin, validate(AdminArticleIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    await deleteAdminArticle(id);
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;
