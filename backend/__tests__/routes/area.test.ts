import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app';

describe('GET /api/area/:citySlug (시 단위 Area API)', () => {
  it('유효하지 않은 citySlug에 대해 404 반환', async () => {
    const res = await request(app).get('/api/area/invalidcity');

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});
