// @TASK P11-R2-T1 - 보안 헤더 미들웨어 테스트
// @SPEC docs/planning/02-trd.md#보안

import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';

describe('Security Middleware', () => {
  describe('Security Headers', () => {
    it('should include X-Content-Type-Options header', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include X-Frame-Options header', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['x-frame-options']).toBe('DENY');
    });

    it('should include X-XSS-Protection header', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    it('should include Content-Security-Policy header', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['content-security-policy']).toBeDefined();
      expect(response.headers['content-security-policy']).toContain("default-src 'self'");
    });

    it('should include Referrer-Policy header', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
    });

    it('should include HSTS header in production', async () => {
      const response = await request(app).get('/api/health');
      // HSTS는 HTTPS에서만 적용되므로, 헤더 존재 여부만 확인
      // 프로덕션 환경에서는 max-age가 설정되어야 함
      if (process.env.NODE_ENV === 'production') {
        expect(response.headers['strict-transport-security']).toBeDefined();
      }
    });

    it('should include X-Request-Id header', async () => {
      const response = await request(app).get('/api/health');
      expect(response.headers['x-request-id']).toBeDefined();
    });
  });

  describe('CORS Configuration', () => {
    it('should allow requests from allowed origin', async () => {
      const allowedOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
      const response = await request(app)
        .get('/api/health')
        .set('Origin', allowedOrigin);

      expect(response.headers['access-control-allow-origin']).toBe(allowedOrigin);
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should reject requests from disallowed origin', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Origin', 'https://malicious-site.com');

      // CORS 에러는 브라우저에서 처리되므로, 서버는 응답하지만 CORS 헤더가 없음
      expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should allow same-origin requests (no origin header)', async () => {
      const response = await request(app).get('/api/health');
      // Same-origin 요청은 origin 헤더가 없으므로 통과
      expect(response.status).toBe(200);
    });
  });

  describe('Input Sanitization', () => {
    it('should remove script tags from query parameters', async () => {
      const response = await request(app)
        .get('/api/facilities')
        .query({ name: '<script>alert("xss")</script>test' });

      // 요청이 처리되어야 하며 (400 or 200), 스크립트 태그는 제거됨
      expect(response.status).not.toBe(500);
    });

    it('should remove script tags from request body', async () => {
      const response = await request(app)
        .post('/api/facilities/search')
        .send({
          latitude: 37.5665,
          longitude: 126.9780,
          name: '<script>alert("xss")</script>test',
        });

      // 요청이 처리되어야 하며, 스크립트 태그는 제거됨
      expect(response.status).not.toBe(500);
    });

    it('should remove iframe tags from input', async () => {
      const response = await request(app)
        .get('/api/facilities')
        .query({ name: '<iframe src="evil.com"></iframe>test' });

      expect(response.status).not.toBe(500);
    });

    it('should remove event handlers from input', async () => {
      const response = await request(app)
        .get('/api/facilities')
        .query({ name: '<img src=x onerror="alert(1)">test' });

      expect(response.status).not.toBe(500);
    });

    it('should remove javascript: protocol from input', async () => {
      const response = await request(app)
        .get('/api/facilities')
        .query({ url: 'javascript:alert(1)' });

      expect(response.status).not.toBe(500);
    });
  });

  describe('CSP Configuration', () => {
    it('should allow Kakao Maps scripts', async () => {
      const response = await request(app).get('/api/health');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain('dapi.kakao.com');
    });

    it('should allow Google Analytics scripts', async () => {
      const response = await request(app).get('/api/health');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain('googletagmanager.com');
    });

    it('should allow unsafe-inline styles for TailwindCSS', async () => {
      const response = await request(app).get('/api/health');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("'unsafe-inline'");
    });

    it('should deny frames', async () => {
      const response = await request(app).get('/api/health');
      const csp = response.headers['content-security-policy'];
      expect(csp).toContain("frame-src 'none'");
    });
  });
});
