import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const {
  mockVerifySession,
  mockListAffiliateProviderDisclosures,
  mockSaveAffiliateProviderDisclosure,
} = vi.hoisted(() => ({
  mockVerifySession: vi.fn(async () => true),
  mockListAffiliateProviderDisclosures: vi.fn(),
  mockSaveAffiliateProviderDisclosure: vi.fn(),
}));

vi.mock('../../src/services/adminSessionService.js', () => ({
  verifySession: mockVerifySession,
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('../../src/services/adminAffiliateDisclosureService.js', () => ({
  listAffiliateProviderDisclosures: mockListAffiliateProviderDisclosures,
  saveAffiliateProviderDisclosure: mockSaveAffiliateProviderDisclosure,
}));

process.env.ADMIN_PASSWORD_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfa';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import adminRouter from '../../src/routes/admin.js';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';
import { AppError, ValidationError } from '../../src/lib/errors.js';

const ORIGIN = 'http://localhost:3000';

const disclosureDto = {
  provider: 'coupang',
  defaultDisclosureText: '테스트 기본 문구',
  updatedAt: '2026-10-07T00:00:00.000Z',
};

function makeApp() {
  const app = express();
  app.use('/api/admin', (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(express.json());
  app.use(cookieParser());
  app.use(requestIdMiddleware);
  app.use('/api/admin', adminRouter);
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json({
      success: false,
      error: {
        code: err instanceof AppError ? err.code : 'INTERNAL',
        message: err.message,
        requestId: req.requestId,
        ...(err instanceof ValidationError && err.details ? { details: err.details } : {}),
      },
    });
  });
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifySession.mockResolvedValue(true);
  mockListAffiliateProviderDisclosures.mockResolvedValue([
    disclosureDto,
    { provider: 'ali', defaultDisclosureText: null, updatedAt: null },
    { provider: 'toss', defaultDisclosureText: null, updatedAt: null },
  ]);
  mockSaveAffiliateProviderDisclosure.mockResolvedValue(disclosureDto);
});

describe('admin affiliate provider disclosure routes', () => {
  it('lists provider disclosures through the authenticated admin route', async () => {
    const response = await request(makeApp())
      .get('/api/admin/affiliate-provider-disclosures');

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body).toEqual({
      success: true,
      data: [
        disclosureDto,
        { provider: 'ali', defaultDisclosureText: null, updatedAt: null },
        { provider: 'toss', defaultDisclosureText: null, updatedAt: null },
      ],
    });
    expect(mockListAffiliateProviderDisclosures).toHaveBeenCalledOnce();
  });

  it('upserts one provider through the authenticated route', async () => {
    mockSaveAffiliateProviderDisclosure.mockResolvedValue(disclosureDto);

    const response = await request(makeApp())
      .put('/api/admin/affiliate-provider-disclosures/coupang')
      .set('Origin', ORIGIN)
      .send({ defaultDisclosureText: '  테스트 기본 문구  ' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: disclosureDto });
    expect(response.headers['cache-control']).toContain('no-store');
    expect(mockSaveAffiliateProviderDisclosure).toHaveBeenCalledWith(
      'coupang',
      { defaultDisclosureText: '테스트 기본 문구' },
    );
  });

  it('rejects unauthenticated reads before service work', async () => {
    mockVerifySession.mockResolvedValue(false);

    const response = await request(makeApp())
      .get('/api/admin/affiliate-provider-disclosures');

    expect(response.status).toBe(401);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(mockListAffiliateProviderDisclosures).not.toHaveBeenCalled();
  });

  it.each([
    ['missing origin', undefined],
    ['different origin', 'https://evil.example'],
  ])('rejects %s writes before validation or service work', async (_name, origin) => {
    const requestBuilder = request(makeApp())
      .put('/api/admin/affiliate-provider-disclosures/coupang')
      .send({ defaultDisclosureText: '테스트 기본 문구' });

    if (origin) {
      requestBuilder.set('Origin', origin);
    }

    const response = await requestBuilder;

    expect(response.status).toBe(403);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(mockSaveAffiliateProviderDisclosure).not.toHaveBeenCalled();
  });

  it.each([
    ['unsupported provider', '/api/admin/affiliate-provider-disclosures/naver', { defaultDisclosureText: '문구' }],
    ['null text', '/api/admin/affiliate-provider-disclosures/coupang', { defaultDisclosureText: null }],
    ['blank text', '/api/admin/affiliate-provider-disclosures/coupang', { defaultDisclosureText: ' \r\n ' }],
    ['over length text', '/api/admin/affiliate-provider-disclosures/coupang', { defaultDisclosureText: 'a'.repeat(1001) }],
    ['extra key', '/api/admin/affiliate-provider-disclosures/coupang', { defaultDisclosureText: '문구', extra: true }],
  ])('rejects %s with 422 before service work', async (_name, path, body) => {
    const response = await request(makeApp())
      .put(path)
      .set('Origin', ORIGIN)
      .send(body);

    expect(response.status).toBe(422);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(mockSaveAffiliateProviderDisclosure).not.toHaveBeenCalled();
  });

  it('returns a no-store 500 envelope when the service fails', async () => {
    mockSaveAffiliateProviderDisclosure.mockRejectedValueOnce(new Error('database unavailable'));

    const response = await request(makeApp())
      .put('/api/admin/affiliate-provider-disclosures/toss')
      .set('Origin', ORIGIN)
      .send({ defaultDisclosureText: '토스 기본 문구' });

    expect(response.status).toBe(500);
    expect(response.headers['cache-control']).toContain('no-store');
    expect(response.body.error).toMatchObject({
      code: 'INTERNAL',
      message: 'database unavailable',
    });
    expect(mockSaveAffiliateProviderDisclosure).toHaveBeenCalledWith(
      'toss',
      { defaultDisclosureText: '토스 기본 문구' },
    );
  });
});
