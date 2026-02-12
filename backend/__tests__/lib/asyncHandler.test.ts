import { describe, it, expect, vi } from 'vitest';
import { asyncHandler } from '../../src/lib/asyncHandler.js';
import type { Request, Response, NextFunction } from 'express';

function mockReqResNext() {
  const req = {} as Request;
  const res = {} as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

describe('asyncHandler', () => {
  it('calls the wrapped function normally', async () => {
    const fn = vi.fn().mockResolvedValue(undefined);
    const wrapped = asyncHandler(fn);
    const { req, res, next } = mockReqResNext();

    wrapped(req, res, next);
    await vi.waitFor(() => {
      expect(fn).toHaveBeenCalledWith(req, res, next);
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('catches errors and passes to next()', async () => {
    const error = new Error('test error');
    const fn = vi.fn().mockRejectedValue(error);
    const wrapped = asyncHandler(fn);
    const { req, res, next } = mockReqResNext();

    wrapped(req, res, next);
    await vi.waitFor(() => {
      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
