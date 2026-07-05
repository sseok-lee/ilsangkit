import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import { AppError, ConflictError } from '../lib/errors.js';
import {
  AdminLoginSchema, AdminArticleListSchema, AdminArticleIdSchema, AdminArticlePatchSchema, AdminGenerateSchema,
  AdminGuideListSchema, AdminGuideIdSchema, AdminGuidePatchSchema,
} from '../schemas/admin.js';
import { SESSION_COOKIE_NAME, getAdminPasswordHash, getSessionTtlMs } from '../config/adminConfig.js';
import { createSession, revokeSession } from '../services/adminSessionService.js';
import { isLockedOut, recordLoginFailure, clearLoginFailures } from '../services/adminThrottleService.js';
import { requireAdmin, requireSameOrigin, adminLoginRateLimiter, adminGenerateRateLimiter } from '../middlewares/adminAuth.js';
import { acquireGenerationLock, releaseGenerationLock } from '../lib/articleGenerationLock.js';
import {
  listAdminArticles,
  getAdminArticle,
  updateAdminArticle,
  publishArticle,
  unpublishArticle,
  rejectArticle,
  deleteAdminArticle,
} from '../services/adminArticleService.js';
import {
  listAdminGuides,
  getAdminGuide,
  updateAdminGuide,
  publishGuide,
  unpublishGuide,
  rejectGuide,
} from '../services/adminGuideService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const router = Router();

// 생성 트리거 공통 경로 — /generate, /:id/regenerate가 공유. 2단계로 분리:
// Phase 1(assertGenerationReady): 키 preflight(503) → dist 스크립트 존재확인(500) → 단일-플라이트 락 확보(409).
// DB 뮤테이션이 전혀 없다 — 성공 반환 시점에 락은 이미 HELD. /regenerate가 이 단계 실패 시 반려를 하지 않는 이유.
// 이 함수에 도달하기 전 count/category는 이미 Zod로 검증된 값만 전달되어야 한다.
async function assertGenerationReady(): Promise<string> {
  if (!process.env.OPENAI_API_KEY || !process.env.NAVER_CLIENT_ID) {
    throw new AppError(503, '생성 키가 설정되지 않았습니다', 'GENERATION_NOT_CONFIGURED');
  }
  const scriptPath = path.resolve(__dirname, '../scripts/generateArticle.js'); // dist 기준(ts 소스 아님)
  if (!fs.existsSync(scriptPath)) {
    throw new AppError(500, '생성 스크립트를 찾을 수 없습니다(빌드 필요)', 'SCRIPT_MISSING');
  }
  const acquired = await acquireGenerationLock();
  if (!acquired) throw new ConflictError('이미 생성이 진행 중입니다');
  return scriptPath;
}

// Phase 2(spawnGenerated): assertGenerationReady()로 락을 이미 확보한 뒤에만 호출.
// spawn 호출/인자 구성/안전 옵션은 기존과 동일 — 변경 대상 아님.
function spawnGenerated(scriptPath: string, count: number, category?: string): void {
  const args = [scriptPath, '--count', String(count)];
  if (category) args.push('--category', category);
  try {
    // 쉘 없이 execPath로 직접 spawn — 문자열 보간/exec 금지, argv 배열만 사용.
    const child = spawn(process.execPath, args, { detached: true, stdio: 'ignore' });
    child.on('exit', () => {
      void releaseGenerationLock(); // best-effort — 실패해도 stale-reclaim이 뒤에서 회수
    });
    child.unref();
  } catch (err) {
    // spawn 자체가 동기적으로 throw하면(EMFILE 등) exit 리스너가 등록되지 못해 락이 stale-reclaim(10분)까지
    // 방치된다 — best-effort로 즉시 해제한 뒤 원본 에러를 그대로 rethrow(호출부의 assertGenerationReady 락-해제
    // 패턴과 대칭).
    void releaseGenerationLock().catch(() => {});
    throw err;
  }
}

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

// POST /api/admin/articles/generate — 생성 트리거(단일-플라이트 락 + 검증된 안전 spawn)
router.post('/articles/generate', requireAdmin, requireSameOrigin, adminGenerateRateLimiter, validate(AdminGenerateSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { count, category } = req.body as { count: number; category?: string };
    const scriptPath = await assertGenerationReady();
    spawnGenerated(scriptPath, count, category);
    res.status(202).json({ success: true, data: { started: true, count, category: category ?? null } });
  })
);

// POST /api/admin/articles/:id/regenerate — 생성 가능 확인(키·dist·락) 후에만 반려 + 동일 category로 재생성 트리거.
// 순서(confirm-viable-first, mutate-second): 대상 조회(404, 뮤테이션 없음) → assertGenerationReady(503/500/409,
// 뮤테이션 없음 — 실패하면 초안은 원본 그대로) → rejectArticle → spawn. 키 미설정/dist 누락/락 경합 시
// 반려가 선반영되지 않아 재시도해도 초안이 유실되지 않는다.
router.post('/articles/:id/regenerate', requireAdmin, requireSameOrigin, adminGenerateRateLimiter, validate(AdminArticleIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const article = await getAdminArticle(id); // 대상 없으면 404 — 뮤테이션 없음
    const scriptPath = await assertGenerationReady(); // 503/500/409 — 여기서 실패해도 article은 원본 그대로(반려 미적용)
    try {
      await rejectArticle(id);
    } catch (err) {
      await releaseGenerationLock().catch(() => {}); // 반려 실패 시 락이 stale-reclaim(10분)까지 방치되지 않도록 best-effort 즉시 해제
      throw err;
    }
    // category는 DB에서 조회한 내부 상태(article.category)이지 사용자 재입력이 아님 — allowlist 재검증 없이 전달해도
    // 안전(배열-인자 spawn은 쉘을 거치지 않아 인젝션 경로가 없음).
    spawnGenerated(scriptPath, 1, article.category);
    res.status(202).json({ success: true, data: { started: true, count: 1, category: article.category } });
  })
);

// GET /api/admin/guides — 목록(전체 상태, 공개 API와 달리 published 강제 없음)
router.get('/guides', requireAdmin, validate(AdminGuideListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await listAdminGuides(req.query as unknown as { page: number; limit: number; published?: boolean; category?: string });
    res.json({ success: true, data: result });
  })
);

// GET /api/admin/guides/:id — 상세
router.get('/guides/:id', requireAdmin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const guide = await getAdminGuide(id);
    res.json({ success: true, data: guide });
  })
);

// PATCH /api/admin/guides/:id — 편집(허용 필드만)
router.patch('/guides/:id', requireAdmin, requireSameOrigin,
  validate(AdminGuideIdSchema, 'params'), validate(AdminGuidePatchSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const guide = await updateAdminGuide(id, req.body);
    res.json({ success: true, data: guide });
  })
);

// POST /api/admin/guides/:id/publish
router.post('/guides/:id/publish', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const guide = await publishGuide(id);
    res.json({ success: true, data: guide });
  })
);

// POST /api/admin/guides/:id/unpublish
router.post('/guides/:id/unpublish', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    const guide = await unpublishGuide(id);
    res.json({ success: true, data: guide });
  })
);

// POST /api/admin/guides/:id/reject — 초안+썸네일 삭제
router.post('/guides/:id/reject', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    await rejectGuide(id);
    res.json({ success: true, data: { deleted: true } });
  })
);

// DELETE /api/admin/guides/:id
router.delete('/guides/:id', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params as unknown as { id: string };
    await rejectGuide(id);
    res.json({ success: true, data: { deleted: true } });
  })
);

export default router;
