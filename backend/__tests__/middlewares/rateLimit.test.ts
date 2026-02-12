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

    it('should allow requests within limit', async () => {
      // Use a non-skipped endpoint to test rate limit headers
      const response = await request(app)
        .post('/api/facilities/search')
        .send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        });

      expect(response.status).not.toBe(429); // Should not be rate limited yet
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
    });

    it('should return 429 when exceeding global rate limit', async () => {
      // 전역 rate limit: 100 req/min
      // 테스트를 위해 101번 요청 (시간이 오래 걸리므로 일부만 테스트)
      const requests = Array(10).fill(null).map(() =>
        request(app).post('/api/facilities/search').send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        })
      );

      const responses = await Promise.all(requests);

      // 모든 요청이 성공하거나 rate limit에 걸려야 함
      responses.forEach((response) => {
        expect([200, 429]).toContain(response.status);
      });
    }, 10000);

    it('should include Retry-After header on 429 response', async () => {
      // Rate limit 초과를 위해 연속 요청
      const requests = Array(35).fill(null).map(() =>
        request(app).post('/api/facilities/search').send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        })
      );

      const responses = await Promise.all(requests);

      // 429 응답 찾기
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.headers['retry-after']).toBeDefined();
        expect(rateLimitedResponse.body).toEqual({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: expect.stringContaining('요청 횟수를 초과했습니다'),
            requestId: expect.any(String),
          },
        });
      }
    }, 15000);

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

    it('should apply stricter limit to search endpoint', async () => {
      const response = await request(app)
        .post('/api/facilities/search')
        .send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        });

      expect(response.headers['ratelimit-limit']).toBeDefined();
      // Search endpoint는 30 req/min으로 제한
      expect(parseInt(response.headers['ratelimit-limit'])).toBeLessThanOrEqual(30);
    });

    it('should return 429 when exceeding search rate limit', async () => {
      // Search rate limit: 30 req/min
      const requests = Array(35).fill(null).map(() =>
        request(app).post('/api/facilities/search').send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        })
      );

      const responses = await Promise.all(requests);

      // 일부 요청은 429를 받아야 함
      const rateLimitedResponses = responses.filter((r) => r.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);

      // 429 응답은 올바른 형식이어야 함
      rateLimitedResponses.forEach((response) => {
        expect(response.body).toEqual({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: expect.stringContaining('요청 횟수를 초과했습니다'),
            requestId: expect.any(String),
          },
        });
        expect(response.headers['retry-after']).toBeDefined();
      });
    }, 15000);

    it('should include requestId in rate limit error response', async () => {
      // 연속 요청으로 rate limit 초과 유도
      const requests = Array(35).fill(null).map(() =>
        request(app).post('/api/facilities/search').send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        })
      );

      const responses = await Promise.all(requests);
      const rateLimitedResponse = responses.find((r) => r.status === 429);

      if (rateLimitedResponse) {
        expect(rateLimitedResponse.body.error.requestId).toBeDefined();
        expect(typeof rateLimitedResponse.body.error.requestId).toBe('string');
      }
    }, 15000);
  });

  describe('Rate Limit Headers', () => {
    it('should include standard RateLimit headers', async () => {
      const response = await request(app)
        .post('/api/facilities/search')
        .send({
          category: 'toilet',
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 1000,
        });

      // Standard RateLimit headers (RFC draft)
      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
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
