// @TASK T0.1 - 앱 기본 테스트
// @TEST __tests__/app.test.ts

import { afterEach, describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import app, { setReleaseReadinessDbCheckForTests } from '../src/app.js';

describe('Express App', () => {
  afterEach(() => {
    delete process.env.ILSK_RELEASE_ID;
    delete process.env.REAL_ESTATE_SUMMARY_MODE;
    delete process.env.REAL_ESTATE_SUMMARY_RUN_ID;
    setReleaseReadinessDbCheckForTests(undefined);
    vi.restoreAllMocks();
  });
  describe('GET /api/health', () => {
    it('should return status ok', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
    });

    it('keeps release metadata inert unless release env is enabled', async () => {
      const response = await request(app).get('/api/health');

      expect(response.headers['x-ilsangkit-release-id']).toBeUndefined();
      expect(response.body).not.toHaveProperty('releaseId');
    });

    it('adds release id header when release env is enabled', async () => {
      process.env.ILSK_RELEASE_ID = 'address-20260929-abc123';

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.headers['x-ilsangkit-release-id']).toBe('address-20260929-abc123');
      expect(response.body).not.toHaveProperty('releaseId');
    });

    it('should return valid timestamp format', async () => {
      const response = await request(app).get('/api/health');

      const timestamp = new Date(response.body.timestamp);
      expect(timestamp).toBeInstanceOf(Date);
      expect(isNaN(timestamp.getTime())).toBe(false);
    });
  });

  describe('GET /api/internal/release-readiness', () => {
    it('is unavailable without release env', async () => {
      const response = await request(app).get('/api/internal/release-readiness');

      expect(response.status).toBe(404);
    });

    it('reports release summary metadata and DB readiness for loopback release probes', async () => {
      process.env.ILSK_RELEASE_ID = 'address-20260929-abc123';
      process.env.REAL_ESTATE_SUMMARY_MODE = 'address';
      process.env.REAL_ESTATE_SUMMARY_RUN_ID = 'summary-run-1';
      setReleaseReadinessDbCheckForTests(
        vi.fn(async () => ({
          mode: 'address',
          table: 'RealEstateBuildingSummaryV2',
          ready: true,
          runId: 'summary-run-1',
          validatedAt: new Date('2026-09-29T00:00:00Z'),
          rowCount: 123,
        }))
      );

      const response = await request(app).get('/api/internal/release-readiness');

      expect(response.status).toBe(200);
      expect(response.headers['x-ilsangkit-release-id']).toBe('address-20260929-abc123');
      expect(response.body).toMatchObject({
        ready: true,
        releaseId: 'address-20260929-abc123',
        summary: { mode: 'address', runId: 'summary-run-1', table: 'RealEstateBuildingSummaryV2', rowCount: 123 },
        db: { ok: true },
      });
    });

    it('fails readiness when DB-backed summary readiness fails', async () => {
      process.env.ILSK_RELEASE_ID = 'address-20260929-abc123';
      setReleaseReadinessDbCheckForTests(
        vi.fn(async () => ({
          mode: 'address',
          table: 'RealEstateBuildingSummaryV2',
          ready: false,
          reason: 'missing-summary-state',
        }))
      );

      const response = await request(app).get('/api/internal/release-readiness');

      expect(response.status).toBe(503);
      expect(response.body.ready).toBe(false);
      expect(response.body.summary).toMatchObject({ reason: 'missing-summary-state' });
      expect(response.body.db).toMatchObject({ ok: false });
    });

    it('rejects proxied public clients even when the backend socket is loopback', async () => {
      process.env.ILSK_RELEASE_ID = 'address-20260929-abc123';
      setReleaseReadinessDbCheckForTests(
        vi.fn(async () => ({
          mode: 'address',
          table: 'RealEstateBuildingSummaryV2',
          ready: true,
          runId: 'summary-run-1',
          validatedAt: new Date('2026-09-29T00:00:00Z'),
          rowCount: 123,
        }))
      );

      const response = await request(app)
        .get('/api/internal/release-readiness')
        .set('X-Forwarded-For', '203.0.113.10');

      expect(response.status).toBe(404);
    });
  });

  describe('404 handler', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/api/unknown');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Not Found');
    });
  });
});
