import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

// evChargerService 전체를 mock
vi.mock('../../src/services/evChargerService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/evChargerService')>();
  return {
    ...actual,
    fetchChargerStatus: vi.fn(),
  };
});

import { fetchChargerStatus } from '../../src/services/evChargerService';

const mockedFetchChargerStatus = vi.mocked(fetchChargerStatus);

describe('GET /api/facilities/ev-charger/:statId/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('충전기 상태 목록을 반환한다', async () => {
    mockedFetchChargerStatus.mockResolvedValueOnce([
      { chgerId: '01', stat: '2', statUpdDt: '20260410120000' },
      { chgerId: '02', stat: '3', statUpdDt: '20260410120100' },
    ]);

    const res = await request(app).get('/api/facilities/ev-charger/ME101010/status');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].chgerId).toBe('01');
    expect(res.body.data[0].stat).toBe('2');
  });

  it('Cache-Control 헤더가 짧게 설정된다', async () => {
    mockedFetchChargerStatus.mockResolvedValueOnce([]);

    const res = await request(app).get('/api/facilities/ev-charger/ST001/status');

    expect(res.headers['cache-control']).toContain('max-age=');
  });

  it('statId가 비어있으면 404를 반환한다', async () => {
    const res = await request(app).get('/api/facilities/ev-charger//status');

    // Express는 빈 path param을 다른 라우트로 매칭하므로 404
    expect(res.status).toBe(404);
  });
});
