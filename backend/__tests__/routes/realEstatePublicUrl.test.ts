import express from 'express';
import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import realEstateRouter from '../../src/routes/realEstate.js';

const app = express();
app.use('/api/real-estate', realEstateRouter);

afterEach(() => vi.unstubAllEnvs());

describe('real estate public URL rollout contract', () => {
  it('keeps existing clients in keyed mode until the registry is explicitly enabled', async () => {
    vi.stubEnv('REAL_ESTATE_URL_MODE', 'keyed');
    const result = await request(app).get('/api/real-estate/resolve-url')
      .query({ path: '/real-estate/apt-sale/seoul/gangnam/A' });
    expect(result.status).toBe(200);
    expect(result.body).toEqual({ success: true, data: { mode: 'keyed' } });
  });

  it('allows a transaction tab to discover that keyed mode is still active', async () => {
    vi.stubEnv('REAL_ESTATE_URL_MODE', 'keyed');
    const result = await request(app).get('/api/real-estate/canonical-url')
      .query({ type: 'apt-rent', buildingKey: 'a'.repeat(64) });
    expect(result.status).toBe(200);
    expect(result.body.data).toEqual({ mode: 'keyed', canonicalPath: null });
  });
});
