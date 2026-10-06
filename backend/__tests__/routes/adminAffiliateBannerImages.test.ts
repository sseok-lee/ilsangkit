import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { Application } from 'express';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const uploadRoot = mkdtempSync(path.join(os.tmpdir(), 'affiliate-banner-route-'));
mkdirSync(path.join(uploadRoot, 'affiliate-banners'), { recursive: true });
writeFileSync(path.join(uploadRoot, 'affiliate-banners', 'public.png'), Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]));

process.env.UPLOAD_DIR = uploadRoot;
process.env.CORS_ORIGIN = 'http://localhost:3000';
process.env.DATABASE_URL = 'mysql://test:test@localhost:3306/test?connection_limit=1&pool_timeout=1';

const { mockVerifySession, mockUploadAffiliateBannerImage } = vi.hoisted(() => ({
  mockVerifySession: vi.fn(),
  mockUploadAffiliateBannerImage: vi.fn(),
}));

vi.mock('../../src/services/adminSessionService.js', () => ({
  verifySession: mockVerifySession,
  createSession: vi.fn(),
  revokeSession: vi.fn(),
}));

vi.mock('../../src/services/affiliateBannerAssetService.js', () => ({
  uploadAffiliateBannerImage: mockUploadAffiliateBannerImage,
}));

import { AppError } from '../../src/lib/errors.js';

const ORIGIN = 'http://localhost:3000';
const SESSION = 'admin_session=test-session';
let app: Application;

beforeAll(async () => {
  app = (await import('../../src/app.js')).default;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockVerifySession.mockResolvedValue(true);
  mockUploadAffiliateBannerImage.mockResolvedValue({
    imageAssetId: '11111111-1111-4111-8111-111111111111',
    imageUrl: '/api/images/affiliate-banners/11111111-1111-4111-8111-111111111111.png',
  });
});

describe('POST /api/admin/affiliate-banner-images', () => {
  it('rejects unauthenticated oversized octet-streams before parsing the body', async () => {
    mockVerifySession.mockResolvedValue(false);

    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Content-Type', 'application/octet-stream')
      .set('Content-Length', String(2 * 1024 * 1024 + 1))
      .send(Buffer.from('x'));

    expect(res.status).toBe(401);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(mockUploadAffiliateBannerImage).not.toHaveBeenCalled();
  });

  it('rejects authenticated cross-origin uploads before storage is called', async () => {
    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Cookie', SESSION)
      .set('Referer', 'https://evil.example/admin')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('x'));

    expect(res.status).toBe(403);
    expect(mockUploadAffiliateBannerImage).not.toHaveBeenCalled();
  });

  it.each([
    ['application/json', Buffer.from('{"x":1}')],
    ['multipart/form-data; boundary=test', Buffer.from('--test--')],
  ])('rejects unsupported upload content type %s', async (contentType, body) => {
    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Cookie', SESSION)
      .set('Origin', ORIGIN)
      .set('Content-Type', contentType)
      .send(body);

    expect(res.status).toBe(415);
    expect(mockUploadAffiliateBannerImage).not.toHaveBeenCalled();
  });

  it('rejects an empty octet-stream body', async () => {
    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Cookie', SESSION)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(0));

    expect(res.status).toBe(422);
    expect(mockUploadAffiliateBannerImage).not.toHaveBeenCalled();
  });

  it('maps parser limit failures to 413', async () => {
    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Cookie', SESSION)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(2 * 1024 * 1024 + 1));

    expect(res.status).toBe(413);
    expect(mockUploadAffiliateBannerImage).not.toHaveBeenCalled();
  });

  it('passes a 2MiB octet-stream body to the storage service', async () => {
    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Cookie', SESSION)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.alloc(2 * 1024 * 1024));

    expect(res.status).toBe(201);
    expect(mockUploadAffiliateBannerImage).toHaveBeenCalledWith(expect.any(Buffer));
    expect(mockUploadAffiliateBannerImage.mock.calls[0][0]).toHaveLength(2 * 1024 * 1024);
  });

  it('returns 415 when storage rejects malformed raster bytes', async () => {
    mockUploadAffiliateBannerImage.mockRejectedValueOnce(
      new AppError(415, '지원하지 않는 이미지 형식입니다', 'UNSUPPORTED_MEDIA_TYPE')
    );

    const res = await request(app)
      .post('/api/admin/affiliate-banner-images')
      .set('Cookie', SESSION)
      .set('Origin', ORIGIN)
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('<svg></svg>'));

    expect(res.status).toBe(415);
  });
});

describe('GET /api/images', () => {
  it('serves stored affiliate banner images without admin authentication', async () => {
    const res = await request(app).get('/api/images/affiliate-banners/public.png');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });
});
