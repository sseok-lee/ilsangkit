// @TASK P11-R1-T1 - API Rate Limiting 미들웨어 테스트
// @SPEC docs/planning/02-trd.md#보안

import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Rate Limiting Middleware', () => {
  describe('Global Rate Limiter (100 req/min)', () => {
    beforeEach(() => {
      // Rate limit 테스트는 시간 기반이므로 각 테스트마다 짧은 대기
      return new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should skip rate limit for localhost (SSR proxy)', async () => {
      // supertest는 localhost에서 요청하므로 skip 동작 확인
      const requests = Array(10).fill(null).map(() =>
        request(app).post('/api/facilities/search').send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        })
      );

      const responses = await Promise.all(requests);

      // localhost 요청은 모두 rate limit에 걸리지 않아야 함
      responses.forEach((response) => {
        expect(response.status).not.toBe(429);
      });
    }, 10000);

    it('should skip rate limit for health check endpoint', async () => {
      // Health check는 rate limit 제외되어야 함
      const requests = Array(10).fill(null).map(() =>
        request(app).get('/api/health')
      );

      const responses = await Promise.all(requests);

      // 모든 health check 요청이 성공해야 함
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Search Rate Limiter (30 req/min)', () => {
    beforeEach(() => {
      return new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should skip rate limit for localhost (SSR proxy)', async () => {
      // SSR 프록시(Nitro → Express)는 localhost에서 요청하므로 skip
      const requests = Array(35).fill(null).map(() =>
        request(app).post('/api/facilities/search').send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        })
      );

      const responses = await Promise.all(requests);

      // localhost 요청은 30 req/min 제한에 걸리지 않아야 함
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBe(0);
    }, 15000);
  });

  describe('Rate Limit Headers', () => {
    it('should not include rate limit headers for localhost (skipped)', async () => {
      const response = await request(app)
        .post('/api/facilities/search')
        .send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        });

      // localhost는 skip되므로 rate limit 헤더가 설정되지 않음
      expect(response.headers['ratelimit-limit']).toBeUndefined();
    });

    it('should not include legacy X-RateLimit headers', async () => {
      const response = await request(app)
        .post('/api/facilities/search')
        .send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        });

      // Legacy headers should be disabled
      expect(response.headers['x-ratelimit-limit']).toBeUndefined();
      expect(response.headers['x-ratelimit-remaining']).toBeUndefined();
      expect(response.headers['x-ratelimit-reset']).toBeUndefined();
    });
  });
});
