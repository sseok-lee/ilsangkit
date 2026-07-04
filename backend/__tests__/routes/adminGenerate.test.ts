import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const {
  mockSpawn,
  mockChildOn,
  mockChildUnref,
  mockExistsSync,
  mockVerifySession,
  mockLockUpsert,
  mockLockUpdateMany,
  mockArticleFindUnique,
  mockArticleUpdate,
} = vi.hoisted(() => {
  const mockChildOn = vi.fn();
  const mockChildUnref = vi.fn();
  return {
    mockChildOn,
    mockChildUnref,
    mockSpawn: vi.fn(() => ({ on: mockChildOn, unref: mockChildUnref })),
    mockExistsSync: vi.fn(() => true),
    mockVerifySession: vi.fn(async () => true),
    mockLockUpsert: vi.fn(async () => ({ id: 'singleton', running: false, startedAt: new Date() })),
    mockLockUpdateMany: vi.fn(async () => ({ count: 1 })),
    mockArticleFindUnique: vi.fn(),
    mockArticleUpdate: vi.fn(),
  };
});

vi.mock('child_process', () => ({ spawn: mockSpawn }));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return { ...actual, existsSync: mockExistsSync, default: { ...actual.default, existsSync: mockExistsSync } };
});

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    articleGenerationLock: {
      upsert: mockLockUpsert,
      updateMany: mockLockUpdateMany,
    },
    article: {
      findUnique: mockArticleFindUnique,
      update: mockArticleUpdate,
    },
  },
}));

vi.mock('../../src/services/adminSessionService.js', () => ({
  verifySession: mockVerifySession,
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

process.env.ADMIN_PASSWORD_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfa';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import adminRouter from '../../src/routes/admin.js';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';
import { AppError, ValidationError } from '../../src/lib/errors.js';
import { adminGenerateRateLimiter } from '../../src/middlewares/adminAuth.js';

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

const SAVED_ENV = { OPENAI_API_KEY: process.env.OPENAI_API_KEY, NAVER_CLIENT_ID: process.env.NAVER_CLIENT_ID };

beforeEach(async () => {
  vi.clearAllMocks();
  mockVerifySession.mockResolvedValue(true);
  mockExistsSync.mockReturnValue(true);
  mockLockUpsert.mockResolvedValue({ id: 'singleton', running: false, startedAt: new Date() });
  mockLockUpdateMany.mockResolvedValue({ count: 1 });
  process.env.OPENAI_API_KEY = 'test-openai-key';
  process.env.NAVER_CLIENT_ID = 'test-naver-client';
  // adminGenerateRateLimiter는 모듈 싱글톤(라우터 재사용) — 테스트마다 supertest의 loopback IP(127.0.0.1) 카운트를 리셋해
  // 테스트 간 429 누적으로 인한 오염을 방지(전용 리미터의 실제 max=5/시간 로직 자체는 그대로 검증 대상).
  await adminGenerateRateLimiter.resetKey('127.0.0.1');
});

afterEach(() => {
  process.env.OPENAI_API_KEY = SAVED_ENV.OPENAI_API_KEY;
  process.env.NAVER_CLIENT_ID = SAVED_ENV.NAVER_CLIENT_ID;
});

describe('POST /api/admin/articles/generate', () => {
  it('정상 요청: 락 확보 + spawn 호출(execPath+배열 args, 쉘 아님) + 202', async () => {
    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 3 });

    expect(res.status).toBe(202);
    expect(res.body.data.started).toBe(true);
    expect(mockLockUpdateMany).toHaveBeenCalledTimes(1); // acquire

    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = mockSpawn.mock.calls[0] as [string, string[], Record<string, unknown>];
    expect(cmd).toBe(process.execPath);
    expect(Array.isArray(args)).toBe(true);
    expect(args).toContain('--count');
    expect(args[args.indexOf('--count') + 1]).toBe('3');
    expect(args).not.toContain('--category'); // category 미지정
    expect(opts).toMatchObject({ detached: true, stdio: 'ignore' });

    expect(mockChildUnref).toHaveBeenCalledTimes(1);
    expect(mockChildOn).toHaveBeenCalledWith('exit', expect.any(Function));

    // exit 핸들러 호출 시 락 해제(release)도 best-effort로 일어나야 함
    const exitHandler = mockChildOn.mock.calls.find((c) => c[0] === 'exit')?.[1] as (() => void) | undefined;
    expect(exitHandler).toBeTypeOf('function');
    mockLockUpdateMany.mockClear();
    exitHandler?.();
    expect(mockLockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { running: false } }));
  });

  it('category 지정 시 spawn args에 --category 포함', async () => {
    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1, category: 'toilet' });

    expect(res.status).toBe(202);
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--category');
    expect(args[args.indexOf('--category') + 1]).toBe('toilet');
  });

  it('락이 이미 running이면 409, spawn 호출 안 됨', async () => {
    mockLockUpdateMany.mockResolvedValue({ count: 0 }); // 확보 실패(이미 다른 생성 진행 중)

    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });

    expect(res.status).toBe(409);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('category:invalid → 422(Zod), spawn 호출 안 됨', async () => {
    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1, category: 'invalid' });

    expect(res.status).toBe(422);
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockLockUpdateMany).not.toHaveBeenCalled(); // 락 확보 자체를 시도하지 않음
  });

  it('count:99 → 3으로 clamp', async () => {
    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 99 });

    expect(res.status).toBe(202);
    expect(res.body.data.count).toBe(3);
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args[args.indexOf('--count') + 1]).toBe('3');
  });

  it('OPENAI_API_KEY 없으면 503, spawn 호출 안 됨', async () => {
    delete process.env.OPENAI_API_KEY;

    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });

    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('GENERATION_NOT_CONFIGURED');
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockLockUpdateMany).not.toHaveBeenCalled();
  });

  it('NAVER_CLIENT_ID 없으면 503, spawn 호출 안 됨', async () => {
    delete process.env.NAVER_CLIENT_ID;

    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });

    expect(res.status).toBe(503);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('dist 생성 스크립트 없으면 500, spawn 호출 안 됨', async () => {
    mockExistsSync.mockReturnValue(false);

    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('SCRIPT_MISSING');
    expect(mockSpawn).not.toHaveBeenCalled();
    expect(mockLockUpdateMany).not.toHaveBeenCalled();
  });

  it('인증 없으면 401, spawn 호출 안 됨', async () => {
    mockVerifySession.mockResolvedValue(false);

    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });

    expect(res.status).toBe(401);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('교차 출처 요청은 403, spawn 호출 안 됨', async () => {
    const res = await request(makeApp()).post('/api/admin/articles/generate').set('Origin', 'https://evil.com').send({ count: 1 });

    expect(res.status).toBe(403);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('전용 리미터: 시간당 한도 초과 시 429 (loopback 스킵 없음)', async () => {
    const app = makeApp();
    for (let i = 0; i < 5; i++) {
      const ok = await request(app).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });
      expect(ok.status).toBe(202);
    }
    const limited = await request(app).post('/api/admin/articles/generate').set('Origin', ORIGIN).send({ count: 1 });
    expect(limited.status).toBe(429);
  });
});

