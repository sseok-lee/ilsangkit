import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const { mockSessionCreate, mockSessionFind, mockSessionDelete, mockThrottleFind, mockThrottleUpsert, mockThrottleUpdate, mockCompare } = vi.hoisted(() => ({
  mockSessionCreate: vi.fn(), mockSessionFind: vi.fn(), mockSessionDelete: vi.fn(),
  mockThrottleFind: vi.fn().mockResolvedValue(null), mockThrottleUpsert: vi.fn().mockResolvedValue({ failedAttempts: 1 }), mockThrottleUpdate: vi.fn(),
  mockCompare: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({ default: {
  adminSession: { create: mockSessionCreate, findUnique: mockSessionFind, delete: mockSessionDelete },
  adminLoginThrottle: { findUnique: mockThrottleFind, upsert: mockThrottleUpsert, update: mockThrottleUpdate },
}}));
vi.mock('bcryptjs', () => ({ default: { compare: mockCompare }, compare: mockCompare }));

process.env.ADMIN_PASSWORD_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfa';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import adminRouter from '../../src/routes/admin.js';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';
import { AppError } from '../../src/lib/errors.js';

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use('/api/admin', adminRouter);
  // 간이 에러 핸들러
  app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const s = err instanceof AppError ? err.statusCode : 500;
    res.status(s).json({ success: false, error: { code: err instanceof AppError ? err.code : 'INTERNAL' } });
  });
  return app;
}

beforeEach(() => { vi.clearAllMocks(); mockThrottleFind.mockResolvedValue(null); mockThrottleUpsert.mockResolvedValue({ failedAttempts: 1 }); });

describe('admin auth', () => {
  it('로그인 성공 시 httpOnly·SameSite=Strict 쿠키 발급', async () => {
    mockCompare.mockResolvedValue(true); mockSessionCreate.mockResolvedValue({});
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'correct' });
    expect(res.status).toBe(200);
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/admin_session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Strict/i);
  });

  it('비밀번호 틀리면 401 + 실패 기록', async () => {
    mockCompare.mockResolvedValue(false);
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'wrong' });
    expect(res.status).toBe(401);
    expect(mockThrottleUpsert).toHaveBeenCalled(); // recordLoginFailure
    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('잠금 상태면 429', async () => {
    mockThrottleFind.mockResolvedValue({ id: 'admin', failedAttempts: 5, lockedUntil: new Date(Date.now() + 60000) });
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'x' });
    expect(res.status).toBe(429);
    expect(mockCompare).not.toHaveBeenCalled();
  });

  it('교차 출처 로그인은 403', async () => {
    const res = await request(makeApp()).post('/api/admin/login').set('Origin', 'https://evil.com').send({ password: 'x' });
    expect(res.status).toBe(403);
  });

  it('세션 없이 GET /session은 401', async () => {
    mockSessionFind.mockResolvedValue(null);
    const res = await request(makeApp()).get('/api/admin/session');
    expect(res.status).toBe(401);
  });

  it('비밀번호에 < 포함돼도 훼손 없이 bcrypt.compare에 전달', async () => {
    mockCompare.mockResolvedValue(true); mockSessionCreate.mockResolvedValue({});
    await request(makeApp()).post('/api/admin/login').set('Origin', 'http://localhost:3000').send({ password: 'p<a>ss' });
    expect(mockCompare.mock.calls[0][0]).toBe('p<a>ss'); // sanitize 안 됨(라우터 자체엔 sanitize 없음)
  });
});
