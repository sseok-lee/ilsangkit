import { beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import cookieParser from 'cookie-parser';
import request from 'supertest';

const {
  mockVerifySession,
  mockListAffiliateBanners,
  mockGetAffiliateBanner,
  mockCreateAffiliateBanner,
  mockUpdateAffiliateBanner,
  mockSetAffiliateBannerStatus,
} = vi.hoisted(() => ({
  mockVerifySession: vi.fn(async () => true),
  mockListAffiliateBanners: vi.fn(),
  mockGetAffiliateBanner: vi.fn(),
  mockCreateAffiliateBanner: vi.fn(),
  mockUpdateAffiliateBanner: vi.fn(),
  mockSetAffiliateBannerStatus: vi.fn(),
}));

vi.mock('../../src/services/adminSessionService.js', () => ({
  verifySession: mockVerifySession,
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('../../src/services/adminAffiliateBannerService.js', () => ({
  listAffiliateBanners: mockListAffiliateBanners,
  getAffiliateBanner: mockGetAffiliateBanner,
  createAffiliateBanner: mockCreateAffiliateBanner,
  updateAffiliateBanner: mockUpdateAffiliateBanner,
  setAffiliateBannerStatus: mockSetAffiliateBannerStatus,
}));

process.env.ADMIN_PASSWORD_HASH = '$2a$10$fakehashfakehashfakehashfakehashfakehashfa';
process.env.CORS_ORIGIN = 'http://localhost:3000';

import adminRouter from '../../src/routes/admin.js';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';
import { AppError, NotFoundError, ValidationError } from '../../src/lib/errors.js';

const ORIGIN = 'http://localhost:3000';

const bannerDto = {
  id: '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
  provider: 'coupang',
  name: '여름 준비',
  imageSourceType: 'url',
  imageAssetId: null,
  externalImageUrl: 'https://images.example.com/banner.png',
  imageUrl: 'https://images.example.com/banner.png',
  targetUrl: 'https://example.com/go?a=%2B&a=2+b',
  altText: '여름 준비',
  isEnabled: false,
  createdAt: '2026-10-06T01:02:03.000Z',
  updatedAt: '2026-10-06T01:02:03.000Z',
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
  mockListAffiliateBanners.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
  mockGetAffiliateBanner.mockResolvedValue(bannerDto);
  mockCreateAffiliateBanner.mockResolvedValue(bannerDto);
  mockUpdateAffiliateBanner.mockResolvedValue({ ...bannerDto, name: '새 이름' });
  mockSetAffiliateBannerStatus.mockResolvedValue({ ...bannerDto, isEnabled: true });
});

describe('admin affiliate banner routes', () => {
  it('lists banners with filters and returns no-store success envelope', async () => {
    const res = await request(makeApp())
      .get('/api/admin/affiliate-banners?page=2&limit=10&provider=coupang&isEnabled=false');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } });
    expect(mockListAffiliateBanners).toHaveBeenCalledWith({
      page: 2,
      limit: 10,
      provider: 'coupang',
      isEnabled: false,
    });
  });

  it('creates banners after admin and same-origin checks', async () => {
    const draft = {
      provider: 'coupang',
      name: '여름 준비',
      imageSourceType: 'url',
      imageAssetId: null,
      externalImageUrl: 'https://images.example.com/banner.png',
      targetUrl: 'https://example.com/go?a=%2B&a=2+b',
      altText: '여름 준비',
    };

    const res = await request(makeApp())
      .post('/api/admin/affiliate-banners')
      .set('Origin', ORIGIN)
      .send(draft);

    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, data: bannerDto });
    expect(mockCreateAffiliateBanner).toHaveBeenCalledWith(draft);
  });

  it('rejects unauthenticated list requests', async () => {
    mockVerifySession.mockResolvedValue(false);

    const res = await request(makeApp()).get('/api/admin/affiliate-banners');

    expect(res.status).toBe(401);
    expect(mockListAffiliateBanners).not.toHaveBeenCalled();
  });

  it('rejects cross-origin writes before service work', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e')
      .send({ name: '새 이름' });

    expect(res.status).toBe(403);
    expect(mockUpdateAffiliateBanner).not.toHaveBeenCalled();
  });

  it('rejects invalid ids and status mass-assignment', async () => {
    const invalidId = await request(makeApp())
      .get('/api/admin/affiliate-banners/not-a-uuid');
    expect(invalidId.status).toBe(422);
    expect(mockGetAffiliateBanner).not.toHaveBeenCalled();

    const massAssignment = await request(makeApp())
      .patch('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e')
      .set('Origin', ORIGIN)
      .send({ isEnabled: true });
    expect(massAssignment.status).toBe(422);
    expect(mockUpdateAffiliateBanner).not.toHaveBeenCalled();
  });

  it('updates status through the dedicated endpoint', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e/status')
      .set('Origin', ORIGIN)
      .send({ isEnabled: true });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.data.isEnabled).toBe(true);
    expect(mockSetAffiliateBannerStatus).toHaveBeenCalledWith(
      '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
      true,
    );
  });

  it('gets a banner by id and returns the service dto', async () => {
    const res = await request(makeApp())
      .get('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ success: true, data: bannerDto });
    expect(mockGetAffiliateBanner).toHaveBeenCalledWith('6ea02ad2-d1be-4d01-946d-d08005f01d4e');
  });

  it('patches a banner and returns the updated service dto', async () => {
    const res = await request(makeApp())
      .patch('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e')
      .set('Origin', ORIGIN)
      .send({ name: '새 이름' });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body).toEqual({ success: true, data: { ...bannerDto, name: '새 이름' } });
    expect(mockUpdateAffiliateBanner).toHaveBeenCalledWith(
      '6ea02ad2-d1be-4d01-946d-d08005f01d4e',
      { name: '새 이름' },
    );
  });

  it.each([
    ['get', () => request(makeApp()).get('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e'), mockGetAffiliateBanner],
    ['patch', () => request(makeApp()).patch('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e').set('Origin', ORIGIN).send({ name: '없음' }), mockUpdateAffiliateBanner],
    ['status', () => request(makeApp()).patch('/api/admin/affiliate-banners/6ea02ad2-d1be-4d01-946d-d08005f01d4e/status').set('Origin', ORIGIN).send({ isEnabled: false }), mockSetAffiliateBannerStatus],
  ])('returns no-store 404 when %s service cannot find the banner', async (_name, sendRequest, serviceMock) => {
    serviceMock.mockRejectedValueOnce(new NotFoundError('배너를 찾을 수 없습니다'));

    const res = await sendRequest();

    expect(res.status).toBe(404);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
