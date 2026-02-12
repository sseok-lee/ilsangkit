import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { requestIdMiddleware } from '../../src/middlewares/requestId.js';

describe('requestIdMiddleware', () => {
  it('should generate a new requestId if not provided in headers', () => {
    const req = {
      headers: {},
    } as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBeDefined();
    expect(typeof req.requestId).toBe('string');
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it('should use existing x-request-id from headers if provided', () => {
    const existingRequestId = 'existing-request-id-123';
    const req = {
      headers: {
        'x-request-id': existingRequestId,
      },
    } as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(req.requestId).toBe(existingRequestId);
    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', existingRequestId);
    expect(next).toHaveBeenCalled();
  });

  it('should set X-Request-Id response header', () => {
    const req = {
      headers: {},
    } as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-Request-Id', expect.any(String));
  });

  it('should call next() to continue middleware chain', () => {
    const req = {
      headers: {},
    } as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should generate valid UUID format', () => {
    const req = {
      headers: {},
    } as Request;
    const res = {
      setHeader: vi.fn(),
    } as unknown as Response;
    const next = vi.fn() as NextFunction;

    requestIdMiddleware(req, res, next);

    // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(req.requestId).toMatch(uuidRegex);
  });
});