describe('POST /api/admin/articles/:id/regenerate', () => {
  it('정상: 생성 가능 확인(락 확보) 후에만 반려 + 해당 category로 spawn(count=1) + 202', async () => {
    mockArticleFindUnique
      .mockResolvedValueOnce({ id: 'a1', category: 'toilet' }) // getAdminArticle(대상 조회)
      .mockResolvedValueOnce({ id: 'a1' }); // rejectArticle 내부 존재 확인
    mockArticleUpdate.mockResolvedValueOnce({ id: 'a1', status: 'rejected', category: 'toilet' });

    const res = await request(makeApp()).post('/api/admin/articles/a1/regenerate').set('Origin', ORIGIN);

    expect(res.status).toBe(202);
    expect(mockLockUpdateMany).toHaveBeenCalledTimes(1); // assertGenerationReady에서 락 확보
    expect(mockArticleUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1' }, data: { status: 'rejected' } }));
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const args = mockSpawn.mock.calls[0][1] as string[];
    expect(args).toContain('--count');
    expect(args[args.indexOf('--count') + 1]).toBe('1');
    expect(args).toContain('--category');
    expect(args[args.indexOf('--category') + 1]).toBe('toilet');
  });

  it('대상 없으면 404, 락 시도 없음, 반려도 적용 안 됨', async () => {
    mockArticleFindUnique.mockResolvedValueOnce(null); // getAdminArticle에서 404

    const res = await request(makeApp()).post('/api/admin/articles/missing/regenerate').set('Origin', ORIGIN);

    expect(res.status).toBe(404);
    expect(mockLockUpdateMany).not.toHaveBeenCalled(); // 락 확보 자체를 시도하지 않음
    expect(mockArticleUpdate).not.toHaveBeenCalled();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('락이 이미 running이면 409, spawn 호출 안 됨, 반려도 적용 안 됨(초안 원본 유지)', async () => {
    mockArticleFindUnique.mockResolvedValueOnce({ id: 'a1', category: 'toilet' }); // getAdminArticle만 성공
    mockLockUpdateMany.mockResolvedValue({ count: 0 }); // 확보 실패

    const res = await request(makeApp()).post('/api/admin/articles/a1/regenerate').set('Origin', ORIGIN);

    expect(res.status).toBe(409);
    expect(mockArticleUpdate).not.toHaveBeenCalled(); // rejectArticle이 호출되지 않아 반려 미적용
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('OPENAI_API_KEY 없으면 503, spawn 호출 안 됨, 반려도 적용 안 됨(초안 원본 유지)', async () => {
    delete process.env.OPENAI_API_KEY;
    mockArticleFindUnique.mockResolvedValueOnce({ id: 'a1', category: 'toilet' }); // getAdminArticle만 성공

    const res = await request(makeApp()).post('/api/admin/articles/a1/regenerate').set('Origin', ORIGIN);

    expect(res.status).toBe(503);
    expect(mockArticleUpdate).not.toHaveBeenCalled();
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  it('dist 생성 스크립트 없으면 500, spawn 호출 안 됨, 반려도 적용 안 됨(초안 원본 유지)', async () => {
    mockExistsSync.mockReturnValue(false);
    mockArticleFindUnique.mockResolvedValueOnce({ id: 'a1', category: 'toilet' }); // getAdminArticle만 성공

    const res = await request(makeApp()).post('/api/admin/articles/a1/regenerate').set('Origin', ORIGIN);

    expect(res.status).toBe(500);
    expect(mockArticleUpdate).not.toHaveBeenCalled();
    expect(mockSpawn).not.toHaveBeenCalled();
  });
});
