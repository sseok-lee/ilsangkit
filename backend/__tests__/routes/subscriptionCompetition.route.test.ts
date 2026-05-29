import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const getCompetitionRankingMock = vi.fn();
vi.mock('../../src/services/subscriptionService.js', () => ({
  getCompetitionRanking: (...a: unknown[]) => getCompetitionRankingMock(...a),
  getSubscriptionList: vi.fn(),
  getSubscriptionDetail: vi.fn(),
  getUpcomingSubscriptions: vi.fn(),
  getRentalPriceStats: vi.fn(),
}));

import subscriptionRouter from '../../src/routes/subscription.js';

function buildApp() {
  const app = express();
  app.use('/api/subscription', subscriptionRouter);
  return app;
}

describe('GET /api/subscription/competition', () => {
  beforeEach(() => vi.clearAllMocks());

  it('competition 랭킹을 반환하고 /:id 로 빠지지 않는다', async () => {
    getCompetitionRankingMock.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
    const res = await request(buildApp()).get('/api/subscription/competition?metric=rate');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getCompetitionRankingMock).toHaveBeenCalledWith(
      expect.objectContaining({ metric: 'rate', page: 1, limit: 20 })
    );
  });

  it('잘못된 metric은 422', async () => {
    const res = await request(buildApp()).get('/api/subscription/competition?metric=bogus');
    expect(res.status).toBe(422);
  });
});
