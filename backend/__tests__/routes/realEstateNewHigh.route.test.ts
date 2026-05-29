import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

const getNewHighMock = vi.fn();
vi.mock('../../src/services/realEstateNewHighService.js', () => ({
  getNewHighBuildings: (...a: unknown[]) => getNewHighMock(...a),
}));

// Mock dependencies that realEstate router imports
vi.mock('../../src/services/realEstateService.js', () => ({
  searchTransactions: vi.fn(),
  getTransactionStats: vi.fn(),
  getComplexList: vi.fn(),
  getBuildingInfo: vi.fn(),
  searchAll: vi.fn(),
  getAreaGroups: vi.fn(),
  getApartmentPriceAnalysis: vi.fn(),
  getNearbyByBjd: vi.fn(),
}));
vi.mock('../../src/services/realEstateHubSummaryService.js', () => ({
  getHubSummary: vi.fn(),
}));

import realEstateRouter from '../../src/routes/realEstate.js';

function buildApp() {
  const app = express();
  app.use('/api/real-estate', realEstateRouter);
  return app;
}

describe('GET /api/real-estate/new-high', () => {
  beforeEach(() => vi.clearAllMocks());

  it('매매 타입 신고가를 반환', async () => {
    getNewHighMock.mockResolvedValue({ items: [], asOfYm: 202603 });
    const res = await request(buildApp()).get('/api/real-estate/new-high?propertyType=apt-sale');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getNewHighMock).toHaveBeenCalledWith('apt-sale', 30);
  });

  it('전월세 타입은 422', async () => {
    const res = await request(buildApp()).get('/api/real-estate/new-high?propertyType=apt-rent');
    expect(res.status).toBe(422);
  });
});
