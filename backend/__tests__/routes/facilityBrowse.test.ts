import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { ValidationError } from '../../src/lib/errors.js';

const { mockBrowseFacilities } = vi.hoisted(() => ({
  mockBrowseFacilities: vi.fn(),
}));

vi.mock('../../src/services/facilityBrowseService.js', () => ({
  browseFacilities: mockBrowseFacilities,
}));

import app from '../../src/app.js';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/facilities/browse', () => {
  it('returns 422 for an invalid region from the browse service', async () => {
    mockBrowseFacilities.mockRejectedValueOnce(new ValidationError('district does not belong to city'));

    const res = await request(app)
      .get('/api/facilities/browse')
      .query({ city: 'seoul', district: 'missing' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns a valid empty grouped response', async () => {
    mockBrowseFacilities.mockResolvedValueOnce({ mode: 'grouped', groups: [] });

    const res = await request(app)
      .get('/api/facilities/browse')
      .query({ city: 'seoul', district: 'gangnam' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { mode: 'grouped', groups: [] } });
    expect(mockBrowseFacilities).toHaveBeenCalledWith(
      expect.objectContaining({ city: 'seoul', district: 'gangnam', page: 1, limit: 20 }),
    );
  });

  it('returns 500 when an adapter failure reaches the route', async () => {
    mockBrowseFacilities.mockRejectedValueOnce(new Error('adapter failed'));

    const res = await request(app)
      .get('/api/facilities/browse')
      .query({ city: 'seoul', district: 'gangnam' });

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });
});
