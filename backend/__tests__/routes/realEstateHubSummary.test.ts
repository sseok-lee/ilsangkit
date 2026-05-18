// backend/__tests__/routes/realEstateHubSummary.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

const { mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockQueryRawUnsafe: vi.fn().mockResolvedValue([{ cnt: BigInt(11) }]),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRawUnsafe: mockQueryRawUnsafe };
  return { prisma, default: prisma };
});

import app from '../../src/app.js';
import {
  __resetHubSummaryCacheForTest,
  HUB_TYPES,
} from '../../src/services/realEstateHubSummaryService.js';

describe('GET /api/real-estate/hub-summary', () => {
  beforeEach(() => {
    __resetHubSummaryCacheForTest();
    mockQueryRawUnsafe.mockClear();
  });

  afterEach(() => {
    __resetHubSummaryCacheForTest();
  });

  it('200 + 6개 키 응답', async () => {
    const res = await request(app).get('/api/real-estate/hub-summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const t of HUB_TYPES) {
      expect(res.body.data[t]).toEqual({ last30dCount: 11 });
    }
    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('두 번째 호출은 캐시 hit — generatedAt 동일 + 쿼리는 6회만', async () => {
    const a = await request(app).get('/api/real-estate/hub-summary');
    const b = await request(app).get('/api/real-estate/hub-summary');
    expect(a.body.generatedAt).toBe(b.body.generatedAt);
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(6);
  });
});
