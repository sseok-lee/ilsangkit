import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/search/searchSuggestService.js', () => ({
  suggest: vi.fn(async () => ({ items: [{ type: 'category', label: '화장실', category: 'toilet' }] })),
}));
vi.mock('../../src/services/search/searchPopularService.js', () => ({
  getPopular: vi.fn(async () => ({ items: [{ keyword: '화장실' }], source: 'static' })),
}));
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn(async () => ({ id: 1 })) }));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { searchLog: { create: mockCreate } }, default: { searchLog: { create: mockCreate } },
}));

import app from '../../src/app.js';

describe('/api/search', () => {
  it('GET /suggest 200 + items', async () => {
    const res = await request(app).get('/api/search/suggest?q=화장실');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
  it('GET /suggest?scope=facility:toilet 는 scope 를 suggest() 로 그대로 전달한다', async () => {
    const { suggest } = await import('../../src/services/search/searchSuggestService.js');
    vi.mocked(suggest).mockClear();
    const res = await request(app).get('/api/search/suggest?q=화장실&scope=facility:toilet');
    expect(res.status).toBe(200);
    expect(vi.mocked(suggest)).toHaveBeenCalledWith('화장실', 'facility:toilet');
  });
  it('GET /popular 200', async () => {
    const res = await request(app).get('/api/search/popular');
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('static');
  });
  it('POST /log 200 (fire-and-forget)', async () => {
    const res = await request(app).post('/api/search/log').send({ sessionId: 'a'.repeat(32), keyword: '화장실', resultCount: 5 });
    expect(res.status).toBe(200);
  });
});
