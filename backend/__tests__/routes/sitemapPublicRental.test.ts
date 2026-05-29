import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const listForSitemapMock = vi.fn();
vi.mock('../../src/services/publicRentalAnnouncementService.js', () => ({
  listAnnouncementsForSitemap: (...a: unknown[]) => listForSitemapMock(...a),
}));

import sitemapRouter from '../../src/routes/sitemap.js';

function buildApp() {
  const app = express();
  app.use('/api/sitemap', sitemapRouter);
  return app;
}

describe('GET /api/sitemap/public-rental-announcements', () => {
  beforeEach(() => vi.clearAllMocks());

  it('pblancId + updatedAt 배열을 반환한다', async () => {
    listForSitemapMock.mockResolvedValue([
      { pblancId: '2026-001', updatedAt: new Date('2026-05-29T01:00:00Z'), status: 'ongoing' },
      { pblancId: '2026-002', updatedAt: new Date('2026-05-28T01:00:00Z'), status: 'closed' },
    ]);
    const res = await request(buildApp()).get('/api/sitemap/public-rental-announcements');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toMatchObject({ pblancId: '2026-001' });
    expect(res.body.data[0]).toHaveProperty('updatedAt');
  });
});
