import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';

const {
  getRentalPriceStats,
  getSubscriptionDetail,
  getSubscriptionList,
  getUpcomingSubscriptions,
} = vi.hoisted(() => ({
  getRentalPriceStats: vi.fn(),
  getSubscriptionDetail: vi.fn(),
  getSubscriptionList: vi.fn(),
  getUpcomingSubscriptions: vi.fn(),
}));

vi.mock('../../src/services/subscriptionService.js', () => ({
  getRentalPriceStats,
  getSubscriptionDetail,
  getSubscriptionList,
  getUpcomingSubscriptions,
}));

import subscriptionRouter from '../../src/routes/subscription.js';

function makeApp() {
  const app = express();
  app.use('/api/subscription', subscriptionRouter);
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, requestId: req.requestId },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
    });
  });
  return app;
}

const app = makeApp();

describe('GET /api/subscription list validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getSubscriptionList.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
  });

  it('returns a 422 validation envelope when q is too long', async () => {
    const res = await request(app)
      .get('/api/subscription')
      .query({ q: '가'.repeat(101) });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(getSubscriptionList).not.toHaveBeenCalled();
  });
});
